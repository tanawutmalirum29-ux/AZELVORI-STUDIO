import { describe, it, expect, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import {
  DynamoWorkspaceStore,
  meta,
  row,
  check,
  cursorEncode,
} from "../../services/api/src/workspace-store";
import { CognitoIdentity } from "../../services/api/src/identity";
describe("workspace AWS command contracts", () => {
  it("turns a revoked Cognito token into a login-required response", async () => {
    const send = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error(), { name: "NotAuthorizedException" }),
      );
    const identity = new CognitoIdentity("pool", {
      send,
    } as unknown as CognitoIdentityProviderClient);
    await expect(
      identity.current({ sub: "me", token: "revoked" }),
    ).rejects.toMatchObject({ status: 401, code: "SESSION_EXPIRED" });
  });
  it("uses strongly consistent partition reads and avoids unscoped scans", async () => {
    const send = vi.fn().mockResolvedValue({ Items: [] }),
      s = new DynamoWorkspaceStore("data", "audit", {
        send,
      } as unknown as DynamoDBDocumentClient);
    await s.get(meta("PROJECT#test"));
    await s.page("PROJECT#test", "MSG#");
    expect(send.mock.calls[0][0].input.ConsistentRead).toBe(true);
    expect(send.mock.calls[1][0].input).toMatchObject({
      ConsistentRead: true,
      Limit: 25,
      ExpressionAttributeValues: { ":pk": "PROJECT#test", ":prefix": "MSG#" },
    });
    await s.get(row(meta("INVITE#test"), { state: "ACCEPTED" }, 2));
    expect(send.mock.calls[2][0].input.Key).toEqual({
      pk: "INVITE#test",
      sk: "META",
    });
  });
  it("combines a changed row's condition with its Put instead of targeting it twice", async () => {
    const send = vi.fn().mockResolvedValue({}),
      s = new DynamoWorkspaceStore("data", "audit", {
        send,
      } as unknown as DynamoDBDocumentClient),
      old = row(meta("PROJECT#test"), {}, 2);
    await s.commit({
      checks: [
        check(old, old),
        { ...meta("STAFF#owner"), version: null, staff: true },
      ],
      puts: [row(old, {}, 3)],
      audit: { pk: "PROJECT#test", sk: "audit-one" },
    });
    const tx = send.mock.calls[0][0].input.TransactItems;
    expect(tx).toHaveLength(3);
    expect(tx[0].ConditionCheck.ConditionExpression).toContain("#d.#a = :yes");
    expect(tx[1].Put).toMatchObject({
      ConditionExpression: "#v = :v",
      ExpressionAttributeValues: { ":v": 2 },
      Item: { version: 3 },
    });
    expect(tx[2].Put.TableName).toBe("audit");
  });
  it("does not mistake throttling for a conditional conflict", async () => {
    const send = vi.fn().mockRejectedValue(
        Object.assign(new Error("provider failure"), {
          name: "TransactionCanceledException",
          CancellationReasons: [{ Code: "ProvisionedThroughputExceeded" }],
        }),
      ),
      s = new DynamoWorkspaceStore("data", "audit", {
        send,
      } as unknown as DynamoDBDocumentClient);
    await expect(s.commit({ checks: [], puts: [], audit: {} })).rejects.toThrow(
      "provider failure",
    );
  });
  it("rejects foreign cursors before querying DynamoDB", async () => {
    const send = vi.fn(),
      s = new DynamoWorkspaceStore("data", "audit", {
        send,
      } as unknown as DynamoDBDocumentClient);
    await expect(
      s.page("PROJECT#A", "MSG#", cursorEncode("PROJECT#B", "MSG#", "MSG#x")),
    ).rejects.toMatchObject({ status: 400 });
    expect(send).not.toHaveBeenCalled();
  });
  it("binds Cognito attributes to the validated subject", async () => {
    const send = vi.fn().mockResolvedValue({
        UserAttributes: [
          { Name: "sub", Value: "other" },
          { Name: "email", Value: "other@example.com" },
          { Name: "email_verified", Value: "true" },
        ],
      }),
      id = new CognitoIdentity("pool", {
        send,
      } as unknown as CognitoIdentityProviderClient);
    await expect(
      id.current({ sub: "me", token: "token" }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("never marks an invited email as verified or takes over another alias", async () => {
    const send = vi
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error(), { name: "UserNotFoundException" }),
        )
        .mockResolvedValueOnce({}),
      id = new CognitoIdentity("pool", {
        send,
      } as unknown as CognitoIdentityProviderClient);
    expect(await id.ensureAccount("customer@example.com")).toBe("CREATED");
    const cmd = send.mock.calls[1][0].input;
    expect(cmd).toMatchObject({
      DesiredDeliveryMediums: ["EMAIL"],
      ForceAliasCreation: false,
      UserPoolId: "pool",
    });
    expect(JSON.stringify(cmd)).not.toContain("email_verified");
    expect(cmd).not.toHaveProperty("TemporaryPassword");
  });
  it("does not resend onboarding email to existing accounts on retries", async () => {
    const send = vi.fn().mockResolvedValue({}),
      id = new CognitoIdentity("pool", {
        send,
      } as unknown as CognitoIdentityProviderClient);
    expect(await id.ensureAccount("customer@example.com")).toBe("EXISTING");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("does not hide Cognito delivery failures", async () => {
    const send = vi
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error(), { name: "UserNotFoundException" }),
        )
        .mockRejectedValueOnce(new Error("delivery unavailable")),
      id = new CognitoIdentity("pool", {
        send,
      } as unknown as CognitoIdentityProviderClient);
    await expect(id.ensureAccount("customer@example.com")).rejects.toThrow(
      "delivery unavailable",
    );
  });
  it("maps invalid verification codes to a user-visible validation error", async () => {
    const send = vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error(), { name: "CodeMismatchException" }),
        ),
      id = new CognitoIdentity("pool", {
        send,
      } as unknown as CognitoIdentityProviderClient);
    await expect(
      id.verify({ sub: "me", token: "token" }, "123456"),
    ).rejects.toMatchObject({ status: 422, code: "INVALID_CODE" });
  });
});
