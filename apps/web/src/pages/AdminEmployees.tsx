import { useEffect, useState, type FormEvent } from "react";
import { AdminEntry } from "../components/AdminEntry";
import { Notice, PageIntro } from "../components/Layout";
import { useIdentity } from "./Workspace";
import { accessToken } from "../lib/auth";
import { api } from "../lib/api";

type Employee = {
  key: string; userId: string; firstName: string; lastName: string;
  nickname: string; active: boolean; version: number; createdAt: string;
  revokedAt?: string;
};
type Issued = { employee: Employee; password: string };
async function authorized<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = await accessToken();
  return api<T>(path, {
    method, headers: { Authorization: "Bearer " + token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, method === "POST" && (path === "/api/v1/admin/employees" || path.endsWith("/reissue")) ? 201 : 200);
}
function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [form, setForm] = useState({ firstName: "", lastName: "", nickname: "" });
  const [issued, setIssued] = useState<Issued>();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [reuseKey, setReuseKey] = useState<string>();
  const [revokeKey, setRevokeKey] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function reload(more = false) {
    setBusy(true); setError("");
    try {
      const query = more && cursor ? "?cursor=" + encodeURIComponent(cursor) : "";
      const page = await authorized<{ items: Employee[]; nextCursor?: string }>("/api/v1/admin/employees" + query);
      setEmployees((before) => more ? [...before, ...page.items] : page.items);
      setCursor(page.nextCursor);
    } catch (e) { setError(e instanceof Error ? e.message : "โหลดรายชื่อไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void reload(); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || issued) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authorized<Issued>(reuseKey
        ? "/api/v1/admin/employees/" + encodeURIComponent(reuseKey) + "/reissue"
        : "/api/v1/admin/employees", "POST", form);
      setIssued(result);
      setPasswordVisible(false);
      setCredentialsSaved(false);
      setCopyMessage("");
      setEmployees((list) => reuseKey
        ? list.map((row) => row.key === reuseKey ? result.employee : row)
        : [result.employee, ...list]);
      setReuseKey(undefined);
      setForm({ firstName: "", lastName: "", nickname: "" });
    } catch (e) { setError(e instanceof Error ? e.message : "สร้างพนักงานไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function copyCredential(which: "key" | "password" | "both") {
    if (!issued) return;
    const copied = which === "key" ? issued.employee.key :
      which === "password" ? issued.password :
      `คีย์พนักงาน: ${issued.employee.key}\nรหัสผ่าน: ${issued.password}\nหน้าเข้าสู่ระบบ: ${location.origin}/staff/login`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(copied);
      setCopyMessage(which === "key" ? "คัดลอกคีย์แล้ว" :
        which === "password" ? "คัดลอกรหัสผ่านแล้ว" : "คัดลอกคีย์และรหัสผ่านแล้ว");
    } catch {
      // iOS private mode and permissions may block the clipboard API.
      // Do not log or store the password; the inputs remain selectable.
      setCopyMessage("คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความในช่องแล้วคัดลอกด้วยตนเอง");
    }
  }
  function acknowledgeCredentials() {
    if (!credentialsSaved) return;
    setIssued(undefined);
    setPasswordVisible(false);
    setCredentialsSaved(false);
    setCopyMessage("");
  }
  async function revoke() {
    if (!revokeKey || busy) return;
    setBusy(true); setError("");
    try {
      const result = await authorized<{ employee: Employee }>(
        "/api/v1/admin/employees/" + encodeURIComponent(revokeKey) + "/revoke", "POST", {},
      );
      setEmployees((rows) => rows.map((row) => row.key === revokeKey ? result.employee : row));
      setNotice("ปิดบัญชี " + revokeKey + " แล้ว รหัสผ่านเก่าใช้ไม่ได้อีก แต่คีย์นี้สามารถออกใหม่ได้");
      setRevokeKey(undefined);
    } catch (e) { setError(e instanceof Error ? e.message : "ปิดคีย์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return (
    <div className="container employee-admin">
      <PageIntro eyebrow="FOUNDER / EMPLOYEE ACCESS" title="จัดการบัญชีพนักงาน">
        ออกคีย์และรหัสผ่านสำหรับพนักงาน เพื่อเข้าหน้าตอบแชทแยกจากระบบแอดมิน
      </PageIntro>
      <nav className="desk-nav" aria-label="พื้นที่ผู้ดูแล">
        <a href="/admin">คิวงาน</a>
        <a href="/admin/inbox">ข้อความลูกค้า</a>
        <a href="/admin/employees" aria-current="page">บัญชีพนักงาน</a>
      </nav>
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}
      <div className="employee-grid">
        <section className="employee-panel">
          <h2>{reuseKey ? "ออกบัญชีใหม่ด้วยคีย์ " + reuseKey : "สร้างบัญชีพนักงาน"}</h2>
          <p className="small-note">คีย์ใหม่รันเลขเริ่ม 00001 และเพิ่มหลักเมื่อครบ 99999 คีย์ที่ปิดแล้วสามารถใช้ซ้ำได้ โดยรหัสผ่านและบัญชีเดิมจะไม่กลับมาใช้ได้อีก</p>
          {reuseKey && <button type="button" className="button secondary small" disabled={busy}
            onClick={() => { setReuseKey(undefined); setForm({ firstName: "", lastName: "", nickname: "" }); }}>
            ยกเลิกการใช้คีย์เดิม
          </button>}
          {issued ? (
            <div className="employee-issued">
              <h3>ออกบัญชีสำเร็จ — แสดงรหัสผ่านครั้งเดียว</h3>
              <p>{issued.employee.firstName} {issued.employee.lastName} ({issued.employee.nickname})</p>
              <label className="field"><span>คีย์พนักงาน</span>
                <input aria-label="คีย์พนักงานที่สร้าง" readOnly value={issued.employee.key}
                  onFocus={(event) => event.currentTarget.select()} />
              </label>
              <button className="button secondary small employee-copy-action" type="button"
                onClick={() => void copyCredential("key")}>คัดลอกคีย์</button>
              <label className="field"><span>รหัสผ่านเริ่มต้น</span>
                <input aria-label="รหัสผ่านพนักงานที่สร้าง" readOnly
                  type={passwordVisible ? "text" : "password"} value={issued.password}
                  onFocus={(event) => event.currentTarget.select()} />
              </label>
              <div className="employee-secret-actions">
                <button className="button secondary small" type="button"
                  aria-pressed={passwordVisible} onClick={() => setPasswordVisible((value) => !value)}>
                  {passwordVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                </button>
                <button className="button secondary small" type="button"
                  onClick={() => void copyCredential("password")}>คัดลอกรหัสผ่าน</button>
                <button className="button secondary small" type="button"
                  onClick={() => void copyCredential("both")}>คัดลอกทั้งชุด</button>
              </div>
              {copyMessage && <p className="small-note" role="status">{copyMessage}</p>}
              <p className="small-note">แสดงรหัสผ่านครั้งเดียวเท่านั้น เก็บไว้ในที่ปลอดภัยและส่งให้พนักงานผ่านช่องทางส่วนตัว ห้ามส่งในกลุ่มแชท รหัสผ่านที่คัดลอกจะยังอยู่ในคลิปบอร์ดของอุปกรณ์จนกว่าจะถูกแทนที่</p>
              <a href="/staff/login">ลิงก์หน้าเข้าสู่ระบบพนักงาน</a>
              <label className="employee-credential-confirm">
                <input type="checkbox" checked={credentialsSaved}
                  onChange={(event) => setCredentialsSaved(event.target.checked)} />
                <span>ฉันบันทึกคีย์และรหัสผ่านเรียบร้อยแล้ว</span>
              </label>
              <button className="button secondary full" type="button"
                disabled={!credentialsSaved} onClick={acknowledgeCredentials}>
                รับทราบและสร้างบัญชีถัดไป
              </button>
            </div>
          ) : (
            <form className="employee-form" onSubmit={(e) => void create(e)}>
              <label className="field"><span>ชื่อจริง</span>
                <input required maxLength={70} value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </label>
              <label className="field"><span>นามสกุล</span>
                <input required maxLength={70} value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </label>
              <label className="field"><span>ชื่อเล่น</span>
                <input required maxLength={40} value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
              </label>
              <button className="button full" disabled={busy || !form.firstName.trim() ||
                !form.lastName.trim() || !form.nickname.trim()}>{reuseKey ? "ออกคีย์เดิมพร้อมรหัสผ่านใหม่" : "สร้างคีย์และรหัสผ่าน"}</button>
            </form>
          )}
        </section>
        <section className="employee-panel">
          <div className="employee-top"><h2>รายชื่อพนักงาน</h2>
            <button className="button secondary small" type="button" disabled={busy}
              onClick={() => void reload()}>โหลดใหม่</button></div>
          {employees.length === 0 && <p>ยังไม่มีพนักงานที่ออกคีย์</p>}
          <div className="employee-list">
            {employees.map((e) => (
              <article className="employee-record" key={e.key}>
                <div><strong>{e.nickname} — {e.firstName} {e.lastName}</strong>
                  <p>คีย์ {e.key} · {e.active ? "เปิดใช้งาน" : "ปิดแล้ว"}</p>
                  <small>สร้าง {new Date(e.createdAt).toLocaleDateString("th-TH")}</small>
                </div>
                {e.active ? <button className="button secondary small" type="button"
                  disabled={busy} onClick={() => setRevokeKey(e.key)}>ปิดคีย์</button>
                  : <button className="button secondary small" type="button" disabled={busy || !!issued}
                    onClick={() => { setReuseKey(e.key); setForm({ firstName: "", lastName: "", nickname: "" });
                      setError(""); setNotice(""); }}>นำคีย์ {e.key} กลับมาใช้</button>}
              </article>
            ))}
          </div>
          {cursor && <button className="button secondary full" type="button" disabled={busy}
            onClick={() => void reload(true)}>โหลดรายการเพิ่มเติม</button>}
        </section>
      </div>
      {revokeKey && (
        <section className="employee-revoke-dialog" role="dialog" aria-modal="true" aria-label="ยืนยันปิดคีย์">
          <h2>ยืนยันปิดคีย์ {revokeKey}?</h2>
          <p>บัญชีและรหัสผ่านเดิมจะใช้ไม่ได้อีก แต่คีย์เลขนี้สามารถออกให้พนักงานใหม่พร้อมรหัสผ่านใหม่ได้</p>
          <div className="row-actions">
            <button className="button secondary" disabled={busy} onClick={() => setRevokeKey(undefined)}>ยกเลิก</button>
            <button className="button" disabled={busy} onClick={() => void revoke()}>ยืนยันปิดคีย์</button>
          </div>
        </section>
      )}
    </div>
  );
}
export function AdminEmployees() {
  const s = useIdentity();
  if (!s.identity) return <AdminEntry loading={s.loading} reason={s.error} />;
  if (!s.identity.staff) return <AdminEntry denied reason="เฉพาะเจ้าของสตูดิโอเท่านั้น" />;
  return <EmployeeManager />;
}
