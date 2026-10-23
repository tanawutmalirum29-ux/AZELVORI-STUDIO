# 02 — Information Architecture, UX and Customer Journeys

## 1. Design direction / UX principles
**Brand:** AZELVORI STUDIO — futuristic but reliable. Dark navy/charcoal, off-white typography, restrained cyan/violet accents; avoid neon overload.  
**Feeling:** premium digital agency + transparent workshop, ไม่ใช่ social chat feed.  
**Rules:** Mobile-first, keyboard-accessible, plain Thai copy, clear cost/states, minimal clicks, no surprise navigation. Avoid false testimonials, fake project counters, fake AI staff portraits.

## 2. Sitemap
`/` — Home  
`/services` — Overview; `/services/web`, `/services/webapp`, `/services/game`, `/services/bugfix`, `/services/maintenance`  
`/work` — Portfolio (consented); `/process`; `/pricing`; `/faq`; `/contact`  
`/start` — Guided briefing wizard  
`/login`, `/signup`, `/invite/:token`, `/forgot-password`  
`/app` — My Projects + Notifications  
`/app/projects/:id` — Project overview and milestones  
`/app/projects/:id/chat` — Private customer-facing chat  
`/app/projects/:id/files` — Files and scans  
`/app/projects/:id/preview/:version` — Protected preview review  
`/app/projects/:id/changes` — Revision requests  
`/app/projects/:id/billing` — Quotes/payments/receipts  
`/app/projects/:id/delivery` — Delivery & warranty  
`/admin` — Owner dashboard  
`/admin/leads`, `/admin/projects`, `/admin/customers`, `/admin/quotes`, `/admin/payments`, `/admin/ai`, `/admin/qa`, `/admin/ops`  
`/privacy`, `/terms`, `/refund-policy`, `/cookies`

## 3. Page specifications

### A. Home
Hero: “เว็บไซต์ เกม และซอฟต์แวร์ที่สร้างตามเป้าหมายของคุณ” / CTA “เริ่มโปรเจกต์” / CTA “ดูวิธีทำงาน”.  
Services cards 5 categories, sample scopes, transparent steps Discover→Quote→Develop→Preview→Approve, selected consented work, trust/security explainer, FAQ & contact.  
Acceptance: visitor เข้าใจบริการและไป start ใน 2 clicks; correct meta+mobile; CTA ไม่ไป dead end.

### B. Start / Brief Wizard (5 steps)
1. เลือก Website / Web app / New game / Game bug fix / Maintain
2. ระบุ project goals, target user, platform, reference, features
3. Timeline + budget **ช่วงราคาโดยประมาณ** ไม่ตีราคา AI อัตโนมัติเป็นข้อผูกมัด
4. Attachments (optional): file type/size notices, sensitive data warning
5. Contact email + privacy acknowledgement + final summary + submit
Persist draft locally (non-sensitive) and server draft when signed in; browser refresh does not lose work. After submit show `LEAD-YYYY-NNNN` receipt and next steps.

### C. Customer Dashboard
Top: Brand header / Project switcher / Notifications / Account.  
Cards: open projects, awaiting approval, unread messages, next payment, next milestone.  
Each project card status + progress from verified milestones + “เปิดโปรเจกต์”; no admin data. Empty state with request CTA.

### D. Project Detail — responsive 3 zones
**Desktop:** left milestone sidebar, center preview/status, right customer chat.  
**Mobile 320px:** vertical sections with tabs (Overview / Preview / Chat / Files / Billing), sticky nav does not obscure CTA; 390px and 844×390 specifically test input keyboard and landscape.  
Hero: project code, scope baseline version, date, current phase, owner-approved percentage.
Timeline: milestone × owner × status × deliverables; blockers visible with reason.  
Activity: customer-facing actions only. Never show staff internal notes or credentials.

### E. Real-time Chat
Thread list limited to project's channels granted to the user; message composer, date dividers, read status, attachment picker, optimistic send with pending/failed indicators and retry.  
Publish flow: optimistic pending UI → POST server → persistent message ack → AppSync broadcast → clients reconcile by message ID.  
Unread badge, reconnect banner and "โหลดข้อความที่พลาด" if network interrupted.  
Chat message attachments only accessible with authorized short-lived URL; chat transcript visible only to participants with access.

