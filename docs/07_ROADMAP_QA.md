# 07 — Implementation Roadmap, Work Breakdown, Testing & Release Gates

**Nature:** detailed delivery plan, not executed development.  
**Estimates:** planning ranges in effective engineer-days (ED); parallelism, AI performance, integrations, legal reviews and project scope can shift schedule; not promises. 1 ED = focused implementation/testing day.

## 1. Phase plan and dependencies

| Phase | Scope | Prerequisite | Indicative effort | Exit |
|---|---|---|---:|---|
| 0 Discovery | brand/legal requirements, sample clients, costs, ADR, design | founder answers | 5–10 ED + external reviews | signed baseline & risk ledger |
| 1 Foundation | monorepo, design system, public site, auth, CI/IaC | P0 | 12–20 ED | demo: public site+secure login |
| 2 Portal | tenants, projects, file intake, internal admin, private chat | P1 | 16–28 ED | A/B isolation tested |
| 3 Commerce & Preview | quote, checkout, webhook, preview, revisions, approvals | P2 | 18–32 ED | sandbox end-to-end paid UAT |
| 4 AI Workspace | M-coded feed, task runners, policies, approvals, QA gates | P3 | 15–30 ED | scoped sandbox task verified |
| 5 Pilot | security tests, observability, ops, restore, client pilot | P4 | 8–16 ED | launch gates pass |
| 6 Post-launch | analytics, customer orgs, mobile enhancements, native game pipelines | pilot metrics | variable | data-driven roadmap |

**Critical path:** Legal/payment KYC → Identity/tenant auth → quote/payment state → protected preview/customer UAT → security & restore → pilot.  
**Avoid AI premature optimization:** manual staff task/QA review works for first paid customers while AI autonomous runner remains P1.

## 2. Epic backlog / executable work items

### EPIC E0 — Foundation & decisions
- `E0-01` define personas, ICP, pricing model, business legal identity, domain/brand clearance. DoD: decisions documented, no misleading company claims.
- `E0-02` write threat model and privacy data map; select AWS region + payment sandbox strategy. DoD: review signoffs.
- `E0-03` establish service quotas, accounts, tags, billing budget, MFA, IAM. DoD: alarms tested without cost incident.
- `E0-04` scaffold TS monorepo, lint/test/types, GitHub branch protection and CI. DoD: failing test blocks PR.
- `E0-05` define ID system, state machines, OpenAPI, event schema, ADR governance. DoD: contract validated.
- `E0-06` implement UX prototype screens and founder acceptance. DoD: mobile 320px screenshot no overlap.

### EPIC E1 — Public Website & Lead CRM
- `E1-01` tokenized accessible UI components (buttons, form, modal, nav, table, skeleton). DoD: keyboard/contrast tests.
- `E1-02` Home/services/process/FAQ/contact/pricing pages. DoD: SEO/a11y/links pass.
- `E1-03` lead wizard conditional fields by service type. DoD: all 5 service briefs tested.
- `E1-04` public API validation/anti-spam/rate-limits + lead storage. DoD: cannot inject scripts or spam cheaply.
- `E1-05` email acknowledgement/notification with provider SES. DoD: bounce/error behavior.
- `E1-06` lead qualification board and notes in Admin. DoD: audit role access.

### EPIC E2 — Customer Identity & Tenant Isolation
- `E2-01` Cognito signup/login/email verification/password reset. DoD: safe session lifecycle, no auth bypass.
- `E2-02` Tenant+membership/project permission service. DoD: denial to nonmember on every CRUD.
- `E2-03` invite/revoke/resend membership flows. DoD: expired token rejected.
- `E2-04` customer dashboard and project detail with scoped data. DoD: A never sees B.
- `E2-05` mandatory admin MFA and source/API access hardening. DoD: test with MFA disabled user denied.
- `E2-06` audit logs/PII masking/DSAR request intake. DoD: log contains no private secrets.

### EPIC E3 — Project Operations & Private Chat
- `E3-01` admin create project, milestones, project state machine. DoD: illegal transitions blocked.
- `E3-02` customer brief/read/upload with S3 presigned POST/PUT and file quotas. DoD: unauthorized upload denied.
- `E3-03` file quarantine/malware scan and clean-only access. DoD: test quarantined file cannot download.
- `E3-04` conversation model with CUSTOMER/INTERNAL permissions. DoD: internal never serialized to customer.
- `E3-05` message POST persistence/dedup + cursored history. DoD: retry x10 stores one record.
- `E3-06` AppSync Events integration/channel authorizer and reconnect catch-up. DoD: cross-tenant subscribe/publish denied.
- `E3-07` unread counts/email alert without leaked sensitive text. DoD: no cross-project email disclosures.
- `E3-08` chat mobile keyboard, attachment errors, offline UX. DoD: portrait+landscape verified.

