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
      scope: "openid email azelvori/access",
      automaticSilentRenew: false,
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
export async function signIn(destination: "app" | "admin" = "app") {
  await auth().signinRedirect({ state: { destination } });
}
let callbackPromise: Promise<void> | undefined;
export function finishLogin() {
  // StrictMode and repeated renders share one exchange; authorization codes are single-use.
  if (!callbackPromise)
    callbackPromise = auth()
      .signinRedirectCallback()
      .then((user) => {
        const destination =
          (user.state as { destination?: string } | undefined)?.destination ===
          "admin"
            ? "/admin"
            : "/app";
        history.replaceState(null, "", "/auth/callback");
        location.replace(destination);
      });
  return callbackPromise;
}
export async function logout() {
  try {
    await auth().revokeTokens(["refresh_token"]);
  } finally {
    await auth().removeUser();
    location.assign(
      `${domain}/logout?client_id=${encodeURIComponent(clientId)}&logout_uri=${encodeURIComponent(`${location.origin}/login`)}`,
    );
  }
}
export async function accessToken(): Promise<string> {
  const user = await auth().getUser();
  if (!user || user.expired)
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  return user.access_token;
}
