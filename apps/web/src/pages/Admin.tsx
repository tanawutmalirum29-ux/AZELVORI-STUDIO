import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  LEAD_STATUSES,
  LEAD_TRANSITIONS,
  SERVICE_LABELS,
  BUDGET_LABELS,
  LeadFollowUpSchema,
  type LeadRecord,
  type LeadStatus,
  type LeadFollowUp,
} from "@azelvori/contracts";
import { AdminEntry } from "../components/AdminEntry";
import { Icon } from "../components/Icon";
import { Notice, PageIntro } from "../components/Layout";
import { getLead, getLeads, patchLead, ApiError } from "../lib/api";
import { accessToken, logout } from "../lib/auth";
import { ProjectCreateCard, useIdentity } from "./Workspace";

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
const dateTime = (s: string) =>
  new Date(s).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const needsFollowUp = (l: LeadRecord) =>
  !["LOST", "WON"].includes(l.status) &&
  !!l.followUp?.followUpDate &&
  l.followUp.followUpDate <= today();
const message = (e: unknown) =>
  e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ กรุณาลองใหม่";
async function token() {
  try {
    return await accessToken();
  } catch {
    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "กรุณาเข้าสู่ระบบผู้ดูแลอีกครั้ง",
    );
  }
}

export function Admin() {
  const session = useIdentity();
  if (!session.identity)
    return <AdminEntry loading={session.loading} reason={session.error} />;
  if (!session.identity.staff)
    return (
      <AdminEntry denied reason="บัญชีลูกค้าไม่สามารถเปิดข้อมูลสตูดิโอได้" />
    );
  return (
    <Desk
      email={session.identity.email}
      onLost={(reason) => {
        session.setError(reason);
        session.setIdentity(null);
      }}
    />
  );
}
function Desk({
  email,
  onLost,
}: {
  email: string;
  onLost: (s: string) => void;
}) {
  const [leads, setLeads] = useState<LeadRecord[]>([]),
    [selected, setSelected] = useState<LeadRecord | null>(null),
    [projectId, setProjectId] = useState<string>(),
    [cursor, setCursor] = useState<string>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("ALL"),
    [queue, setQueue] = useState("ALL"),
    [dirty, setDirty] = useState(false),
    [stale, setStale] = useState(false);
  const lock = useRef(false),
    mounted = useRef(true),
    dirtyRef = useRef(false),
    detail = useRef<HTMLElement>(null);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function fail(e: unknown) {
    if (!mounted.current) return;
    if (e instanceof ApiError && [401, 403].includes(e.status)) {
      setLeads([]);
      setSelected(null);
      onLost(message(e));
    } else {
      setError(message(e));
      if (e instanceof ApiError && e.status === 409) setStale(true);
    }
  }
  const discard = () =>
    !dirtyRef.current ||
    window.confirm(
      "มีบันทึกที่ยังไม่บันทึก ต้องการทิ้งร่างและเปลี่ยนข้อมูลที่เปิดอยู่หรือไม่?",
    );
  async function load(next?: string) {
    if (lock.current || (!next && !discard())) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const result = await getLeads(await token(), next);
      if (!mounted.current) return;
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
      if (!next) {
        setSelected(null);
        setProjectId(undefined);
        setDirty(false);
        setStale(false);
      }
    } catch (e) {
      fail(e);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, []);
  async function choose(id: string) {
    if (lock.current || !discard()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const result = await getLead(await token(), id);
      if (!mounted.current) return;
      setSelected(result.lead);
      setProjectId(result.projectId);
      setDirty(false);
      setStale(false);
      setLeads((prev) => prev.map((l) => (l.leadId === id ? result.lead : l)));
      requestAnimationFrame(() =>
        detail.current?.focus({ preventScroll: true }),
      );
    } catch (e) {
      fail(e);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function update(change: LeadStatus | LeadFollowUp) {
    if (lock.current || !selected || stale) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const saved = await patchLead(await token(), selected, change);
      if (!mounted.current) return;
      setSelected(saved);
      setLeads((prev) =>
        prev.map((l) => (l.leadId === saved.leadId ? saved : l)),
      );
      setDirty(false);
      setNote(
        typeof change === "string"
          ? `เปลี่ยนสถานะเป็น “${labels[saved.status]}” แล้ว`
          : "บันทึกติดตามงานแล้ว",
      );
    } catch (e) {
      fail(e);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const counts = {
    ALL: leads.length,
    NEW: leads.filter((l) => l.status === "NEW").length,
    FOLLOW_UP: leads.filter(needsFollowUp).length,
    HIGH: leads.filter(
      (l) =>
        l.followUp?.priority === "HIGH" && !["LOST", "WON"].includes(l.status),
    ).length,
  };
  const filtered = leads
    .filter((l) => {
      const text = [l.title, l.leadId, l.contactName, l.contactEmail]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!query.trim() || text.includes(query.trim().toLocaleLowerCase())) &&
        (status === "ALL" || l.status === status) &&
        (queue === "ALL" ||
          (queue === "NEW" && l.status === "NEW") ||
          (queue === "FOLLOW_UP" && needsFollowUp(l)) ||
          (queue === "HIGH" &&
            l.followUp?.priority === "HIGH" &&
            !["LOST", "WON"].includes(l.status)))
      );
    })
    .sort((a, b) =>
      queue === "FOLLOW_UP"
        ? a.followUp!.followUpDate.localeCompare(b.followUp!.followUpDate) ||
          b.createdAt.localeCompare(a.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <div className="container admin-page">
      <div className="admin-heading">
        <PageIntro eyebrow="STUDIO DESK / INBOX" title="บรีฟและคิวงาน">
          รับเรื่องให้ชัด ติดตามให้ทัน แล้วส่งต่องานเข้าพื้นที่โปรเจกต์
        </PageIntro>
        <div className="desk-account">
          <span>{email}</span>
          <button
            className="text-link"
            onClick={() => {
              if (discard()) void logout().catch(fail);
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
      <nav className="desk-nav" aria-label="พื้นที่ผู้ดูแล">
        <a href="/admin" aria-current="page">
          บรีฟและคิวงาน
        </a>
        <a href="/admin/pilot">ทดสอบงานจริง</a>
        <a href="/admin/inbox">ข้อความลูกค้า</a>
        <a href="/admin/projects">จัดการโปรเจกต์</a>
        <a href="/admin/employees">บัญชีพนักงาน</a>
        <a href="/admin/setup">ความพร้อมระบบ</a>
      </nav>
      <div className="desk-stats" aria-label="คิวจากบรีฟที่โหลดแล้ว">
        {(
          [
            ["ALL", "ทั้งหมดที่โหลด"],
            ["NEW", "บรีฟใหม่"],
            ["FOLLOW_UP", "ถึงนัดติดตาม"],
            ["HIGH", "สำคัญสูง"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={queue === key}
            onClick={() => setQueue(key)}
          >
            <span>{label}</span>
            <strong>{counts[key]}</strong>
          </button>
        ))}
      </div>
      <div className="desk-filters">
        <label className="field">
          <span>ค้นหาบรีฟที่โหลดแล้ว</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ชื่อโปรเจกต์ ชื่อลูกค้า อีเมล หรือรหัส"
          />
        </label>
        <label className="field">
          <span>สถานะบรีฟ</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">ทุกสถานะ</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          <Icon name="refresh" />
          โหลดข้อมูลล่าสุด
        </button>
      </div>
      <p className="small-note">
        แสดง {filtered.length} จาก {leads.length} บรีฟที่โหลดแล้ว
        {cursor
          ? " · ยังมีหน้าถัดไป ตัวเลขและการค้นหายังไม่รวมบรีฟที่ไม่ได้โหลด"
          : ""}{" "}
        · วันนัดอ้างอิงเวลาไทย
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      {note && <Notice kind="success">{note}</Notice>}
      {stale && selected && (
        <Notice>
          บรีฟนี้เปลี่ยนระหว่างทำงาน ร่างของคุณยังอยู่ด้านล่าง
          กรุณาคัดลอกส่วนที่ต้องการเก็บก่อนโหลดเวอร์ชันล่าสุด{" "}
          <button
            className="button secondary small"
            disabled={busy}
            onClick={() => void choose(selected.leadId)}
          >
            โหลดบรีฟล่าสุด
          </button>
        </Notice>
      )}
      <div className="crm-layout" aria-busy={busy}>
        <div className="lead-list" role="region" aria-label="รายการบรีฟ">
          {busy && !leads.length && <p role="status">กำลังโหลดบรีฟ…</p>}
          {!busy && !filtered.length && (
            <div className="empty-state">
              <Icon name="mail" size={32} />
              <h2>{leads.length ? "ไม่พบในคิวที่เลือก" : "ยังไม่มีบรีฟ"}</h2>
              <p>
                {leads.length
                  ? "เปลี่ยนคำค้นหรือสถานะ แล้วลองอีกครั้ง"
                  : "บรีฟที่ส่งสำเร็จจะแสดงที่นี่ ตรวจความพร้อมระบบหากยังไม่ได้เปิดรับบรีฟ"}
              </p>
            </div>
          )}
          {filtered.map((l) => (
            <button
              key={l.leadId}
              disabled={busy}
              className={`lead-card ${selected?.leadId === l.leadId ? "selected" : ""}`}
              aria-pressed={selected?.leadId === l.leadId}
              onClick={() => void choose(l.leadId)}
            >
              <span className="badge">{labels[l.status]}</span>
              {l.followUp?.priority === "HIGH" && (
                <span className="desk-priority">สำคัญสูง</span>
              )}
              <strong>{l.title}</strong>
              <small>
                {SERVICE_LABELS[l.serviceType]} · {l.contactName}
              </small>
              <small>{dateTime(l.createdAt)}</small>
              {l.followUp?.followUpDate && (
                <small className={needsFollowUp(l) ? "desk-due" : ""}>
                  นัดติดตาม {l.followUp.followUpDate}
                  {needsFollowUp(l) ? " · ถึงกำหนด" : ""}
                </small>
              )}
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
        <section
          className="lead-detail"
          ref={detail}
          tabIndex={-1}
          aria-label="รายละเอียดบรีฟ"
        >
          {selected ? (
            <>
              <span className="eyebrow">
                {selected.leadId} / V{selected.version}
              </span>
              <h2>{selected.title}</h2>
              <p className="small-note">
                รับเมื่อ {dateTime(selected.createdAt)} ·{" "}
                {labels[selected.status]}
              </p>
              <h3>ดำเนินการถัดไป</h3>
              <div className="status-actions">
                {LEAD_TRANSITIONS[selected.status].map((s) => (
                  <button
                    key={s}
                    className="button secondary small"
                    disabled={busy || dirty || stale}
                    onClick={() => void update(s)}
                  >
                    {labels[s]}
                  </button>
                ))}
              </div>
              {dirty && (
                <p className="small-note">
                  บันทึกโน้ตหรือคืนค่าร่างก่อนเปลี่ยนสถานะ
                </p>
              )}
              {!LEAD_TRANSITIONS[selected.status].length && (
                <p className="small-note">
                  บรีฟนี้ปิดขั้นตอนการขายแล้ว ยังบันทึกข้อมูลภายในได้
                </p>
              )}
              <dl>
                <dt>ติดต่อ</dt>
                <dd>
                  {selected.contactName}
                  <br />
                  <a href={`mailto:${selected.contactEmail}`}>
                    {selected.contactEmail}
                  </a>
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
                  {
                    {
                      FLEXIBLE: "ยืดหยุ่นได้",
                      ONE_MONTH: "ภายใน 1 เดือน",
                      THREE_MONTHS: "ภายใน 3 เดือน",
                      SPECIFIC: "ตามวันที่ระบุ",
                    }[selected.timeline]
                  }{" "}
                  {selected.targetDate}
                </dd>
                {selected.referenceUrl && (
                  <>
                    <dt>สิ่งอ้างอิง</dt>
                    <dd>
                      <a
                        href={selected.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        เปิดลิงก์อ้างอิง ↗
                      </a>
                    </dd>
                  </>
                )}
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
              <FollowUpForm
                key={`${selected.leadId}:${selected.version}`}
                lead={selected}
                busy={busy || stale}
                onDirty={setDirty}
                save={update}
              />
              {projectId ? (
                <div className="wks-create">
                  <h3>มีพื้นที่ทำงานแล้ว</h3>
                  <p>
                    บรีฟนี้ผูกกับโปรเจกต์แล้ว
                    เปิดเพื่อคุยกับลูกค้าและจัดการขั้นตอนงานได้เลย
                  </p>
                  <a
                    className="button"
                    href={`/admin/projects?project=${projectId}`}
                  >
                    เปิดโปรเจกต์ของบรีฟนี้ <Icon name="arrow" />
                  </a>
                </div>
              ) : (
                <ProjectCreateCard
                  key={selected.leadId}
                  lead={selected}
                  disabled={busy || dirty || stale}
                />
              )}
              <p className="small-note">
                สถานะการขายและวันนัดเป็นบันทึกภายใน
                การเปลี่ยนสถานะไม่ส่งอีเมลหรือยืนยันการชำระเงิน
              </p>
            </>
          ) : (
            <div className="empty-state">
              <Icon name="folder" size={35} />
              <h2>เลือกบรีฟเพื่อเริ่มดูแลงาน</h2>
              <p>
                อ่านรายละเอียด รับเรื่อง และบันทึกสิ่งที่ต้องติดตามในที่เดียว
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function FollowUpForm({
  lead,
  busy,
  onDirty,
  save,
}: {
  lead: LeadRecord;
  busy: boolean;
  onDirty: (v: boolean) => void;
  save: (v: LeadFollowUp) => Promise<void>;
}) {
  const original: LeadFollowUp = {
    note: lead.followUp?.note ?? "",
    priority: lead.followUp?.priority ?? "NORMAL",
    followUpDate: lead.followUp?.followUpDate ?? "",
  };
  const [value, setValue] = useState(original),
    [error, setError] = useState("");
  const dirty = JSON.stringify(value) !== JSON.stringify(original);
  function change(next: LeadFollowUp) {
    setValue(next);
    onDirty(JSON.stringify(next) !== JSON.stringify(original));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = LeadFollowUpSchema.safeParse(value);
    if (!parsed.success) {
      setError("กรอกวันที่ให้ถูกต้อง และบันทึกไม่เกิน 5,000 ตัวอักษร");
      return;
    }
    setError("");
    await save(parsed.data);
  }
  return (
    <form className="desk-follow-up" onSubmit={(e) => void submit(e)}>
      <h3>บันทึกติดตามงาน</h3>
      <p className="small-note">เห็นเฉพาะผู้ดูแล ไม่แสดงในพื้นที่ลูกค้า</p>
      <div className="desk-follow-fields">
        <label className="field">
          <span>ความสำคัญ</span>
          <select
            disabled={busy}
            value={value.priority}
            onChange={(e) =>
              change({
                ...value,
                priority: e.target.value as LeadFollowUp["priority"],
              })
            }
          >
            <option value="NORMAL">ปกติ</option>
            <option value="HIGH">สำคัญสูง</option>
          </select>
        </label>
        <label className="field">
          <span>วันนัดติดตาม</span>
          <input
            type="date"
            disabled={busy}
            value={value.followUpDate}
            onChange={(e) => change({ ...value, followUpDate: e.target.value })}
          />
        </label>
      </div>
      <label className="field">
        <span>โน้ตภายใน</span>
        <textarea
          rows={5}
          maxLength={5000}
          disabled={busy}
          value={value.note}
          onChange={(e) => change({ ...value, note: e.target.value })}
          placeholder="คุยอะไรไว้ ต้องขอข้อมูลเพิ่มอะไร และจะทำอะไรต่อ"
        />
      </label>
      {lead.followUp?.updatedAt && (
        <p className="small-note">
          บันทึกล่าสุด {dateTime(lead.followUp.updatedAt)}
        </p>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="status-actions">
        <button className="button" disabled={busy || !dirty}>
          บันทึกการติดตาม
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy || !dirty}
          onClick={() => change(original)}
        >
          คืนค่าร่าง
        </button>
      </div>
    </form>
  );
}