### F. Preview & Review
Version selector (latest approved/review version), open-in-new-tab, device presets, build time and SHA, test report badge. Preview iframe only when isolated origin and secure allowlist, otherwise new window.  
Comments attach to exact version + page/path + screenshot/coordinates; UI makes clear comment ≠ approved change order.  
CTA “ส่งคำขอแก้ไข” or “อนุมัติเวอร์ชันนี้”; confirm dialog restates version, summary and ramifications.
For game: HTML5 demo playable if supported; downloadable build behind authenticated link for native games. No unsupported fake simulator.

### G. Payment
Accepted quote → payment schedule → secure hosted checkout; status PENDING/SUCCEEDED/FAILED/REFUNDED from server; clear payer identity, total, currency, tax disclosure, due dates and terms; signed receipt.  
Never collect or store full card number/CVV within platform. Confirm success only from verified processor event. Always show support path if provider is pending/outage.

### H. Admin
Priority inbox: new leads, quotes to approve, payments pending, QA failures, UAT requests, incidents.  
Kanban: Lead → Scoped → Quoted → Paid → Doing → QA → UAT → Delivered; override with audit reason.  
Lead detail must avoid exposing other customers in search snippets to unauthorized team roles.  
AI area: project-specific task board + messages M000001, agent list, docs/artifacts, cost quota, allowed tools, pause and rollback. One-click “คัดลอก MN ไปส่งแชท AI”; founder decides destination.

## 4. Journeys / state transitions

### Journey J01 — Website Customer
Discover -> wizard -> confirmation -> invite/login -> see quote -> accept -> deposit -> milestone/preview -> comment -> UAT approval -> final payment -> handover.  
Exceptional: quote expired, payment failed, client cancels, unresponsive customer, scope creep, build failed.

### Journey J02 — Game Creator
Choose game; specify engine/platform & licensing; concept/genre/gameplay references/assets; define vertical slice & playable criteria; quote; milestones for loop/assets/QA; browser demo if HTML5; native test build if not; handover source/licenses.

### Journey J03 — Game Bug Fix
Upload reproduction details + sanitized logs and authorized source; admin triages severity, environment and reproducing budget; discovery quote if unknown; report root cause; reproducible failing test; patch; regression; release notes; delivery.  
Exceptional: cannot reproduce -> request missing data, diagnose only, stop with findings and billing per agreement.

### Journey J04 — Customer A vs Customer B isolation
A can see own projects, quote, messages, files, previews; B can see theirs. Even if A changes URLs to B ID, result 403/404 depending disclosure policy (use consistent 404 for unowned resources); no cross-tenant channel subscribe/publish, no leaked search, thumbnails, e-mails or pre-signed S3 paths. Verify through E2E negative tests.

### Journey J05 — Agent-assisted delivery
Founder creates scoped task; assign agent; agent produces staged change + tests; QA reviewer passes; founder authorizes preview update; customer tests; founder approves production. Failed QA loops back to agent; no gate skipped for speed.

## 5. Interaction details & edge cases
- Toast has accessible announce area; destructive actions require confirmation and audit.
- Server time in UTC; show Asia/Bangkok to Thai users; date/time explicit timezone.
- Error states: no internet, auth expired, upload too large, scanned malware, provider outage, 429, 409 stale revision, S3 expired, preview build pending.
- Accessible contrast, heading semantics, labels, descriptive buttons, focus trap in dialogs, reduced motion and tab navigation.
- No OS-native alert/select popup used for app-like UI when custom accessible CSS control feasible; native accessible input remains valid for security/keyboard usability.
- Prevent copying sensitive tokens via visible UI, never prevent regular text copy broadly since customers must copy receipts/info.
- Multi-tab consistency: payment and approval display canonical server state, no stale approvals.
- Safety: external preview scripts never same-origin as portal, deny clipboard/storage/camera/mic top-level permissions unless explicitly needed.

## 6. Content checklist
Thai microcopy for stages and payments; privacy notice accessible from brief; terms snapshot at quote acceptance; support contact; cancellation/refund process; realistic portfolio consent; public FAQ “AI ใช้งานอย่างไร?”: เปิดเผยการใช้เครื่องมือ AI แต่ยืนยันการตรวจรับโดยมนุษย์.

## 7. Deliverable UI package
Design tokens → information architecture → low-fidelity mobile wireframes → high-fidelity components → interaction specs → component stories → desktop/mobile QA screenshots.  
Gate: founder signs off Home, Wizard, Customer Portal, Admin before visual implementation expansion.
