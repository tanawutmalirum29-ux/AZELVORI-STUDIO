# 05 — AI Development Workspace, Governance and Delivery Pipeline

## 1. Goal / hard boundaries
สร้างพื้นที่ทำงาน AI **ต่อโปรเจกต์ลูกค้า** ภายใน Admin ของ AZELVORI STUDIO โดยเจ้าของกิจการส่ง MN หรือคำสั่งสั้นจาก ChatGPT ไปยัง AI แชทที่ตนเลือกเองได้ และ AI ที่เชื่อมกับระบบจริงจึงจะสามารถแก้โค้ด ตรวจ Diff หรือสั่งงานใน sandbox ผ่าน API ที่ถูกอนุญาต

**No magic integration:** การเปิด ChatGPT แยกหลายแชทไม่ได้สร้าง network ระหว่างแชทอัตโนมัติ, หน้าเว็บไซต์จะไม่สามารถ “ควบคุม ChatGPT” โดยไม่มี API, browser tool, agent runner และ authentication. ต้องมี explicit connector/action ที่ผ่านสิทธิ์แล้ว. ห้ามเขียน UI ที่อ้างว่ารันงานจริงแต่เพียงแค่บันทึกข้อความ

## 2. Scope แยก Customer กับ Organization อย่างเด็ดขาด
`CUSTOMER_CHAT`: ลูกค้า↔คนดูแลบริษัท; ไม่มี internal technical notes, agent instructions, test data, secrets.  
`INTERNAL_TEAM`: CEO/DIR/TL/EN/QA (AI หรือมนุษย์); เข้าถึงเฉพาะ staff และ agent ที่มอบหมาย project.  
`REVIEW_THREAD`: แชทเกี่ยวกับ preview มี customer-visible subset ตามสิทธิ์ที่กำหนด.  
**ห้าม** ใช้ GitHub Issues เป็นห้องสนทนา AI; Github ใช้ source control, PR, external bug backlog เฉพาะที่จำเป็น. พื้นที่องค์กรเกิดขึ้นอัตโนมัติ **ภายใต้โปรเจกต์นั้น** ไม่ใช่ห้องรวมระหว่างลูกค้า.

## 3. Team structure and quota
Team assignment flexible:
`FOUNDER/OWNER` — สั่งงาน, บริหารงบ, รับรอง quote, อนุมัติ Merge/Production, คืนเงิน/ส่งมอบ  
`CEO/PROJECT-LEAD` — กำหนด scope, milestones, plan, QA gate, source integration  
`DIR` — บริหารสายงาน frontend/backend/game/visual ตามขนาดงาน  
`TL` — แบ่ง task ระหว่าง 2 engineers ได้ตามความจำเป็น  
`EN` — ทำ implementation ที่ได้รับมอบหมาย  
`QA_REVIEWER` — ตรวจอิสระจากผู้แก้งาน, block release ได้  
**จำนวน AI active พร้อมกันต่อโปรเจกต์สูงสุด 10** (นับทุกบทบาทที่เป็น AI; Owner มนุษย์ไม่ใช่ AI). ทีมอาจเล็กเพียง 1 developer+1 QA; ห้ามใช้ผังจำนวนคนเกิน 10 เพราะสูตร org chart โตไม่จำกัด.

Founder อาจเลือกแต่งตั้ง CEO ใหม่; การแต่งตั้งดังกล่าวจะ invalidate/revoke agent assignments เก่าทั้งหมดใน **โปรเจกต์นั้น** และต้องแต่งตั้ง team ใหม่ มิใช่เปลี่ยนระบบระดับ global โดยไม่ขออนุมัติ.

