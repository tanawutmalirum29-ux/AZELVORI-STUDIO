import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { digest, HttpError } from "./domain";

export type Key = { pk: string; sk: string };
export type Row<T = unknown> = Key & {
  version: number;
  data: T;
  expiresAt?: number;
};
export type Check = Key & { version: number | null; staff?: boolean };
export type Change = {
  checks: Check[];
  puts: Row[];
  audit: Record<string, unknown>;
};
export interface WorkspaceStore {
  get<T>(key: Key): Promise<Row<T> | undefined>;
  page<T>(
    pk: string,
    prefix: string,
    cursor?: string,
    reverse?: boolean,
  ): Promise<{ items: Row<T>[]; nextCursor?: string }>;
  commit(change: Change): Promise<boolean>;
}
export const meta = (pk: string): Key => ({ pk, sk: "META" });
export const row = <T>(key: Key, data: T, version = 1): Row<T> => ({
  ...key,
  data,
  version,
});
export const check = (key: Key, current?: Row): Check => ({
  ...key,
  version: current?.version ?? null,
});
export const cursorEncode = (pk: string, prefix: string, sk: string) =>
  Buffer.from(
    JSON.stringify({ scope: digest(`${pk}|${prefix}`), sk }),
  ).toString("base64url");
export function cursorDecode(
  pk: string,
  prefix: string,
  cursor?: string,
): Key | undefined {
  if (!cursor) return;
  try {
    if (cursor.length > 1000) throw new Error();
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (
      value.scope !== digest(`${pk}|${prefix}`) ||
      typeof value.sk !== "string" ||
      !value.sk.startsWith(prefix) ||
      value.sk.length > 200 ||
      Object.keys(value).sort().join() !== "scope,sk"
    )
      throw new Error();
    return { pk, sk: value.sk };
  } catch {
    throw new HttpError(400, "INVALID_CURSOR", "รหัสหน้าข้อมูลไม่ถูกต้อง");
  }
}
const signature = (k: Key) => `${k.pk}\0${k.sk}`;
export class DynamoWorkspaceStore implements WorkspaceStore {
  constructor(
    private table: string,
    private auditTable: string,
    private client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
  ) {}
  async get<T>(key: Key) {
    return (
      await this.client.send(
        new GetCommand({
          TableName: this.table,
          Key: { pk: key.pk, sk: key.sk },
          ConsistentRead: true,
        }),
      )
    ).Item as Row<T> | undefined;
  }
  async page<T>(pk: string, prefix: string, cursor?: string, reverse = false) {
    const data = await this.client.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": pk, ":prefix": prefix },
        ConsistentRead: true,
        Limit: 25,
        ScanIndexForward: !reverse,
        ExclusiveStartKey: cursorDecode(pk, prefix, cursor),
      }),
    );
    return {
      items: (data.Items ?? []) as Row<T>[],
      ...(data.LastEvaluatedKey
        ? { nextCursor: cursorEncode(pk, prefix, data.LastEvaluatedKey.sk) }
        : {}),
    };
  }
  async commit(change: Change) {
    const putKeys = new Set(change.puts.map(signature));
    if (putKeys.size !== change.puts.length)
      throw new Error("Duplicate transaction target");
    const conditions = new Map(change.checks.map((c) => [signature(c), c]));
    const condition = (
      c: Check,
    ): {
      ConditionExpression: string;
      ExpressionAttributeNames?: Record<string, string>;
      ExpressionAttributeValues?: Record<string, unknown>;
    } =>
      c.staff
        ? {
            ConditionExpression: "#d.#a = :yes AND #d.#r = :role",
            ExpressionAttributeNames: {
              "#d": "data",
              "#a": "active",
              "#r": "role",
            },
            ExpressionAttributeValues: {
              ":yes": true,
              ":role": "FOUNDER_ADMIN",
            },
          }
        : c.version === null
          ? { ConditionExpression: "attribute_not_exists(pk)" }
          : {
              ConditionExpression: "#v = :v",
              ExpressionAttributeNames: { "#v": "version" },
              ExpressionAttributeValues: { ":v": c.version },
            };
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            ...[...conditions.values()]
              .filter((c) => !putKeys.has(signature(c)))
              .map((c) => ({
                ConditionCheck: {
                  TableName: this.table,
                  Key: { pk: c.pk, sk: c.sk },
                  ...condition(c),
                },
              })),
            ...change.puts.map((p) => ({
              Put: {
                TableName: this.table,
                Item: p,
                ...condition(
                  conditions.get(signature(p)) ?? { ...p, version: null },
                ),
              },
            })),
            {
              Put: {
                TableName: this.auditTable,
                Item: change.audit,
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
          ],
        }),
      );
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "TransactionCanceledException" &&
        (
          error as Error & { CancellationReasons?: { Code?: string }[] }
        ).CancellationReasons?.some((r) => r.Code === "ConditionalCheckFailed")
      )
        return false;
      throw error;
    }
  }
}
