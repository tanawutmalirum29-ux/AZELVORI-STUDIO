import { useState, type FormEvent } from "react";
import { Notice } from "./Layout";
import { Icon } from "./Icon";
import { authConfigured, logout, signIn } from "../lib/auth";
import {
  answerNativeChallenge,
  confirmPasswordRecovery,
  directConfigured,
  logoutNative,
  readableNativeError,
  startNativeLogin,
  startPasswordRecovery,
  type SignInStep,
} from "../lib/direct-auth";
import { workspaceApi } from "../lib/workspace-api";
import { ApiError, apiBase } from "../lib/api";

type Mode = "admin" | "app";
type View = "login" | "challenge" | "forgot" | "reset";
type PendingStep = Exclude<SignInStep, { kind: "done" }>;
export function FirstPartyLogin({ mode, denied = false, reason = "" }: {
  mode: Mode;
  denied?: boolean;
  reason?: string;
}) {
  const [view, setView] = useState<View>("login");
  const [step, setStep] = useState<PendingStep>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [replacement, setReplacement] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const configured = directConfigured && /^https:\/\//.test(apiBase);
  const destination = mode === "admin" ? "/admin" :
    new URLSearchParams(location.search).get("continue") === "invite" ? "/invite" : "/app";

  function report(error: unknown) {
    setError(readableNativeError(error));
  }
  async function completed(next: SignInStep) {
    if (next.kind !== "done") {
      setStep(next);
      setCode("");
      setReplacement("");
      setConfirm("");
      setView("challenge");
      return;
    }
    // Do not navigate to a broken private page while the old API scope gate is
    // still deployed. Keep the hosted-OAuth fallback functional until CDK rollout.
    try {
      const me = await workspaceApi.me();
      if (mode === "admin" && !me.staff) {
        await logoutNative();
        throw new Error("บัญชีนี้ยังไม่มีสิทธิ์ผู้ดูแล");
      }
    } catch (failure) {
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) {
        await logoutNative();
        throw new Error("AWS API ยังไม่รองรับหน้าล็อกอินใหม่ กรุณาใช้เข้าสู่ระบบผ่าน Cognito ชั่วคราว");
      }
      throw failure;
    }
    location.assign(destination);
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !configured || !email.trim() || !password) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await startNativeLogin(email, password);
      setPassword("");
      await completed(next);
    } catch (failure) {
      setPassword("");
      report(failure);
    } finally {
      setBusy(false);
    }
  }
  async function answer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!step || busy) return;
    const value = step.kind === "new-password" ? replacement : code;
    if (step.kind === "new-password" &&
        (value.length < 12 || value !== confirm)) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร และตรงกันทั้งสองช่อง");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await answerNativeChallenge(step, value);
      setCode("");
      setReplacement("");
      setConfirm("");
      await completed(next);
    } catch (failure) {
      report(failure);
    } finally {
      setBusy(false);
    }
  }
  async function forgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await startPasswordRecovery(email);
      setNotice("หากอีเมลนี้มีบัญชี ระบบจะส่งรหัสรีเซ็ตให้ทางอีเมล");
      setCode("");
      setView("reset");
    } catch (failure) {
      // Avoid leaking which accounts exist to an unauthenticated user.
      if (failure instanceof Error && failure.name === "UserNotFoundException") {
        setNotice("หากอีเมลนี้มีบัญชี ระบบจะส่งรหัสรีเซ็ตให้ทางอีเมล");
        setView("reset");
      } else report(failure);
    } finally {
      setBusy(false);
    }
  }
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || replacement.length < 12 || replacement !== confirm) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร และตรงกันทั้งสองช่อง");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await confirmPasswordRecovery(email, code, replacement);
      setReplacement("");
      setConfirm("");
      setCode("");
      setPassword("");
      setNotice("ตั้งรหัสผ่านใหม่เรียบร้อย กรุณาเข้าสู่ระบบ");
      setView("login");
    } catch (failure) { report(failure); }
    finally { setBusy(false); }
  }
  async function hosted() {
    setError("");
    setBusy(true);
    try {
      await signIn(destination === "/invite" ? "invite" : mode);
    } catch {
      setError("เปิดหน้าล็อกอินทางเลือกไม่ได้ กรุณาลองใหม่");
      setBusy(false);
    }
  }
  function resetView() {
    setView("login"); setStep(undefined); setCode(""); setPassword("");
    setReplacement(""); setConfirm(""); setNotice(""); setError("");
  }
  return (
    <section className="login-card first-party-login" aria-label="บัญชี AZELVORI STUDIO">
      <img className="first-party-mark" src="/brand/azelvori-logo-horizontal.svg"
        alt="AZELVORI STUDIO" width="245" height="55" />
      <div className="first-party-intro">
        <span className="eyebrow">{mode === "admin" ? "STUDIO CONTROL CENTER" : "PRIVATE CLIENT PORTAL"}</span>
        <h2>{denied ? "บัญชีนี้ยังไม่มีสิทธิ์ผู้ดูแล"
          : view === "forgot" ? "กู้คืนรหัสผ่าน"
          : view === "reset" ? "ตั้งรหัสผ่านใหม่"
          : view === "challenge" ? step?.kind === "setup" ? "ตั้งค่า Authenticator"
            : step?.kind === "new-password" ? "เปลี่ยนรหัสผ่านครั้งแรก"
              : "ยืนยันตัวตนอีกขั้น"
          : "ยินดีต้อนรับกลับ"}</h2>
        <p>{view === "challenge" ? "ยืนยันตัวตนเพื่อปกป้องบัญชีของคุณ"
          : mode === "admin" ? "เข้าสู่พื้นที่จัดการงานของสตูดิโอ" : "เข้าสู่พื้นที่โปรเจกต์ส่วนตัว"}</p>
      </div>
      {!configured && <Notice>ระบบบัญชีหรือ API ยังไม่ได้ตั้งค่า ไม่สามารถลงชื่อเข้าใช้จริงได้</Notice>}
      {reason && <Notice>{reason}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}
      {denied ? (
        <button className="button full" disabled={busy} onClick={() => {
          setBusy(true);
          void logout().catch((failure) => { report(failure); setBusy(false); });
        }}>ออกจากระบบเพื่อเปลี่ยนบัญชี</button>
      ) : (
        <>
          {view === "login" && (
            <form onSubmit={(event) => void signInWithPassword(event)} className="first-party-form">
              <label className="field" htmlFor="studio-email">
                <span>อีเมล</span>
                <input id="studio-email" type="email" autoComplete="username" required
                  maxLength={254} placeholder="you@example.com" value={email}
                  onChange={(event) => setEmail(event.target.value)} disabled={busy} />
              </label>
              <div className="field">
                <label htmlFor="studio-password">รหัสผ่าน</label>
                <span className="first-party-password">
                  <input id="studio-password" type={visible ? "text" : "password"}
                    autoComplete="current-password" required value={password}
                    onChange={(event) => setPassword(event.target.value)} disabled={busy} />
                  <button type="button" className="first-party-reveal"
                    aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    onClick={() => setVisible(!visible)}>{visible ? "ซ่อน" : "แสดง"}</button>
                </span>
              </div>
              <button className="button full" disabled={!configured || busy}>
                {busy ? "กำลังตรวจสอบ…" : mode === "admin" ? "เข้าสู่ระบบผู้ดูแล" : "เข้าสู่พื้นที่ลูกค้า"} <Icon name="arrow" size={18} />
              </button>
              <button className="text-link first-party-forgot" type="button" disabled={busy}
                onClick={() => { setView("forgot"); setError(""); setNotice(""); }}>
                ลืมรหัสผ่าน?
              </button>
            </form>
          )}
          {view === "challenge" && step && (
            <form onSubmit={(event) => void answer(event)} className="first-party-form">
              {step.kind === "setup" && (
                <div className="first-party-setup">
                  <p>เปิดแอป Authenticator แล้วเพิ่มบัญชีด้วยรหัสลับนี้ จากนั้นกรอกรหัส 6 หลัก</p>
                  <div className="first-party-secret" aria-label="รหัสตั้งค่า Authenticator">{step.secret}</div>
                  <p className="small-note">เก็บรหัสนี้เป็นความลับ อย่าแชร์ภาพหน้าจอหรือส่งให้ผู้อื่น</p>
                </div>
              )}
              {step.kind === "new-password" ? (
                <>
                  <label className="field">รหัสผ่านใหม่ (อย่างน้อย 12 ตัวอักษร)
                    <input type="password" autoComplete="new-password" minLength={12} required value={replacement}
                      onChange={(event) => setReplacement(event.target.value)} disabled={busy} />
                  </label>
                  <label className="field">ยืนยันรหัสผ่านใหม่
                    <input type="password" autoComplete="new-password" minLength={12} required value={confirm}
                      onChange={(event) => setConfirm(event.target.value)} disabled={busy} />
                  </label>
                </>
              ) : (
                <label className="field" htmlFor="studio-otp"><span>รหัสยืนยัน 6 หลัก</span>
                  <input id="studio-otp" type="text" inputMode="numeric" autoComplete="one-time-code"
                    pattern="[0-9]{6}" maxLength={6} required value={code}
                    placeholder="000000" onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                    disabled={busy} />
                </label>
              )}
              <button className="button full" disabled={busy}>{busy ? "กำลังยืนยัน…" : "ยืนยันและดำเนินการต่อ"}</button>
              <button className="text-link" type="button" onClick={resetView}>เริ่มเข้าสู่ระบบใหม่</button>
            </form>
          )}
          {view === "forgot" && (
            <form className="first-party-form" onSubmit={(event) => void forgot(event)}>
              <p>กรอกอีเมลที่ใช้กับบัญชี เพื่อรับรหัสตั้งรหัสผ่านใหม่</p>
              <label className="field">อีเมล
                <input type="email" autoComplete="username" maxLength={254} required
                  value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
              </label>
              <button className="button full" disabled={busy || !configured}>ส่งรหัสรีเซ็ต</button>
              <button className="text-link" type="button" onClick={resetView}>กลับหน้าเข้าสู่ระบบ</button>
            </form>
          )}
          {view === "reset" && (
            <form className="first-party-form" onSubmit={(event) => void reset(event)}>
              <label className="field">รหัสยืนยันจากอีเมล
                <input type="text" autoComplete="one-time-code" inputMode="numeric" required
                  value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} />
              </label>
              <label className="field">รหัสผ่านใหม่
                <input type="password" autoComplete="new-password" required minLength={12}
                  value={replacement} onChange={(event) => setReplacement(event.target.value)} disabled={busy} />
              </label>
              <label className="field">ยืนยันรหัสผ่านใหม่
                <input type="password" autoComplete="new-password" required minLength={12}
                  value={confirm} onChange={(event) => setConfirm(event.target.value)} disabled={busy} />
              </label>
              <button className="button full" disabled={busy || !configured}>บันทึกรหัสผ่านใหม่</button>
              <button className="text-link" type="button" onClick={resetView}>กลับหน้าเข้าสู่ระบบ</button>
            </form>
          )}
        </>
      )}
      <div className="first-party-divider"><span>หรือ</span></div>
      <button className="button secondary full" type="button" disabled={!authConfigured || busy}
        onClick={() => void hosted()}>เข้าสู่ระบบผ่าน Amazon Cognito</button>
      <p className="first-party-support">ระบบยืนยันตัวตนโดย Amazon Cognito · บัญชีได้รับเชิญเท่านั้น</p>
      <nav className="first-party-links" aria-label="ลิงก์บัญชี">
        <a href={mode === "admin" ? "/login" : "/admin/login"}>
          {mode === "admin" ? "พื้นที่ลูกค้า" : "เข้าสู่ระบบผู้ดูแล"}
        </a>
        <a href="/privacy">ความเป็นส่วนตัว</a>
        <a href="/admin/setup">{mode === "admin" ? "วิธีเปิดหน้าแอดมินครั้งแรก" : "ตรวจความพร้อมระบบ"}</a>
      </nav>
    </section>
  );
}
