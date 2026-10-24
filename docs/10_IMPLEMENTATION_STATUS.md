# Implementation status — Studio admin desk alpha

Updated after the guided CloudShell activation increment; start with the [Thai CloudShell quick start](19_CLOUDSHELL_QUICKSTART.md), or use [manual admin activation](17_ADMIN_ACTIVATION.md) for an existing deployment. This file describes actual code; the master plan describes the intended final service.

## Implemented in source

| Area | Behavior | Limits |
|---|---|---|
| Public studio site | Thai content, five services, process, price explanation, FAQ, clear CTAs, dark cyan/violet design | Single landing page; case studies are labeled concepts; no fabricated clients or testimonials |
| Brief wizard | Five steps; fields vary for website, app, new game, debugging, maintenance; validation and visible errors | Attachments deferred; no fixed price or delivery promises |
| Drafts | Type/budget retained seven days; full draft explicitly downloadable as JSON | Private/free-text fields deliberately not persisted automatically; refresh loses them |
| Submission | 202 only after durable transaction; UUID idempotency; duplicate body conflict; retry; 24KB cap; honeypot; per-IP minute quota | Disabled by default; needs real deployment and reviewed notices |
| Lead CRM | Founder-only list/detail, loaded-page search and work queues, private follow-up note/priority/date, versioned transitions, existing project link | Operator helper provisions founder with explicit target and audit; no outbound follow-up notifications or quote/payment execution |
| Identity | Cognito IaC, hosted code flow + PKCE, explicit email verification, invite-only provisioning; callback has a 20-second whole-operation deadline, same-tab retry and a visible success/continuation link; 12-character minimum passphrases without composition rules and required TOTP | Owner's 24 October 11:30 screenshot reached the callback but was still pending; complete login/MFA/recovery remain unverified. Frontend deployment applies the callback fix; existing pool password changes still require the documented AWS update. Self-signup off; on-demand refresh with one concurrent request per tab, eight-hour refresh-token lifetime |
| Invitations | 256-bit token stored as hash, verified-email binding, fixed 72-hour expiry, single-use acceptance, replacement/revocation, one-time link display | Founder shares the project link manually; Cognito sends initial account credentials separately; no automatic email resend |
| Private projects | Qualified brief → planning workspace, active tenant membership AND project grant, founder/customer views, paged lists, member revocation | One new tenant per project in this increment; no customer organization/role/expiry management UI; creating a workspace does not activate paid work |
| Milestones | Three weighted steps, founder sets work/review state, customer accepts exact project version, immutable acceptance, progress derives only from acceptance | No deliverable files, owner/deadline editor, contractual scope snapshot or preview build/hash approval |
| Project messages | Transactional persistence + audit + idempotency, escaped text, paging, server author/time, draft-preserving retries, visible-tab polling every 15 seconds. Founder inbox at `/admin/inbox` lists accessible project threads and replies using the existing backend. | Single customer-visible channel; inbox sorts by project update time, not last message; no internal notes, pre-project chat, staff assignment, AppSync events, presence, unread counts, notifications or attachments. CI is synthetic; live cloud chat not verified. |
| IAM/audit | Strong grant reads, gateway JWT/scope checks, separate append-only audit writes, no Scan/DeleteItem privileges | Does not replace independent cloud authorization review |
| Portal demo | Overview, milestone-derived progress, device preview, version-pinned sample comments/approval, escaped chat, file/scope examples | Public synthetic content; memory only; no realtime/customer data |
| AWS source | Cognito, Lambda, HTTP API, two DynamoDB tables, PITR/retention, logs, alarm, optional monthly budget | Owner's 24 October 10:36 CloudShell screenshot shows staging in ap-southeast-2, verified founder provisioning and a successful Amplify release; no AWS writes from the development environment |
| Amplify source | Build config, security headers, SPA rewrite config, bundled fonts | Job 15 succeeded per the owner's screenshot; public browser checks show configured Cognito/API and a successful health check. Public intake remains closed |
| Guided activation | CloudShell launcher prepares Node/dependencies; operator reviews account/region/app/email and Lambda capacity mode before backend creation, audited founder provisioning, branch env merge and Amplify release polling | Only the supplied app/main and closed staging; quota 1–104 uses shared capacity with lower route throttles, ≥105 reserves 5. Shared mode cannot open public intake or production. Existing stacks are reused, never redeployed by the wizard. Owner's activation completed; full login/MFA and private data flows remain unverified |
| QA | Contracts, HTTP/domain integration, Dynamo command contracts, infrastructure assertions, activation/secret transport tests, browser matrix in CI | 184 tests and 140 browser cases passed on `f45d31e` ([CI](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/40057753600)); [activation evidence](19_CLOUDSHELL_QUICKSTART.md) distinguishes mocks/local/CI/live AWS |

