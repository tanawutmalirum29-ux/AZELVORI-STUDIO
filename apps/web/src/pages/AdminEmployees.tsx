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
  }, method === "POST" && path === "/api/v1/admin/employees" ? 201 : 200);
}
function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [form, setForm] = useState({ firstName: "", lastName: "", nickname: "" });
  const [issued, setIssued] = useState<Issued>();
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
      const result = await authorized<Issued>("/api/v1/admin/employees", "POST", form);
      setIssued(result);
      setEmployees((list) => [result.employee, ...list]);
      setForm({ firstName: "", lastName: "", nickname: "" });
    } catch (e) { setError(e instanceof Error ? e.message : "สร้างพนักงานไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (!revokeKey || busy) return;
    setBusy(true); setError("");
    try {
      const result = await authorized<{ employee: Employee }>(
        "/api/v1/admin/employees/" + encodeURIComponent(revokeKey) + "/revoke", "POST", {},
      );
      setEmployees((rows) => rows.map((row) => row.key === revokeKey ? result.employee : row));
      setNotice("ปิดบัญชี " + revokeKey + " แล้ว ไม่สามารถนำรหัสนี้กลับมาใช้ซ้ำ");
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
          <h2>สร้างบัญชีพนักงาน</h2>
          <p className="small-note">คีย์รันเลขลำดับเริ่ม 00001 เพิ่มหลักเมื่อครบ 99999 และไม่วนกลับมาใช้ซ้ำ</p>
          {issued ? (
            <div className="employee-issued">
              <h3>ออกบัญชีสำเร็จ — แสดงรหัสผ่านครั้งเดียว</h3>
              <p>{issued.employee.firstName} {issued.employee.lastName} ({issued.employee.nickname})</p>
              <label className="field"><span>คีย์พนักงาน</span>
                <input aria-label="คีย์พนักงานที่สร้าง" readOnly value={issued.employee.key} />
              </label>
              <label className="field"><span>รหัสผ่านเริ่มต้น</span>
                <input aria-label="รหัสผ่านพนักงานที่สร้าง" readOnly value={issued.password} />
              </label>
              <p className="small-note">จดหรือส่งผ่านช่องทางส่วนตัวให้พนักงาน รหัสผ่านจะไม่แสดงให้แอดมินดูย้อนหลัง</p>
              <a href="/staff/login">ลิงก์หน้าเข้าสู่ระบบพนักงาน</a>
              <button className="button secondary full" type="button"
                onClick={() => setIssued(undefined)}>รับทราบและสร้างบัญชีถัดไป</button>
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
                !form.lastName.trim() || !form.nickname.trim()}>สร้างคีย์และรหัสผ่าน</button>
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
                {e.active && <button className="button secondary small" type="button"
                  disabled={busy} onClick={() => setRevokeKey(e.key)}>ปิดคีย์</button>}
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
          <p>พนักงานจะหมดสิทธิ์ตอบแชททันที คีย์นี้ไม่สามารถเปิดกลับหรือออกซ้ำได้</p>
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
