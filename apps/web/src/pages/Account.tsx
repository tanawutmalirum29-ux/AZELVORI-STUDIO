import { useEffect, useState } from "react";
import {
  LEAD_TRANSITIONS,
  SERVICE_LABELS,
  BUDGET_LABELS,
  type LeadRecord,
  type LeadStatus,
} from "@azelvori/contracts";
import { Icon } from "../components/Icon";
import { Notice, PageIntro } from "../components/Layout";
import {
  accessToken,
  authConfigured,
  finishLogin,
  logout,
  signIn,
} from "../lib/auth";
import { getLeads, patchLead } from "../lib/api";

export function Login() {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function login(destination: "app" | "admin") {
    setPending(true);
    try {
      await signIn(destination);
    } catch {
      setError("เปิดหน้าลงชื่อเข้าใช้ไม่ได้ กรุณาลองใหม่");
      setPending(false);
    }
  }
  return (
    <div className="container login-page">
      <div className="login-story">
        <span className="eyebrow">YOUR OWN SPACE</span>
        <h1>
          พื้นที่ของคุณ
          <br />
          <span className="accent">สำหรับทุกขั้นตอน</span>
        </h1>
        <p>
          ติดตามโปรเจกต์ ตรวจงาน และคุยรายละเอียด
          <br />
          ในพื้นที่ที่ออกแบบมาสำหรับงานของคุณ
        </p>
        <ul>
          {[
            "เห็นสถานะและสิ่งที่ต้องตรวจรับ",
            "ข้อมูลแยกตามโปรเจกต์",
            "เริ่มจากคำเชิญของสตูดิโอ",
          ].map((t) => (
            <li key={t}>
              <Icon name="check" />
              {t}
            </li>
          ))}
        </ul>
        <a className="text-link" href="/demo">
          สำรวจพอร์ทัลตัวอย่าง <Icon name="arrow" />
        </a>
      </div>
      <div className="login-card">
        <span className="service-icon">
          <Icon name="lock" size={27} />
        </span>
        <h2>ยินดีต้อนรับกลับ</h2>
        <p>เข้าสู่ระบบด้วยบัญชีที่ได้รับเชิญ</p>
        {!authConfigured && (
          <Notice>
            ยังไม่เปิดระบบบัญชีจริง
            คุณสามารถดูหน้าตาพอร์ทัลตัวอย่างได้โดยไม่ต้องลงทะเบียน
          </Notice>
        )}
        {error && <Notice kind="error">{error}</Notice>}
        <button
          className="button full"
          disabled={!authConfigured || pending}
          onClick={() => void login("app")}
        >
          เข้าสู่พื้นที่ลูกค้า <Icon name="arrow" />
        </button>
        <a className="button secondary full" href="/demo">
          ทดลองดูพอร์ทัล
        </a>
        <button
          className="text-link admin-login"
          disabled={!authConfigured || pending}
          onClick={() => void login("admin")}
        >
          เข้าสู่ระบบผู้ดูแล
        </button>
        <p className="small-note">
          การตั้งรหัสผ่านและกู้คืนบัญชีทำผ่านหน้าลงชื่อเข้าใช้ของ Amazon Cognito
        </p>
      </div>
    </div>
  );
}
export function Callback() {
  const [error, setError] = useState("");
  useEffect(() => {
    if (!authConfigured) {
      setError("ยังไม่ได้ตั้งค่าระบบบัญชี");
      return;
    }
    void finishLogin().catch(() => {
      history.replaceState(null, "", "/auth/callback");
      setError("ยืนยันการเข้าสู่ระบบไม่สำเร็จ ลิงก์อาจหมดอายุ กรุณาเริ่มใหม่");
    });
  }, []);
  return (
    <div className="container status-page">
      <PageIntro
        eyebrow="ACCOUNT"
        title={error ? "เข้าสู่ระบบไม่สำเร็จ" : "กำลังยืนยันบัญชี…"}
      />
      {error && <Notice kind="error">{error}</Notice>}
      <a href="/login" className="button secondary">
        กลับหน้าเข้าสู่ระบบ
      </a>
    </div>
  );
}
export function CustomerAccount() {
  const [state, setState] = useState<"loading" | "signed-in" | "signed-out">(
    "loading",
  );
  useEffect(() => {
    if (!authConfigured) {
      setState("signed-out");
      return;
    }
    void accessToken()
      .then(() => setState("signed-in"))
      .catch(() => setState("signed-out"));
  }, []);
  return (
    <div className="container status-page">
      <PageIntro
        eyebrow="CUSTOMER SPACE"
        title={state === "loading" ? "กำลังตรวจสอบบัญชี…" : "พื้นที่ลูกค้า"}
      />
      {state === "signed-in" ? (
        <>
          <Notice>
            เข้าสู่ระบบแล้ว ระบบโปรเจกต์จริงยังอยู่ระหว่างพัฒนา
            หน้าตัวอย่างแยกจากบัญชีและข้อมูลจริงของคุณ
          </Notice>
          <button className="button secondary" onClick={() => void logout()}>
            ออกจากระบบ
          </button>
        </>
      ) : (
        state === "signed-out" && (
          <>
            <Notice>
              กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับเชิญก่อนเข้าถึงข้อมูล
            </Notice>
            <a className="button" href="/login">
              ไปหน้าเข้าสู่ระบบ <Icon name="arrow" />
            </a>
          </>
        )
      )}
      <a className="text-link" href="/demo">
        ดูพอร์ทัลตัวอย่าง <Icon name="northeast" />
      </a>
    </div>
  );
}
const labels: Record<LeadStatus, string> = {
  NEW: "บรีฟใหม่",
  ACKNOWLEDGED: "รับเรื่องแล้ว",
  DISCOVERY: "เก็บรายละเอียด",
  QUALIFIED: "ผ่านการประเมิน",
  SCOPED: "วางขอบเขตแล้ว",
  QUOTED: "เสนอราคาแล้ว",
  WON: "ตกลงงาน",
  LOST: "ไม่ดำเนินการ",
};
export function Admin() {
  const [leads, setLeads] = useState<LeadRecord[]>([]),
    [selected, setSelected] = useState<LeadRecord | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cursor, setCursor] = useState<string>();
  async function load(next?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await getLeads(await accessToken(), next);
      setLeads((prev) =>
        next
          ? [
              ...prev,
              ...result.items.filter(
                (i) => !prev.some((p) => p.leadId === i.leadId),
              ),
            ]
          : result.items,
      );
      setCursor(result.nextCursor);
      if (!next) setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      setLeads([]);
      setSelected(null);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (authConfigured) void load();
    else setError("ระบบผู้ดูแลยังไม่ได้เชื่อมต่อ");
  }, []);
  async function update(status: LeadStatus) {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await patchLead(await accessToken(), selected, status);
      const changed = { ...selected, ...result };
      setSelected(changed);
      setLeads((prev) =>
        prev.map((l) => (l.leadId === selected.leadId ? changed : l)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container admin-page">
      <div className="admin-heading">
        <PageIntro eyebrow="STUDIO / CRM" title="บรีฟและโอกาสใหม่" />
        <button
          className="button secondary"
          disabled={!authConfigured || busy}
          onClick={() => void load()}
        >
          <Icon name="refresh" /> โหลดข้อมูลล่าสุด
        </button>
      </div>
      {error && (
        <Notice kind="error">
          {error} <a href="/login">เข้าสู่ระบบ</a>
        </Notice>
      )}
      <div className="crm-layout">
        <div className="lead-list" aria-label="รายการบรีฟ">
          {busy && !leads.length && <p role="status">กำลังโหลดบรีฟ…</p>}
          {!busy && !leads.length && (
            <div className="empty-state">
              <Icon name="folder" size={35} />
              <h2>ยังไม่มีบรีฟที่แสดงได้</h2>
              <p>ระบบจะแสดงข้อมูลเมื่อเชื่อมต่อและตรวจสิทธิ์ผู้ดูแลสำเร็จ</p>
            </div>
          )}
          {leads.map((lead) => (
            <button
              key={lead.leadId}
              className={`lead-card ${selected?.leadId === lead.leadId ? "selected" : ""}`}
              onClick={() => setSelected(lead)}
            >
              <span className="badge">{labels[lead.status]}</span>
              <strong>{lead.title}</strong>
              <small>
                {SERVICE_LABELS[lead.serviceType]} · {lead.contactName}
              </small>
              <small>{lead.leadId}</small>
            </button>
          ))}
          {cursor && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void load(cursor)}
            >
              โหลดเพิ่มเติม
            </button>
          )}
        </div>
        <section className="lead-detail">
          {selected ? (
            <>
              <span className="eyebrow">
                {selected.leadId} / V{selected.version}
              </span>
              <h2>{selected.title}</h2>
              <dl>
                <dt>ติดต่อ</dt>
                <dd>
                  {selected.contactName}
                  <br />
                  {selected.contactEmail}
                </dd>
                <dt>รายละเอียด</dt>
                <dd className="preserve-lines">{selected.description}</dd>
                <dt>แพลตฟอร์ม / เอนจิน</dt>
                <dd>
                  {selected.platform} / {selected.engine || "—"}
                </dd>
                <dt>งบที่เตรียมไว้</dt>
                <dd>{BUDGET_LABELS[selected.budget]}</dd>
                <dt>ช่วงเวลา</dt>
                <dd>
                  {selected.timeline} {selected.targetDate}
                </dd>
                <dt>สิ่งอ้างอิง</dt>
                <dd>
                  {selected.referenceUrl ? (
                    <a
                      href={selected.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      เปิดลิงก์อ้างอิง <Icon name="northeast" size={14} />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                {selected.serviceType === "GAME_BUGFIX" && (
                  <>
                    <dt>คาดหวัง</dt>
                    <dd>{selected.expected}</dd>
                    <dt>อาการจริง</dt>
                    <dd>{selected.actual}</dd>
                    <dt>ทำซ้ำ</dt>
                    <dd className="preserve-lines">{selected.reproduction}</dd>
                  </>
                )}
              </dl>
              <h3>ดำเนินการถัดไป</h3>
              <div className="status-actions">
                {LEAD_TRANSITIONS[selected.status].map((status) => (
                  <button
                    key={status}
                    className="button secondary small"
                    disabled={busy}
                    onClick={() => void update(status)}
                  >
                    {labels[status]}
                  </button>
                ))}
              </div>
              <p className="small-note">
                การเปลี่ยนสถานะบันทึกผู้ดำเนินการและเวอร์ชัน
                ไม่สร้างการชำระเงินหรือโปรเจกต์โดยอัตโนมัติ
              </p>
            </>
          ) : (
            <div className="empty-state">
              <Icon name="mail" size={35} />
              <h2>เลือกบรีฟเพื่ออ่านรายละเอียด</h2>
              <p>
                ข้อมูลส่วนนี้เข้าถึงได้เฉพาะผู้ดูแลที่ได้รับสิทธิ์จากเซิร์ฟเวอร์
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