## Requirement mapping

| IDs | Current status |
|---|---|
| P-001/P-002 | Landing and service content implemented; separate service pages deferred |
| P-003, G-001/G-002/G-003 | Brief fields and rights acknowledgement implemented; attachments deferred |
| P-004 | Baseline validation, idempotency, honeypot, distributed rate counters implemented; live abuse tests pending |
| P-005 | Transparent alpha notices present; legal identity/contact and reviewed production policies pending |
| P-006/P-007/P-008 | CMS, full SEO/localization pending; alpha intentionally noindex |
| I-001/I-004 | Cognito and verified-email client/server flow; on-demand refresh/logout coordination implemented; actual deployed auth/MFA/recovery/refresh verification pending |
| I-002 | Hashed single-use token, fixed 72h expiry, revoke/replace implemented; adjustable expiry and automatic resend deferred |
| I-003 | Active tenant + project membership checks and revocation implemented; membership expiry/multiple customer roles deferred |
| C-001 | Lead list/status, private notes, priorities, follow-up dates and queues implemented; staff assignments/outbound notifications pending |
| C-002 | All five intake service types supported |
| A-002/A-004 | Backend-gated CRM and mutation audit implemented for current routes |
| C-005/C-006/C-007 | Planning workspace and simplified work states/milestone acceptance implemented; deposit-triggered activation, full commercial states, deadlines/owners/blockers deferred |
| T-001/T-002/T-004/T-010 | One customer-visible channel, durable messages/idempotency, timestamp + UUID tie-break, pagination and 15s polling; internal channels absent, ULID/event reconnect/catch-up pending |
| C-003/C-004/C-008/C-009/C-010, T-003/T-005–T-009, R-001–R-010, PYM-001–PYM-009 | Quotes, payments, storage, AppSync, protected build previews and remaining conversation features planned only |
| AI-001–AI-008 | Planned only; no fake running agents or synthetic execution receipts |

## Next concrete increment

1. Deploy the callback recovery fix through Amplify and finish the owner's login into the admin desk. The screenshot establishes arrival at the callback, not a successful admin session. If the existing pool still has the old password rules, apply the [simplified policy](17_ADMIN_ACTIVATION.md#ใช้รหัสผ่านที่จำง่าย); the activation wizard does not update an existing pool. Budget and truthful legal contact remain operator decisions.
2. Verify actual hosted login/logout/MFA and staff revocation; test Dynamo transaction/rate semantics in staging.
3. Run the [private workspace staging checklist](15_PRIVATE_WORKSPACE_PILOT.md) with two synthetic customers; source tests already cover A/B denial, invitation lifecycle and revocation races.
4. Add private S3 quarantine/download grants and immutable deliverable/preview versions. Expand milestone scope, owners and deadlines.
5. Add quote snapshots and sandbox payment webhooks before activating paid projects; add notifications/outbox and AppSync reconnect with scoped subscriptions.

No milestone percentage is inferred from file count. Foundation alpha is useful development progress, not completion of the multi-phase plan.
