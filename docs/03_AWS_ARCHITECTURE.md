# 03 — AWS Architecture / Infrastructure Blueprint

**Decision:** AWS-first serverless modular monolith with event-driven side effects. Deploy infrastructure as code (AWS CDK in TypeScript recommended); environment separation.  
**Note:** แนวทางนี้ยังไม่ deploy จริง, ต้องยืนยัน region availability, quotas, pricing, and AWS account access ในช่วง Phase 0.

## 1. High-level architecture
```text
User Browser (Public / Customer / Admin)
  |
  | HTTPS + custom domain + security headers
  v
AWS Amplify Hosting [Frontend: Next.js/React]
  |                             |
  | login                       | private preview (different origin/domain)
  v                             v
Amazon Cognito              Preview Access Gateway
  |                                | -> CloudFront signed cookies / isolated
  | JWT                            |    origin or protected Amplify preview
  v                                v
API Gateway HTTP API         Preview Artifacts (S3/Amplify/Build)
  | AuthN and backend AuthZ
  v
AWS Lambda (domain modules: CRM, projects, chat, quote, pay, preview, QA)
  |         |          |            |
  v         v          v            v
DynamoDB  S3 private  SQS/EventBridge  Stripe Checkout + signed Webhooks
  |                        |
  +---------> Lambda workers/CodeBuild (job/preview, scoped)
  |
  +---------> AppSync Events (WebSocket; authorize channel per project)
  |
CloudWatch / CloudTrail / GuardDuty optional / IAM / Secrets Manager
```

**Important:** AppSync Events ใช้กระจาย event หลังเขียนข้อความลง DB สำเร็จ ไม่ใช่ที่จัดเก็บข้อความถาวร; authorize ทั้ง connect, subscribe, publish. Preview builds ห้ามรันใน same trusted runtime ของบริษัท.

## 2. Service decisions / alternatives
| Concern | Initial choice | Why / when switch |
|---|---|---|
| Public+Portal+Admin hosting | AWS Amplify Hosting | managed deploy + CDN; avoid heavy SSR to control cost |
| Authentication | Cognito User Pools (Essentials/Lite review) | managed identity, MFA, hosted login optional |
| Backend | API Gateway HTTP API + Lambda | simple REST, low idle overhead |
| Canonical transactional metadata | DynamoDB on-demand | managed scaling; access patterns matter; conditional writes |
| File storage | S3 private + presigned upload | efficient large files; quarantine, versioning |
| Realtime | AWS AppSync Events | websockets publish/subscribe; per-channel auth rules |
| Async jobs | SQS + EventBridge | retries/DLQ; decouple payment, email, builds |
| Email | SES | verification/notifications (verify domain & production sending) |
| Payments | Stripe Checkout + webhook | avoid storing PAN; Thai PromptPay/card subject eligibility |
| Builds | CodeBuild in isolated project/account | ephemeral builds, IAM policy; cost/time quota |
| Static preview | Separate S3 + CloudFront + auth gateway | version immutable; restrict direct origin |
| Dynamic preview | dedicated isolated environment | no live DB/secrets, synthetic data, expiry |
| Observability | CloudWatch metrics/logs/alarms, CloudTrail | incident tracing/audit |
| Secrets | Secrets Manager/SSM secure param | never in repo/build log |
| DNS/TLS | Route 53 + ACM (or external registrar) | auto TLS, domain control |
| Security perimeter | WAF as budget allows, Shield standard availability | anti-bot/rate-limit; review pricing |
| IaC | CDK/CloudFormation | repeatable, git-reviewed setup |

**Regional placement:** เริ่ม region ที่ AWS services ทั้งหมดรองรับ (พิจารณา ap-southeast-1 Singapore หรือ ap-southeast-7 Thailand หากรายการบริการ/ราคา/latency ครบ), ห้ามสมมติว่า service availability เหมือนกันทุก region; บันทึก AWS_REGION ใน ADR.

