import { useState } from "react";
import { authConfigured, logout, signIn } from "../lib/auth";
import { apiBase } from "../lib/api";
import { Icon } from "./Icon";
import { Notice } from "./Layout";

export function AdminEntry({
  loading = false,
  reason = "",
  denied = false,
}: {
  loading?: boolean;
  reason?: string;
  denied?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const configured = authConfigured && /^https:\/\//.test(apiBase);
  async function enter() {
    setBusy(true);
    setError("");
    try {
      await (denied ? logout() : signIn("admin"));
    } catch {
      setError("เปิดหน้าบัญชีไม่ได้ กรุณาลองใหม่");
      setBusy(false);
    }
  }
  return (
    <div className="container login-page admin-entry">
      <div className="login-story">
        <span className="eyebrow">AZELVORI / STUDIO DESK</span>
        <h1>
          รับบรีฟ วางแผน
          <br />
          <span className="accent">แล้วพางานไปต่อ</span>
        </h1>
        <p>
          พื้นที่ผู้ดูแลสำหรับทุกวันทำงาน
          ตั้งแต่คุยรายละเอียดแรกจนถึงส่งมอบให้ลูกค้า
        </p>
        <ul>
          {[
            "จัดคิวบรีฟและนัดติดตาม",
            "คุมโปรเจกต์และขั้นตอนตรวจรับ",
            "ตอบลูกค้าและจัดการสมาชิก",
          ].map((t) => (
            <li key={t}>
              <Icon name="check" />
              {t}
            </li>
          ))}
        </ul>
        <a className="text-link" href="/admin/setup">
          ตรวจความพร้อมและวิธีเปิดใช้งาน <Icon name="arrow" />
        </a>
      </div>
      <section className="login-card">
        <span className="service-icon">
          <Icon name="lock" size={27} />
        </span>
        <h2>
          {denied ? "บัญชีนี้ยังไม่มีสิทธิ์ผู้ดูแล" : "เข้าสู่ระบบผู้ดูแล"}
        </h2>
        <p>สำหรับเจ้าของสตูดิโอที่ได้รับสิทธิ์จากระบบ</p>
        {loading ? (
          <p role="status">กำลังตรวจสอบสิทธิ์…</p>
        ) : (
          <>
            {!configured && (
              <Notice>
                เว็บนี้ยังไม่ได้เชื่อมระบบบัญชีหรือ API
                จึงยังเปิดข้อมูลจริงไม่ได้
                เริ่มจากหน้าตรวจความพร้อมเพื่อตั้งค่าครั้งแรก
              </Notice>
            )}
            {configured && reason && <Notice>{reason}</Notice>}
            {error && <Notice kind="error">{error}</Notice>}
            <button
              className="button full"
              disabled={!configured || busy}
              onClick={() => void enter()}
            >
              {denied ? "ออกจากระบบเพื่อเปลี่ยนบัญชี" : "เข้าสู่ระบบผู้ดูแล"}{" "}
              <Icon name="arrow" />
            </button>
            <a className="button secondary full" href="/admin/setup">
              วิธีเปิดหน้าแอดมินครั้งแรก
            </a>
            {denied && (
              <a className="text-link" href="/app">
                กลับพื้นที่ลูกค้า
              </a>
            )}
            <p className="small-note">
              ใช้บัญชี Amazon Cognito พร้อมรหัสยืนยันจากแอป Authenticator
              ไม่มีรหัสแอดมินกลาง และการมีบัญชีลูกค้าไม่ได้ให้สิทธิ์ผู้ดูแล
            </p>
          </>
        )}
      </section>
    </div>
  );
}
