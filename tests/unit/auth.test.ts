import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const manager = vi.hoisted(() => ({
  getUser: vi.fn(),
  signinSilent: vi.fn(),
  removeUser: vi.fn(),
  revokeTokens: vi.fn(),
  signinRedirectCallback: vi.fn(),
}));
vi.mock("oidc-client-ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("oidc-client-ts")>()),
  UserManager: class {
    constructor() {
      return manager;
    }
  },
  WebStorageStateStore: class {},
}));
const active = {
  access_token: "access-test",
  refresh_token: "refresh-test",
  expires_in: 300,
  expired: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
  vi.stubEnv("VITE_COGNITO_AUTHORITY", "https://identity.example.test/pool");
  vi.stubEnv("VITE_COGNITO_CLIENT_ID", "client");
  vi.stubEnv("VITE_COGNITO_DOMAIN", "https://auth.example.test");
  vi.stubGlobal("location", {
    origin: "https://studio.example.test",
    href: "https://studio.example.test/auth/callback/?code=one-use-code&state=login-state",
    pathname: "/auth/callback/",
    assign: vi.fn(),
    replace: vi.fn(),
  });
  vi.stubGlobal("history", { replaceState: vi.fn() });
  vi.stubGlobal("sessionStorage", { removeItem: vi.fn() });
  manager.getUser.mockResolvedValue(active);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("login callback recovery", () => {
  it.each([
    ["admin", "/admin"],
    ["invite", "/invite"],
    ["app", "/app"],
    ["https://untrusted.example/", "/app"],
    [undefined, "/app"],
  ])(
    "only continues to a fixed local destination for %s",
    async (destination, target) => {
      manager.signinRedirectCallback.mockResolvedValue({
        ...active,
        state: { destination },
      });
      const auth = await import("../../apps/web/src/lib/auth");
      expect(await auth.finishLogin()).toBe(target);
      expect(location.replace).not.toHaveBeenCalled();
    },
  );
  it("exchanges once across StrictMode mounts and scrubs the URL while pending", async () => {
    let finish!: (v: unknown) => void;
    manager.signinRedirectCallback.mockImplementation(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    const auth = await import("../../apps/web/src/lib/auth");
    const first = auth.finishLogin();
    expect(auth.finishLogin()).toBe(first);
    await vi.waitFor(() =>
      expect(manager.signinRedirectCallback).toHaveBeenCalledOnce(),
    );
    expect(manager.signinRedirectCallback).toHaveBeenCalledWith(location.href);
    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/auth/callback/",
    );
    finish({ ...active, state: { destination: "admin" } });
    expect(await first).toBe("/admin");
    expect(auth.finishLogin()).toBe(first);
  });
  it("settles a stalled exchange at the deadline and removes a late saved session", async () => {
    vi.useFakeTimers();
    let finish!: (v: unknown) => void;
    manager.signinRedirectCallback.mockImplementation(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    manager.removeUser.mockResolvedValue(undefined);
    const auth = await import("../../apps/web/src/lib/auth");
    const result = auth.finishLogin().catch((e) => e);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await result).toMatchObject({ reason: "timeout" });
    expect(manager.removeUser).toHaveBeenCalledOnce();
    finish({ ...active, state: { destination: "admin" } });
    await vi.advanceTimersByTimeAsync(1);
    expect(manager.removeUser).toHaveBeenCalledTimes(2);
    expect(location.replace).not.toHaveBeenCalled();
    expect(await auth.finishLogin().catch((e) => e)).toMatchObject({
      reason: "timeout",
    });
    expect(manager.signinRedirectCallback).toHaveBeenCalledOnce();
  });
  it("clears the watchdog on success so it cannot later remove a valid session", async () => {
    vi.useFakeTimers();
    manager.signinRedirectCallback.mockResolvedValue({ ...active });
    const auth = await import("../../apps/web/src/lib/auth");
    expect(await auth.finishLogin()).toBe("/app");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(manager.removeUser).not.toHaveBeenCalled();
  });
  it("turns synchronous failures into retryable errors without leaking provider details", async () => {
    manager.signinRedirectCallback.mockImplementation(() => {
      throw new Error("sensitive-provider-error?code=one-use-code");
    });
    const auth = await import("../../apps/web/src/lib/auth");
    const error = await auth.finishLogin().catch((e) => e);
    expect(error).toMatchObject({ reason: "failed" });
    expect(error.message).not.toContain("one-use-code");
    expect(error.message).not.toContain("sensitive-provider-error");
  });
  it("recognizes the library network timeout and clears its own timer on failure", async () => {
    vi.useFakeTimers();
    const { ErrorTimeout } = await import("oidc-client-ts");
    manager.signinRedirectCallback.mockRejectedValue(
      new ErrorTimeout("Network timed out"),
    );
    const auth = await import("../../apps/web/src/lib/auth");
    await expect(auth.finishLogin()).rejects.toMatchObject({
      reason: "timeout",
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(manager.removeUser).not.toHaveBeenCalled();
  });
  it("does not leave the page pending if browser history cleanup throws", async () => {
    vi.mocked(history.replaceState).mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    const auth = await import("../../apps/web/src/lib/auth");
    await expect(auth.finishLogin()).rejects.toMatchObject({
      reason: "failed",
    });
    expect(manager.signinRedirectCallback).not.toHaveBeenCalled();
  });
});
describe("on-demand session refresh", () => {
  it("uses a valid token without issuing a refresh", async () => {
    const auth = await import("../../apps/web/src/lib/auth");
    expect(await auth.accessToken()).toBe("access-test");
    expect(manager.signinSilent).not.toHaveBeenCalled();
  });
  it("shares one refresh across simultaneous API calls near expiration", async () => {
    manager.getUser.mockResolvedValue({ ...active, expires_in: 10 });
    let finish!: (v: typeof active) => void;
    manager.signinSilent.mockImplementation(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    const auth = await import("../../apps/web/src/lib/auth");
    const pending = Promise.all([
      auth.accessToken(),
      auth.accessToken(),
      auth.accessToken(),
    ]);
    await vi.waitFor(() =>
      expect(manager.signinSilent).toHaveBeenCalledTimes(1),
    );
    finish({ ...active, access_token: "renewed-test" });
    expect(await pending).toEqual([
      "renewed-test",
      "renewed-test",
      "renewed-test",
    ]);
  });
  it("clears rejected refresh sessions and never returns an expired token", async () => {
    manager.getUser.mockResolvedValue({
      ...active,
      expires_in: -5,
      expired: true,
    });
    manager.signinSilent.mockRejectedValue(new Error("invalid_grant"));
    const auth = await import("../../apps/web/src/lib/auth");
    await expect(auth.accessToken()).rejects.toThrow("เข้าสู่ระบบใหม่");
    expect(manager.removeUser).toHaveBeenCalledOnce();
  });
  it("does not create an iframe when a refresh token is absent", async () => {
    manager.getUser.mockResolvedValue({
      ...active,
      refresh_token: undefined,
      expires_in: -1,
      expired: true,
    });
    const auth = await import("../../apps/web/src/lib/auth");
    await expect(auth.accessToken()).rejects.toThrow();
    expect(manager.signinSilent).not.toHaveBeenCalled();
  });
  it("logout waits for refresh then revokes and clears the latest session", async () => {
    manager.getUser.mockResolvedValue({ ...active, expires_in: 1 });
    let finish!: (v: typeof active) => void;
    manager.signinSilent.mockImplementation(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    const auth = await import("../../apps/web/src/lib/auth");
    const token = auth.accessToken().catch((e) => e);
    await vi.waitFor(() => expect(manager.signinSilent).toHaveBeenCalledOnce());
    const logout = auth.logout();
    expect(manager.revokeTokens).not.toHaveBeenCalled();
    finish({ ...active, access_token: "renewed-test" });
    await logout;
    expect(await token).toBeInstanceOf(Error);
    expect(manager.revokeTokens).toHaveBeenCalledWith(["refresh_token"]);
    expect(manager.revokeTokens.mock.invocationCallOrder[0]).toBeLessThan(
      manager.removeUser.mock.invocationCallOrder[0],
    );
    await expect(auth.accessToken()).rejects.toThrow("ออกจากระบบ");
  });
});
