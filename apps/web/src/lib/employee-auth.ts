import {
  CognitoIdentityProviderClient, InitiateAuthCommand, RevokeTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { api } from "./api";

type StaffConfig = { poolId: string; clientId: string; region: string };
type TokenSet = { access: string; refresh: string; expiresAt: number };
const SESSION_KEY = "azelvori:employee-session";
/** Persistent only when the employee explicitly trusts this device. */
type StaffTabSession = TokenSet & { remembered?: boolean };
/** The durable store contains only the opaque refresh credential. Access tokens
 * remain tab-scoped; on the next browser launch they are refreshed on demand. */
function persistentRefresh(): string | undefined {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return;
    const data = JSON.parse(value) as { refresh?: unknown };
    return typeof data.refresh === "string" && data.refresh ? data.refresh : undefined;
  } catch { return; }
}
function saveSession(data: TokenSet, remember = !!persistentRefresh()) {
  let persisted = false;
  if (remember) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ refresh: data.refresh }));
      persisted = true;
    } catch { /* In private mode, keep a tab-only session. */ }
  } else {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* Restricted storage */ }
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, remembered: persisted }));
}
function invalidRefresh(error: unknown) {
  return error instanceof Error && [
    "NotAuthorizedException", "UserNotFoundException",
    "InvalidParameterException", "ResourceNotFoundException",
  ].includes(error.name);
}
let cfg: StaffConfig | undefined;
let instance: CognitoIdentityProviderClient | undefined;
let refreshJob: Promise<string> | undefined;
export async function staffConfig(): Promise<StaffConfig> {
  if (!cfg) {
    const next = await api<StaffConfig>("/api/v1/employee/config");
    if (!/^[a-z0-9-]+$/.test(next.region) || !/^[a-z0-9-_]+$/.test(next.clientId))
      throw new Error("การตั้งค่าบัญชีพนักงานไม่ถูกต้อง");
    cfg = next;
  }
  return cfg;
}
async function client() {
  const config = await staffConfig();
  return {
    sdk: instance ??= new CognitoIdentityProviderClient({ region: config.region }),
    clientId: config.clientId,
  };
}
function read(): TokenSet | undefined {
  const refresh = persistentRefresh();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const data = JSON.parse(raw) as StaffTabSession;
      if (typeof data.access === "string" && typeof data.refresh === "string" &&
          typeof data.expiresAt === "number") {
        // A sign-out in a different tab invalidates this remembered device.
        if (data.remembered && (!refresh || refresh !== data.refresh)) return;
        return data;
      }
    }
    if (refresh) return { access: "", refresh, expiresAt: 0 };
  } catch { /* Invalid storage must not grant access. */ }
}
export const employeeSessionExists = () => !!read();
export function clearEmployeeSession() {
  sessionStorage.removeItem(SESSION_KEY);
  try { localStorage.removeItem(SESSION_KEY); } catch { /* Restricted storage */ }
}
export async function employeeLogin(key: string, password: string, rememberDevice = true) {
  if (!/^\d{5,}$/.test(key)) throw new Error("รหัสพนักงานต้องเป็นตัวเลขอย่างน้อย 5 หลัก");
  const issued = /^AZb-(\d+)-(\d{5,})-[A-Za-z0-9_-]+$/.exec(password);
  if (password.startsWith("AZb-") && (!issued || issued[2] !== key))
    throw new Error("คีย์พนักงานกับรหัสผ่านไม่ตรงกัน");
  // Every new issuance has a distinct Cognito subject; legacy AZa credentials
  // continue to authenticate using emp-{key} until explicitly disabled.
  const username = issued ? "emp-" + key + "-v" + issued[1] : "emp-" + key;
  const { sdk, clientId } = await client();
  const result = await sdk.send(new InitiateAuthCommand({
    ClientId: clientId, AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: username, PASSWORD: password },
  }));
  if (!result.AuthenticationResult?.AccessToken || !result.AuthenticationResult.RefreshToken ||
      !result.AuthenticationResult.ExpiresIn)
    throw new Error("บัญชีพนักงานยังไม่สามารถเข้าสู่ระบบได้");
  const auth = result.AuthenticationResult;
  saveSession({ access: auth.AccessToken!, refresh: auth.RefreshToken!,
    expiresAt: Date.now() + (auth.ExpiresIn ?? 0) * 1000 }, rememberDevice);
}
export async function employeeAccessToken(): Promise<string> {
  const s = read();
  if (!s) throw new Error("กรุณาเข้าสู่ระบบพนักงาน");
  if (Date.now() + 30000 < s.expiresAt) return s.access;
  if (!refreshJob) refreshJob = (async () => {
    const { sdk, clientId } = await client();
    const refreshed = await sdk.send(new InitiateAuthCommand({
      ClientId: clientId, AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: s.refresh },
    }));
    const next = refreshed.AuthenticationResult;
    if (!next?.AccessToken || !next.ExpiresIn) throw new Error("เซสชันพนักงานหมดอายุ");
    if (read()?.refresh !== s.refresh) throw new Error("เซสชันพนักงานถูกยกเลิก");
    saveSession({ access: next.AccessToken, refresh: next.RefreshToken ?? s.refresh,
      expiresAt: Date.now() + next.ExpiresIn * 1000 });
    return next.AccessToken;
  })().catch((error: unknown) => {
    // A temporary network failure must not log a remembered employee out.
    if (invalidRefresh(error) && read()?.refresh === s.refresh) clearEmployeeSession();
    throw error;
  }).finally(() => { refreshJob = undefined; });
  return refreshJob;
}
export async function employeeLogout() {
  const session = read();
  clearEmployeeSession();
  if (!session) return;
  try {
    const { sdk, clientId } = await client();
    await sdk.send(new RevokeTokenCommand({ ClientId: clientId, Token: session.refresh }));
  } catch { /* Revocation on server also checks active grant on each request. */ }
}
export function employeeAuthError(error: unknown) {
  if (error instanceof Error &&
      ["NotAuthorizedException", "UserNotFoundException"].includes(error.name))
    return "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกปิดแล้ว";
  if (error instanceof Error && error.name === "TooManyRequestsException")
    return "ทำรายการถี่เกินไป โปรดลองอีกครั้ง";
  return error instanceof Error && !error.name.endsWith("Exception")
    ? error.message : "เข้าสู่ระบบพนักงานไม่สำเร็จ";
}
