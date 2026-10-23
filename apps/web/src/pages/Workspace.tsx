import { pendingInvite, inviteStorage } from "../lib/invitation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PROJECT_STATES,
  PROJECT_STATE_LABELS,
  projectProgress,
  ProjectCreateSchema,
  type StudioProject,
  type StudioIdentity,
  type ProjectMessage,
  type ProjectMember,
  type LeadRecord,
} from "@azelvori/contracts";
import { Notice, PageIntro } from "../components/Layout";
import { Icon } from "../components/Icon";
import { workspaceApi as client } from "../lib/workspace-api";
import { ApiError } from "../lib/api";
import { authConfigured, logout, signIn } from "../lib/auth";
import { newRequestId } from "../lib/id";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ กรุณาลองใหม่";
const time = (s: string) =>
  new Date(s).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
const expired = (e: unknown) =>
  e instanceof ApiError && [401, 403, 404].includes(e.status);
export function useIdentity() {
  const [identity, setIdentity] = useState<StudioIdentity | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!authConfigured) {
      setLoading(false);
      setError("ระบบบัญชียังไม่ได้เชื่อมต่อ");
      return;
    }
    void client
      .me()
      .then((v) => {
        if (active) setIdentity(v);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return { identity, setIdentity, loading, error, setError };
}
function AccountRequired({
  loading,
  error,
}: {
  loading: boolean;
  error: string;
}) {
  return (
    <div className="container status-page">
      <PageIntro eyebrow="CUSTOMER SPACE" title="พื้นที่ลูกค้า" />
      {loading ? (
        <p role="status">กำลังตรวจสอบบัญชี…</p>
      ) : (
        <>
          <Notice>{error || "กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับเชิญ"}</Notice>
          <a className="button" href="/login">
            ไปหน้าเข้าสู่ระบบ <Icon name="arrow" />
          </a>
        </>
      )}
      <a className="text-link" href="/demo">
        ดูพอร์ทัลตัวอย่าง
      </a>
    </div>
  );
}
function EmailVerification({
  identity,
  onVerified,
}: {
  identity: StudioIdentity;
  onVerified: (i: StudioIdentity) => void;
}) {
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [error, setError] = useState("");
  async function run(verify: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (verify) {
        onVerified(await client.verify(code));
        setNote("ยืนยันอีเมลแล้ว");
      } else {
        await client.requestVerification();
        setNote("ส่งรหัสยืนยันแล้ว ตรวจกล่องอีเมลของคุณ");
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (identity.emailVerified) return null;
  return (
    <section className="wks-verification">
      <h2>ยืนยันอีเมลก่อนเข้าร่วมโปรเจกต์</h2>
      <p>{identity.email}</p>
      <div className="wks-inline">
        <button
          className="button secondary small"
          disabled={busy}
          onClick={() => void run(false)}
        >
          ส่งรหัสยืนยันอีเมล
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(true);
          }}
        >
          <label className="field">
            <span>รหัสยืนยัน 6 หลัก</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
          </label>
          <button className="button small" disabled={busy || code.length !== 6}>
            ยืนยันอีเมล
          </button>
        </form>
      </div>
      {note && <p role="status">{note}</p>}
      {error && <Notice kind="error">{error}</Notice>}
    </section>
  );
}
export function ProjectCreateCard({ lead }: { lead: LeadRecord }) {
  const [title, setTitle] = useState(lead.title),
    [summary, setSummary] = useState(lead.description),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<{ body: string; key: string } | undefined>(undefined),
    lock = useRef(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    const data = { leadId: lead.leadId, title, summary },
      parsed = ProjectCreateSchema.safeParse(data);
    if (!parsed.success) {
      setError("ระบุชื่ออย่างน้อย 5 ตัวอักษร และขอบเขตอย่างน้อย 30 ตัวอักษร");
      return;
    }
    const body = JSON.stringify(data);
    if (pending.current?.body !== body)
      pending.current = { body, key: newRequestId() };
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const p = await client.create(data, pending.current!.key);
      location.assign(`/admin/projects?project=${p.projectId}`);
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!["QUALIFIED", "SCOPED", "QUOTED", "WON"].includes(lead.status))
    return (
      <p className="small-note">ประเมินบรีฟให้ผ่านก่อนสร้างโปรเจกต์ส่วนตัว</p>
    );
  return (
    <form className="wks-create" onSubmit={(e) => void submit(e)}>
      <h3>สร้างพื้นที่ทำงานจากบรีฟนี้</h3>
      <label className="field">
        <span>ชื่อโปรเจกต์</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          minLength={5}
          maxLength={200}
          required
        />
      </label>
      <label className="field">
        <span>ขอบเขตเบื้องต้นสำหรับให้ลูกค้าเห็น</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          minLength={30}
          maxLength={5000}
          required
        />
      </label>
      <p className="small-note">
        สร้างพื้นที่วางแผนและตรวจรับงาน
        การสร้างโปรเจกต์ไม่ยืนยันการชำระเงินหรือแทนข้อตกลงราคา
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      <button className="button" disabled={busy}>
        {busy ? "กำลังสร้าง…" : "สร้างโปรเจกต์ส่วนตัว"}
        <Icon name="arrow" />
      </button>
    </form>
  );
}
export function Workspace() {
  const session = useIdentity();
  if (!session.identity)
    return <AccountRequired loading={session.loading} error={session.error} />;
  return (
    <WorkspaceContent
      identity={session.identity}
      onIdentity={session.setIdentity}
      onLost={(e) => {
        session.setError(e);
        session.setIdentity(null);
      }}
    />
  );
}
function WorkspaceContent({
  identity,
  onIdentity,
  onLost,
}: {
  identity: StudioIdentity;
  onIdentity: (i: StudioIdentity) => void;
  onLost: (error: string) => void;
}) {
  const [projects, setProjects] = useState<StudioProject[]>([]),
    [project, setProject] = useState<StudioProject | null>(null),
    [messages, setMessages] = useState<ProjectMessage[]>([]),
    [members, setMembers] = useState<ProjectMember[]>([]),
    [cursor, setCursor] = useState<string>(),
    [messageCursor, setMessageCursor] = useState<string>(),
    [memberCursor, setMemberCursor] = useState<string>();
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [text, setText] = useState(""),
    [email, setEmail] = useState(""),
    [link, setLink] = useState(""),
    [invitationId, setInvitationId] = useState(""),
    [review, setReview] = useState<{
      id: string;
      version: number;
      label: string;
      key: string;
    } | null>(null),
    [revoke, setRevoke] = useState<ProjectMember | null>(null);
  const operation = useRef(false),
    generation = useRef(0),
    draft = useRef<{ id: string; text: string; key: string } | undefined>(
      undefined,
    ),
    inviteRequest = useRef<
      { id: string; email: string; key: string } | undefined
    >(undefined),
    dialog = useRef<HTMLDialogElement>(null);
  function failed(e: unknown) {
    setError(message(e));
    if (expired(e)) {
      setProject(null);
      setProjects([]);
      setMessages([]);
      setMembers([]);
      setLink("");
      setText("");
      onLost(message(e));
    }
  }
  async function select(id: string) {
    const n = ++generation.current;
    setLoading(true);
    setError("");
    setNote("");
    setLink("");
    setInvitationId("");
    setText("");
    setMessages([]);
    setMembers([]);
    setProject(null);
    try {
      const [p, m, g] = await Promise.all([
        client.get(id),
        client.messages(id),
        identity.staff
          ? client.members(id)
          : Promise.resolve({
              items: [] as ProjectMember[],
              nextCursor: undefined,
            }),
      ]);
      if (n !== generation.current) return;
      setProject(p);
      setMessages(m.items);
      setMessageCursor(m.nextCursor);
      setMembers(g.items);
      setMemberCursor(g.nextCursor);
    } catch (e) {
      if (n === generation.current) failed(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }
  async function list(next?: string) {
    try {
      const page = await client.list(next);
      setProjects((prev) =>
        next
          ? [
              ...prev,
              ...page.items.filter(
                (p) => !prev.some((x) => x.projectId === p.projectId),
              ),
            ]
          : page.items,
      );
      setCursor(page.nextCursor);
      if (!next) {
        const desired = new URLSearchParams(location.search).get("project");
        if (desired || page.items[0])
          await select(desired ?? page.items[0].projectId);
      }
    } catch (e) {
      failed(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void list();
    return () => {
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (!project) return;
    const id = project.projectId;
    const interval = setInterval(() => {
      if (document.hidden || operation.current) return;
      const n = generation.current;
      void Promise.all([client.get(id), client.messages(id)])
        .then(([p, m]) => {
          if (n !== generation.current) return;
          setProject((old) => (old && p.version >= old.version ? p : old));
          setMessages((old) =>
            [
              ...new Map(
                [...old, ...m.items].map((x) => [x.messageId, x]),
              ).values(),
            ].sort(
              (a, b) =>
                a.createdAt.localeCompare(b.createdAt) ||
                a.messageId.localeCompare(b.messageId),
            ),
          );
          setError("");
        })
        .catch((e) => {
          if (n === generation.current) failed(e);
        });
    }, 15000);
    return () => clearInterval(interval);
  }, [project?.projectId]);
  useEffect(() => {
    if (review || revoke) dialog.current?.showModal();
    else dialog.current?.close();
  }, [review, revoke]);
  async function act(fn: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setNote("");
    try {
      await fn();
    } catch (e) {
      failed(e);
      if (e instanceof ApiError && e.status === 409 && project) {
        setReview(null);
        setRevoke(null);
        try {
          setProject(await client.get(project.projectId));
        } catch (refreshError) {
          failed(refreshError);
        }
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  function changed(p: StudioProject) {
    setProject(p);
    setProjects((list) =>
      list.map((x) => (x.projectId === p.projectId ? p : x)),
    );
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!project || !text.trim()) return;
    const id = project.projectId,
      value = text.trim();
    if (draft.current?.text !== value || draft.current?.id !== id)
      draft.current = { id, text: value, key: newRequestId() };
    await act(async () => {
      const m = await client.send(id, value, draft.current!.key);
      setMessages((old) =>
        old.some((x) => x.messageId === m.messageId) ? old : [...old, m],
      );
      setText("");
      draft.current = undefined;
      setNote("บันทึกข้อความแล้ว");
    });
  }
  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!project) return;
    const id = project.projectId,
      value = email.trim().toLowerCase();
    if (
      inviteRequest.current?.email !== value ||
      inviteRequest.current?.id !== id
    )
      inviteRequest.current = { id, email: value, key: newRequestId() };
    await act(async () => {
      const result = await client.invite(id, value, inviteRequest.current!.key);
      setInvitationId(result.invitationId);
      setLink(
        result.token ? `${location.origin}/invite#token=${result.token}` : "",
      );
      setNote(
        result.token
          ? `คำเชิญใช้ได้ถึง ${time(result.expiresAt)}${result.account === "CREATED" ? " · Cognito ส่งข้อมูลตั้งบัญชีไปยังอีเมลลูกค้าแล้ว" : " · ใช้บัญชีลูกค้าเดิม"}`
          : "คำเชิญถูกสร้างแล้ว ลิงก์ไม่เก็บย้อนหลัง กดสร้างคำเชิญอีกครั้งเพื่อออกลิงก์ใหม่แทนฉบับเดิม",
      );
      inviteRequest.current = undefined;
    });
  }
  return (
    <div className="container wks-page">
      <div className="wks-heading">
        <PageIntro
          eyebrow={identity.staff ? "STUDIO / PROJECTS" : "YOUR PROJECTS"}
          title={
            identity.staff ? "พื้นที่จัดการโปรเจกต์" : "งานของคุณ อยู่ที่นี่"
          }
        />
        <div className="wks-top-actions">
          {identity.staff && (
            <a className="button secondary small" href="/admin">
              บรีฟและ CRM
            </a>
          )}
          <button
            className="text-link"
            onClick={() => void logout().catch((e) => failed(e))}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
      <p className="small-note wks-account">
        {identity.email} · {identity.staff ? "ทีมสตูดิโอ" : "บัญชีลูกค้า"}
      </p>
      <EmailVerification identity={identity} onVerified={onIdentity} />
      {error && <Notice kind="error">{error}</Notice>}
      {note && (
        <div className="wks-feedback" role="status">
          {note}
        </div>
      )}
      <div className="wks-layout">
        <aside className="wks-sidebar" aria-label="โปรเจกต์ของคุณ">
          <div className="wks-sidebar-title">
            <h2>โปรเจกต์</h2>
            <span>{projects.length}</span>
          </div>
          {projects.map((p) => (
            <button
              key={p.projectId}
              className={`wks-project ${project?.projectId === p.projectId ? "selected" : ""}`}
              disabled={busy}
              onClick={() => void select(p.projectId)}
            >
              <span className="badge">{PROJECT_STATE_LABELS[p.state]}</span>
              <strong>{p.title}</strong>
              <small>ตรวจรับแล้ว {projectProgress(p)}%</small>
            </button>
          ))}
          {cursor && (
            <button
              className="button secondary small"
              disabled={busy}
              onClick={() => void act(() => list(cursor))}
            >
              โหลดโปรเจกต์เพิ่มเติม
            </button>
          )}
          <p className="small-note">
            แสดงเฉพาะโปรเจกต์ที่คุณมีสิทธิ์ ข้อมูลตัวอย่างอยู่ที่หน้า Demo
          </p>
        </aside>
        <section className="wks-content" aria-label="รายละเอียดโปรเจกต์">
          {loading ? (
            <div className="empty-state" role="status">
              กำลังโหลดข้อมูลโปรเจกต์…
            </div>
          ) : !project ? (
            <div className="empty-state">
              <img
                src="/brand/illustrations/azelvori-empty-project.svg"
                alt=""
                width="240"
              />
              <h2>ยังไม่มีโปรเจกต์ที่เข้าถึงได้</h2>
              <p>
                {identity.staff
                  ? "เริ่มจากบรีฟที่ผ่านการประเมิน แล้วสร้างพื้นที่โปรเจกต์"
                  : "เปิดลิงก์คำเชิญจากสตูดิโอเพื่อเริ่มงาน"}
              </p>
              {identity.staff && (
                <a className="button" href="/admin">
                  เปิด CRM
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="wks-cover">
                <img src="/brand/azelvori-client-portal-cover.svg" alt="" />
                <div>
                  <span className="eyebrow">PROJECT / V{project.version}</span>
                  <h2>{project.title}</h2>
                  <span className="badge">
                    {PROJECT_STATE_LABELS[project.state]}
                  </span>
                </div>
              </div>
              <div className="wks-summary">
                <p className="preserve-lines">{project.summary}</p>
                <div className="wks-progress">
                  <strong>
                    {projectProgress(project)}
                    <small>%</small>
                  </strong>
                  <span>จาก milestone ที่ลูกค้าตรวจรับแล้ว</span>
                </div>
              </div>
              <p className="small-note">
                พื้นที่นี้ใช้ติดตามขอบเขตและงาน การตรวจรับ milestone
                ไม่ใช่ใบเสร็จหรือหลักฐานชำระเงิน
              </p>
              {identity.staff && (
                <label className="field wks-state">
                  <span>สถานะโปรเจกต์</span>
                  <select
                    value={project.state}
                    disabled={busy}
                    onChange={(e) => {
                      const state = e.target.value;
                      void act(async () =>
                        changed(await client.update(project, { state })),
                      );
                    }}
                  >
                    {PROJECT_STATES.map((s) => (
                      <option key={s} value={s}>
                        {PROJECT_STATE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <section className="wks-section">
                <div className="wks-section-heading">
                  <h3>Milestones และการตรวจรับ</h3>
                  <span>เวอร์ชัน {project.version}</span>
                </div>
                <ol className="wks-milestones">
                  {project.milestones.map((m, i) => (
                    <li key={m.id}>
                      <span
                        className={`wks-step ${m.status === "ACCEPTED" ? "accepted" : ""}`}
                      >
                        {m.status === "ACCEPTED" ? (
                          <Icon name="check" size={16} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div>
                        <strong>{m.label}</strong>
                        <p>
                          {
                            {
                              PENDING: "รอเริ่ม",
                              ACTIVE: "กำลังทำ",
                              REVIEW: "รอลูกค้าตรวจรับ",
                              ACCEPTED: "ตรวจรับแล้ว",
                            }[m.status]
                          }{" "}
                          · น้ำหนัก {m.weight}%
                        </p>
                        {m.acceptedAt && <small>{time(m.acceptedAt)}</small>}
                      </div>
                      {identity.staff && m.status !== "ACCEPTED" ? (
                        <select
                          aria-label={`สถานะ ${m.label}`}
                          value={m.status}
                          disabled={busy}
                          onChange={(e) => {
                            const milestoneState = e.target.value;
                            void act(async () =>
                              changed(
                                await client.update(project, {
                                  milestoneId: m.id,
                                  milestoneState,
                                }),
                              ),
                            );
                          }}
                        >
                          <option value="PENDING">รอเริ่ม</option>
                          <option value="ACTIVE">กำลังทำ</option>
                          <option value="REVIEW">ส่งตรวจรับ</option>
                        </select>
                      ) : !identity.staff && m.status === "REVIEW" ? (
                        <button
                          className="button small"
                          disabled={busy}
                          onClick={() =>
                            setReview({
                              id: m.id,
                              version: project.version,
                              label: m.label,
                              key: newRequestId(),
                            })
                          }
                        >
                          ตรวจรับ milestone
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
              <section className="wks-section">
                <div className="wks-section-heading">
                  <h3>ข้อความในโปรเจกต์</h3>
                  <span>ตรวจข้อความใหม่ทุก 15 วินาที</span>
                </div>
                {messageCursor && (
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        const page = await client.messages(
                          project.projectId,
                          messageCursor,
                        );
                        setMessages((old) => [
                          ...new Map(
                            [...page.items, ...old].map((m) => [
                              m.messageId,
                              m,
                            ]),
                          ).values(),
                        ]);
                        setMessageCursor(page.nextCursor);
                      })
                    }
                  >
                    โหลดข้อความก่อนหน้า
                  </button>
                )}
                <div
                  className="wks-thread"
                  role="region"
                  aria-label="ข้อความที่บันทึกแล้ว"
                >
                  {!messages.length && (
                    <p className="wks-empty-chat">
                      ยังไม่มีข้อความ เริ่มคุยรายละเอียดงานได้เลย
                    </p>
                  )}
                  {messages.map((m) => (
                    <article
                      key={m.messageId}
                      className={`wks-message ${m.senderId === identity.userId ? "own" : ""}`}
                    >
                      <header>
                        <strong>
                          {m.senderId === identity.userId
                            ? "คุณ"
                            : m.senderRole === "STUDIO"
                              ? "สตูดิโอ"
                              : "ลูกค้า"}
                        </strong>
                        <time dateTime={m.createdAt}>{time(m.createdAt)}</time>
                      </header>
                      <p>{m.text}</p>
                      <small>บันทึกแล้ว</small>
                    </article>
                  ))}
                </div>
                <form className="wks-compose" onSubmit={(e) => void send(e)}>
                  <label className="field">
                    <span>
                      ข้อความถึง{identity.staff ? "ลูกค้า" : "สตูดิโอ"}
                    </span>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      required
                      placeholder="พิมพ์รายละเอียดหรือคำถามเกี่ยวกับงาน…"
                      disabled={busy}
                    />
                  </label>
                  <div>
                    <span className="small-note">
                      {text.length}/2,000 · ไม่รองรับไฟล์แนบในรุ่นนี้
                    </span>
                    <button
                      className="button small"
                      disabled={busy || !text.trim()}
                    >
                      ส่งข้อความ <Icon name="arrow" size={16} />
                    </button>
                  </div>
                </form>
              </section>
              {identity.staff && (
                <section className="wks-section">
                  <h3>เชิญลูกค้าและจัดการสิทธิ์</h3>
                  <p className="small-note">
                    บัญชีใหม่จะได้รับข้อมูลเข้าสู่ระบบจาก Cognito
                    คัดลอกลิงก์คำเชิญด้านล่างส่งให้ลูกค้าเอง
                    คำเชิญผูกกับอีเมลที่ยืนยันแล้วและหมดอายุใน 72 ชั่วโมง
                  </p>
                  <form
                    className="wks-invite-form"
                    onSubmit={(e) => void invite(e)}
                  >
                    <label className="field">
                      <span>อีเมลลูกค้าที่ต้องการเชิญ</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        maxLength={254}
                        disabled={busy}
                      />
                    </label>
                    <button className="button small" disabled={busy}>
                      สร้างคำเชิญ
                    </button>
                  </form>
                  {link && (
                    <div className="wks-invite-link">
                      <label className="field">
                        <span>ลิงก์คำเชิญ — แสดงครั้งนี้เท่านั้น</span>
                        <textarea
                          value={link}
                          readOnly
                          rows={3}
                          onFocus={(e) => e.target.select()}
                        />
                      </label>
                      <div className="wks-inline">
                        <button
                          className="button secondary small"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(link)
                              .then(() => setNote("คัดลอกลิงก์แล้ว"))
                              .catch(() =>
                                setNote(
                                  "เลือกและคัดลอกข้อความลิงก์ด้านบนได้เลย",
                                ),
                              )
                          }
                        >
                          คัดลอกลิงก์
                        </button>
                        <button
                          className="text-link"
                          disabled={busy}
                          onClick={() =>
                            void act(async () => {
                              await client.revokeInvite(
                                project.projectId,
                                invitationId,
                              );
                              setLink("");
                              setNote("ยกเลิกคำเชิญแล้ว");
                            })
                          }
                        >
                          ยกเลิกคำเชิญนี้
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="wks-members">
                    {members.map((m) => (
                      <div key={m.userId}>
                        <div>
                          <strong>{m.email}</strong>
                          <small>
                            {m.active ? "เข้าร่วมแล้ว" : "ถอนสิทธิ์แล้ว"} ·{" "}
                            {time(m.joinedAt)}
                          </small>
                        </div>
                        {m.active && (
                          <button
                            className="text-link"
                            disabled={busy}
                            onClick={() => setRevoke(m)}
                          >
                            ถอนสิทธิ์
                          </button>
                        )}
                      </div>
                    ))}
                    {!members.length && (
                      <p className="small-note">ยังไม่มีลูกค้ารับคำเชิญ</p>
                    )}
                    {memberCursor && (
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            const page = await client.members(
                              project.projectId,
                              memberCursor,
                            );
                            setMembers((old) => [...old, ...page.items]);
                            setMemberCursor(page.nextCursor);
                          })
                        }
                      >
                        โหลดสมาชิกเพิ่มเติม
                      </button>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </div>
      <dialog
        ref={dialog}
        className="wks-dialog"
        onCancel={() => {
          setReview(null);
          setRevoke(null);
        }}
        aria-labelledby="wks-confirm-title"
      >
        <h2 id="wks-confirm-title">
          {review ? "ยืนยันการตรวจรับ milestone" : "ยืนยันการถอนสิทธิ์"}
        </h2>
        <p>
          {review
            ? `คุณกำลังตรวจรับ “${review.label}” ในโปรเจกต์เวอร์ชัน ${review.version} ตรวจขอบเขตและผลงานให้ครบก่อนยืนยัน`
            : `บัญชี ${revoke?.email} จะเข้าโปรเจกต์และอ่านข้อความไม่ได้ในการเรียก API ครั้งถัดไป`}
        </p>
        <div className="wks-inline">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setReview(null);
              setRevoke(null);
            }}
          >
            กลับไปตรวจ
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                if (review && project) {
                  changed(
                    await client.accept(
                      { ...project, version: review.version },
                      review.id,
                      review.key,
                    ),
                  );
                  setNote("บันทึกการตรวจรับ milestone แล้ว");
                } else if (revoke) {
                  const member = await client.revokeMember(revoke);
                  setMembers((old) =>
                    old.map((m) => (m.userId === member.userId ? member : m)),
                  );
                  setNote("ถอนสิทธิ์แล้ว");
                }
                setReview(null);
                setRevoke(null);
              })
            }
          >
            {review ? "ยืนยันตรวจรับเวอร์ชันนี้" : "ยืนยันถอนสิทธิ์"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
export function Invite() {
  const [token] = useState(pendingInvite),
    session = useIdentity(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState<StudioProject | null>(null),
    lock = useRef(false);
  async function accept() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const p = await client.acceptInvite(token);
      setAccepted(p);
      sessionStorage.removeItem(inviteStorage);
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="container wks-invitation">
      <PageIntro
        eyebrow="A SPACE FOR YOUR PROJECT"
        title={accepted ? "เข้าร่วมโปรเจกต์แล้ว" : "คำเชิญจาก AZELVORI"}
      />
      {accepted ? (
        <>
          <Notice>ยืนยันสิทธิ์เข้าร่วม “{accepted.title}” แล้ว</Notice>
          <a className="button" href={`/app?project=${accepted.projectId}`}>
            เปิดโปรเจกต์ <Icon name="arrow" />
          </a>
        </>
      ) : (
        <>
          <p>
            ลงชื่อเข้าใช้ด้วยอีเมลที่สตูดิโอเชิญ บัญชีใหม่ให้ตั้งรหัสผ่านและ MFA
            ตามอีเมลของ Amazon Cognito ก่อน
          </p>
          {!token ? (
            <Notice>
              ไม่พบคำเชิญในหน้านี้ หรือลิงก์ที่พักไว้หมดเวลาแล้ว
              เปิดลิงก์ต้นฉบับจากสตูดิโออีกครั้ง
            </Notice>
          ) : session.loading ? (
            <p role="status">กำลังตรวจสอบบัญชี…</p>
          ) : session.identity ? (
            <>
              <p className="wks-account">
                บัญชีปัจจุบัน: {session.identity.email}
              </p>
              <EmailVerification
                identity={session.identity}
                onVerified={session.setIdentity}
              />
              <button
                className="button"
                disabled={busy || !session.identity.emailVerified}
                onClick={() => void accept()}
              >
                {busy ? "กำลังรับคำเชิญ…" : "รับคำเชิญเข้าโปรเจกต์"}
              </button>
              <button
                className="text-link"
                onClick={() => void logout().catch((e) => setError(message(e)))}
              >
                ออกจากระบบเพื่อเปลี่ยนบัญชี
              </button>
            </>
          ) : (
            <>
              <Notice>
                {session.error || "กรุณาเข้าสู่ระบบก่อนรับคำเชิญ"}
              </Notice>
              <button
                className="button"
                disabled={!authConfigured || busy}
                onClick={() => {
                  setBusy(true);
                  void signIn("invite").catch((e) => {
                    setError(message(e));
                    setBusy(false);
                  });
                }}
              >
                เข้าสู่ระบบเพื่อรับคำเชิญ
              </button>
            </>
          )}
          {error && <Notice kind="error">{error}</Notice>}
          <p className="small-note">
            คำเชิญมีอายุ 72 ชั่วโมง ลิงก์ใช้ได้เฉพาะอีเมลที่ได้รับเชิญ
            และฉบับใหม่จะแทนฉบับเดิม
          </p>
        </>
      )}
    </div>
  );
}
