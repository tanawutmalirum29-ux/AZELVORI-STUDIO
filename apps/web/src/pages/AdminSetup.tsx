import { useState } from "react";
import { z } from "zod";
import { PageIntro, Notice } from "../components/Layout";
import { authConfigured } from "../lib/auth";
import { api, apiBase, intakeEnabled } from "../lib/api";

const HealthSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("azelvori-api"),
  schemaVersion: z.number(),
  capabilities: z.array(z.string()).optional(),
  intakeEnabled: z.boolean().optional(),
});
export function AdminSetup() {
  const [health, setHealth] = useState<z.infer<typeof HealthSchema> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const apiConfigured = /^https:\/\//.test(apiBase);
  async function check() {
    setBusy(true);
    setError("");
    setHealth(null);
    try {
      const result = HealthSchema.safeParse(
        await api<unknown>("/health", {}, 200),
      );
      if (!result.success)
        throw new Error(
          "ปลายทางไม่ใช่ API ของ AZELVORI ที่รองรับ ตรวจ URL และการเผยแพร่ backend",
        );
      setHealth(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เชื่อมต่อ API ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  const checks = [
    ["ระบบบัญชี", authConfigured, "ตั้งค่า Cognito เพื่อเปิดหน้าลงชื่อเข้าใช้"],
    ["ปลายทาง API", apiConfigured, "ตั้งค่า API เพื่ออ่านและบันทึกงาน"],
    [
      "รับบรีฟบนหน้าเว็บ",
      intakeEnabled,
      "เปิดเมื่อข้อมูลธุรกิจและนโยบายพร้อมแล้ว",
    ],
  ] as const;
  return (
    <div className="container admin-setup">
      <PageIntro eyebrow="STUDIO DESK / SETUP" title="เปิดใช้งานแอดมินครั้งแรก">
        ตรวจการเชื่อมต่อ สร้างบัญชีเจ้าของ แล้วเริ่มรับและดูแลงาน
      </PageIntro>
      <nav className="desk-nav" aria-label="พื้นที่ผู้ดูแล">
        <a href="/admin">บรีฟและคิวงาน</a>
        <a href="/admin/projects">จัดการโปรเจกต์</a>
        <a href="/admin/login">เข้าสู่ระบบผู้ดูแล</a>
      </nav>
      <div className="setup-grid">
        <section className="setup-panel">
          <h2>ความพร้อมของเว็บนี้</h2>
          <p className="small-note">
            รายการนี้อ่านค่าที่ตั้งไว้ตอนเผยแพร่เว็บ
            ยังไม่ยืนยันว่าลงชื่อเข้าใช้หรือบันทึกฐานข้อมูลสำเร็จ
          </p>
          <ul className="setup-checks">
            {checks.map(([label, ready, hint]) => (
              <li key={label}>
                <div>
                  <strong>{label}</strong>
                  <p>{hint}</p>
                </div>
                <span className={`badge ${ready ? "ready" : ""}`}>
                  {ready ? "ตั้งค่าแล้ว" : "ยังไม่เปิด"}
                </span>
              </li>
            ))}
          </ul>
          <button
            className="button secondary"
            disabled={!apiConfigured || busy}
            onClick={() => void check()}
          >
            {busy ? "กำลังตรวจ…" : "ทดสอบการตอบกลับ API"}
          </button>
          {error && (
            <Notice kind="error">
              {error} หากเพิ่งตั้งค่า ให้ตรวจ CORS และเผยแพร่เว็บใหม่
            </Notice>
          )}
          {health && (
            <Notice
              kind={
                health.capabilities?.includes("crm-follow-up")
                  ? "success"
                  : "info"
              }
            >
              API ตอบกลับแล้ว ·{" "}
              {health.capabilities?.includes("crm-follow-up")
                ? "รองรับบันทึกติดตามบรีฟ"
                : "ต้องอัปเดต backend เพื่อใช้บันทึกติดตามบรีฟ"}
              <br />
              ฝั่งเซิร์ฟเวอร์รับบรีฟ:{" "}
              {health.intakeEnabled === undefined
                ? "ยังตรวจไม่ได้"
                : health.intakeEnabled
                  ? "เปิด"
                  : "ปิด"}
              <br />
              การตรวจนี้ยังไม่ทดสอบฐานข้อมูลหรือสิทธิ์ผู้ดูแล
            </Notice>
          )}
        </section>
        <section className="setup-panel">
          <h2>เริ่มใช้งาน 3 ขั้นตอน</h2>
          <ol className="setup-steps">
            <li>
              <strong>เชื่อมระบบ AWS</strong>
              <p>
                เผยแพร่ backend โดยใช้ที่อยู่เว็บนี้เป็น App origin แล้วนำค่าจาก
                Stack outputs ใส่ Environment variables ของ Amplify
                และเผยแพร่เว็บอีกครั้ง
              </p>
            </li>
            <li>
              <strong>สร้างบัญชีเจ้าของสตูดิโอ</strong>
              <p>
                ผู้ดูแล AWS ใช้คำสั่ง admin:setup ตามคู่มือเพื่อสร้างบัญชี
                Cognito และสิทธิ์ FOUNDER_ADMIN ระบบส่งคำเชิญไปยังอีเมลที่ระบุ
              </p>
            </li>
            <li>
              <strong>เข้าสู่ระบบและเริ่มงาน</strong>
              <p>
                เปิด /admin/login ตั้งรหัสผ่านส่วนตัวและ Authenticator
                ตามหน้าบัญชี จากนั้นเปิด /admin เพื่อรับเรื่องและติดตามบรีฟ หรือ
                /admin/projects เพื่อคุมงาน
              </p>
            </li>
          </ol>
          <a className="button" href="/admin/login">
            ไปหน้าเข้าสู่ระบบผู้ดูแล
          </a>
          <a
            className="text-link"
            href="https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/blob/main/docs/17_ADMIN_ACTIVATION.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            คู่มือตั้งค่าและคำสั่งสำหรับผู้ดูแล AWS ↗
          </a>
        </section>
      </div>
      <details className="setup-panel setup-technical">
        <summary>ชื่อค่าที่ต้องตั้งใน Amplify</summary>
        <ul>
          {[
            "VITE_API_BASE_URL",
            "VITE_COGNITO_AUTHORITY",
            "VITE_COGNITO_CLIENT_ID",
            "VITE_COGNITO_DOMAIN",
            "VITE_SITE_URL",
            "VITE_PUBLIC_INTAKE_ENABLED",
          ].map((v) => (
            <li key={v}>
              <code>{v}</code>
            </li>
          ))}
        </ul>
        <p>
          ใช้ค่าจาก backend ของบัญชีคุณเท่านั้น ค่ากลุ่ม VITE_ เปิดเผยในเว็บได้
          จึงห้ามใส่ AWS secret key หรือรหัสผ่านในช่องเหล่านี้
        </p>
      </details>
    </div>
  );
}
