import { newRequestId } from "../lib/id";
import { useEffect, useRef, useState } from "react";
import { verifiedProgress, type Milestone } from "@azelvori/contracts";
import { Icon } from "../components/Icon";
import { Notice } from "../components/Layout";
import { ConceptSite } from "./Home";
type Tab = "overview" | "preview" | "chat" | "files" | "billing";
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "ภาพรวม", icon: "grid" },
  { id: "preview", label: "ตรวจงาน", icon: "monitor" },
  { id: "chat", label: "ข้อความ", icon: "chat" },
  { id: "files", label: "ไฟล์งาน", icon: "folder" },
  { id: "billing", label: "ข้อตกลง", icon: "shield" },
];
const milestones: Milestone[] = [
  {
    id: "m1",
    label: "บรีฟและขอบเขตงาน",
    weight: 25,
    status: "ACCEPTED",
    detail: "โครงสร้างหน้าและสิ่งที่ต้องส่งมอบ",
  },
  {
    id: "m2",
    label: "ออกแบบประสบการณ์",
    weight: 25,
    status: "ACTIVE",
    detail: "ต้นแบบหน้าแรกสำหรับตรวจความคิดเห็น",
  },
  {
    id: "m3",
    label: "พัฒนาและทดสอบ",
    weight: 30,
    status: "PENDING",
    detail: "พัฒนา responsive และตรวจฟังก์ชัน",
  },
  {
    id: "m4",
    label: "ตรวจรับและส่งมอบ",
    weight: 20,
    status: "PENDING",
    detail: "อนุมัติเวอร์ชันที่ระบุในข้อตกลง",
  },
];
export function Demo() {
  const [tab, setTab] = useState<Tab>("overview"),
    [device, setDevice] = useState("desktop");
  const [messages, setMessages] = useState([
    {
      id: "seed-1",
      text: "นี่คือตัวอย่างพื้นที่คุยงานของโปรเจกต์ ORBIT ข้อความจากหน้าตัวอย่างนี้จะไม่ส่งถึงสตูดิโอ",
      own: false,
    },
  ]);
  const [message, setMessage] = useState(""),
    [feedback, setFeedback] = useState(""),
    [revision, setRevision] = useState("");
  const [approved, setApproved] = useState(false),
    [modal, setModal] = useState<"approve" | "revision" | "file" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    lastMessage = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    if (messages.length > 1)
      lastMessage.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
  }, [messages]);
  function changeTab(id: Tab) {
    setTab(id);
    setNotice("");
  }
  return (
    <div className="demo-page">
      <div className="demo-banner">
        <span>
          <span className="tiny-dot" />
          <strong>พื้นที่ตัวอย่าง</strong> ข้อมูลสมมติ ·
          การเปลี่ยนแปลงอยู่เฉพาะหน้านี้
        </span>
        <a href="/start">
          เริ่มโปรเจกต์จริง <Icon name="northeast" size={15} />
        </a>
      </div>
      <div className="container demo-container">
        <div className="workspace-top">
          <div>
            <a href="/" className="back-link">
              <Icon name="back" size={15} /> กลับหน้าสตูดิโอ
            </a>
            <h1>
              สวัสดี, นักสร้างสรรค์<span className="accent">.</span>
            </h1>
            <p>พื้นที่ที่ทำให้คุณเห็นภาพเดียวกันตลอดโปรเจกต์</p>
          </div>
          <div className="avatar" aria-label="บัญชีตัวอย่าง">
            YO
          </div>
        </div>
        <div className="workspace">
          <aside className="workspace-sidebar">
            <span className="eyebrow">YOUR PROJECT</span>
            <div className="project-identity">
              <div className="project-monogram">o.</div>
              <div>
                <strong>ORBIT</strong>
                <span>Business website</span>
              </div>
            </div>
            <span className="badge">ตัวอย่าง / รอตรวจดีไซน์</span>
            <nav aria-label="ส่วนต่าง ๆ ของโปรเจกต์">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? "active" : ""}
                  aria-current={tab === t.id ? "page" : undefined}
                  onClick={() => changeTab(t.id)}
                >
                  <Icon name={t.icon} size={19} />
                  <span>{t.label}</span>
                  {t.id === "chat" && <small>{messages.length}</small>}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <Icon name="shield" size={18} />
              <p>
                หน้าตัวอย่างสาธารณะ
                <br />
                ไม่มีข้อมูลลูกค้าจริง
              </p>
            </div>
          </aside>
          <div className="workspace-main">
            <div className="workspace-heading">
              <div>
                <span className="eyebrow">PROJECT DEMO-001</span>
                <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
              </div>
              <span className="demo-pill">DEMO MODE</span>
            </div>
            {notice && <Notice kind="success">{notice}</Notice>}
            {tab === "overview" && (
              <>
                <div className="project-summary">
                  <div>
                    <span className="eyebrow">FROM CONCEPT TO REALITY</span>
                    <h3>ORBIT — เว็บไซต์แบรนด์ไลฟ์สไตล์</h3>
                    <p>
                      เว็บไซต์แนะนำแบรนด์และคอลเลกชัน
                      <br />
                      ขอบเขตตัวอย่าง: หน้าแรก · สินค้า · เรื่องราว · ติดต่อ
                    </p>
                    <button
                      className="button small"
                      onClick={() => changeTab("preview")}
                    >
                      ดูดีไซน์ที่รอตรวจ <Icon name="northeast" size={16} />
                    </button>
                  </div>
                  <div
                    className="progress-ring"
                    style={
                      {
                        "--progress": `${verifiedProgress(milestones)}%`,
                      } as React.CSSProperties
                    }
                  >
                    <div>
                      <strong>
                        {verifiedProgress(milestones)}
                        <span>%</span>
                      </strong>
                      <small>ตรวจรับแล้ว</small>
                    </div>
                  </div>
                </div>
                <p className="small-note">
                  ความคืบหน้าตัวอย่างคำนวณจากน้ำหนักช่วงงานที่ตรวจรับแล้วเท่านั้น
                </p>
                <div className="workspace-columns">
                  <section className="milestone-panel">
                    <h3>เส้นทางของโปรเจกต์</h3>
                    {milestones.map((m, i) => (
                      <div
                        className={`milestone ${m.status.toLowerCase()}`}
                        key={m.id}
                      >
                        <span className="milestone-dot">
                          {m.status === "ACCEPTED" ? (
                            <Icon name="check" size={14} />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <div>
                          <strong>{m.label}</strong>
                          <p>{m.detail}</p>
                        </div>
                        <small>
                          {m.status === "ACCEPTED"
                            ? "ตรวจรับแล้ว"
                            : m.status === "ACTIVE"
                              ? "กำลังทำ"
                              : "ถัดไป"}
                        </small>
                      </div>
                    ))}
                  </section>
                  <section className="next-action">
                    <span className="eyebrow">NEXT UP</span>
                    <Icon name="monitor" size={29} />
                    <h3>
                      ความคิดเห็นของคุณ
                      <br />
                      ช่วยให้งานไปต่อ
                    </h3>
                    <p>
                      ลองตรวจดีไซน์ตัวอย่าง และส่งคำขอแก้ไขที่ผูกกับเวอร์ชัน
                    </p>
                    <button
                      className="text-link"
                      onClick={() => changeTab("preview")}
                    >
                      เปิดตรวจงาน <Icon name="arrow" />
                    </button>
                  </section>
                </div>
              </>
            )}
            {tab === "preview" && (
              <>
                <div className="preview-toolbar">
                  <div>
                    <strong>หน้าแรก / Concept v0.1</strong>
                    <span>
                      {approved
                        ? "ทดลองอนุมัติเวอร์ชันนี้แล้ว"
                        : "ตัวอย่างดีไซน์สำหรับลองตรวจงาน"}
                    </span>
                  </div>
                  <div
                    className="device-switch"
                    role="group"
                    aria-label="ขนาดพรีวิว"
                  >
                    {[
                      ["desktop", "เดสก์ท็อป"],
                      ["tablet", "แท็บเล็ต"],
                      ["mobile", "มือถือ"],
                    ].map(([v, t]) => (
                      <button
                        key={v}
                        className={device === v ? "active" : ""}
                        aria-pressed={device === v}
                        onClick={() => setDevice(v)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={`preview-stage ${device}`}>
                  <div className="preview-site-wrap">
                    <ConceptSite compact={device === "mobile"} />
                  </div>
                </div>
                <p className="small-note">
                  คอนเซปต์ที่สร้างในหน้านี้ ใช้เพื่อทดลองการตรวจงาน ยังไม่มี
                  build หรือเว็บไซต์ลูกค้าที่ deploy จริง
                </p>
                {revision && (
                  <Notice>คำขอแก้ไขตัวอย่างสำหรับ v0.1: {revision}</Notice>
                )}
                <div className="review-actions">
                  <button
                    className="button secondary"
                    onClick={() => setModal("revision")}
                  >
                    <Icon name="chat" size={18} /> ทดลองขอแก้ไข
                  </button>
                  <button
                    className="button"
                    disabled={approved}
                    onClick={() => setModal("approve")}
                  >
                    <Icon name="check" size={18} />
                    {approved ? "ทดลองอนุมัติแล้ว" : "ทดลองอนุมัติเวอร์ชัน"}
                  </button>
                </div>
              </>
            )}
            {tab === "chat" && (
              <div className="chat-panel">
                <div className="chat-header">
                  <span className="avatar small">AZ</span>
                  <div>
                    <strong>ห้องคุยโปรเจกต์ ORBIT</strong>
                    <span>ตัวอย่างข้อความ · ไม่ส่งถึงสตูดิโอ</span>
                  </div>
                </div>
                <div className="chat-thread" aria-live="polite">
                  {messages.map((m) => (
                    <div className={`message ${m.own ? "own" : ""}`} key={m.id}>
                      <small>
                        {m.own ? "คุณ / ตัวอย่าง" : "ข้อความแนะนำตัวอย่าง"}
                      </small>
                      <p>{m.text}</p>
                      <span>
                        {m.own ? "เพิ่มในหน้าตัวอย่างแล้ว" : "เริ่มทดลองใช้งาน"}
                      </span>
                    </div>
                  ))}
                  <div ref={lastMessage} />
                </div>
                <form
                  className="chat-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = message.trim();
                    if (!value) return;
                    setMessages((prev) => [
                      ...prev,
                      { id: newRequestId(), text: value, own: true },
                    ]);
                    setMessage("");
                  }}
                >
                  <label htmlFor="demo-message" className="sr-only">
                    ข้อความตัวอย่าง
                  </label>
                  <textarea
                    id="demo-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="ลองเขียนข้อความ… ห้ามใส่ข้อมูลลับ"
                  />
                  <button
                    className="button"
                    disabled={!message.trim()}
                    type="submit"
                    aria-label="เพิ่มข้อความตัวอย่าง"
                  >
                    <Icon name="arrow" />
                  </button>
                </form>
              </div>
            )}
            {tab === "files" && (
              <>
                <Notice>
                  ระบบไฟล์ส่วนตัวและการตรวจไฟล์ยังไม่เปิดใช้งาน
                  ตัวอย่างนี้ไม่รับไฟล์หรืออัปโหลดข้อมูลใด ๆ
                </Notice>
                <button
                  className="sample-file"
                  onClick={() => setModal("file")}
                >
                  <span className="service-icon">
                    <Icon name="folder" />
                  </span>
                  <span>
                    <strong>ขอบเขตงาน ORBIT</strong>
                    <small>เอกสารตัวอย่าง · เปิดอ่านในหน้านี้</small>
                  </span>
                  <Icon name="northeast" />
                </button>
                <div className="empty-state">
                  <Icon name="shield" size={35} />
                  <h3>พื้นที่สำหรับไฟล์ที่เกี่ยวข้องกับงาน</h3>
                  <p>
                    ระบบจริงจะตรวจสิทธิ์ทุกครั้ง
                    และเปิดดาวน์โหลดหลังไฟล์ผ่านการตรวจเท่านั้น
                  </p>
                </div>
              </>
            )}
            {tab === "billing" && (
              <>
                <Notice>
                  ยังไม่มีใบเสนอราคาจริงและยังไม่เปิดรับชำระเงิน
                  การกดในหน้าตัวอย่างไม่ทำธุรกรรมใด ๆ
                </Notice>
                <div className="agreement">
                  <span className="eyebrow">SAMPLE SCOPE / V0.1</span>
                  <h3>ข้อตกลงเริ่มจากความชัดเจน</h3>
                  <dl>
                    <dt>งานส่งมอบตัวอย่าง</dt>
                    <dd>เว็บไซต์แนะนำแบรนด์ 4 หน้า พร้อมการแสดงผลบนมือถือ</dd>
                    <dt>ขอบเขตที่ไม่รวม</dt>
                    <dd>ตะกร้าสินค้า ระบบรับเงิน และระบบสมาชิก</dd>
                    <dt>ราคา / รอบแก้ไข / วันส่ง</dt>
                    <dd>ต้องประเมินและตกลงก่อนเริ่มงาน</dd>
                    <dt>การอนุมัติ</dt>
                    <dd>ผูกกับรายละเอียดและเวอร์ชันของใบเสนอราคา</dd>
                  </dl>
                  <a href="/start" className="button secondary">
                    เริ่มบรีฟเพื่อประเมินงาน <Icon name="arrow" />
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="modal"
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
        aria-labelledby="dialog-title"
      >
        <div className="modal-heading">
          <span className="eyebrow">DEMO / CONCEPT V0.1</span>
          <button
            className="icon-button"
            aria-label="ปิดหน้าต่าง"
            onClick={() => setModal(null)}
          >
            <Icon name="close" />
          </button>
        </div>
        <h2 id="dialog-title">
          {modal === "approve"
            ? "ทดลองอนุมัติดีไซน์ v0.1"
            : modal === "revision"
              ? "ลองส่งความคิดเห็น"
              : "ขอบเขตงานตัวอย่าง"}
        </h2>
        {modal === "approve" ? (
          <>
            <p>
              การอนุมัตินี้เปลี่ยนเฉพาะหน้าตัวอย่าง
              ไม่ใช่การตรวจรับงานจริงหรือยืนยันการชำระเงิน
            </p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setModal(null)}>
                กลับไปตรวจต่อ
              </button>
              <button
                className="button"
                onClick={() => {
                  setApproved(true);
                  setModal(null);
                  setNotice("บันทึกการอนุมัติตัวอย่าง v0.1 ในหน้านี้แล้ว");
                }}
              >
                ยืนยันการทดลอง <Icon name="check" />
              </button>
            </div>
          </>
        ) : modal === "revision" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!feedback.trim()) return;
              setRevision(feedback.trim());
              setFeedback("");
              setModal(null);
            }}
          >
            <label className="field" htmlFor="feedback">
              <span>ต้องการให้ปรับอะไร?</span>
              <textarea
                id="feedback"
                maxLength={1000}
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="เช่น อยากให้หัวข้อหน้าแรกอ่านง่ายขึ้น"
                autoFocus
              />
            </label>
            <p className="small-note">
              ความคิดเห็นนี้ผูกกับ Concept v0.1 และอยู่เฉพาะหน้านี้
            </p>
            <button className="button" disabled={!feedback.trim()}>
              เพิ่มความคิดเห็นตัวอย่าง <Icon name="arrow" />
            </button>
          </form>
        ) : (
          <>
            <p>โปรเจกต์สมมติ: ORBIT</p>
            <ul>
              <li>หน้าแรกและคอลเลกชัน</li>
              <li>เรื่องราวของแบรนด์</li>
              <li>หน้าติดต่อ</li>
              <li>ทดสอบการแสดงผลบนมือถือ</li>
            </ul>
            <p className="small-note">
              ไม่มีข้อมูลส่วนบุคคลหรือซอร์สโค้ดของลูกค้าในเอกสารนี้
            </p>
          </>
        )}
      </dialog>
    </div>
  );
}