## 3. AWS environments
- `dev`: synthetic data, sandbox Stripe, permissive feature flags but private auth.
- `staging`: parity with prod; test accounts A/B; canary deployments and full regression.
- `prod`: real customer PII/payments; strict IAM, separate secrets & backup.
- `customer-build-sandbox`: separate AWS account strongly preferred for executing client-provided code. Separate from prod and limit egress/compute/network/credentials; never mount prod credentials.
- Use deploy role via federated OIDC from CI when supported; no long-lived access keys in GitHub/JS.
- **Production data must never be copied to test** without approved masked/anonymized transform.

## 4. Repository / service structure (proposed)
```text
AZELVORI-STUDIO/
  README.md
  docs/
  apps/
    web/                   # public/customer/admin Next.js
  packages/
    ui/                    # design tokens + accessible components
    types/                 # shared contracts + validators
    auth/                  # authorization helpers
    events/                # event contracts
    config/
  services/
    api/                   # Lambda handlers grouped by domain
    workers/               # SQS consumers, Stripe, notification
    jobs/                  # build orchestration, AI runner adapters
  infrastructure/
    cdk/
      stacks/              # dns/auth/data/api/events/preview/observability
  tests/
    unit/
    integration/
    e2e/
    security/
    load/
  .github/workflows/
    ci.yml
    deploy-staging.yml
    deploy-prod.yml
```
Keep one deployable backend domain app while small; split only when coupling, ownership or scaling warrants.

## 5. Request and persistence patterns
**Write:** API JWT validated -> load tenant membership from DB -> validate request(schema) -> conditional DB transaction + immutable audit -> enqueue event (outbox pattern) -> respond canonical resource.  
**Read:** query tenant/index keyed by server-approved tenant context; no global scan exposed to customer.  
**Pagination:** cursor-based + max size (default 20, max 100); no leaked cross-tenant totals.  
**Versioning:** resource version / conditional write for quote/project/approval state.  
**Search:** index tenant-scoped; avoid unrestricted OpenSearch until demand justifies cost.

### Chat pipeline
1. Authenticated customer POST `/projects/{projectId}/messages` with `clientMessageId`.
2. Server checks membership, channel type, rate and upload scan state; conditional write (PK tenant/project) with unique idempotency key.
3. Record `chat.message.created` event through outbox; asynchronous publisher broadcasts via AppSync Event API.
4. Connected clients update UI; clients GET missed messages using cursor after disconnect.
5. AppSync namespace channel must verify project membership *on each subscription*; revoke access triggers disconnect/re-auth strategy and low token expiry.
6. Failure to broadcast does not lose messages. DLQ+replay guarantees eventual notification without exactly-once assumptions.

### Checkout pipeline
1. Accepted quote snapshot -> create invoice/payment attempt server-side (strict currency/amount).
2. Server creates Stripe Checkout session with internal invoice reference and single-use redirect.
3. Stripe webhook verified with current secret, verifies event and Stripe object signature; dedup ID; transactionally set invoice PAID and create project once.
4. Customer redirect success page may say “กำลังยืนยันการชำระเงิน” until webhook confirmed; reconcile scheduled job for missing events.
5. Refund/dispute flows mapped to ledger with immutable history and founder approval.

## 6. File handling / quarantine
- Frontend requests signed upload for tenant/project + object hash, MIME extension and max bytes. S3 key generated randomly, never trust arbitrary client path.
- Upload to quarantine bucket/prefix with public access blocked, encryption, versioning, lifecycle deletion for abandoned partials.
- S3 event -> malware scan (GuardDuty Malware Protection for S3 if supported/cost acceptable), MIME sniff, archive bomb/size heuristics, human review for source archives.
- Only CLEAN transitions to validated file; presigned GET expires quickly (e.g., 60–300 sec), backend grants per request.
- ZIP/source may contain scripts: no unzip on Lambda API nodes, no automatically running npm install/postinstall against customer content on prod, sandbox builds require reviewed job profile.

