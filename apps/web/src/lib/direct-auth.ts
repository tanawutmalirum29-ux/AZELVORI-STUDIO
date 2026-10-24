import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  RevokeTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";

/** Public browser client only. Never include AWS credentials or an app-client secret. */
const issuer = import.meta.env.VITE_COGNITO_AUTHORITY?.replace(/\/$/, "") ?? "";
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID ?? "";
const region = /^https:\/\/cognito-idp\.([a-z0-9-]+)\.amazonaws\.com(?:\.cn)?\/[A-Za-z0-9_-]+$/.exec(issuer)?.[1];
const KEY = "azelvori:direct-cognito-session";
export const directConfigured = !!region && !!clientId;

type NativeSession = {
  access: string;
  refresh: string;
  id: string;
  expiresAt: number;
};
type Challenge = {
  username: string;
  session: string;
};
export type SignInStep =
  | { kind: "done" }
  | ({ kind: "totp"; method: "SOFTWARE_TOKEN_MFA" | "SMS_MFA" | "EMAIL_OTP" } & Challenge)
  | ({ kind: "setup"; secret: string } & Challenge)
  | ({ kind: "new-password" } & Challenge);
let instance: CognitoIdentityProviderClient | undefined;
let inFlightRefresh: Promise<string> | undefined;
function provider() {
  if (!directConfigured) throw new Error("การเข้าสู่ระบบยังไม่ได้ตั้งค่า");
  return instance ??= new CognitoIdentityProviderClient({ region });
}
function read(): NativeSession | undefined {
  try {
    const raw = typeof sessionStorage.getItem === "function" ? sessionStorage.getItem(KEY) : null;
    if (!raw) return;
    const data = JSON.parse(raw) as NativeSession;
    if (typeof data.access === "string" && typeof data.refresh === "string" &&
        typeof data.expiresAt === "number" && typeof data.id === "string") return data;
  } catch { /* Corrupt storage is never authentication. */ }
}
export function hasNativeSession() { return !!read(); }
export function clearNativeSession() {
  sessionStorage.removeItem(KEY);
}
function stored(result: { AccessToken?: string; IdToken?: string; RefreshToken?: string; ExpiresIn?: number }, previous?: NativeSession): SignInStep {
  if (!result.AccessToken || !result.IdToken || !(result.RefreshToken || previous?.refresh) ||
      !result.ExpiresIn) throw new Error("ระบบบัญชีส่งข้อมูลเข้าสู่ระบบไม่ครบ");
  const entry: NativeSession = {
    access: result.AccessToken,
    id: result.IdToken,
    refresh: result.RefreshToken ?? previous!.refresh,
    expiresAt: Date.now() + result.ExpiresIn * 1000,
  };
  sessionStorage.setItem(KEY, JSON.stringify(entry));
  return { kind: "done" };
}
type CognitoAnswer = {
  AuthenticationResult?: { AccessToken?: string; IdToken?: string; RefreshToken?: string; ExpiresIn?: number };
  ChallengeName?: string;
  Session?: string;
  ChallengeParameters?: Record<string, string>;
};
async function next(answer: CognitoAnswer, previousUser: string): Promise<SignInStep> {
  if (answer.AuthenticationResult) return stored(answer.AuthenticationResult);
  if (!answer.ChallengeName || !answer.Session)
    throw new Error("การตอบกลับของระบบบัญชีไม่สมบูรณ์ กรุณาลองใหม่");
  const username = answer.ChallengeParameters?.USERNAME ??
    answer.ChallengeParameters?.USER_ID_FOR_SRP ?? previousUser;
  const pending = { username, session: answer.Session };
  if (["SOFTWARE_TOKEN_MFA", "SMS_MFA", "EMAIL_OTP"].includes(answer.ChallengeName))
    return { ...pending, kind: "totp", method: answer.ChallengeName as "SOFTWARE_TOKEN_MFA" | "SMS_MFA" | "EMAIL_OTP" };
  if (answer.ChallengeName === "NEW_PASSWORD_REQUIRED")
    return { ...pending, kind: "new-password" };
  if (answer.ChallengeName === "MFA_SETUP") {
    const association = await provider().send(new AssociateSoftwareTokenCommand({ Session: answer.Session }));
    if (!association.SecretCode || !association.Session) throw new Error("ยังไม่สามารถเตรียม Authenticator ได้");
    return { ...pending, session: association.Session, secret: association.SecretCode, kind: "setup" };
  }
  throw new Error("บัญชีต้องการวิธียืนยันตัวตนเพิ่มเติม กรุณาใช้การเข้าสู่ระบบผ่าน Cognito");
}
export async function startNativeLogin(email: string, password: string): Promise<SignInStep> {
  const username = email.trim().toLowerCase();
  const response = await provider().send(new InitiateAuthCommand({
    ClientId: clientId,
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: username, PASSWORD: password },
  }));
  return next(response, username);
}
export async function answerNativeChallenge(step: Exclude<SignInStep, { kind: "done" }>, input: string): Promise<SignInStep> {
  if (step.kind === "setup") {
    const verified = await provider().send(new VerifySoftwareTokenCommand({
      Session: step.session, UserCode: input.replace(/\s/g, ""),
    }));
    if (verified.Status !== "SUCCESS" || !verified.Session) throw new Error("รหัส Authenticator ไม่ถูกต้อง");
    const answer = await provider().send(new RespondToAuthChallengeCommand({
      ClientId: clientId, ChallengeName: "MFA_SETUP",
      Session: verified.Session, ChallengeResponses: { USERNAME: step.username },
    }));
    return next(answer, step.username);
  }
  const name = step.kind === "new-password" ? "NEW_PASSWORD_REQUIRED" : step.method;
  const key = step.kind === "new-password" ? "NEW_PASSWORD" :
    step.method === "SOFTWARE_TOKEN_MFA" ? "SOFTWARE_TOKEN_MFA_CODE" :
    step.method === "SMS_MFA" ? "SMS_MFA_CODE" : "EMAIL_OTP_CODE";
  const answer = await provider().send(new RespondToAuthChallengeCommand({
    ClientId: clientId, ChallengeName: name,
    Session: step.session, ChallengeResponses: { USERNAME: step.username, [key]: input.trim() },
  }));
  return next(answer, step.username);
}
export async function startPasswordRecovery(email: string) {
  await provider().send(new ForgotPasswordCommand({ ClientId: clientId, Username: email.trim().toLowerCase() }));
}
export async function confirmPasswordRecovery(email: string, code: string, password: string) {
  await provider().send(new ConfirmForgotPasswordCommand({
    ClientId: clientId, Username: email.trim().toLowerCase(), ConfirmationCode: code.trim(), Password: password,
  }));
}
export async function nativeAccessToken(): Promise<string> {
  const entry = read();
  if (!entry) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  if (entry.expiresAt - Date.now() > 30_000) return entry.access;
  if (!inFlightRefresh) {
    inFlightRefresh = provider().send(new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: clientId,
      AuthParameters: { REFRESH_TOKEN: entry.refresh },
    })).then((answer) => {
      if (!answer.AuthenticationResult) throw new Error("ไม่สามารถต่ออายุเซสชันได้");
      // A logout in another tab or a newer sign-in must not be undone by a late refresh.
      if (read()?.refresh !== entry.refresh) throw new Error("เซสชันถูกยกเลิกแล้ว");
      stored(answer.AuthenticationResult, entry);
      return answer.AuthenticationResult.AccessToken!;
    }).catch(() => {
      clearNativeSession();
      throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    }).finally(() => { inFlightRefresh = undefined; });
  }
  return inFlightRefresh;
}
export async function logoutNative() {
  const entry = read();
  clearNativeSession();
  await inFlightRefresh?.catch(() => undefined);
  if (entry) {
    try {
      await provider().send(new RevokeTokenCommand({ ClientId: clientId, Token: entry.refresh }));
    } catch { /* Session is already removed; do not block logout on AWS connectivity. */ }
  }
}
export function readableNativeError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAuthorizedException":
    case "UserNotFoundException": return "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่";
    case "CodeMismatchException": return "รหัสยืนยันไม่ถูกต้อง กรุณาลองใหม่";
    case "ExpiredCodeException": return "รหัสยืนยันหมดอายุ กรุณาขอรหัสใหม่";
    case "InvalidPasswordException": return "รหัสผ่านไม่เป็นไปตามเงื่อนไขของบัญชี (ขั้นต่ำ 12 ตัวอักษร)";
    case "LimitExceededException":
    case "TooManyRequestsException": return "ทำรายการถี่เกินไป กรุณาลองอีกครั้งภายหลัง";
    case "UserNotConfirmedException": return "บัญชียังไม่ได้รับการยืนยัน กรุณาติดต่อสตูดิโอ";
    case "InvalidParameterException": return "ระบบ Cognito ยังไม่ได้เปิดวิธีล็อกอินใหม่ โปรดใช้การเข้าสู่ระบบผ่าน Cognito";
    default: return error instanceof Error && !error.name.endsWith("Exception")
      ? error.message : "ติดต่อระบบบัญชีไม่ได้ กรุณาลองใหม่ หรือใช้การเข้าสู่ระบบผ่าน Cognito";
  }
}
