import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const manager = vi.hoisted(() => ({
  getUser: vi.fn(),
  signinSilent: vi.fn(),
  removeUser: vi.fn(),
  revokeTokens: vi.fn(),
}));
vi.mock("oidc-client-ts", () => ({
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
    assign: vi.fn(),
  });
  vi.stubGlobal("sessionStorage", { removeItem: vi.fn() });
  manager.getUser.mockResolvedValue(active);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
