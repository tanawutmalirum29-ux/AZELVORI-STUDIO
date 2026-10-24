import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class { send = sdk.send; },
  InitiateAuthCommand: class { constructor(public input: unknown) {} },
  RespondToAuthChallengeCommand: class { constructor(public input: unknown) {} },
  AssociateSoftwareTokenCommand: class { constructor(public input: unknown) {} },
  VerifySoftwareTokenCommand: class { constructor(public input: unknown) {} },
  ForgotPasswordCommand: class { constructor(public input: unknown) {} },
  ConfirmForgotPasswordCommand: class { constructor(public input: unknown) {} },
  RevokeTokenCommand: class { constructor(public input: unknown) {} },
}));

let store: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  sdk.send.mockReset();
  vi.stubEnv("VITE_COGNITO_AUTHORITY", "https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_TEST");
  vi.stubEnv("VITE_COGNITO_CLIENT_ID", "public-client");
  store = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const tokens = {
  AccessToken: "access-example", IdToken: "id-example",
  RefreshToken: "refresh-example", ExpiresIn: 300,
};

describe("Cognito first-party identity contract", () => {
  it("completes a two-factor TOTP challenge without persisting the password", async () => {
    sdk.send.mockResolvedValueOnce({
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: "session-one", ChallengeParameters: { USERNAME: "user-sub" },
    }).mockResolvedValueOnce({ AuthenticationResult: tokens });
    const auth = await import("../../apps/web/src/lib/direct-auth");
    const step = await auth.startNativeLogin("User@Example.COM", "secret-not-in-storage");
    expect(sdk.send.mock.calls[0][0].input).toEqual({
      ClientId: "public-client", AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "user@example.com", PASSWORD: "secret-not-in-storage" },
    });
    expect(step).toMatchObject({ kind: "totp", username: "user-sub" });
    if (step.kind !== "totp") throw new Error("expected TOTP");
    expect(await auth.answerNativeChallenge(step, "123456")).toEqual({ kind: "done" });
    expect(sdk.send.mock.calls[1][0].input).toMatchObject({
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      ChallengeResponses: { USERNAME: "user-sub", SOFTWARE_TOKEN_MFA_CODE: "123456" },
    });
    expect(await auth.nativeAccessToken()).toBe(tokens.AccessToken);
    expect(JSON.stringify([...store.values()])).not.toContain("secret-not-in-storage");
  });
  it("requires verification before completing MFA setup", async () => {
    sdk.send.mockResolvedValueOnce({
      ChallengeName: "MFA_SETUP", Session: "session-a", ChallengeParameters: { USERNAME: "user-a" },
    }).mockResolvedValueOnce({ SecretCode: "AUTHENTICATOR-SECRET", Session: "session-b" })
      .mockResolvedValueOnce({ Status: "SUCCESS", Session: "session-c" })
      .mockResolvedValueOnce({ AuthenticationResult: tokens });
    const auth = await import("../../apps/web/src/lib/direct-auth");
    const step = await auth.startNativeLogin("user@example.com", "password");
    expect(step).toMatchObject({ kind: "setup", secret: "AUTHENTICATOR-SECRET" });
    if (step.kind !== "setup") throw new Error("expected setup");
    expect(await auth.answerNativeChallenge(step, "123456")).toEqual({ kind: "done" });
    expect(sdk.send.mock.calls[2][0].input).toMatchObject({ Session: "session-b", UserCode: "123456" });
    expect(sdk.send.mock.calls[3][0].input).toMatchObject({
      ChallengeName: "MFA_SETUP", Session: "session-c",
    });
    expect(JSON.stringify([...store.values()])).not.toContain("AUTHENTICATOR-SECRET");
  });
  it("supports new-password challenge and does not retain new password", async () => {
    sdk.send.mockResolvedValueOnce({
      ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "temp-session",
    }).mockResolvedValueOnce({ AuthenticationResult: tokens });
    const auth = await import("../../apps/web/src/lib/direct-auth");
    const step = await auth.startNativeLogin("user@example.com", "temporary");
    if (step.kind !== "new-password") throw new Error("expected password change");
    expect(await auth.answerNativeChallenge(step, "a-memorable-passphrase")).toEqual({ kind: "done" });
    expect(sdk.send.mock.calls[1][0].input.ChallengeResponses.NEW_PASSWORD).toBe("a-memorable-passphrase");
    expect(JSON.stringify([...store.values()])).not.toContain("a-memorable-passphrase");
  });
  it("uses one on-demand token refresh and clears session on logout", async () => {
    sdk.send.mockResolvedValueOnce({ AuthenticationResult: tokens });
    const auth = await import("../../apps/web/src/lib/direct-auth");
    expect(await auth.startNativeLogin("user@example.com", "pass")).toEqual({ kind: "done" });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 295000);
    sdk.send.mockResolvedValueOnce({
      AuthenticationResult: { AccessToken: "refreshed", IdToken: "id-new", ExpiresIn: 300 },
    });
    const results = await Promise.all([auth.nativeAccessToken(), auth.nativeAccessToken()]);
    expect(results).toEqual(["refreshed", "refreshed"]);
    expect(sdk.send).toHaveBeenCalledTimes(2);
    expect(sdk.send.mock.calls[1][0].input).toMatchObject({
      AuthFlow: "REFRESH_TOKEN_AUTH", AuthParameters: { REFRESH_TOKEN: "refresh-example" },
    });
    sdk.send.mockResolvedValueOnce({});
    await auth.logoutNative();
    expect(auth.hasNativeSession()).toBe(false);
    await expect(auth.nativeAccessToken()).rejects.toThrow("เซสชันหมดอายุ");
    vi.restoreAllMocks();
  });
  it("maps known AWS exceptions to safe user messages", async () => {
    const auth = await import("../../apps/web/src/lib/direct-auth");
    const error = new Error("sensitive backend details");
    error.name = "NotAuthorizedException";
    expect(auth.readableNativeError(error)).not.toContain("sensitive");
  });
});
