import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { LeadRecord, LeadReceipt, LeadStatus } from "@azelvori/contracts";
import {
  HttpError,
  type Repository,
  type IdempotencyRecord,
  type StaffGrant,
} from "./domain";
import { randomUUID } from "node:crypto";

const conditionalFailure = (e: unknown) =>
  e instanceof Error &&
  (e.name === "ConditionalCheckFailedException" ||
    (e.name === "TransactionCanceledException" &&
      (
        e as Error & { CancellationReasons?: { Code?: string }[] }
      ).CancellationReasons?.some((r) => r.Code === "ConditionalCheckFailed")));
export class DynamoRepository implements Repository {
  constructor(
    private table: string,
    private auditTable: string,
    private client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {}
  private async get(pk: string) {
    return (
      await this.client.send(
        new GetCommand({
          TableName: this.table,
          Key: { pk, sk: "META" },
          ConsistentRead: true,
        }),
      )
    ).Item;
  }
  async findReceipt(key: string) {
    const item = await this.get(`IDEMP#${key}`);
    return item
      ? ({ hash: item.hash, receipt: item.receipt } as IdempotencyRecord)
      : undefined;
  }
  async consumeRate(key: string, now: number) {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { pk: `RATE#${key}`, sk: "META" },
          UpdateExpression: "SET expiresAt = :ttl ADD #count :one",
          ConditionExpression: "attribute_not_exists(#count) OR #count < :max",
          ExpressionAttributeNames: { "#count": "count" },
          ExpressionAttributeValues: {
            ":ttl": Math.floor(now / 1000) + 120,
            ":one": 1,
            ":max": 5,
          },
        }),
      );
      return true;
    } catch (e) {
      if (conditionalFailure(e)) return false;
      throw e;
    }
  }
  async createLead(
    lead: LeadRecord,
    key: string,
    hash: string,
    receipt: LeadReceipt,
  ) {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.table,
                Item: {
                  pk: `LEAD#${lead.leadId}`,
                  sk: "META",
                  gsi1pk: "LEADS",
                  gsi1sk: `${lead.createdAt}#${lead.leadId}`,
                  data: lead,
                },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: this.table,
                Item: {
                  pk: `IDEMP#${key}`,
                  sk: "META",
                  hash,
                  receipt,
                  expiresAt:
                    Math.floor(Date.parse(lead.createdAt) / 1000) + 604800,
                },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: this.auditTable,
                Item: {
                  pk: `LEAD#${lead.leadId}`,
                  sk: `${lead.createdAt}#${randomUUID()}`,
                  action: "lead.created",
                  target: lead.leadId,
                  actor: "public",
                  at: lead.createdAt,
                },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
          ],
        }),
      );
      return true;
    } catch (e) {
      if (conditionalFailure(e)) return false;
      throw e;
    }
  }
  async getStaff(userId: string) {
    const item = await this.get(`STAFF#${userId}`);
    return item?.data as StaffGrant | undefined;
  }
  async listLeads(cursor?: string) {
    let startKey: Record<string, string> | undefined;
    if (cursor) {
      try {
        if (cursor.length > 1500) throw new Error();
        const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
        if (
          Object.keys(decoded).sort().join(",") !== "gsi1pk,gsi1sk,pk,sk" ||
          decoded.gsi1pk !== "LEADS" ||
          decoded.sk !== "META" ||
          typeof decoded.pk !== "string" ||
          !decoded.pk.startsWith("LEAD#") ||
          typeof decoded.gsi1sk !== "string"
        )
          throw new Error();
        startKey = decoded;
      } catch {
        throw new HttpError(400, "INVALID_CURSOR", "รหัสหน้าข้อมูลไม่ถูกต้อง");
      }
    }
    const page = await this.client.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": "LEADS" },
        ScanIndexForward: false,
        Limit: 25,
        ExclusiveStartKey: startKey,
      }),
    );
    return {
      items: (page.Items ?? []).map((i) => i.data as LeadRecord),
      ...(page.LastEvaluatedKey
        ? {
            nextCursor: Buffer.from(
              JSON.stringify(page.LastEvaluatedKey),
            ).toString("base64url"),
          }
        : {}),
    };
  }
  async getLead(id: string) {
    const item = await this.get(`LEAD#${id}`);
    return item?.data as LeadRecord | undefined;
  }
  async changeStatus(lead: LeadRecord, status: LeadStatus, actor: string) {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.table,
                Key: { pk: `LEAD#${lead.leadId}`, sk: "META" },
                UpdateExpression:
                  "SET #data.#status = :status, #data.#version = :next",
                ConditionExpression: "#data.#version = :version",
                ExpressionAttributeNames: {
                  "#data": "data",
                  "#status": "status",
                  "#version": "version",
                },
                ExpressionAttributeValues: {
                  ":status": status,
                  ":next": lead.version + 1,
                  ":version": lead.version,
                },
              },
            },
            {
              Put: {
                TableName: this.auditTable,
                Item: {
                  pk: `LEAD#${lead.leadId}`,
                  sk: `${new Date().toISOString()}#${randomUUID()}`,
                  action: "lead.status.changed",
                  target: lead.leadId,
                  actor,
                  from: lead.status,
                  to: status,
                  version: lead.version + 1,
                },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
          ],
        }),
      );
      return true;
    } catch (e) {
      if (conditionalFailure(e)) return false;
      throw e;
    }
  }
}
