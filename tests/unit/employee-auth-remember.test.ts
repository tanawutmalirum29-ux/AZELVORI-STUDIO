import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class { send = sdk.send; },
  InitiateAuthCommand: class { constructor(public input: any) {} },
  RevokeTokenCommand: class { constructor(public input: any) {} },
}));
vi.mock("../../apps/web/src/lib/api", () => ({
  api: vi.fn(async () => ({
    poolId: "ap-southeast-2_TEST", clientId: "employee-client", region: "ap-southeast-2",
  })),
}));
let tab: Map<string, string>;
let device: Map<string, string>;
beforeEach(() => {
  vi.resetModules(); sdk.send.mockReset();
  tab = new Map(); device = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => tab.get(key) ?? null,
    setItem: (key: string, val: string) => tab.set(key, val),
    removeItem: (key: string) => tab.delete(key),
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => device.get(key) ?? null,
    setItem: (key: string, val: string) => device.set(key, val),
    removeItem: (key: string) => device.delete(key),
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const tokens = {
  AccessToken: "employee-access", RefreshToken: "employee-refresh", ExpiresIn: 300,
};
describe("employee remembered device", () => {
  it("restores trusted employee after a browser restart using refresh only", async () => {
    sdk.send.mockResolvedValueOnce({ AuthenticationResult: tokens });
    const auth = await import("../../apps/web/src/lib/employee-auth");
    await auth.employeeLogin("00001", "AZb-2-00001-test-password", true);
    expect(auth.employeeSessionExists()).toBe(true);
    const persistent = JSON.stringify([...device.values()]);
    expect(persistent).toContain("employee-refresh");
    expect(persistent).not.toContain("employee-access");
    expect(persistent).not.toContain("test-password");
    tab.clear();
    expect(auth.employeeSessionExists()).toBe(true);
    sdk.send.mockResolvedValueOnce({
      AuthenticationResult: { AccessToken: "renewed-access", ExpiresIn: 300 },
    });
    expect(await auth.employeeAccessToken()).toBe("renewed-access");
    expect(sdk.send.mock.calls[1][0].input.AuthFlow).toBe("REFRESH_TOKEN_AUTH");
    expect(sdk.send.mock.calls[1][0].input.AuthParameters.REFRESH_TOKEN)
      .toBe("employee-refresh");
    expect((JSON.parse([...device.values()][0]) as Record<string,string>).access).toBeUndefined();
  });
  it("does not survive tab closure when remember is disabled", async () => {
    sdk.send.mockResolvedValueOnce({ AuthenticationResult: tokens });
    const auth = await import("../../apps/web/src/lib/employee-auth");
    await auth.employeeLogin("00001", "AZb-2-00001-test-password", false);
    expect(device.size).toBe(0);
    tab.clear();
    expect(auth.employeeSessionExists()).toBe(false);
  });
  it("keeps refresh token on temporary connection failure then retries", async () => {
    sdk.send.mockResolvedValueOnce({ AuthenticationResult: tokens });
    const auth = await import("../../apps/web/src/lib/employee-auth");
    await auth.employeeLogin("00001", "AZb-2-00001-test-password", true);
    tab.clear();
    sdk.send.mockRejectedValueOnce(new Error("NetworkError"));
    await expect(auth.employeeAccessToken()).rejects.toThrow("NetworkError");
    expect(auth.employeeSessionExists()).toBe(true);
    sdk.send.mockResolvedValueOnce({
      AuthenticationResult: { AccessToken: "recovered", ExpiresIn: 300 },
    });
    expect(await auth.employeeAccessToken()).toBe("recovered");
  });
  it("clears both stores on Cognito revocation or manual logout", async () => {
    sdk.send.mockResolvedValueOnce({ AuthenticationResult: tokens });
    const auth = await import("../../apps/web/src/lib/employee-auth");
    await auth.employeeLogin("00001", "AZb-2-00001-test-password", true);
    tab.clear();
    const rejected = new Error("User is disabled");
    rejected.name = "NotAuthorizedException";
    sdk.send.mockRejectedValueOnce(rejected);
    await expect(auth.employeeAccessToken()).rejects.toThrow();
    expect(auth.employeeSessionExists()).toBe(false);
    expect(device.size).toBe(0);
    sdk.send.mockResolvedValueOnce({ AuthenticationResult: tokens });
    await auth.employeeLogin("00001", "AZb-2-00001-test-password", true);
    sdk.send.mockResolvedValueOnce({});
    await auth.employeeLogout();
    expect(device.size).toBe(0);
    expect(tab.size).toBe(0);
  });
});
