# 08 — Commercial Model, Client Operations, Pricing, Finance & Delivery Policies

**Scope:** business plan proposals for Founder approval. Illustrative prices and thresholds below are planning examples, **not published quotes or guaranteed costs**.

## 1. Positioning and service packages
| Offer | Typical scope | Quote strategy | Deliverable |
|---|---|---|---|
| Web Starter | 1–5 pages, responsive, contact form | fixed after brief | deployed site + content guide |
| Business Web | multi-page CMS/basic booking | fixed with integrations scoped | production web app + training |
| Custom Web App | auth, dashboard, workflows, data | discovery + milestones | system + technical docs |
| Game Prototype | one core loop, prototype art, HTML5/Godot | milestone/sprint | playable vertical slice |
| Full Game | gameplay systems, content, assets, QA | discovery + phased quote | stage-based source/builds |
| Game Bug Fix | reproduce isolated defect + regression | paid diagnosis then fixed/time-boxed | fix patch + test/report |
| Support & Maintenance | monitoring, updates, incident SLA | monthly retainer | periodic report + tickets |

Price calculation: `Estimated engineering effort × effective hourly cost + AI/API + AWS build/hosting + 3rd party assets/licenses + QA + project overhead + risk buffer + target margin`.  
Complex projects require paid discovery/feasibility phase; NEVER quote unlimited game features or unlimited revisions for flat fee.

## 2. Example pricing worksheet — internal only
Use this model, not hard-coded numbers. Sample in THB:
```text
Development labor cost                  8,000
AI/API tooling                          1,200
QA/UAT                                  2,000
Hosting/build/storage allocation          600
Assets/licenses                           500
Project management                      1,500
---------------------------------------------
Direct/allocated cost                  13,800
Contingency (15% illustrative)          2,070
Total expected cost                     15,870
Quote with target gross margin 35%  =  15,870 / (1 - 0.35)
                                      = 24,415.38 THB
Round per pricing policy; taxes/fees considered separately.
```
**Important:** Gross margin formula differs from markup. Payment processing fees, VAT/withholding, refunds and discounts must be modeled appropriately before final published quote.

## 3. Contract / quote structure
Every quote should include:
- Seller legally required identity and contact details; buyer & tax details if applicable
- project title/service type, baseline requirement revision, deliverables and exclusions
- platforms/engine/version, hosting and dependencies, ownership/IP license and third-party restrictions
- number of revision rounds and what counts (minor defect vs new feature)
- acceptance test matrix and supported devices/browsers; third-party dependencies
- milestone schedule, payment installments, what pauses schedule
- customer-provided assets/access responsibilities; deadline to respond to clarifications
- hosting subscription cost allocation, post-delivery warranty and maintenance options
- confidentiality/privacy/AI use notice and portfolio publicity opt-in
- cancellation, termination, refund, chargeback, dispute procedure and governing terms
- time-limited quote validity; version + acceptance evidence

Suggested **illustrative** milestones 30% deposit / 40% reviewed prototype / 30% final release; adjust per project risk and legal requirements. Never activate paid state from front-end alone.

## 4. Revision and change order policy
- Included revisions defined per milestone (example 2 rounds of minor UI feedback within original scope).
- Bug fix of a contractually agreed feature that fails acceptance does **not** automatically consume a discretionary design-change round.
- New feature, new platform, changed engine, new art direction or unplanned large refactor requires Change Order (scope, price, time, acceptance impact) approved before work.
- Record revision as linked to exact preview hash/version and classify `DEFECT` vs `SCOPE_CHANGE` vs `DESIGN_POLISH`; disputes go to founder/PM.

## 5. Bug fixing intake triage
Customer submits: engine (Godot/Unity/web/other), version, target OS/graphics/device, expected vs actual, minimal repro, access rights, logs/screenshots, most recent known-good version.  
Triage:
1. Confirm reproducibility & severity; do not claim fix before test.
2. Quote time-boxed investigation if not reproducible initially.
3. Produce diagnosis with root cause confidence and minimum safe patch.
4. Develop failing regression, apply patch, run targeted + broad tests.
5. Publish staged build/notes, get customer acceptance and handover.
6. If cannot fix within agreed cap, explain evidence and next options; bill according to approved diagnosis terms.

## 6. Game creation delivery
- **Preproduction:** mini-GDD, reference mood board, target platform/engine and ownership rules.
- **Prototype:** 1 core gameplay loop and touch/keyboard controls; early playtest and scope lock.
- **Vertical slice:** art direction, enemy/player feedback, menus, progression example, save behavior if agreed.
- **Production:** content pipeline, level/build tools, asset provenance, VFX/animation/audio, localization options.
- **QA:** game FPS/lag, crash/freezes, save migration, deterministic test where relevant, compatibility matrix.
- **Handover:** source, build, assets/licenses, engine/editor version, build instructions, limitations, known issues, warranty.

