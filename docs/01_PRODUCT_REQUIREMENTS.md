# 01 — Product Requirements / Functional & Non-functional Scope

**Requirement IDs:** P-xxx (Public), I-xxx (Identity), C-xxx (Customer), T-xxx (Chat), R-xxx (Review), PYM-xxx (Payment), A-xxx (Admin), AI-xxx (AI), G-xxx (Game).  
**Priority:** P0 = ต้องมีก่อนรับลูกค้าทดลอง; P1 = หลัง pilot; P2 = roadmap.

## 1. Actor / RBAC
| Role | View | Change | Forbidden |
|---|---|---|---|
| VISITOR | public content | lead form | project data |
| CUSTOMER_OWNER | projects of their tenant | brief/revisions/approve/payment | other customers, internal prompts/keys |
| CUSTOMER_MEMBER | assigned projects in tenant | comment/upload ตาม grant | finance/approve unless allowed |
| FOUNDER_ADMIN | all authorized organization operations | quote, contract, scope, deploy approval | bypass immutable audit |
| PROJECT_MANAGER | assigned projects | milestones, replies | arbitrary payment override |
| DEVELOPER | assigned code/tasks | staged commits, builds | refunds and production merge |
| QA_REVIEWER | assigned staging/test reports | pass/fail | self-approve code from same actor |
| FINANCE | necessary invoice/payment metadata | refund request with approval | source code/secrets |
| AI_AGENT | short-lived scoped capability | propose edits/report | public customer messaging unapproved; billing/admin |
| SUPPORT | support tickets permitted | replies | unrelated project content |

**Tenant:** ลูกค้าหนึ่งองค์กรอาจมีหลาย users และหลาย projects. Person เดียวอาจอยู่หลาย tenants โดยต้องเลือก tenant context; ห้ามให้ token tenant_id ที่ลูกค้าส่งมาเองตัดสินสิทธิ์

## 2. Public Website
| ID | Priority | Requirement + Acceptance |
|---|---|---|
| P-001 | P0 | Landing มี CTA สั่งงาน อธิบายบริการ เว็บ/เกม/แก้บั๊ก ผลงานและวิธีทำงาน |
| P-002 | P0 | Services จัดหมวด scope ตัวอย่าง deliverables และ exclusions |
| P-003 | P0 | Lead wizard เลือกประเภทงาน ประเภทเกม/platform budget range deadline attachments & consent |
| P-004 | P0 | Form validation ฝั่ง server, honeypot/rate limit, antispam |
| P-005 | P0 | privacy/terms/contact/business identity text ตามสถานะจริง; language ไทย |
| P-006 | P1 | Portfolio CMS แสดงเฉพาะ case study ที่อนุญาต พร้อมผลงาน performance |
| P-007 | P1 | SEO metadata sitemap robots structured data + blog |
| P-008 | P2 | English/localization รองรับ currency/display locales แยกจาก billing THB |

## 3. Account & Invitation
| ID | Priority | Requirement + Acceptance |
|---|---|---|
| I-001 | P0 | Cognito signup/login/verified email/password reset; admin MFA บังคับ |
| I-002 | P0 | Client invitation token single-use, hashed, 24–72h adjustable; revoke/resend |
| I-003 | P0 | Membership table linked user↔tenant↔project with role/expiry |
| I-004 | P0 | Logout/revoke sessions; auth error UX; refresh token handling safe |
| I-005 | P1 | MFA option ลูกค้า, passkey exploration, SSO สำหรับ enterprise |
| I-006 | P1 | Account export/deletion request workflow with retention exceptions |