## 4. Workspace provisioning
เมื่อ `Project.state ACTIVE` และ deposit verified:
1. สร้าง `workspaceId` และ project-scoped storage prefix / audit scope / budgets.
2. สร้าง timeline, task board, internal feed, assignable roles, QA gate, artifact manifest.
3. สร้าง `messageSequence` ภายใน workspace เริ่ม `M000001` (เลขเพิ่มอย่างเป็นลำดับ; ไม่เริ่มใหม่ระหว่างโปรเจกต์เดิม)
4. ตรึง contract/hash ของ scope, quote, accepted requirements, target devices/platform.
5. เลือก source option: GitHub private customer repo via approved installation; หรือ managed internal versioned workspace. **ไม่จำเป็นต้องเปิด GitHub repo ให้ลูกค้าทุกคน**
6. ตั้ง quotas: model token budget, max task runs, max preview builds, file and disk cap, concurrent workers.
7. ส่ง owner dashboard new workspace with clear “Not yet running” until runner registered.

## 5. Messaging Protocol
Project-local message ID `M000001` increment by server conditional update, independent for each workspace. Message categories:
| Code | Meaning | Example |
|---|---|---|
| `AP-ROLE` | คำสั่งแต่งตั้งและกรอบสิทธิ์ | `AP-ROLE CEO PROJECT#P0001` |
| `MN` | มอบหมายงาน พร้อม acceptance | `MN UI-01 Implement responsive hero + tests` |
| `MQ` | ขอข้อมูล/ข้อจำกัดที่แก้งานต่อไม่ได้ | `MQ Missing design assets for logo` |
| `TR` | ลองใหม่/แก้ blocker ที่ปลอดภัย | `TR Retry build with sanitized logs` |
| `C` | รับทราบสั้น ๆ พร้อมสถานะ | `C RECEIVED / BLOCKED / DONE` |
| `QA` | Review verdict, evidence | `QA HOLD: 320×568 overlap` |
| `REL` | Release approval with immutable artifact | `REL APPROVED SHA:...` |

**Message envelope fields:** messageId, workspaceId, seqCode, senderRole, recipientRole, taskId, summary, links to artifacts/preview, status, createdAt, correlationId, readAckAt.  
**Short-reply UX:** UI แสดงแค่รหัส+ผล+ลิงก์; details อยู่ใน task report, ไม่ยัด log หลายพันบรรทัดในข้อความ.

### Example (owner manually forwards)
```text
MN M000027 | PROJECT P-0001 | ENGINEER-WEB
Task UI-01: ทำหน้าแรก responsive, ห้ามเปลี่ยน payment logic.
Done = lint/typecheck/unit PASS, browser 5 sizes PASS, diff link+SHA.
Submit to QA, no production merge.
```
AI reply:
```text
C M000027 | UI-01 | CODE_READY | Build PASS | Diff: <internal link> | QA_PENDING
```
No fake progress: `CODE_READY` ต้องมี commit/artifact evidence. `QA_PASS` ต้องมี QA verdict signed by independent reviewer.

## 6. Work item lifecycle
`NEW → SCOPED → ASSIGNED → IN_PROGRESS → CODE_READY → QA_RUNNING → QA_HOLD / QA_PASS → OWNER_REVIEW → PREVIEW_PUBLISHED → CLIENT_UAT → APPROVED → RELEASED → CLOSED`.  
Failure loops: QA_HOLD→IN_PROGRESS with preserved evidence; UAT_CHANGES→Change request/next version.  
**Never auto-close:** merged/finished if tests skipped. Event-sourced audit trail for transitions.

## 7. AI agent execution contract
```json
{
  "taskId": "task_...",
  "projectId": "prj_...",
  "sourceRef": "snapshot_or_branch_sha",
  "allowedPaths": ["apps/web/src/**"],
  "forbiddenPaths": ["infrastructure/prod/**", "**/.env*", "billing/**"],
  "acceptanceCriteria": ["responsive at 5 viewports", "unit tests pass"],
  "toolGrants": ["read_code", "propose_patch", "run_safe_tests"],
  "maxTokens": 100000,
  "maxWallMinutes": 25,
  "maxCostUSD": 2.00,
  "requiresApprovalFor": ["deploy_prod", "delete_resource", "refactor_auth"],
  "expiresAt": "2026-10-31T00:00:00Z"
}
```
**Illustrative caps** only; actual pricing limits require budget signoff.

