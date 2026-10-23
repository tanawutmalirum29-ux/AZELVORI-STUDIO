# 09 — Operations Runbook / Deployment, Monitoring, Incident & Recovery

**State:** proposed operational procedures, not evidence of deployed infrastructure.  
**Audience:** Founder, Engineering, QA, on-call.  
**Scope:** AWS account, website, private chat, storage, checkout, protected preview, AI runners, customer data.

## 1. Production principles
1. Do not deploy code with unresolved P0/P1 security or payment defects.
2. Deploy one verified artifact digest at a time with immutable release notes.
3. Main platform remains protected even if a customer's demo/build is compromised.
4. Every critical change has a rollback and restore plan prepared in advance.
5. Observability is part of Definition of Done, not a post-launch extra.
6. A cost alert is not a guaranteed upper spending limit; design application quotas and backpressure.
7. Separate disaster recovery tests from customer production data and measure actual outcomes.

## 2. Initial account bootstrap SOP (owner executed)
- [ ] Confirm legal billing owner and AWS account contacts; root MFA enabled, no root access keys.
- [ ] Choose approved region after checking Amplify, Cognito, AppSync Events, DynamoDB, S3, Lambda, API Gateway, CodeBuild, CloudFront, SES availability/pricing.
- [ ] Create least-privileged operator and deploy roles, admin MFA, emergency break-glass account with logging.
- [ ] Enable CloudTrail and security notifications; protected CloudWatch logs with retention/redaction.
- [ ] Set AWS Budgets monthly (illustrative alerts at 50/80/100%) + anomaly detection; verify notification arrives to real monitored inbox.
- [ ] Define app-level controls: requests/rate per tenant, daily/monthly build quota, token budgets, S3 upload max, worker concurrency, manual confirmation for high-cost tasks.
- [ ] Set DNS, TLS ACM certs, email DKIM/SPF/DMARC, SES sandbox upgrade if needed.
- [ ] Provision `dev`/`staging`/`prod` via reviewed IaC; secure preview sandbox build account if customer-code execution enabled.
- [ ] Store production secrets in managed secrets store; secure rotation, never print values.
- [ ] Set S3 buckets private with public block; lifecycle & versioning; DynamoDB backups/PITR according to RPO design.
- [ ] Test IAM denying client/staff/runner unauthorized access *before* uploading personal data.

## 3. Deploy runbook
**Prereqs:** QA report with exact SHA, CI green and security scans, migration plan, founder approval, snapshot/backup verified, change window selected for high-risk migrations.

```text
Release ID: REL-YYYYMMDD-NNN
Source Commit: <sha>
Artifact SHA256: <digest>
Environment: staging -> prod
Issue/Scope: <task refs>
Tests: lint PASS, unit PASS, integration PASS, browser matrix PASS
Security: PASS / documented risk accepted by authorized founder
QA Verdict: PASS with link to evidence
Owner Approval: <actor+timestamp>
Rollback: last-good artifact <sha>
Deploy Time: UTC time and timezone
Post-Deploy Smoke: PASS/FAIL
```

### Steps
1. Validate stage deployment & environment config; test login, tenancy, customer chat, preview, webhook sandbox and billing read.
2. Check migration forward/backward compatibility; deploy schema additive change before dependent code.
3. Confirm correct account/region/project IDs (prevent deploy to wrong AWS account).
4. Approve immutable release from Admin/CI gate; production deployment by scoped deploy role.
5. Smoke checks: public home, auth, A project read, B denial, test chat, preview gating, service health; do not execute live payment charge without safe approved test strategy.
6. Watch error rate/p95, queues, logs, budgets, broken links for agreed observation window.
7. If failure crosses rollback threshold, revert alias/deploy to last-known-good; record incident and communicate.

### Rollback options
- Frontend: redeploy previous immutable Amplify build/release; validate old env variables.
- API/Lambda: move alias to previous function version; rollback feature flag/migration if safe.
- Preview: move `latest` alias pointer to previous approved version; never rewrite accepted version artifact.
- Data migration: restore from verified backup to isolated stack before choosing irreversible prod restore; prefer forward corrective migrations when possible.
- Payment: never “rollback” successful external charges by DB deletion; use reconciliation/refund process.

