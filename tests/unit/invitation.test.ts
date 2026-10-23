import { describe, it, expect, vi } from "vitest";
import {
  pendingInvite,
  inviteStorage,
} from "../../apps/web/src/lib/invitation";
describe("invitation URL handling", () => {
  it("removes the secret from the address bar and persists only a short per-tab copy", () => {
    const nav = { replaceState: vi.fn() },
      storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
      token = "a".repeat(64);
    expect(pendingInvite({ hash: `#token=${token}` }, nav, storage, 100)).toBe(
      token,
    );
    expect(nav.replaceState).toHaveBeenCalledWith(null, "", "/invite");
    expect(JSON.parse(storage.setItem.mock.calls[0][1])).toEqual({
      token,
      expires: 900100,
    });
  });
  it("clears expired tokens instead of reusing them", () => {
    const storage = {
      getItem: () => JSON.stringify({ token: "a".repeat(64), expires: 100 }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    expect(
      pendingInvite({ hash: "" }, { replaceState: vi.fn() }, storage, 101),
    ).toBe("");
    expect(storage.removeItem).toHaveBeenCalledWith(inviteStorage);
  });
  it("keeps the in-memory token and cleans the URL if browser storage is blocked", () => {
    const nav = { replaceState: vi.fn() },
      storage = {
        getItem: () => {
          throw Error();
        },
        setItem: () => {
          throw Error();
        },
        removeItem: () => {
          throw Error();
        },
      },
      token = "b".repeat(64);
    expect(pendingInvite({ hash: `#token=${token}` }, nav, storage)).toBe(
      token,
    );
    expect(nav.replaceState).toHaveBeenCalled();
  });
});