## 7. Preview isolation
- Build service emits manifest {tenantId, projectId, versionId, artifactSha256, commitSha, status, files}.
- Host each project preview on distinct **origin** from `app.azelvori.example`; no shared cookies/storage with main portal.
- Private preview token is signed, audience-bound, short TTL, revocable; protected CloudFront origin or alternative verified gate; no public S3 object URLs.
- Static site can be served via S3/CloudFront; dynamic app requires dedicated isolated runtime and synthetic fixtures, with TTL/auto shutdown and owner-reviewed external integrations.
- HTTP CSP `frame-ancestors` allowlist + sandbox iframe with least privileges; do not enable `allow-same-origin` with arbitrary scripts on a same-origin iframe.
- Preview version URL immutable; alias latest moves only after build/test Gate. Customer UAT approval pins version/hash.
- Native game preview may be an artifact download or recorded playthrough, not fake “browser simulator”.

## 8. Build and deployment
**CI:** lint -> types -> unit -> secret scan -> SAST/dependency licenses -> integration -> browser E2E (Chromium+WebKit & viewports) -> artifact signing -> staging deploy -> QA evidence -> human release approval -> prod -> smoke test -> monitor -> rollback if needed.

**AI/customer-code job security:**
- create per-run ephemeral job with allowlisted image, CPU/memory/time/disk cap, nonprivileged execution and constrained network; build artifacts uploaded to private S3.
- no root Docker socket access; no persistent SSH; no prod IAM role; secrets injected only if required for scoped integrations.
- customer/source license validation, dependency pinning, build logs redacted and retained per policy.
- if isolation cannot be guaranteed, support manual review and code-only delivery rather than executing uploaded binaries.

## 9. Scaling strategy and cost levers
- Use single consolidated Amplify app for company first; **do not create an always-on stack per client by default**.
- On-demand DynamoDB, S3 lifecycle, thumbnail processing only when needed, Realtime channel limits, compress images, cache immutable assets.
- Limit build minutes per project and number of parallel jobs; tear down previews after delivery according to retention.
- Meter: requests, Lambda duration, DB reads/writes, S3 storage/egress, AppSync operations/connections, SES emails, CodeBuild, AI tokens, Stripe fees, data transfer.
- CloudWatch alarms: 4xx/5xx p95, throttles, queue age, message DLQ, webhook failures, preview failure ratio, budget thresholds 50/80/100% (illustrative).
- Budgets warnings are not absolute spending caps; high-cost actions require manual approval and workflow-level hard quotas.

## 10. Baseline operational security
Root account MFA and no root operational use, mandatory MFA for admins, IAM roles with least privilege, CloudTrail on, S3 block public access, audit all deploys, short-lived credentials, image/dependency CVE scanning, patch schedule, access review monthly, backups & restore drills. Define incident on-call before accepting real PII.

## 11. Environment configuration (names only, no secrets)
`AWS_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `API_BASE_URL`, `APPSYNC_EVENTS_URL`, `S3_UPLOAD_BUCKET`, `S3_ARTIFACT_BUCKET`, `STRIPE_SECRET_REF`, `STRIPE_WEBHOOK_SECRET_REF`, `APP_URL`, `PREVIEW_BASE_DOMAIN`, `OWNER_EMAIL`, `BUDGET_MONTHLY_USD`.  
Store secrets via Secrets Manager/SSM and expose only required public runtime identifiers to frontend.

## 12. References and validation
- AWS Amplify pricing: https://aws.amazon.com/amplify/pricing/
- Cognito pricing/free MAUs: https://aws.amazon.com/cognito/pricing/
- AppSync Events: https://docs.aws.amazon.com/appsync/latest/eventapi/
- AppSync authorization: https://docs.aws.amazon.com/appsync/latest/eventapi/configure-event-api-auth.html
- Private S3 presigned URL semantics: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- Amplify preview/access: https://docs.aws.amazon.com/amplify/latest/userguide/advanced-deploy-features-chapter.html
- AWS Budgets: https://aws.amazon.com/aws-cost-management/aws-budgets/

**Pricing warning:** All AWS free tiers, quotas, regions and vendor prices may change; recheck actual account eligibility and latest prices before purchase/deploy. Monthly budgets are monitoring, not a universal kill switch.