## 4. CRM, Ordering, Project Management
| ID | Priority | Requirement + Acceptance |
|---|---|---|
| C-001 | P0 | Lead intake → qualify/disqualify + internal note + assignee |
| C-002 | P0 | Brief types: WEBSITE, WEB_APP, GAME_NEW, GAME_BUGFIX, MAINTENANCE |
| C-003 | P0 | Quotes versioned with items, currency THB, tax treatment, milestones, expiry, deliverables, scope exclusions, revision quota |
| C-004 | P0 | Customer can accept/reject quote once, timestamp+snapshot+actor, no silent repricing |
| C-005 | P0 | After authorized deposit paid → project created idempotently |
| C-006 | P0 | Project states: DRAFT, SCOPING, QUOTED, AWAITING_DEPOSIT, ACTIVE, IN_REVIEW, UAT, AWAITING_FINAL_PAYMENT, DELIVERED, SUPPORT, CLOSED, CANCELLED |
| C-007 | P0 | Milestones as deliverables with owner, deadline, acceptance, blocker |
| C-008 | P0 | File upload metadata + scan state and per-tenant access |
| C-009 | P1 | Change order/extra scope with impact quote accepted before execution |
| C-010 | P1 | SLA/response dashboard, notification preferences, support tickets |
| C-011 | P2 | Client organizations with manager invitation and scoped reporting |

## 5. Messaging & Notifications (private by default)
| ID | Priority | Requirement + Acceptance |
|---|---|---|
| T-001 | P0 | Project channels: CUSTOMER_CHAT, INTERNAL_TEAM, REVIEW_THREAD; strict separation |
| T-002 | P0 | Persist message server-side with monotonic ULID/time + idempotency key BEFORE emit event |
| T-003 | P0 | AppSync subscribe/publish authorizer validates project membership AND channel authorization for both actions |
| T-004 | P0 | Reconnect GET cursor catches missed events; ordering deterministic, duplicate client retries collapse |
| T-005 | P0 | Typing/presence are ephemeral optional; no personal contact leak |
| T-006 | P0 | Unread per user, notifications in-app, email only actionable summary without sensitive body |
| T-007 | P0 | Attachment link short-lived, allowed MIME+size+scan PASS; links are never public |
| T-008 | P1 | Search conversations within access grants, message edit policy/time window, audit of deletions |
| T-009 | P1 | Rich message embeds build artifacts & approvals; mobile push optional |
| T-010 | P1 | Customer cannot see INTERNAL_TEAM notes/AI prompts, even by network inspector |

## 6. Preview, Feedback & Acceptance
| ID | Priority | Requirement + Acceptance |
|---|---|---|
| R-001 | P0 | Build creates immutable preview version with URL, state, commit/artifact hash, changelog, deploy status |
| R-002 | P0 | Customer sees current approved preview; loading error/fallback/rollback clear |
| R-003 | P0 | Protected preview using customer authentication and isolated domain; signed session/cookies or access gateway |
| R-004 | P0 | Desktop/tablet/mobile viewport controls and open-in-new-tab |
| R-005 | P0 | Comment on specific version/page/component or screenshot with context and timestamp |
| R-006 | P0 | Review statuses: OPEN, TRIAGED, ACCEPTED, REJECTED_WITH_REASON, IN_PROGRESS, FIXED, VERIFIED, CLOSED |
| R-007 | P0 | UAT approval binds version/hash, scope and contract; cannot silently replace approved build |
| R-008 | P1 | Annotate screenshot/click target; visual diff; live co-review optional |
| R-009 | P1 | Browser game preview with WebGL/WebGPU capability detection and hardware caveat |
| R-010 | P2 | Native games: cloud video demo/build download, no promise that APK/EXE runs in browser |

## 7. Pricing, Checkout, Financial
| ID | Priority | Requirement + Acceptance |
|---|---|---|
| PYM-001 | P0 | Invoice draft linked accepted quote/milestone; no browser-side authoritative totals |
| PYM-002 | P0 | Checkout session created server-side with provider id, short expiry, amount & currency immutable |
| PYM-003 | P0 | Stripe webhook signature verified, event-id dedup, valid amount/order check |
| PYM-004 | P0 | PAYMENT_SUCCEEDED/FAILED/REFUNDED state reconciled with provider; prevent double project activation |
| PYM-005 | P0 | Customer-visible invoices/receipts reflect legally verified seller details |
| PYM-006 | P0 | Manual refund requires Founder role, reason, provider result, audit |
| PYM-007 | P1 | Split milestones, change orders, payment reminders, disputes ledger |
| PYM-008 | P1 | Tax/VAT/withholding rules configurable ONLY after qualified accounting/legal validation |
| PYM-009 | P2 | Multi-currency, automatic transfer payout & subscriptions |