### EPIC E4 — Commercial Flow
- `E4-01` quote editor lines, revision count, milestones/terms version. DoD: sums server-side.
- `E4-02` quote accept/decline/expire + immutable acceptance. DoD: no expired quote acceptance.
- `E4-03` invoice/payment attempts and idempotency state. DoD: race-safe concurrent attempts.
- `E4-04` Stripe sandbox checkout PromptPay/card depending supported test paths. DoD: checkout amount matches quote.
- `E4-05` signed webhook + dedup/retry/reconciliation. DoD: redirect fake never paid; replay x10 exactly once.
- `E4-06` receipt/invoice access and legal seller details. DoD: finance+legal approve public output.
- `E4-07` manual refund approval/dispute tracking. DoD: support/developer cannot refund.
- `E4-08` finance dashboard order-to-cash and project profit estimates. DoD: compare provider to ledger.

### EPIC E5 — Builds, Preview & Review
- `E5-01` immutable artifacts and build/job metadata. DoD: SHA256 and source version linked.
- `E5-02` static preview isolation, secure artifact serving, signed sessions. DoD: uninvited anonymous denied.
- `E5-03` responsive preview devices, version selector, deploy states. DoD: latest alias only points passed build.
- `E5-04` revision requests tied to version/page; change-order detection. DoD: scope creep traceable.
- `E5-05` UAT approve exact version and acceptance timestamp. DoD: approval pinned after deploy changes.
- `E5-06` browser game preview/controls and download of native artifacts where available. DoD: no unsupported native promise.
- `E5-07` final delivery module: source/license/deploy docs/access transfer. DoD: customer confirms receipt.

### EPIC E6 — AI-assisted Work Orchestration (after portal stable)
- `E6-01` AI workspace provisioning per project with message code M000001+ and project local history. DoD: project B cannot see A feed.
- `E6-02` role/grant management CEO/DIR/TL/EN/QA with <=10 AI active per project. DoD: cap enforced.
- `E6-03` Copy MN & owner manual dispatch UX, delivery acknowledgements. DoD: no fake “agent received”.
- `E6-04` task scope contract + path/tool allowlists, budget quotas, emergency pause. DoD: forbidden write denied.
- `E6-05` safe provider adapter + actual run receipts (SHA, tests, cost). DoD: fake completion detectable.
- `E6-06` sandbox job runner + artifacts & cleanup. DoD: no prod access/metadata exfiltration.
- `E6-07` independent QA review, proof, founder release approvals. DoD: self-approved production impossible.
- `E6-08` project closeout/team disband/revoke tokens and archive. DoD: post-close permissions expire.

### EPIC E7 — Observability / Launch / Hardening
- `E7-01` structured logs, correlation IDs, metrics, dashboards. DoD: trace lead→paid→build→UAT.
- `E7-02` 50/80/100% AWS budget alerts + app-level spend quota. DoD: simulated alert and job pause works.
- `E7-03` backup/PITR/S3 versioning, sample restore drill. DoD: measured recovery, evidence artifact.
- `E7-04` OWASP API/security tests + authz cross-tenant matrix. DoD: zero critical findings.
- `E7-05` browser QA viewports and accessibility audit. DoD: accessibility violations triaged, no blocking UX.
- `E7-06` incident runbook, contact, error banner, status page. DoD: tabletop exercise.
- `E7-07` production pipeline smoke rollback exercise. DoD: restoration verified.
- `E7-08` supervised pilot with synthetic then real consented user. DoD: founder signs off.

## 3. Dependencies in graph form
```text
E0 -> E1
E0 -> E2 -> E3
E2 + E3 -> E4
E3 -> E5
E3 + E5 -> E6
E0 + E1 + E2 + E3 + E4 + E5 -> E7 -> PILOT
E6 may follow PILOT if safely disabled behind a feature flag.
```

## 4. Definition of Done per user story
1. User story, actors, exceptions, business value and acceptance recorded.
2. Unit tests (happy/unhappy), integration tests & negative permission tests.
3. UI on 5 target viewports and Chromium+WebKit; no clipping, horizontal scroll, blocked controls; keyboard focus preserved.
4. Data privacy: no PII in client telemetry/logs/preview, access scoped, error message safe.
5. Ops: metrics/alarms, retry behavior, rollback, feature flag and deployment docs.
6. QA report with exact source/artifact SHA, tool versions and environment; pass/fail truthful.
7. Founder approves release; only then update production; client acceptance separate gate.

## 5. Test matrix

### UI browser/viewports
| Browser | 320×568 | 390×844 | 768×1024 | 844×390 | 1440×900 |
|---|---|---|---|---|---|
| Chromium | Required | Required | Required | Required | Required |
| WebKit | Required | Required | Required | Required | Required |

Test: navigation, wizard, login/auth expiration, project switch, chat composer with virtual keyboard, uploads, preview iframe/new tab, payment redirect/back/refresh, long text/Thai glyphs, contrast and focus. Browser-only testing not substitute for physical-device testing: perform real Android/iOS smoke tests before wide launch.

