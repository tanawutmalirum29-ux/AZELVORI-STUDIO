import { clearNativeSession, hasNativeSession, logoutNative, nativeAccessToken } from "./direct-auth";
import {
  ErrorTimeout,
  UserManager,
  WebStorageStateStore,
} from "oidc-client-ts";
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
      // Hosted OAuth fallback stays tab-scoped; first-party login has an explicit trusted-device option.
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
  clearNativeSession();
  await auth().signinRedirect({ state: { destination } });
}
export type LoginDestination = "/admin" | "/invite" | "/app";
export class LoginCallbackError extends Error {
  constructor(public readonly reason: "timeout" | "failed") {
    super(
      reason === "timeout"
        ? "ระบบบัญชีตอบกลับช้า กรุณาตรวจการเชื่อมต่อแล้วเข้าสู่ระบบใหม่ในแท็บนี้"
        : "ยืนยันการเข้าสู่ระบบไม่สำเร็จ ลิงก์อาจหมดอายุหรือเปิดจากคนละแท็บ กรุณาเข้าสู่ระบบใหม่ในแท็บนี้",
    );
  }
}
let callbackPromise: Promise<LoginDestination> | undefined;
export function finishLogin() {
  // StrictMode and repeated renders share one exchange; authorization codes are single-use.
  if (!callbackPromise)
    callbackPromise = new Promise<LoginDestination>((resolve, reject) => {
      let timedOut = false;
      let callbackManager: UserManager | undefined;
      // The library's request timeout stops at response headers. Bound the entire
      // exchange as well, including a stalled response body or session storage.
      const deadline = setTimeout(() => {
        timedOut = true;
        reject(new LoginCallbackError("timeout"));
        void callbackManager?.removeUser().catch(() => undefined);
      }, 20_000);
      void Promise.resolve()
        .then(() => {
          const callbackUrl = location.href;
          // Pass the original URL explicitly; never leave the one-use code in history.
          history.replaceState(null, "", location.pathname);
          callbackManager = auth();
          return callbackManager.signinRedirectCallback(callbackUrl);
        })
        .then(async (user) => {
          if (timedOut) {
            // A late library response can have persisted a user. It must neither
            // restore this abandoned sign-in nor navigate away from the retry UI.
            await callbackManager!.removeUser();
            return;
          }
          clearTimeout(deadline);
          const requested = (user.state as { destination?: string } | undefined)
            ?.destination;
          resolve(
            requested === "admin"
              ? "/admin"
              : requested === "invite"
                ? "/invite"
                : "/app",
          );
        })
        .catch((error: unknown) => {
          clearTimeout(deadline);
          // Provider errors can contain codes/tokens: expose only our own messages.
          reject(
            new LoginCallbackError(
              error instanceof ErrorTimeout ? "timeout" : "failed",
            ),
          );
        });
    });
  return callbackPromise;
}
export async function logout() {
  loggingOut = true;
  if (hasNativeSession()) {
    sessionStorage.removeItem("azelvori:pending-invite");
    try {
      await logoutNative();
      // A previous hosted-OAuth session must not silently survive native sign-out.
      await auth().removeUser();
    } finally { location.assign("/login"); }
    return;
  }
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
  if (hasNativeSession()) return nativeAccessToken();
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
      .catch(async (error: unknown) => {
        const denial = error as { error?: string; name?: string; message?: string } | null;
        if (denial && (denial.error === "invalid_grant" ||
            denial.name === "invalid_grant" || denial.message === "invalid_grant" ||
            denial.name === "NotAuthorizedException")) {
          await auth().removeUser();
          throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
        }
        throw new Error("เชื่อมต่อไม่ได้ชั่วคราว กรุณาลองอีกครั้ง");
      })
      .finally(() => {
        refreshing = undefined;
      });
  const token = await refreshing;
  if (loggingOut) throw new Error("กำลังออกจากระบบ");
  return token;
}
