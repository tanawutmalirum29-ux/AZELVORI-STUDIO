import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { awsCli } from "../../scripts/admin-setup";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
const execute = vi.mocked(execFileSync);
const call = awsCli({ region: "ap-southeast-1" });
beforeEach(() => {
  execute.mockReset();
});
describe("AWS CLI private transport", () => {
  it("keeps existing env secrets out of argv and removes the owner-only request file", async () => {
    let path = "";
    execute.mockImplementation((_file, args) => {
      const argv = args as string[];
      expect(argv.join(" ")).not.toContain("secret-canary");
      path = argv[argv.indexOf("--cli-input-json") + 1].replace(
        /^file:\/\//,
        "",
      );
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(statSync(dirname(path)).mode & 0o777).toBe(0o700);
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
        environmentVariables: { PRIVATE: "secret-canary" },
      });
      return "{}";
    });
    await call("amplify", "update-branch", {
      environmentVariables: { PRIVATE: "secret-canary" },
    });
    expect(existsSync(dirname(path))).toBe(false);
  });
  it("cleans up after failure and reports only the AWS machine error code", async () => {
    let path = "";
    execute.mockImplementation((_file, args) => {
      const argv = args as string[];
      path = argv[argv.indexOf("--cli-input-json") + 1].replace(
        /^file:\/\//,
        "",
      );
      throw Object.assign(new Error("secret-canary"), {
        stderr:
          "An error occurred (AccessDeniedException) when calling: secret-canary",
      });
    });
    await expect(call("amplify", "update-branch", {})).rejects.toThrow(
      /^AWS operation failed: AccessDeniedException \(amplify\/update-branch\)$/,
    );
    expect(existsSync(dirname(path))).toBe(false);
  });
  it("only identifies a missing stack from the exact requested stack error", async () => {
    execute.mockImplementation(() => {
      throw Object.assign(new Error(), {
        stderr:
          "An error occurred (ValidationError) when calling the DescribeStacks operation: Stack with id Azelvori-staging does not exist",
      });
    });
    await expect(
      call("cloudformation", "describe-stacks", {
        StackName: "Azelvori-staging",
      }),
    ).rejects.toMatchObject({ code: "StackNotFound" });
    await expect(
      call("cloudformation", "describe-stacks", { StackName: "CDKToolkit" }),
    ).rejects.toMatchObject({ code: "ValidationError" });
  });
});
