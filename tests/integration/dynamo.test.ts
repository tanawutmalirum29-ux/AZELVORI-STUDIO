import { describe, expect, it, vi } from "vitest";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoRepository } from "../../services/api/src/dynamo";
import { validLead } from "../fixtures";
const lead = {
  ...validLead,
  leadId: "LEAD-TEST",
  createdAt: "2026-10-23T12:00:00.000Z",
  status: "NEW" as const,
  version: 1,
};
describe("Dynamo persistence contract", () => {
  it("writes lead, idempotency and append-only audit in one conditional transaction", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repo = new DynamoRepository("data", "audit", {
      send,
    } as unknown as DynamoDBDocumentClient);
    expect(
      await repo.createLead(lead, "key", "hash", {
        leadId: lead.leadId,
        receivedAt: lead.createdAt,
        status: "RECEIVED",
      }),
    ).toBe(true);
    const input = send.mock.calls[0][0].input;
    expect(input.TransactItems).toHaveLength(3);
    expect(
      input.TransactItems.every(
        (t: { Put: { ConditionExpression: string } }) =>
          t.Put.ConditionExpression === "attribute_not_exists(pk)",
      ),
    ).toBe(true);
    expect(input.TransactItems[2].Put.TableName).toBe("audit");
    expect(JSON.stringify(input.TransactItems[2])).not.toContain(
      validLead.contactEmail,
    );
  });
  it("does not mistake transient AWS failures for duplicate success", async () => {
    const send = vi.fn().mockRejectedValue(
      Object.assign(new Error("throttled"), {
        name: "ProvisionedThroughputExceededException",
      }),
    );
    const repo = new DynamoRepository("data", "audit", {
      send,
    } as unknown as DynamoDBDocumentClient);
    await expect(
      repo.createLead(lead, "k", "h", {
        leadId: lead.leadId,
        receivedAt: lead.createdAt,
        status: "RECEIVED",
      }),
    ).rejects.toThrow("throttled");
  });
  it("recognizes a conditional transaction collision", async () => {
    const send = vi.fn().mockRejectedValue(
      Object.assign(new Error("collision"), {
        name: "TransactionCanceledException",
        CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
      }),
    );
    const repo = new DynamoRepository("data", "audit", {
      send,
    } as unknown as DynamoDBDocumentClient);
    expect(
      await repo.createLead(lead, "k", "h", {
        leadId: lead.leadId,
        receivedAt: lead.createdAt,
        status: "RECEIVED",
      }),
    ).toBe(false);
  });
  it("uses strongly consistent reads for grants", async () => {
    const send = vi.fn().mockResolvedValue({});
    await new DynamoRepository("data", "audit", {
      send,
    } as unknown as DynamoDBDocumentClient).getStaff("actor");
    expect(send.mock.calls[0][0].input).toMatchObject({
      Key: { pk: "STAFF#actor", sk: "META" },
      ConsistentRead: true,
    });
  });
  it("commits private notes only with a current founder grant and lead version, without notes in audit", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repo = new DynamoRepository("data", "audit", {
      send,
    } as unknown as DynamoDBDocumentClient);
    await repo.saveFollowUp(
      lead,
      {
        note: "private-note",
        priority: "HIGH",
        followUpDate: "2026-11-01",
        updatedAt: lead.createdAt,
      },
      "actor",
    );
    const tx = send.mock.calls[0][0].input.TransactItems;
    expect(tx[0].ConditionCheck).toMatchObject({
      Key: { pk: "STAFF#actor", sk: "META" },
      ExpressionAttributeValues: { ":active": true, ":role": "FOUNDER_ADMIN" },
    });
    expect(tx[1].Update).toMatchObject({
      ConditionExpression: "#data.#version = :version",
      ExpressionAttributeValues: { ":version": 1, ":next": 2 },
    });
    expect(tx[2].Put.Item.action).toBe("lead.followup.changed");
    expect(JSON.stringify(tx[2])).not.toContain("private-note");
    send.mockClear();
    await repo.changeStatus(lead, "ACKNOWLEDGED", "actor");
    expect(send.mock.calls[0][0].input.TransactItems[0].ConditionCheck).toEqual(
      tx[0].ConditionCheck,
    );
  });
  it("rejects a forged cursor before accessing the database", async () => {
    const send = vi.fn();
    const repo = new DynamoRepository("data", "audit", {
      send,
    } as unknown as DynamoDBDocumentClient);
    const cursor = Buffer.from(
      JSON.stringify({
        pk: "STAFF#actor",
        sk: "META",
        gsi1pk: "STAFF",
        gsi1sk: "fake",
      }),
    ).toString("base64url");
    await expect(repo.listLeads(cursor)).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });
    expect(send).not.toHaveBeenCalled();
  });
});
