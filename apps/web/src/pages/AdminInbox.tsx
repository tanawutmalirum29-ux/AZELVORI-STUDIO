import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ProjectMessage, StudioIdentity, StudioProject } from "@azelvori/contracts";
import { AdminEntry } from "../components/AdminEntry";
import { Notice, PageIntro } from "../components/Layout";
import { workspaceApi as client } from "../lib/workspace-api";
import { ApiError } from "../lib/api";
import { logout } from "../lib/auth";
import { newRequestId } from "../lib/id";
import { useIdentity } from "./Workspace";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่";
}
function readableTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function mergeMessages(previous: ProjectMessage[], incoming: ProjectMessage[]) {
  return [...new Map([...previous, ...incoming].map((item) => [item.messageId, item])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId));
}
function InboxDesk({ identity, onLost }: {
  identity: StudioIdentity;
  onLost: (message: string) => void;
}) {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [projectCursor, setProjectCursor] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string>();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const drafts = useRef(new Map<string, string>());
  const pending = useRef(new Map<string, { text: string; key: string }>());
  const sendLock = useRef(false);
  const pollLock = useRef(false);

  function failed(reason: unknown) {
    const message = errorText(reason);
    setError(message);
    if (reason instanceof ApiError && ([401, 403, 404].includes(reason.status))) {
      setProjects([]);
      setMessages([]);
      setSelectedId(undefined);
      onLost(message);
    }
  }

  useEffect(() => {
    let active = true;
    void client.list()
      .then((page) => {
        if (!active) return;
        setProjects(page.items);
        setProjectCursor(page.nextCursor);
        const requested = new URLSearchParams(location.search).get("project");
        const first = page.items.find((project) => project.projectId === requested) ?? page.items[0];
        setSelectedId(first?.projectId);
      })
      .catch((reason) => {
        if (active) failed(reason);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    pollLock.current = false;
    setMessages([]);
    setMessageCursor(undefined);
    setLoadingThread(true);
    setNote("");
    setError("");
    void client.messages(selectedId)
      .then((page) => {
        if (!active) return;
        setMessages(mergeMessages([], page.items));
        setMessageCursor(page.nextCursor);
      })
      .catch((reason) => { if (active) failed(reason); })
      .finally(() => { if (active) setLoadingThread(false); });

    // Poll only the open thread. Loading every customer's messages on each tick
    // would unnecessarily consume the shared staging Lambda/API capacity.
    const timer = setInterval(() => {
      if (!active || document.hidden || sendLock.current || pollLock.current) return;
      pollLock.current = true;
      void client.messages(selectedId)
        .then((page) => {
          if (active) setMessages((old) => mergeMessages(old, page.items));
        })
        .catch((reason) => { if (active) failed(reason); })
        .finally(() => { pollLock.current = false; });
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedId]);

  function choose(id: string) {
    if (sendLock.current || moreBusy || selectedId === id) return;
    if (selectedId) drafts.current.set(selectedId, draft);
    setSelectedId(id);
    setDraft(drafts.current.get(id) ?? "");
  }

  async function loadMoreProjects() {
    if (!projectCursor || moreBusy) return;
    setMoreBusy(true);
    setError("");
    try {
      const page = await client.list(projectCursor);
      setProjects((old) => [
        ...old,
        ...page.items.filter((item) => !old.some((project) => project.projectId === item.projectId)),
      ]);
      setProjectCursor(page.nextCursor);
    } catch (reason) {
      failed(reason);
    } finally {
      setMoreBusy(false);
    }
  }

  async function loadOlder() {
    if (!selectedId || !messageCursor || moreBusy) return;
    setMoreBusy(true);
    setError("");
    try {
      const page = await client.messages(selectedId, messageCursor);
      setMessages((old) => mergeMessages(page.items, old));
      setMessageCursor(page.nextCursor);
    } catch (reason) {
      failed(reason);
    } finally {
      setMoreBusy(false);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!selectedId || !value || sendLock.current || loadingThread) return;
    const id = selectedId;
    if (pending.current.get(id)?.text !== value)
      pending.current.set(id, { text: value, key: newRequestId() });
    sendLock.current = true;
    setSending(true);
    setNote("");
    setError("");
    try {
      const saved = await client.send(id, value, pending.current.get(id)!.key);
      setMessages((old) => mergeMessages(old, [saved]));
      setDraft("");
      drafts.current.delete(id);
      pending.current.delete(id);
      setNote("ส่งและบันทึกข้อความแล้ว");
    } catch (reason) {
      // Keep the message and idempotency key, so retry cannot create a second copy.
      failed(reason);
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  const matches = projects
    .filter((project) =>
      (project.title + " " + project.leadId + " " + project.serviceType)
        .toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const selected = projects.find((project) => project.projectId === selectedId);

  return (
    <div className="container inbox-page">
      <div className="inbox-heading">
        <PageIntro eyebrow="STUDIO DESK / CUSTOMER MESSAGES" title="กล่องข้อความลูกค้า">
          เปิดห้องสนทนา ตอบลูกค้า และดูประวัติในแต่ละโปรเจกต์จากหน้าเดียว
        </PageIntro>
        <div className="inbox-heading-actions">
          <span className="small-note">{identity.email}</span>
          <button className="text-link" onClick={() => void logout().catch(failed)}>ออกจากระบบ</button>
        </div>
      </div>
      <nav className="desk-nav" aria-label="พื้นที่ผู้ดูแล">
        <a href="/admin">บรีฟและคิวงาน</a>
        <a href="/admin/inbox" aria-current="page">ข้อความลูกค้า</a>
        <a href="/admin/projects">จัดการโปรเจกต์</a>
        <a href="/admin/employees">บัญชีพนักงาน</a>
        <a href="/admin/setup">ความพร้อมระบบ</a>
      </nav>
      {error && <Notice kind="error">{error}</Notice>}
      {note && <Notice kind="success">{note}</Notice>}
      <div className="inbox-grid">
        <aside className="inbox-sidebar" aria-label="รายชื่อโปรเจกต์">
          <div className="inbox-sidebar-top">
            <h2>ห้องสนทนา</h2>
            <span className="small-note">{projects.length} โปรเจกต์ที่โหลด</span>
          </div>
          <label className="field">
            <span>ค้นหาชื่อโปรเจกต์</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาโปรเจกต์…" />
          </label>
          {loading ? <p role="status">กำลังโหลดโปรเจกต์…</p>
            : projects.length === 0 ? <p>ยังไม่มีโปรเจกต์ที่เปิดแชทได้</p>
            : matches.length === 0 ? <p>ไม่พบโปรเจกต์ที่ตรงกับคำค้น</p>
            : (
              <nav className="inbox-project-list" aria-label="เลือกห้องสนทนา">
                {matches.map((project) => (
                  <button type="button" key={project.projectId}
                    className={project.projectId === selectedId ? "inbox-project active" : "inbox-project"}
                    aria-pressed={project.projectId === selectedId}
                    disabled={sending || moreBusy}
                    onClick={() => choose(project.projectId)}>
                    <strong>{project.title}</strong>
                    <span>{project.leadId}</span>
                    <small>อัปเดตโปรเจกต์ {readableTime(project.updatedAt)}</small>
                  </button>
                ))}
              </nav>
            )}
          {projectCursor && (
            <button className="button secondary small inbox-more" type="button"
              disabled={moreBusy} onClick={() => void loadMoreProjects()}>
              {moreBusy ? "กำลังโหลด…" : "โหลดโปรเจกต์เพิ่มเติม"}
            </button>
          )}
          <p className="small-note inbox-side-note">
            รายการเรียงตามวันอัปเดตโปรเจกต์ ไม่ใช่เวลาข้อความล่าสุด
          </p>
        </aside>
        <section className="inbox-thread" aria-label="การสนทนากับลูกค้า">
          {selected ? (
            <>
              <header className="inbox-thread-top">
                <div>
                  <h2>{selected.title}</h2>
                  <p>คุยกับลูกค้าในพื้นที่ส่วนตัวของโปรเจกต์</p>
                </div>
                <a className="button secondary small"
                  href={"/admin/projects?project=" + encodeURIComponent(selected.projectId)}>
                  จัดการโปรเจกต์
                </a>
              </header>
              <div className="inbox-thread-tools">
                <span className="small-note">ตรวจข้อความใหม่ทุก 15 วินาทีเมื่อเปิดหน้านี้</span>
                {messageCursor && (
                  <button className="text-link" type="button" disabled={moreBusy}
                    onClick={() => void loadOlder()}>
                    โหลดข้อความก่อนหน้า
                  </button>
                )}
              </div>
              <div className="inbox-messages" role="log" aria-label="ข้อความที่บันทึกแล้ว"
                aria-live="off" tabIndex={0}>
                {loadingThread ? <p role="status">กำลังโหลดข้อความ…</p>
                  : messages.length === 0 ? <p>ยังไม่มีข้อความ เริ่มสนทนาได้เลย</p>
                  : messages.map((item) => (
                    <article className={item.senderId === identity.userId
                      ? "inbox-bubble own" : "inbox-bubble"}
                      key={item.messageId}>
                      <header>
                        <strong>{item.senderId === identity.userId ? "คุณ"
                          : item.senderRole === "CUSTOMER" ? "ลูกค้า" : "ทีมสตูดิโอ"}</strong>
                        <time dateTime={item.createdAt}>{readableTime(item.createdAt)}</time>
                      </header>
                      <p>{item.text}</p>
                    </article>
                  ))}
              </div>
              <form className="inbox-compose" onSubmit={(event) => void send(event)}>
                <label className="field">
                  <span>ตอบกลับลูกค้า</span>
                  <textarea value={draft} maxLength={2000} rows={3}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (selectedId) drafts.current.set(selectedId, event.target.value);
                    }}
                    placeholder="พิมพ์ข้อความถึงลูกค้า…" required disabled={sending || loadingThread} />
                </label>
                <div className="inbox-compose-actions">
                  <span className="small-note">{draft.length}/2,000 · ไม่รองรับไฟล์แนบ</span>
                  <button className="button small" disabled={sending || loadingThread || !draft.trim()}>
                    {sending ? "กำลังส่ง…" : "ส่งข้อความ"}
                  </button>
                </div>
              </form>
            </>
          ) : <div className="inbox-empty">
            <h2>เลือกโปรเจกต์เพื่อเริ่มสนทนา</h2>
            <p>สร้างโปรเจกต์จากบรีฟที่ผ่านการประเมินในหน้าคิวงานก่อน</p>
            <a className="button secondary" href="/admin">เปิดคิวงาน</a>
          </div>}
        </section>
      </div>
    </div>
  );
}

export function AdminInbox() {
  const session = useIdentity();
  if (!session.identity)
    return <AdminEntry loading={session.loading} reason={session.error} />;
  if (!session.identity.staff)
    return <AdminEntry denied reason="บัญชีลูกค้าไม่สามารถเปิดข้อความของสตูดิโอได้" />;
  return <InboxDesk identity={session.identity}
    onLost={(message) => { session.setError(message); session.setIdentity(null); }} />;
}
