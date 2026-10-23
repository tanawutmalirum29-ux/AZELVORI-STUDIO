import { describe, expect, it, vi } from "vitest";
import {
  parseOptions,
  setupAdmin,
  type AwsCall,
  type SetupOptions,
} from "../../scripts/admin-setup";
const sub = "11111111-1111-4111-8111-111111111111";
const options: SetupOptions = {
  account: "123456789012",
  region: "ap-southeast-1",
  stack: "Azelvori-staging",
  email: "owner@example.test",
  apply: false,
};
function fixture() {
  const user = {
    Enabled: true,
    UserStatus: "CONFIRMED",
    UserAttributes: [
      { Name: "sub", Value: sub },
      { Name: "email", Value: options.email },
    ],
  };
  const state = {
    exists: true,
    grant: undefined as unknown,
    account: options.account,
  };
  const outputs = {
    UserPoolId: "ap-southeast-1_TEST",
    OperationsTable: "operations",
    AuditTable: "audit",
    AppOrigin: "https://studio.example.test",
    ApiBaseUrl: "https://api.example.test",
    CognitoAuthority: "https://identity.example.test",
    CognitoClientId: "client",
    CognitoDomain: "https://auth.example.test",
  };
  const call = vi.fn<AwsCall>(async (_service, operation, input) => {
    switch (operation) {
      case "get-caller-identity":
        return {
          Account: state.account,
          Arn: `arn:aws:iam::${state.account}:role/operator`,
        };
      case "describe-stacks":
        return {
          Stacks: [
            {
              StackId: `arn:aws:cloudformation:${options.region}:${options.account}:stack/${options.stack}/id`,
              StackStatus: "UPDATE_COMPLETE",
              Outputs: Object.entries(outputs).map(
                ([OutputKey, OutputValue]) => ({ OutputKey, OutputValue }),
              ),
            },
          ],
        };
      case "admin-get-user":
        if (!state.exists)
          throw Object.assign(new Error("missing"), {
            code: "UserNotFoundException",
          });
        return user;
      case "get-item":
        return { Item: state.grant };
      case "admin-create-user":
        state.exists = true;
        return {
          User: {
            ...user,
            UserStatus: "FORCE_CHANGE_PASSWORD",
            Attributes: user.UserAttributes,
          },
        };
      case "transact-write-items":
        state.grant = (
          input.TransactItems as { Put: { Item: unknown } }[]
        )[0].Put.Item;
        return {};
      default:
        throw new Error(`Unexpected AWS operation: ${operation}`);
    }
  });
  return { call, state, user, outputs };
}
describe("founder provisioning operator boundary", () => {
  it("requires an explicit target and rejects extra or repeated flags", () => {
    expect(() => parseOptions([])).toThrow();
    const args = [
      "--account",
      options.account,
      "--region",
      options.region,
      "--stack",
      options.stack,
      "--email",
      options.email,
    ];
    expect(parseOptions(args).apply).toBe(false);
    expect(() =>
      parseOptions([...args, "--endpoint-url", "http://bad.test"]),
    ).toThrow();
    expect(() =>
      parseOptions([...args, "--account", options.account]),
    ).toThrow();
  });
  it("plans a missing account without sending email or writing a grant", async () => {
    const { call, state } = fixture();
    state.exists = false;
    expect(await setupAdmin(options, call)).toMatchObject({
      mode: "PLAN_ONLY",
      user: "CREATE_AND_EMAIL_INVITATION",
    });
    expect(call.mock.calls.map((c) => c[1])).toEqual([
      "get-caller-identity",
      "describe-stacks",
      "admin-get-user",
    ]);
  });
  it("blocks the wrong AWS account before any other operation", async () => {
    const { call, state } = fixture();
    state.account = "999999999999";
    await expect(setupAdmin({ ...options, apply: true }, call)).rejects.toThrow(
      "does not match",
    );
    expect(call).toHaveBeenCalledOnce();
  });
  it("creates a matching account and atomically writes grant plus actor audit", async () => {
    const { call, state } = fixture();
    state.exists = false;
    expect(await setupAdmin({ ...options, apply: true }, call)).toMatchObject({
      mode: "APPLIED",
      grant: "ACTIVE_VERIFIED",
    });
    const create = call.mock.calls.find(
      (c) => c[1] === "admin-create-user",
    )![2];
    expect(create).toMatchObject({
      DesiredDeliveryMediums: ["EMAIL"],
      ForceAliasCreation: false,
    });
    expect(JSON.stringify(create)).not.toContain("TemporaryPassword");
    expect(JSON.stringify(create)).not.toContain("email_verified");
    const tx = call.mock.calls.find((c) => c[1] === "transact-write-items")![2]
      .TransactItems as {
      Put: { ConditionExpression: string; Item: unknown };
    }[];
    expect(tx).toHaveLength(2);
    expect(
      tx.every((t) => t.Put.ConditionExpression === "attribute_not_exists(pk)"),
    ).toBe(true);
    expect(JSON.stringify(tx[1])).toContain("role/operator");
    expect(JSON.stringify(tx[1])).not.toContain(options.email);
  });
  it("does not overwrite or reactivate a revoked grant", async () => {
    const { call, state } = fixture();
    state.grant = {
      data: {
        M: {
          userId: { S: sub },
          role: { S: "FOUNDER_ADMIN" },
          active: { BOOL: false },
        },
      },
    };
    await expect(setupAdmin({ ...options, apply: true }, call)).rejects.toThrow(
      "refusing",
    );
    expect(call.mock.calls.some((c) => c[1] === "transact-write-items")).toBe(
      false,
    );
  });
  it("reruns with no additional writes or invitations after a verified grant", async () => {
    const { call } = fixture();
    await setupAdmin({ ...options, apply: true }, call);
    call.mockClear();
    expect(await setupAdmin({ ...options, apply: true }, call)).toMatchObject({
      grant: "ACTIVE_VERIFIED",
    });
    expect(call.mock.calls.some((c) => /create|write/.test(c[1]))).toBe(false);
  });
  it("rejects a resolved email alias belonging to a different principal", async () => {
    const { call, user } = fixture();
    user.UserAttributes[1].Value = "different@example.test";
    await expect(setupAdmin({ ...options, apply: true }, call)).rejects.toThrow(
      "exactly match",
    );
    expect(call.mock.calls.some((c) => /create|write/.test(c[1]))).toBe(false);
  });
  it("refuses old stacks without the audit output", async () => {
    const { call, outputs } = fixture();
    outputs.AuditTable = "";
    await expect(setupAdmin({ ...options, apply: true }, call)).rejects.toThrow(
      "AuditTable is missing",
    );
    expect(call.mock.calls.some((c) => /create|write/.test(c[1]))).toBe(false);
  });
});