Agents must declare: input version, changed files, diff hash, commands run, test results with log artifact, unknowns, dependencies, security findings, cost spent. The tool server, not LLM self-report, validates execution receipts and commits.

## 8. Tool boundary / isolation
Recommended runner has:
- OIDC/mTLS or signed short-lived service token with allowed resource list and TTL; per-agent audit.
- backend controls validate every requested action against task scope, file paths, repository/branch, preview environment.
- shell/build allowed only in isolated sandbox with resource and network limits; not on Lambda API/prod container.
- no direct raw cloud Admin keys exposed to model prompts or chat messages.
- outbound network allowlist for dependencies when feasible, blocked metadata endpoint; artifacts scanner.
- customer uploads and prompt text are untrusted input: protect against prompt injection that requests credential exfiltration or skips QA.
- agents cannot browse all client tenants even if platform operator can; owner manually grants project access.

## 9. Development process templates

### Website / Web App
Discovery & sitemap → visual mockup → design tokens → responsive components → integration/data flows → payment/security (if scoped) → tests → protected preview → UAT → production → docs/handover.

### Game Creation
GDD concise (core loop, genre, controls, target FPS, platform) → 1 playable mechanic prototype → vertical slice approval → feature milestones → art/audio/license matrix → gameplay/performance/accessibility tests → preview/build → UAT → source delivery.

### Game Bug Fix
Intake repro evidence + project rights → environment/version lock → reproduce and log baseline → failing regression test → targeted fix → performance comparison → QA build on agreed devices → patch notes + rollback → delivery.  
If reproduce impossible, deliver a **diagnostic report**; no claim bug fixed without evidence.

### Maintenance
Production incident triage → impact/severity → reproduction → patch review → staging regression → planned release → monitor → report; urgent hotfix must still be logged and postmortemed.

## 10. Test and release gates
**G0** Scope/version locked and risks classified  
**G1** Code reviewed (no secrets, license issues or unscoped changes)  
**G2** CI green at exact artifact SHA (lint/type/unit/integration)  
**G3** QA independent: Chromium+WebKit 5 viewport matrix and domain-specific game tests  
**G4** Security: AuthZ negative tests, dependency scan, file/preview isolation, billing idempotency as applicable  
**G5** Founder approval of named version & deploy target  
**G6** Staging smoke → Preview share/customer UAT  
**G7** Contractual payment/acceptance and final release/ownership transfer per terms

If any gate not applicable record explicit N/A reason; NEVER silently skip required gate. Merge to main only on approved code review with required tests; protect main via branch protection where possible.

## 11. Project hygiene / communication UX
- One workspace per customer project, each retains M-number history, documents, receipts.
- Customer has separate project activity feed; staff can publish customer-ready status manually/through reviewed templates.
- Team disbands after accepted delivery; project becomes read-only/Support, credentials revoked, archives retained per policy.
- Messages are not GitHub Issues; PRs and commits remain as source control for optional integrations.
- Owner can click “Copy MN” and send it to chosen ChatGPT chat; system must not assume agent received it without callback/receipt.
- Web interface offers quick decisions APPROVE, HOLD, REQUEST FIX, PAUSE, CANCEL with a single confirmation rather than complex registration steps.

## 12. Evaluation, abuse prevention and costs
Log agent success rate, hallucinated receipt frequency, rollback frequency, user time saved, QA fail classes, total AI tokens+build minutes per project.  
Rate-limit automatic retries to exponential backoff with ceiling; do not endlessly retry authentication, permission or billing errors; escalate rather than circumvent security blocks.  
No autonomous production changes, client refund or irreversible deletions. Pause an agent when budget exhausted or potentially malicious instruction appears; manual approval to resume.

## 13. Exit criteria to turn on AI runner
- API tool authentication/authorization tests pass incl cross-tenant denial
- at least one dry-run read-only task on synthetic repo, one staged edit task and one sandbox build with matching SHA evidence
- independent QA validation, audit + cost metering demonstrated
- revoke/rotate tokens and abort-running-job controls verified
- emergency stop checked end-to-end
- Founder explicitly authorizes agent tool access and scopes
