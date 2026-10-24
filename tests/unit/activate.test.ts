import { describe, expect, it, vi } from "vitest";
import {
  activate,
  cdkArguments,
  parseActivationOptions,
  target,
  type ActivationOptions,
} from "../../scripts/activate";
import { AwsFailure, type AwsCall } from "../../scripts/admin-setup";

const account = "123456789012",
  region = "ap-southeast-1";
const options: ActivationOptions = {
  region,
  email: "owner@example.test",
  check: false,
};
const sub = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const outputs: Record<string, string> = {
    AppOrigin: target.origin,
    IntakeEnabled: "false",
    UserPoolId: `${region}_TEST`,
    ApiBaseUrl: `https://abc123.execute-api.${region}.amazonaws.com`,
    CognitoAuthority: `https://cognito-idp.${region}.amazonaws.com/${region}_TEST`,
    CognitoDomain: `https://azelvori-staging-${account}.auth.${region}.amazoncognito.com`,
    CognitoClientId: "client",
    OperationsTable: "operations",
    AuditTable: "audit",
  };
  const stack = () => ({
    StackId: `arn:aws:cloudformation:${region}:${account}:stack/${target.stack}/id`,
    StackStatus: "CREATE_COMPLETE",
    Tags: [
      { Key: "Project", Value: "AZELVORI-STUDIO" },
      { Key: "Environment", Value: "staging" },
    ],
    Outputs: Object.entries(outputs).map(([OutputKey, OutputValue]) => ({
      OutputKey,
      OutputValue,
    })),
  });
  const app: Record<string, unknown> = {
    appId: target.appId,
    appArn: `arn:aws:amplify:${region}:${account}:apps/${target.appId}`,
    defaultDomain: `${target.appId}.amplifyapp.com`,
    repository: `${target.repository}.git`,
    environmentVariables: { EXISTING_APP_SECRET: "app-secret-canary" },
  };
  const branch: Record<string, unknown> = {
    branchName: "main",
    branchArn: `${app.appArn}/branches/main`,
    activeJobId: "9",
    environmentVariables: { EXISTING_BRANCH_SECRET: "branch-secret-canary" },
  };
  const state = {
    exists: false,
    userExists: false,
    grant: undefined as unknown,
    limit: 1000,
    statuses: ["RUNNING", "SUCCEED"],
    priorJobStatus: "SUCCEED",
    corruptUpdate: false,
  };
  const aws = vi.fn<AwsCall>(async (_service, operation, input) => {
    switch (operation) {
      case "get-caller-identity":
        return {
          Account: account,
          Arn: `arn:aws:iam::${account}:role/operator`,
        };
      case "get-app":
        return { app: structuredClone(app) };
      case "get-branch":
        return { branch: structuredClone(branch) };
      case "describe-stacks":
        if (input.StackName === "CDKToolkit" || !state.exists)
          throw new AwsFailure("StackNotFound");
        return { Stacks: [stack()] };
      case "get-account-settings":
        return {
          AccountLimit: { UnreservedConcurrentExecutions: state.limit },
        };
      case "admin-get-user":
        if (!state.userExists) throw new AwsFailure("UserNotFoundException");
        return {
          Enabled: true,
          UserStatus: "FORCE_CHANGE_PASSWORD",
          UserAttributes: [
            { Name: "sub", Value: sub },
            { Name: "email", Value: options.email },
          ],
        };
      case "admin-create-user":
        state.userExists = true;
        return {
          User: {
            Enabled: true,
            UserStatus: "FORCE_CHANGE_PASSWORD",
            Attributes: [
              { Name: "sub", Value: sub },
              { Name: "email", Value: options.email },
            ],
          },
        };
      case "get-item":
        return { Item: state.grant };
      case "transact-write-items":
        state.grant = (
          input.TransactItems as { Put: { Item: unknown } }[]
        )[0].Put.Item;
        return {};
      case "update-branch":
        branch.environmentVariables = structuredClone(
          input.environmentVariables,
        );
        if (state.corruptUpdate)
          delete (branch.environmentVariables as Record<string, string>)
            .EXISTING_BRANCH_SECRET;
        return { branch: structuredClone(branch) };
      case "start-job":
        return { jobSummary: { jobId: "10" } };
      case "get-job":
        return {
          job: {
            summary: {
              status:
                input.jobId === "9"
                  ? state.priorJobStatus
                  : state.statuses.length > 1
                    ? state.statuses.shift()
                    : state.statuses[0],
            },
          },
        };
      default:
        throw new Error(`Unexpected ${operation}`);
    }
  });
  const deps = {
    aws,
    confirm: vi.fn(async () => true),
    deploy: vi.fn(async () => {
      state.exists = true;
    }),
    health: vi.fn(async (_url: string) => ({
      status: "ok",
      service: "azelvori-api",
      schemaVersion: 2,
      capabilities: ["crm-follow-up", "private-workspace"],
      intakeEnabled: false,
    })),
    wait: vi.fn(async () => {}),
    report: vi.fn(),
    pollAttempts: 3,
  };
  const writes = () =>
    aws.mock.calls.filter((call) =>
      /^(admin-create|transact-write|update|start)/.test(call[1]),
    );
  return { deps, state, app, branch, outputs, writes };
}
describe("guided AWS activation", () => {
  it("validates flags and never accepts an automatic yes or another target", () => {
    expect(parseActivationOptions(["--check"], region)).toEqual({
      check: true,
      region,
    });
    expect(() => parseActivationOptions(["--yes"], region)).toThrow();
    expect(() =>
      parseActivationOptions(["--app-id", "other"], region),
    ).toThrow();
    expect(() =>
      parseActivationOptions(["--region", region, "--region", region]),
    ).toThrow();
  });
  it("checks or cancels without creating resources, accounts, environment changes or builds", async () => {
    const f = fixture();
    expect(
      await activate({ ...options, check: true, email: undefined }, f.deps),
    ).toEqual({ mode: "CHECK_ONLY" });
    expect(f.deps.confirm).not.toHaveBeenCalled();
    f.deps.confirm.mockResolvedValue(false);
    expect(await activate(options, f.deps)).toEqual({ mode: "CANCELLED" });
    expect(f.deps.deploy).not.toHaveBeenCalled();
    expect(f.writes()).toEqual([]);
  });
  it.each(["appArn", "repository", "defaultDomain", "appId"])(
    "rejects an incorrect %s before confirmation or writes",
    async (field) => {
      const f = fixture();
      f.app[field] = "wrong-target";
      await expect(activate(options, f.deps)).rejects.toThrow("ไม่ตรง");
      expect(f.deps.confirm).not.toHaveBeenCalled();
      expect(f.writes()).toEqual([]);
    },
  );
  it("blocks another branch and does not race an active Amplify build", async () => {
    const f = fixture();
    f.branch.branchName = "other";
    await expect(activate(options, f.deps)).rejects.toThrow("branch main");
    f.branch.branchName = "main";
    f.state.priorJobStatus = "RUNNING";
    await expect(activate(options, f.deps)).rejects.toThrow("กำลัง build");
    expect(f.writes()).toEqual([]);
  });
  it("treats denied reads as failures, never as missing resources", async () => {
    const f = fixture();
    f.deps.aws.mockRejectedValue(new AwsFailure("AccessDeniedException"));
    await expect(activate(options, f.deps)).rejects.toThrow("AccessDenied");
    expect(f.deps.deploy).not.toHaveBeenCalled();
    expect(f.deps.confirm).not.toHaveBeenCalled();
  });
  it("stops before creating any resources if Lambda reservation would exceed quota", async () => {
    const f = fixture();
    f.state.limit = 104;
    await expect(activate(options, f.deps)).rejects.toThrow("concurrency");
    expect(f.deps.deploy).not.toHaveBeenCalled();
    expect(f.writes()).toEqual([]);
  });
  it.each(["true", ""])(
    "does not reset an active or older stack with IntakeEnabled=%s",
    async (value) => {
      const f = fixture();
      f.state.exists = true;
      f.outputs.IntakeEnabled = value;
      await expect(activate(options, f.deps)).rejects.toThrow("IntakeEnabled");
      expect(f.deps.deploy).not.toHaveBeenCalled();
      expect(f.writes()).toEqual([]);
    },
  );
  it("does not repoint a configured frontend to a new backend", async () => {
    const f = fixture();
    (
      f.branch.environmentVariables as Record<string, string>
    ).VITE_API_BASE_URL = "https://other.example.test";
    await expect(activate(options, f.deps)).rejects.toThrow(
      "VITE_API_BASE_URL",
    );
    expect(f.deps.deploy).not.toHaveBeenCalled();
    expect(f.writes()).toEqual([]);
  });
  it("revalidates environment values after the operator confirms", async () => {
    const f = fixture();
    f.deps.confirm.mockImplementation(async () => {
      (f.app.environmentVariables as Record<string, string>).NEW_VALUE =
        "concurrent-edit";
      return true;
    });
    await expect(activate(options, f.deps)).rejects.toThrow(
      "เปลี่ยนระหว่างยืนยัน",
    );
    expect(f.deps.deploy).not.toHaveBeenCalled();
    expect(f.writes()).toEqual([]);
  });
  it("requires both API capabilities before provisioning an owner or publishing", async () => {
    const f = fixture();
    f.deps.health.mockResolvedValue({
      status: "ok",
      service: "azelvori-api",
      schemaVersion: 2,
      capabilities: [],
      intakeEnabled: false,
    });
    await expect(activate(options, f.deps)).rejects.toThrow("API");
    expect(f.state.exists).toBe(true);
    expect(f.writes()).toEqual([]);
  });
  it("creates the real grant, preserves unrelated env, and waits for a successful release", async () => {
    const f = fixture();
    expect(await activate(options, f.deps)).toEqual({
      mode: "DEPLOYED",
      jobId: "10",
      adminUrl: `${target.origin}/admin/login`,
    });
    expect(f.deps.deploy).toHaveBeenCalledWith(
      expect.objectContaining({
        account,
        region,
        bootstrap: true,
        backend: "CREATE",
      }),
    );
    expect(f.branch.environmentVariables).toMatchObject({
      EXISTING_BRANCH_SECRET: "branch-secret-canary",
      VITE_PUBLIC_INTAKE_ENABLED: "false",
      VITE_API_BASE_URL: f.outputs.ApiBaseUrl,
    });
    expect(f.app.environmentVariables).toEqual({
      EXISTING_APP_SECRET: "app-secret-canary",
    });
    expect(f.writes().map((c) => c[1])).toEqual([
      "admin-create-user",
      "transact-write-items",
      "update-branch",
      "start-job",
    ]);
    expect(f.deps.wait).toHaveBeenCalledOnce();
    expect(JSON.stringify(f.deps.report.mock.calls)).not.toContain(
      "secret-canary",
    );
    expect(JSON.stringify(f.deps.confirm.mock.calls)).not.toContain(
      "secret-canary",
    );
  });
  it("resumes a failed build without redeploying the backend or reinviting the owner", async () => {
    const f = fixture();
    f.state.statuses = ["FAILED"];
    await expect(activate(options, f.deps)).rejects.toThrow("job 10 ไม่สำเร็จ");
    expect(f.state.userExists).toBe(true);
    f.deps.aws.mockClear();
    f.deps.deploy.mockClear();
    f.state.statuses = ["SUCCEED"];
    expect((await activate(options, f.deps)).mode).toBe("DEPLOYED");
    expect(f.deps.deploy).not.toHaveBeenCalled();
    expect(f.writes().map((c) => c[1])).toEqual(["start-job"]);
  });
  it("refuses a revoked owner grant before any Amplify change", async () => {
    const f = fixture();
    f.state.exists = true;
    f.state.userExists = true;
    f.state.grant = {
      data: {
        M: {
          userId: { S: sub },
          role: { S: "FOUNDER_ADMIN" },
          active: { BOOL: false },
        },
      },
    };
    await expect(activate(options, f.deps)).rejects.toThrow("revoked");
    expect(f.writes()).toEqual([]);
  });
  it("does not start a release if verification detects lost environment values", async () => {
    const f = fixture();
    f.state.corruptUpdate = true;
    await expect(activate(options, f.deps)).rejects.toThrow(
      "ตรวจค่าหลังบันทึก",
    );
    expect(f.writes().some((c) => c[1] === "start-job")).toBe(false);
  });
  it("reports a bounded timeout without falsely announcing success or destroying resources", async () => {
    const f = fixture();
    f.state.statuses = ["RUNNING"];
    await expect(activate(options, f.deps)).rejects.toThrow("หมดเวลารอ");
    expect(f.deps.wait).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(f.deps.report.mock.calls)).not.toContain(
      "เผยแพร่สำเร็จ",
    );
    expect(f.state.exists).toBe(true);
    expect(f.state.userExists).toBe(true);
  });
  it("uses the reviewed account/profile and keeps IAM review plus public intake closed", () => {
    const commands = cdkArguments(
      { account, region, backend: "CREATE", bootstrap: true },
      "studio",
    );
    expect(commands.bootstrap).toContain(`aws://${account}/${region}`);
    expect(commands.deploy).toEqual(
      expect.arrayContaining([
        "stage=staging",
        "intakeEnabled=false",
        "legalReady=false",
        "--require-approval",
        "broadening",
        "--profile",
        "studio",
      ]),
    );
  });
});
