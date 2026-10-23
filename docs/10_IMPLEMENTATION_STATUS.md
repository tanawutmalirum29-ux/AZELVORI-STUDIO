# Implementation status — Foundation alpha

Updated: 2026-10-23 (Asia/Bangkok). This file describes actual code; the master plan describes the intended final service.

## Implemented in source

| Area | Behavior | Limits |
|---|---|---|
| Public studio site | Thai content, five services, process, price explanation, FAQ, clear CTAs, dark cyan/violet design | Single landing page; case studies are labeled concepts; no fabricated clients or testimonials |
| Brief wizard | Five steps; fields vary for website, app, new game, debugging, maintenance; validation and visible errors | Attachments deferred; no fixed price or delivery promises |
| Drafts | Type/budget retained seven days; full draft explicitly downloadable as JSON | Private/free-text fields deliberately not persisted automatically; refresh loses them |
| Submission | 202 only after durable transaction; UUID idempotency; duplicate body conflict; retry; 24KB cap; honeypot; per-IP minute quota | Disabled by default; needs real deployment and reviewed notices |
| Lead CRM | Founder-only list, cursor pagination, details, allowed status transitions, version conflict detection | Staff grant must be provisioned by authorized operator; no quote/payment execution |
| Identity | Cognito IaC, hosted code flow + PKCE, session handling, callback error UX, logout/revocation | AWS end-to-end login, invitation lifecycle and recovery not yet verified; self-signup off |
| IAM/audit | Strong grant reads, gateway JWT/scope checks, separate append-only audit writes, no Scan/DeleteItem privileges | Does not replace independent cloud authorization review |
| Portal demo | Overview, milestone-derived progress, device preview, version-pinned sample comments/approval, escaped chat, file/scope examples | Public synthetic content; memory only; no realtime/customer data |
| AWS source | Cognito, Lambda, HTTP API, two DynamoDB tables, PITR/retention, logs, alarm, optional monthly budget | Synthesized locally; no cloud resources created in this task |
| Amplify source | Build config, security headers, SPA rewrite config, bundled fonts | Hosting application/domain must be connected and smoke-tested |
| QA | Contracts, HTTP/domain integration, Dynamo command contracts, infrastructure assertions, browser matrix in CI | Test reports distinguish mocks/local/CI/live AWS |

## Requirement mapping

| IDs | Current status |
|---|---|
| P-001/P-002 | Landing and service content implemented; separate service pages deferred |
| P-003, G-001/G-002/G-003 | Brief fields and rights acknowledgement implemented; attachments deferred |
| P-004 | Baseline validation, idempotency, honeypot, distributed rate counters implemented; live abuse tests pending |
| P-005 | Transparent alpha notices present; legal identity/contact and reviewed production policies pending |
| P-006/P-007/P-008 | CMS, full SEO/localization pending; alpha intentionally noindex |
| I-001/I-004 | Cognito and client code foundation; deployed auth/session verification pending |
| I-002/I-003 | Invitation tokens, tenant and project membership not implemented |
| C-001 | Lead list/status implemented; assignments/notes/notifications still pending |
| C-002 | All five intake service types supported |
| A-002/A-004 | Backend-gated CRM and mutation audit implemented for current routes |
| C-003–C-010, T-001–T-010, R-001–R-010, PYM-001–PYM-009 | Planned only; demo UI does not implement private projects, payments, storage or realtime |
| AI-001–AI-008 | Planned only; no fake running agents or synthetic execution receipts |

## Next concrete increment

1. Confirm AWS account/region/domain, operational budget and truthful legal contact. Configure a staging stack with intake closed.
2. Verify actual hosted login/logout/MFA and staff revocation; test Dynamo transaction/rate semantics in staging.
3. Add invitation tokens, tenant/project memberships and object grants; enforce A/B negative tests before any customer data.
4. Add project CRUD and milestones, private S3 quarantine, durable conversations/outbox; then AppSync reconnect and scoped subscriptions.
5. Add quote snapshots and sandbox payment webhooks before activating paid projects. Preview isolation and version approvals follow.

No milestone percentage is inferred from file count. Foundation alpha is useful development progress, not completion of the multi-phase plan.