## 4. Operational dashboards and alerts
| Area | Metric | Trigger proposal | Immediate response |
|---|---|---|---|
| Public site | 5xx and availability | > threshold over 5 min | incident triage/rollback |
| API | 5xx, p95 latency, Lambda throttles | sustained anomaly | inspect deploy and concurrency |
| Chat | persisted→broadcast lag, DLQ, reconnect rate | sustained lag | fallback polling, replay outbox |
| Auth | login failures, anomalous permissions | spike/high severity | threat review, account containment |
| Billing | webhook failures/replay backlog | any sustained failures | stop activation, reconcile with provider |
| Uploads | malware scan failures, queue depth | repeated failure | hold quarantine downloads |
| Preview | build failure rate, orphan runtimes | threshold / aging | disable build, clean up safely |
| AI | token spend, tool deny, infinite retry | quota reached | pause agent, inspect receipts |
| Storage | S3 capacity, access denials | abnormal growth | enforce limits, investigate |
| Cloud cost | actual/forecast spend | 50/80/100% budget | notify, pause optional workloads/manual review |

**Evidence:** dashboards must have actual URLs, team access, owner, and retention policy after deployment. Do not expose dashboard to customers unless scoped.

## 5. Chat incident runbook
**Symptom:** messages not appearing; user sees stalled spinner or reconnect.
1. Determine whether POST persistence works; query canonical DB using privileged audited ops.
2. If DB persisted but events not sent: check outbox queue, AppSync permission errors, SQS DLQ.
3. Enable customer fallback polling at bounded frequency; annotate “reconnecting” (never tell users message lost without evidence).
4. Replay pending events idempotently; duplicates are deduped by message ID on clients.
5. Test client A + B cross-tenant denial before restoring realtime permissions after auth/config edit.
6. Write incident report with backlog counts, duration and missed/not-missed message evidence.

## 6. Payment incident runbook
**Symptom:** customer paid but dashboard says pending; duplicate charge dispute; webhook 5xx.
1. Stop automatic project activation if reconciliation is uncertain.
2. Inspect Stripe dashboard via authorized operations, compare payment provider IDs to invoice amount/currency and ledger.
3. Validate webhook signing secret/config and event retries; restore consumer from dead-letter queue.
4. Reconcile exactly once with conditional DB write; don't mark paid from screenshot/browser URL.
5. Escalate duplicate/incorrect charge to Founder+Finance; refunds only through provider workflow with audit and client notice.
6. Document affected invoices, provider IDs and mitigation with customer PII redacted in issue/incident summaries.

## 7. Preview/build incident runbook
**Symptom:** preview 404, reveals other customer's content, compromised uploaded file, bill spike.
- For availability failures: inspect build status, immutable artifact manifest and signed-token expiration. Revert `latest` alias to known-good after QA.
- For unauthorized preview access: **SEV1** disable preview access gateway and token issuance, revoke signing keys/sessions if needed, investigate logs; do not simply hide button in UI.
- For sandbox compromise: isolate/delete affected ephemeral compute and credentials, suspend builds globally, review egress/access logs, rotate scoped secrets, confirm no production compromise.
- For build cost spikes: throttle queue, pause new builds and AI runs, enforce per-project maximum, delete orphan runtimes after retention validation.
- Customer source should remain in immutable backup, never destroyed during triage without approval.

## 8. Backups and restore (initial RPO/RTO proposals)
| Data | Mechanism | Candidate RPO | Candidate RTO |
|---|---|---|---|
| DynamoDB project/payment/chat | PITR + scheduled export | <= 24h / finer if affordable | <= 8h |
| S3 upload/artifact | versioning + optional replication | <= 24h | <= 8h |
| IaC/source | protected Git + release artifacts | per commit | <= 4h |
| Secrets/config | managed history + offline break-glass docs | per change | <= 4h |
| Immutable audit | append-only backup retention | per event policy | <= 24h |

These are **planning targets only**; verify service settings, expense, replication and actual measured drill results. Payment provider events require separate external reconciliation. A backup is not considered valid until restoration test passes.

