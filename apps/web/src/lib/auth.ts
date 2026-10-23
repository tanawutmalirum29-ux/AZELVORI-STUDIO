import { UserManager, WebStorageStateStore } from "oidc-client-ts";
const authority = import.meta.env.VITE_COGNITO_AUTHORITY?.replace(/\/$/, "");
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const domain = import.meta.env.VITE_COGNITO_DOMAIN?.replace(/\/$/, "");
export const authConfigured =
  !!authority &&
  !!clientId &&
  !!domain &&
  authority.startsWith("https://") &&
  domain.startsWith("https://");
let manager: UserManager | undefined;
export function auth() {
  if (!authConfigured) throw new Error("ระบบเข้าสู่ระบบยังไม่เปิดใช้งาน");
  if (!manager)
    manager = new UserManager({
      authority,
      client_id: clientId,
      redirect_uri: `${location.origin}/auth/callback`,
      response_type: "code",
      scope: "openid email aws.cognito.signin.user.admin azelvori/access",
      automaticSilentRenew: false,
      silentRequestTimeoutInSeconds: 15,
      requestTimeoutInSeconds: 15,
      loadUserInfo: false,
      userStore: new WebStorageStateStore({ store: sessionStorage }),
      stateStore: new WebStorageStateStore({ store: sessionStorage }),
      metadata: {
        issuer: authority,
        authorization_endpoint: `${domain}/oauth2/authorize`,
        token_endpoint: `${domain}/oauth2/token`,
        jwks_uri: `${authority}/.well-known/jwks.json`,
        revocation_endpoint: `${domain}/oauth2/revoke`,
      },
    });
  return manager;
}
export async function signIn(destination: "app" | "admin" | "invite" = "app") {
  await auth().signinRedirect({ state: { destination } });
}
let callbackPromise: Promise<void> | undefined;
export function finishLogin() {
  // StrictMode and repeated renders share one exchange; authorization codes are single-use.
  if (!callbackPromise)
    callbackPromise = auth()
      .signinRedirectCallback()
      .then((user) => {
        const requested = (user.state as { destination?: string } | undefined)
          ?.destination;
        const destination =
          requested === "admin"
            ? "/admin"
            : requested === "invite"
              ? "/invite"
              : "/app";
        history.replaceState(null, "", "/auth/callback");
        location.replace(destination);
      });
  return callbackPromise;
}
export async function logout() {
  loggingOut = true;
  sessionStorage.removeItem("azelvori:pending-invite");
  try {
    // A refresh may persist a new user. Finish it before removing the session.
    await refreshing?.catch(() => undefined);
    await auth().revokeTokens(["refresh_token"]);
  } finally {
    await auth().removeUser();
    location.assign(
      `${domain}/logout?client_id=${encodeURIComponent(clientId)}&logout_uri=${encodeURIComponent(`${location.origin}/login`)}`,
    );
  }
}
let refreshing: Promise<string> | undefined;
let loggingOut = false;
export async function accessToken(): Promise<string> {
  if (loggingOut) throw new Error("กำลังออกจากระบบ");
  const user = await auth().getUser();
  if (loggingOut || !user)
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  if ((user.expires_in ?? 0) > 30 && user.access_token)
    return user.access_token;
  // Never fall back to iframe sign-in: this app renews only an existing refresh token.
  if (!user.refresh_token) {
    if (!user.expired && user.access_token) return user.access_token;
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }
  if (!refreshing)
    refreshing = auth()
      .signinSilent()
      .then((renewed) => {
        if (!renewed || renewed.expired || !renewed.access_token)
          throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
        return renewed.access_token;
      })
      .catch(async () => {
        await auth().removeUser();
        throw new Error("ต่ออายุเซสชันไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่");
      })
      .finally(() => {
        refreshing = undefined;
      });
  const token = await refreshing;
  if (loggingOut) throw new Error("กำลังออกจากระบบ");
  return token;
}