## 8. Admin / AI Workspace
| ID | Priority | Requirement + Acceptance |
|---|---|---|
| A-001 | P0 | Dashboard cards: leads, urgent messages, approval gates, overdue, payments, spend |
| A-002 | P0 | Admin projects independent of customer-visible views; strict access |
| A-003 | P0 | Admin can create scoped tasks, verify QA evidence, approve releases and handover |
| A-004 | P0 | Audit event for role changes, quote changes, approval, secrets access attempts, deploy/refund |
| AI-001 | P1 | Per-project AI workspace: messages M000001..., tasks, instructions, artifacts, context hash |
| AI-002 | P1 | Founder can manually forward MN to selected AI chat; no assumption that separate chat agents communicate automatically |
| AI-003 | P1 | AI runner authenticated with project/role scoped token; allowlisted operations only |
| AI-004 | P1 | AI changes submitted as diff/build evidence, not auto-merged into production |
| AI-005 | P1 | Mandatory independent QA gate and rollback path |
| AI-006 | P1 | Usage quotas per agent/project/day/month; pause on budget exceed; human override audited |
| AI-007 | P2 | Automated assignment within max AI team policy (<=10 active agents across project) |
| AI-008 | P2 | Visual code editing/logs/rollback from browser with strict security |

## 9. Game and Bug Fix Intake
| ID | Priority | Requirement + Acceptance |
|---|---|---|
| G-001 | P0 | New game intake: engine, platform, genre, gameplay reference, target devices, art/audio ownership |
| G-002 | P0 | Bug intake: engine/version, OS, device, expected vs actual, repro steps, severity, logs/screen capture |
| G-003 | P0 | Customer affirms they own/have rights to source and assets; secrets excluded from upload |
| G-004 | P0 | No execution of arbitrary uploaded binaries or build scripts on application hosts |
| G-005 | P1 | Source import from private repo via scoped integration and owner approval |
| G-006 | P1 | Repro -> failing test -> fix -> regression -> build artifact -> QA evidence |
| G-007 | P1 | Engine-specific CI matrix Godot/Unity where license and runner capacity permit |
| G-008 | P2 | Multiplayer load tests, anti-cheat/integrity testing scoped to authorized software only |

## 10. Non-functional requirements
- **Availability:** Health endpoints & error budget; defined SLO after pilot. No unbacked “99.99%” sales claim.
- **Latency:** Responsive interaction, sampled p95 API and message delivery; performance budgets on mobile bandwidth.
- **Security:** least privilege, secrets manager, CSP, WAF/rate limits, no root AWS key usage, strong tenancy.
- **Durability:** backups/versioning, restore drills, no data lost silently, idempotency.
- **Accessibility:** WCAG 2.2 AA target, keyboard focus, labels, contrast, reduced motion.
- **Mobile:** portrait+landscape short screen; no HUD overlay blocking chat/payment/preview; touch >=44px ideally.
- **Observability:** structured logs, request/correlation IDs, deploy trace, PII redaction.
- **Compliance:** privacy notice, retention, export/delete requests, agreements and seller identity.
- **Scale:** no hardcoded customer count; queue and concurrency backpressure; per-tenant rate limits.
- **Cost:** quotas are guardrails not guarantee of free/unlimited operations.

## 11. Explicitly out of MVP
Fully autonomous multi-agent coding, public marketplace of templates, escrow, custom video calling, arbitrary mobile OS remote build farm, in-house payment gateway, real-time pixel streaming of code changes, automated legal contracts, fixed-rate unlimited edits, client executable shell inside portal.

## 12. Definition of Ready/Done
**Ready:** problem/user, testable AC, permission matrix, data classification, owner, dependencies, complexity/cost estimate, rollback identified.  
**Done:** code reviewed, unit+integration+E2E, security negative tests, mobile QA, log/metric, feature flag, docs/runbook, staging signoff; customer-facing functions approved by Founder.  
**Conflict policy:** หากเอกสารขัดแย้งกัน ต้องเปิด ADR และแก้เอกสารก่อนลงมือ; ห้ามตีความเองว่าฟีเจอร์เสร็จ