### Permissions / isolation
Actors: Anonymous, Customer A Owner, A Member, Customer B Owner, Founder, PM assigned, PM unassigned, QA assigned, AI Agent.  
Actions: project list/read/update, messages read/send/subscribe, file presign/download, preview/token, quote/payment/refund, exports, source modify, prod approve.  
Expect denied for all unauthorized actor×resource pairs; try sequential object IDs and forged tenant parameters.

### Payment
- 1 successful deposit → single activated project
- webhook same event replay 10× → one payment/ledger effect
- fake callback without signature → 4xx no state change
- payment succeeded but frontend reloads before webhook → pending then updates
- decline/cancel/expired session → no paid state
- refund partial/full + dispute → status & ledger consistent, admin audit
- mismatched amount/currency, stale quote, network retry → deny/reconcile

### Chat
- Two tabs, offline, reconnect, 100 rapid messages, retry clientMessageId, stale membership revoke, cross-tenant websocket denial.
- Attachments missing, expired signed URL, malicious scan, oversized and unsupported file.
- Thai/emoji, very long text, newline, escaped HTML, accessibility.

### Game development QA (per contract)
- Godot/web demo controls touch+keyboard, FPS budget, animation states/weapon sync, browser/audio unlock behavior
- Unity/Godot engine version and target platform recorded; license check before build
- Bugfix: reproduce baseline, verified regression, compare before/after evidence, prevent unrelated gameplay logic changes
- Native mobile/desktop target build tested on specified OS/device; browser preview alone does not count

### Recovery / security
- restore S3 object version and DynamoDB PITR to isolated environment
- corrupt file or failed build cannot advance preview latest
- stolen/expired JWT and revoked membership fail
- malicious markdown/prompt injection cannot access secrets or other tenant
- CI cannot deploy without expected approver and artifact SHA

## 6. Priority and sequencing
**MVP P0:** E0–E5 minimal, E7 security gates. AI work can be manual through Founder until E6 tested.  
**Post-MVP P1:** AI runner, enhanced revisions, customer teams, analytics, maintenance billing.  
**Future P2:** English/multi-currency, advanced game cloud build, AI automated estimates, client portal API, advanced SLA plans.

## 7. Risk register with blockers
| ID | Priority | Risk/blocker | Owner | Exit condition |
|---|---|---|---|---|
| R01 | BLOCKER | payments KYC/legal merchant identity unclear | founder/legal | provider sandbox/live acceptance |
| R02 | BLOCKER | preview/customer code isolation | engineer/security | penetration/isolation review |
| R03 | BLOCKER | cross-tenant channel authorization | engineer/QA | automated A/B denial test |
| R04 | HIGH | AWS unbounded billing | founder/ops | tags, budget, job quota, cap policy |
| R05 | HIGH | free-text scope creep | PM/founder | approved scope and change order |
| R06 | HIGH | AI impersonated completion | AI lead/QA | tool receipts and SHA gate |
| R07 | HIGH | copyrighted game assets | founder/customer | declared rights and license register |
| R08 | MED | mobile preview quality poor | UX/QA | 10 browser×viewport matrix |
| R09 | MED | vendor unavailable (Stripe/SES/AppSync) | ops | retry/reconciliation/degraded UX |
| R10 | MED | customers expect real-time live code pixels | product | communicate preview after successful deploy |

## 8. Pilot launch checklist (hard gates)
- [ ] business identity, name and privacy/terms/refund documents legally reviewed
- [ ] Stripe account onboarding and actual receipt/statement display verified
- [ ] hosted public site contact and invitation flow pass
- [ ] A/B data/chat/file/preview separation passes
- [ ] signed webhook, replay and reconciliation pass
- [ ] build preview does not expose main portal credentials or customer source
- [ ] uploaded malicious/oversized assets cannot execute or be served
- [ ] backups, restore and rollback rehearsed with evidence
- [ ] all 10 viewport+browser combinations accepted
- [ ] audit/alerts/cost caps configured and incident owner assigned
- [ ] real customer pilot authorized, no critical security findings
- [ ] release note and founder signoff attached to SHA

## 9. Launch sequence
**Alpha:** synthetic demo only; do not accept money.  
**Private beta:** 1–3 consented customers, manual approvals, modest limits and support coverage.  
**Public beta:** after payment/reliability and support validation; throttle intake and enforce capacity.  
**General availability:** publish SLA only after measuring real uptime/response metrics and support capacity.

## 10. Delivery tracking template
```text
ID: E3-06 | Owner: EN-BACKEND | Priority: P0
Problem: Customer project chat needs private realtime delivery.
Acceptance: A cannot subscribe/send to B; offline reconnect pulls missed data.
Dependencies: E2-02, E3-05
Changes: <paths> | Tests: <cmd and result>
QA: HOLD/PASS; artifact SHA: <verified sha>
Owner: pending/approved | Deployed: staging/prod with timestamp
Rollback: disable event publish and fall back to polling
```
Use this template in internal workspaces; don't need clutter public GitHub Issues.
