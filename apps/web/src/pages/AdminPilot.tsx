import { useEffect, useRef, useState } from "react";
import { AdminEntry } from "../components/AdminEntry";
import { Notice, PageIntro } from "../components/Layout";
import { accessToken } from "../lib/auth";
import { api, ApiError } from "../lib/api";
import { newRequestId } from "../lib/id";
import { useIdentity } from "./Workspace";

type PilotHealth = { status: string; pilotEnabled?: boolean; intakeEnabled: boolean };
type PilotReceipt = { leadId: string; receivedAt: string; status: "RECEIVED" };

/**
 * Live/stored synthetic-data pilot: NOT public intake, billing, or a demo mock.
 * The server generates fixed non-PII lead fields and checks founder privileges.
 */
function PilotDesk() {
  const [status, setStatus] = useState<"checking" | "ready" | "off" | "error">("checking");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<PilotReceipt>();
  // Keep the UUID on any network failure so that retries never duplicate the lead.
  const key = useRef(newRequestId());
  useEffect(() => {
    let active = true;
    void api<PilotHealth>("/health").then((health) => {
      if (active) setStatus(health.pilotEnabled && !health.intakeEnabled ? "ready" : "off");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, []);
  async function create() {
    if (sending || receipt || status !== "ready") return;
    setSending(true); setError("");
    try {
      const token = await accessToken();
      const data = await api<PilotReceipt>("/api/v1/admin/pilot/leads", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Idempotency-Key": key.current,
        },
      }, 202);
      if (!/^LEAD-\d{4}-[A-F0-9]{16}$/.test(data.leadId) || data.status !== "RECEIVED")
        throw new ApiError(502, "INVALID_RECEIPT", "ไม่พบเลขรับเรื่องที่ถูกต้อง กรุณาลองด้วยคำขอเดิม");
      setReceipt(data);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "บันทึกข้อมูลทดสอบไม่ได้");
    } finally { setSending(false); }
  }
  return (
    <div className="container employee-admin">
      <PageIntro eyebrow="FOUNDER / LIVE PILOT" title="ทดลองระบบงานจริง">
        ใช้ AWS Staging และ DynamoDB จริง แต่ใช้ข้อมูลสมมติเท่านั้น ไม่มีการเปิดรับลูกค้าสาธารณะหรือเรียกเก็บเงินจริง
      </PageIntro>
      <nav className="desk-nav" aria-label="พื้นที่ผู้ดูแล">
        <a href="/admin">คิวงาน</a>
        <a href="/admin/pilot" aria-current="page">ทดสอบระบบจริง</a>
        <a href="/admin/projects">โปรเจกต์</a>
        <a href="/admin/inbox">ข้อความลูกค้า</a>
        <a href="/admin/employees">พนักงาน</a>
      </nav>
      <section className="employee-panel pilot-desk">
        <h2>ขั้นตอนที่ 1 — สร้างบรีฟทดสอบจริง</h2>
        {status === "checking" && <Notice>กำลังตรวจสอบว่าระบบทดสอบบน AWS เปิดแล้วหรือยัง…</Notice>}
        {status === "off" && <Notice>โหมด Pilot ยังไม่เปิดบน Lambda โปรดตรวจและ Deploy Staging ด้วยค่า pilotEnabled=true โดยไม่เปิด public intake</Notice>}
        {status === "error" && <Notice kind="error">ยังติดต่อ API ไม่ได้ โปรดตรวจการเชื่อมต่อและลองโหลดหน้าใหม่</Notice>}
        <p>ระบบจะสร้างรายการชื่อ <strong>[TEST PILOT]</strong> พร้อมอีเมลสมมติ ไม่มีชื่อหรือข้อมูลลูกค้าจริง และไม่สร้างสัญญาหรือใบแจ้งหนี้</p>
        {error && <Notice kind="error">{error}</Notice>}
        {receipt ? (
          <Notice kind="success">บันทึกลงระบบจริงแล้ว เลขรับเรื่อง: <strong>{receipt.leadId}</strong></Notice>
        ) : (
          <button className="button" type="button"
            disabled={status !== "ready" || sending} onClick={() => void create()}>
            {sending ? "กำลังบันทึกลงระบบ…" : "สร้างบรีฟทดสอบในฐานข้อมูลจริง"}
          </button>
        )}
        <p className="small-note">หากเครือข่ายหลุด ให้กดซ้ำในหน้านี้โดยไม่รีเฟรช ระบบใช้รหัสคำขอเดิมเพื่อป้องกันบรีฟซ้ำ</p>
      </section>
      <section className="employee-panel pilot-desk">
        <h2>ขั้นตอนที่ 2 — ทดลองการทำงานทุกบทบาท</h2>
        <ol className="pilot-steps">
          <li>เปิด <a href="/admin">คิวงานแอดมิน</a> เลือกบรีฟที่ขึ้นต้น [TEST PILOT] และลองรับเรื่อง/ประเมิน/วางขอบเขตตามสถานะจริง</li>
          <li>เมื่อผ่านการประเมินแล้ว ลอง <a href="/admin/projects">สร้างโปรเจกต์</a> และทดลองออกคำเชิญให้บัญชีทดสอบที่คุณควบคุม</li>
          <li>เข้า <a href="/admin/inbox">แชทแอดมิน</a>, <a href="/staff/login">แชทพนักงาน</a> และ <a href="/app">พื้นที่ลูกค้า</a> ด้วยบัญชีที่มีสิทธิ์แยกกัน แล้วทดสอบส่งข้อความ</li>
          <li>ทดสอบการปิดคีย์พนักงานผ่าน <a href="/admin/employees">หน้าจัดการพนักงาน</a> และยืนยันว่าบัญชีเดิมเข้าใช้งานไม่ได้</li>
        </ol>
        <Notice>ขั้นตอนชำระเงินจริง อัปโหลดไฟล์ส่งมอบ ระบบแจ้งเตือน และการเปิดรับบรีฟสาธารณะ ยังไม่พร้อมใช้งานจริง และไม่ถูกจำลองให้ดูเหมือนว่าทำงานแล้ว</Notice>
        <a href="/demo" className="button secondary">ดูตัวอย่างหน้าพอร์ทัล (ข้อมูลจำลอง ไม่บันทึกจริง)</a>
      </section>
    </div>
  );
}

export function AdminPilot() {
  const session = useIdentity();
  if (!session.identity)
    return <AdminEntry loading={session.loading} reason={session.error} />;
  if (!session.identity.staff)
    return <AdminEntry denied reason="โหมดทดสอบงานจริงใช้ได้เฉพาะบัญชีเจ้าของสตูดิโอ" />;
  return <PilotDesk />;
}
