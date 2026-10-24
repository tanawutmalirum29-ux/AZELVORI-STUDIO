import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ProjectMessage, StudioProject } from "@azelvori/contracts";
import { Notice, PageIntro } from "../components/Layout";
import { api, type ApiError } from "../lib/api";
import { newRequestId } from "../lib/id";
import {
  employeeAccessToken, employeeAuthError, employeeLogin, employeeLogout,
  employeeSessionExists, clearEmployeeSession,
} from "../lib/employee-auth";

type Employee = { key: string; nickname: string; firstName: string; lastName: string; active: boolean };
type Lead = { leadId: string; title: string; status: string; contactName?: string; description?: string };
async function staffApi<T>(path: string, method = "GET", payload?: unknown, idempotencyKey?: string): Promise<T> {
  const token = await employeeAccessToken();
  return api<T>("/api/v1/employee" + path, {
    method, headers: {
      Authorization: "Bearer " + token,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  }, method === "POST" && path.endsWith("/messages") ? 201 : 200);
}
export function StaffLogin() {
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function enter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await employeeLogin(key.trim(), password);
      await staffApi<Employee>("/me");
      setPassword("");
      location.assign("/staff/inbox");
    } catch (err) {
      clearEmployeeSession(); setPassword("");
      setError(employeeAuthError(err));
    } finally { setBusy(false); }
  }
  return (
    <div className="container login-page first-party-shell">
      <div className="login-story">
        <span className="eyebrow">AZELVORI / EMPLOYEE WORKSPACE</span>
        <h1>พื้นที่ทำงาน<br /><span className="accent">ทีม AZELVORI</span></h1>
        <p>รับงานลูกค้าและตอบข้อความจากหน้าพนักงานโดยเฉพาะ</p>
        <p className="small-note">บัญชีนี้แยกจากเจ้าของสตูดิโอและบัญชีลูกค้า</p>
      </div>
      <section className="login-card first-party-login">
        <img className="first-party-mark" src="/brand/azelvori-logo-horizontal.svg"
          alt="AZELVORI STUDIO" width="238" height="55" />
        <div className="first-party-intro">
          <span className="eyebrow">STAFF SIGN IN</span><h2>เข้าสู่ระบบพนักงาน</h2>
          <p>ใช้คีย์และรหัสผ่านที่ได้รับจากแอดมิน</p>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <form className="first-party-form" onSubmit={(e) => void enter(e)}>
          <label className="field"><span>คีย์พนักงาน</span>
            <input inputMode="numeric" pattern="[0-9]{5,}" minLength={5}
              placeholder="00001" autoComplete="username" required value={key}
              onChange={(e) => setKey(e.target.value.replace(/\D/g, ""))} disabled={busy} />
          </label>
          <label className="field"><span>รหัสผ่าน</span>
            <input type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          </label>
          <button className="button full" disabled={busy || !key || !password}>
            {busy ? "กำลังตรวจสอบ…" : "เข้าสู่พื้นที่พนักงาน"}
          </button>
        </form>
        <p className="first-party-support">บัญชีไม่มีวันหมดอายุโดยอัตโนมัติ แอดมินเป็นผู้ปิดสิทธิ์เท่านั้น</p>
        <nav className="first-party-links"><a href="/">กลับหน้าเว็บไซต์</a></nav>
      </section>
    </div>
  );
}
export function StaffInbox() {
  const [me, setMe] = useState<Employee>();
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [moreMessages, setMoreMessages] = useState<string>();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"chat" | "work">("chat");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadCursor, setLeadCursor] = useState<string>();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const pending = useRef<{ key: string; text: string; project: string } | undefined>(undefined);
  const lock = useRef(false);
  function handleError(err: unknown) {
    if ((err as ApiError)?.status === 403 || (err as ApiError)?.status === 401) {
      clearEmployeeSession();
      location.assign("/staff/login");
      return;
    }
    setError(err instanceof Error ? err.message : "ระบบไม่พร้อม กรุณาลองใหม่");
  }
  useEffect(() => {
    if (!employeeSessionExists()) { location.replace("/staff/login"); return; }
    let active = true;
    void Promise.all([
      staffApi<Employee>("/me"),
      staffApi<{items: StudioProject[]; nextCursor?: string}>("/projects"),
    ]).then(([employee, page]) => {
      if (!active) return;
      setMe(employee); setProjects(page.items); setCursor(page.nextCursor);
      setSelected(page.items[0]?.projectId);
    }).catch((err) => { if (active) handleError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setMessages([]); setMoreMessages(undefined); setDraft("");
    const pull = async (fresh: boolean) => {
      try {
        const page = await staffApi<{ items: ProjectMessage[]; nextCursor?: string }>(
          "/projects/" + encodeURIComponent(selected) + "/messages");
        if (active) {
          setMessages((prior) => [...new Map([...(fresh ? [] : prior), ...page.items].map(x => [x.messageId, x])).values()]
            .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)));
          if (fresh) setMoreMessages(page.nextCursor);
        }
      } catch (err) { if (active) handleError(err); }
    };
    void pull(true);
    const interval = setInterval(() => {
      if (active && !document.hidden && !lock.current) void pull(false);
    }, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [selected]);
  async function loadProjects() {
    if (!cursor || busy) return;
    setBusy(true);
    try {
      const page = await staffApi<{items: StudioProject[]; nextCursor?: string}>(
        "/projects?cursor=" + encodeURIComponent(cursor));
      setProjects(p=>[...p,...page.items]); setCursor(page.nextCursor);
    } catch(e) { handleError(e); } finally { setBusy(false); }
  }
  async function loadOlder() {
    if (!selected || !moreMessages || busy) return;
    setBusy(true);
    try {
      const page = await staffApi<{items:ProjectMessage[];nextCursor?:string}>(
        "/projects/"+encodeURIComponent(selected)+"/messages?cursor="+encodeURIComponent(moreMessages));
      setMessages(p=>[...new Map([...page.items,...p].map(x=>[x.messageId,x])).values()]
        .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)));
      setMoreMessages(page.nextCursor);
    } catch(e) { handleError(e); } finally { setBusy(false); }
  }
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !draft.trim() || busy) return;
    if (!pending.current || pending.current.project !== selected || pending.current.text !== draft.trim())
      pending.current = { key: newRequestId(), text: draft.trim(), project: selected };
    setBusy(true); lock.current = true; setError("");
    try {
      const message = await staffApi<ProjectMessage>(
        "/projects/" + encodeURIComponent(selected) + "/messages",
        "POST", {text: draft.trim()}, pending.current.key);
      setMessages(p=>[...new Map([...p,message].map(x=>[x.messageId,x])).values()]);
      setDraft(""); pending.current=undefined; setNote("ส่งข้อความแล้ว");
    } catch(e) { handleError(e); }
    finally { setBusy(false); lock.current=false; }
  }
  async function loadLeads(more=false) {
    setBusy(true);
    try {
      const page = await staffApi<{items: Lead[];nextCursor?:string}>(
        "/leads" + (more && leadCursor ? "?cursor="+encodeURIComponent(leadCursor) : ""));
      setLeads(p=>more ? [...p,...page.items] : page.items); setLeadCursor(page.nextCursor);
    } catch(e) { handleError(e); } finally { setBusy(false); }
  }
  async function accept(leadId: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const answer = await staffApi<{lead:Lead}>("/leads/"+encodeURIComponent(leadId)+"/acknowledge","POST",{});
      setLeads(p=>p.map(x=>x.leadId===leadId?answer.lead:x)); setNote("รับเรื่องแล้ว");
    } catch(e) { handleError(e); } finally { setBusy(false); }
  }
  async function leave() {
    setBusy(true); await employeeLogout(); location.assign("/staff/login");
  }
  if (loading) return <div className="container status-page" role="status">กำลังโหลดพื้นที่พนักงาน…</div>;
  return (
    <div className="container inbox-page">
      <div className="inbox-heading">
        <PageIntro eyebrow="AZELVORI / EMPLOYEE DESK" title={"พื้นที่พนักงาน" + (me ? " · " + me.nickname : "")}>
          ดูบรีฟที่เข้ามาและตอบข้อความลูกค้า โดยไม่มีสิทธิ์จัดการบัญชีแอดมิน
        </PageIntro>
        <button className="button secondary small" disabled={busy} onClick={() => void leave()}>ออกจากระบบพนักงาน</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {note && <Notice kind="success">{note}</Notice>}
      <nav className="desk-nav" aria-label="เมนูพนักงาน">
        <button type="button" aria-current={tab==="chat"?"page":undefined}
          onClick={()=>setTab("chat")}>แชทลูกค้า</button>
        <button type="button" aria-current={tab==="work"?"page":undefined}
          onClick={()=>{setTab("work");void loadLeads();}}>งานลูกค้า</button>
      </nav>
      {tab==="work" ? (
        <section className="employee-panel">
          <h2>บรีฟลูกค้า</h2>
          <p className="small-note">พนักงานรับทราบงานใหม่ได้ แต่การอนุมัติงานและการสร้างโปรเจกต์ยังเป็นสิทธิ์แอดมิน</p>
          {leads.map(l=>(
            <article className="employee-record" key={l.leadId}>
              <div><strong>{l.title}</strong><p>{l.contactName ?? ""} · {l.status}</p><small>{l.leadId}</small></div>
              {l.status==="NEW" && <button className="button small" disabled={busy}
                onClick={()=>void accept(l.leadId)}>รับเรื่อง</button>}
            </article>
          ))}
          {!leads.length && <p>ยังไม่มีรายการในคิวงาน</p>}
          {leadCursor && <button className="button secondary" disabled={busy}
            onClick={()=>void loadLeads(true)}>โหลดเพิ่มเติม</button>}
        </section>
      ) : (
        <div className="inbox-grid">
          <aside className="inbox-sidebar">
            <h2>โปรเจกต์ลูกค้า</h2>
            <div className="inbox-project-list">
              {projects.map(p=>(
                <button type="button" key={p.projectId} disabled={busy}
                  className={selected===p.projectId?"inbox-project active":"inbox-project"}
                  aria-pressed={selected===p.projectId} onClick={()=>setSelected(p.projectId)}>
                  <strong>{p.title}</strong><small>{p.leadId}</small>
                </button>
              ))}
            </div>
            {!projects.length && <p>ยังไม่มีโปรเจกต์</p>}
            {cursor && <button type="button" className="button secondary full" disabled={busy}
              onClick={()=>void loadProjects()}>โหลดเพิ่มเติม</button>}
          </aside>
          <section className="inbox-thread">
            <header className="inbox-thread-top"><h2>{projects.find(p=>p.projectId===selected)?.title ?? "เลือกห้องสนทนา"}</h2></header>
            <div className="inbox-thread-tools"><span className="small-note">อัปเดตทุก 15 วินาที</span>
              {moreMessages && <button type="button" className="text-link" disabled={busy}
                onClick={()=>void loadOlder()}>ข้อความก่อนหน้า</button>}
            </div>
            <div className="inbox-messages" role="log" tabIndex={0} aria-label="ข้อความลูกค้า">
              {messages.map(m=><article className={m.senderId===me?.key?"inbox-bubble own":"inbox-bubble"}
                key={m.messageId}><strong>{m.senderRole==="CUSTOMER"?"ลูกค้า":"ทีมสตูดิโอ"}</strong>
                <p>{m.text}</p><small>{new Date(m.createdAt).toLocaleString("th-TH")}</small></article>)}
            </div>
            <form className="inbox-compose" onSubmit={(e)=>void send(e)}>
              <label className="field"><span>ตอบกลับลูกค้า</span>
                <textarea rows={3} required maxLength={2000} value={draft} disabled={!selected || busy}
                  onChange={e=>setDraft(e.target.value)} />
              </label>
              <div className="inbox-compose-actions"><span>{draft.length}/2000</span>
                <button className="button" disabled={!selected || busy || !draft.trim()}>ส่งข้อความ</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