## 7. Lead operations / CRM SOP
`NEW → ACKNOWLEDGED → DISCOVERY → QUALIFIED → SCOPED → QUOTED → WON/LOST`.  
Initial goal: acknowledging within minutes automatically and human reply within one business day (not public promise until capacity proves). If budget/scope mismatch, politely decline or offer smaller discovery phase.  
Ask only information needed for quote; don't collect personal ID in first contact. Follow-ups via portal/email under notification preferences.

## 8. Customer communications
- Primary: Customer Portal private chat & invoice/review notifications.
- Email: invitation, quote, payment/status alerts, delivery summary; avoid copying confidential text into email subject.
- Optional LINE/social are secondary only by customer preference and verified staff process; conversations outside portal should be summarized back with consent.
- Customer updates: only verifiable milestones, next action, blocker owner and ETA **when backed by a plan**. Avoid fabricated “80% done.”
- Support: working hours, response-time tiers, emergency availability and escalation explicitly published after capacity planning.

## 9. Support tiers (proposal)
- **Warranty:** defects within accepted scope for defined period; time length decided by Founder per contract.
- **Standard Maintenance:** updates/security patches/limited hours, uptime monitoring if hosting managed.
- **Priority SLA:** faster response window, charge premium only if staffing adequate.
- Severity P0: service unavailable/payment/security; P1: core flow broken; P2: minor UX; P3: enhancement request.
- Client-caused source edits, unapproved third-party plugins or changed hosting environment may alter warranty eligibility; contract must specify.

## 10. Payment handling / financial controls
- Payment provider Stripe is candidate; **never guarantee client won't see founder legal name** — test actual banking display; KYC identification to processor remains necessary.
- Invoice and receipt issuer details must follow business entity and Thai tax rules; accounting signoff required.
- Track `order_amount`, `net_amount`, `processor_fee`, `refund`, `tax_due`, `AI_cost`, `AWS_cost`, `gross_margin`.
- Reconciliation daily/weekly: external payout/transaction records versus internal ledger, outstanding exceptions.
- Refund workflow: customer request → staff review → founder approval → provider action → ledger entry → client notice; no unlogged manual edits.

## 11. Unit economics dashboards
**Per project:** agreed fee, invoiced, received, cash outstanding, estimated/historical labor, AWS allocation, AI tokens, third-party assets, revisions, net contribution, planned delivery date, actual acceptance.  
**Company:** pipeline weighted value, conversion, average ticket, churn, recurring maintenance revenue, cash reserve, unresolved refunds/disputes, utilization, AI cost.  
**Alerts:** gross margin forecast below threshold, 2+ unplanned revision rounds, preview build spend > capped budget, 30-day idle paid project, critical client support unanswered.

## 12. AWS/AI costs — planning framework
AWS free tier is service-specific, may be temporary or have eligibility rules, and usage may become billable beyond quotas. No “unlimited daily without cost” claim.  
Cloud budget should track total AWS account and tenant/project tagged resources. Simulate:
- 1, 10, 50 and 100 active clients
- concurrent chat connections and messages/month
- 1–10 preview builds/project/week
- S3 attachments average 100 MB vs 2 GB per project
- percentage of live dynamic previews (more expensive than static)
- AI tokens by role/task, retries and QA rework
- transaction processing fees, refunds and international card mix
Use AWS Pricing Calculator and provider dashboard for region-specific real estimates, update monthly.

## 13. Legal transparency and brand
**AZELVORI STUDIO** is branding. Until verified and registered, don't claim it's “AZELVORI STUDIO Co., Ltd.”.  
Verify Thai trademarks/business name, domain availability, legal seller identity, privacy and cookie policies, Thailand taxation, B2C cancellation and receipts before public marketing and collecting payment.  
No portfolio work without customer permission; no testimonials that did not happen; no promises about AI cost/free or unlimited features.

## 14. Founder prelaunch decisions checklist
- [ ] legal seller type and truthful public identity/receipt
- [ ] pricing floor/minimum project size; diagnosis fee
- [ ] maximum parallel clients
- [ ] supported tech stack/engines/platforms
- [ ] service hours/support escalation
- [ ] payment provider and approved transaction fee
- [ ] AWS monthly budget and recovery reserve
- [ ] revision/warranty/refund templates
- [ ] client legal notices and AI data-processing approval
- [ ] domain/brand trademark review and marketing style
- [ ] portfolio/demo source and permission
- [ ] customer source hosting policy & handover format

**Exit:** First 3 trial clients can be quoted, invoiced, previewed, accepted and handed over without side-channel confusion or untracked expense.
