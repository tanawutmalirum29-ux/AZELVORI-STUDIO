export const inviteStorage = "azelvori:pending-invite";
// Fragment tokens never go to HTTP request/access logs. Keep only a short,
// per-tab copy for the hosted-login redirect, then remove it on acceptance.
export function pendingInvite(
  loc: Pick<Location, "hash"> = location,
  nav: Pick<History, "replaceState"> = history,
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  now = Date.now(),
): string {
  const token = new URLSearchParams(loc.hash.slice(1)).get("token");
  if (loc.hash) nav.replaceState(null, "", "/invite");
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    try {
      (storage ?? sessionStorage).setItem(
        inviteStorage,
        JSON.stringify({ token, expires: now + 15 * 60000 }),
      );
    } catch {
      /* The in-memory token still works in this page. */
    }
    return token;
  }
  try {
    const saved = JSON.parse(
      (storage ?? sessionStorage).getItem(inviteStorage) || "null",
    );
    if (saved?.expires > now && /^[a-f0-9]{64}$/.test(saved.token))
      return saved.token;
    (storage ?? sessionStorage).removeItem(inviteStorage);
  } catch {
    /* Storage can be blocked or malformed. */
  }
  return "";
}