### Restore drill
1. Select known staging backup date and expected record hashes.
2. Restore to **isolated** AWS environment (never overwrite prod just to test).
3. Validate tenant permissions, message history, invoice uniqueness, presigned file access, previews and cryptographic manifest.
4. Measure recovery times and data gap, compare proposed RPO/RTO and record deficiencies.
5. Remove isolated restore environment after retention and cost signoff.

## 9. Credential rotation / offboarding
- On staff/AI assignment expiry: revoke grants, invalidate tokens, remove project/tool role, rotate exposed secrets and disable workspace.
- On suspected exposure: emergency key rotation and container termination, audit provider access, notify incident owner.
- Customer final handover: create customer-owned admin accounts/credential transfer through secure path, revoke studio access unless support retained, provide deployment/build instructions, confirm deletion/retention rights.
- Do not send long-lived keys or passwords over plaintext chat; password manager or sealed secret-sharing channel where justified.

## 10. Data retention and legal hold
- Private leads/temporary uploads/previews auto-expire according to reviewed policy, after project closure or prolonged inactivity.
- Invoices and contract records follow legal/accounting retention with exceptions.
- Support DSAR delete/export requests with identity verification, ticket and audit; do not purge contract/payment data required by law without review.
- Legal hold overrides normal deletion while authorized and documented; avoid indefinite hold without revisit.

## 11. Release/checks on recurring cadence
**Daily:** alerts, failed jobs, DLQ, payment settlement mismatches, important unanswered leads, budget trend.  
**Weekly:** staging regression, dependency patches, orphan previews/artifact retention, access requests, client progress reviews, AI spend per project.  
**Monthly:** AWS cost analysis, IAM grants audit, key expiry, backup sampling, privacy request ledger, incident trends, security patch cadence, feature prioritization.  
**Quarterly:** restore drill, tabletop incident response, penetration test scope review, DPA/vendor roster review, SLA recalibration from observed metrics.

## 12. AWS costs and controls nuance
AWS does **not** have a universal default “free unlimited” quota. Free plans and service tiers depend on account creation date/plan and each service. AWS Budgets may lag actual usage, and IAM Budget Actions alone are not an absolute spending cutoff. Investigate any newer account-specific Spend Limits eligibility directly inside AWS before relying on one.  
Separate mitigation: in-app job caps, reserved per-project budgets, concurrency limiting, resource cleanup TTL, approval for dynamic preview clusters/large builds, no GPU services by default. Finance reviews actual invoiced cost against forecast after each month.

Official AWS cost documents:
- https://aws.amazon.com/amplify/pricing/
- https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html
- https://aws.amazon.com/aws-cost-management/aws-budgets/

## 13. Disaster recovery tabletop scenarios
A. Stripe sends success 3 times & frontend receives callback twice → single activation, no duplicate invoice.  
B. AppSync offline for 20 minutes → chat persists and backfills, no data leak.  
C. Customer A ID request resolves B's preview → all previews blocked; SEV1 containment and notify assessment.  
D. CodeBuild downloads malicious npm package → build sandbox is contained, no production IAM key available.  
E. Failed migration causes project list outage → rollback app, restore tested data if irreversible.  
F. Founder loses admin phone/MFA → controlled emergency break-glass without shared root use.  
G. AWS billing anomaly → application self-quota prevents optional new build jobs before financial damage grows.

Each drill produces: date, environment, expected vs actual, participants, elapsed recovery, issues to fix, owner and verification.

## 14. Final operational go/no-go
```text
GO only if:
  [x] founder approves legal identity/payment and security checks
  [x] staging acceptance signed for required workflows
  [x] customer A/B authorization negative tests pass
  [x] payments idempotency tests + provider reconciliation pass
  [x] backup restoration evidence recorded
  [x] alarms/incident ownership verified
  [x] cost quota and emergency pause tested
  [x] exact release artifact SHA and rollback recorded
Otherwise:
  HOLD / DO NOT ACCEPT LIVE PAYMENTS
```
All checkboxes above are examples and NOT evidence they are currently completed.
