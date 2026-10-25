# AZELVORI — Founder Live Pilot on Real Staging

**Scope:** an authenticated founder can test real AWS persistence and operational flows with **synthetic data only**, while public lead intake, payments, production legal and paid order creation remain disabled. This is not a production launch or a bypass of legal/customer privacy controls.

## Verified code capabilities and limitations

| Surface | Pilot support | How to test |
|---|---|---|
| Public landing, information and static demo | Available | `/`, `/demo`, `/privacy`, `/terms` |
| Public intake wizard | **Draft/preview only** | `/start`; public `POST /api/v1/leads` remains 503 |
| Founder-only live lead intake | **NEW, real writes, synthetic data** | `/admin/pilot` creates a `[TEST PILOT]` item in DynamoDB, returns a persisted receipt |
| Founder lead CRM | Available after founder login | `/admin`: acknowledge, qualify and follow up |
| Private project creation, invitations, messaging, milestones | Implemented; requires grants and separate test identity | `/admin/projects`, `/app`, `/invite` |
| Employee create, reissue/revoke, staff chat & lead queue | Implemented; not automatically provisioned | `/admin/employees`, `/staff/login`, `/staff/inbox` |
| Real customer payment, invoicing, file uploads, realtime notifications | **Not implemented** | Do not claim that the buttons are functional or request real payments |

## AWS rollout — operator action required

1. In AWS CloudShell **Sydney / ap-southeast-2**, verify AWS account **301338930958** and checkout current GitHub `main`. Run tests and build with Node 22.14+; no credentials belong in GitHub or chat.
2. Re-check GitHub CI for merged `main` SHA and AWS Amplify frontend release status. The site at `https://main.d3uhwi8blbgrci.amplifyapp.com` must run the merged version.
3. Run CDK **diff first**, retaining the deployed staging stack settings and adding **`pilotEnabled=true`**, with **`intakeEnabled=false`, `legalReady=false`, `lambdaConcurrency=shared`**. The only expected changes are the Lambda code/env and a scoped JWT-protected API Gateway route. No Cognito pool, DynamoDB table replacement or public intake change should appear.
4. After reviewing diff, deploy `Azelvori-staging`. Confirm output `PilotEnabled=true`, `IntakeEnabled=false`, `LambdaConcurrencyMode=shared`; verify API `GET /health` reports `pilotEnabled=true`, `intakeEnabled=false`.
5. Founder signs into `/admin/pilot` using the existing required TOTP account. Click **สร้างบรีฟทดสอบในฐานข้อมูลจริง**. It creates only synthetic lead fields with `[TEST PILOT]` prefix and `pilot@example.com`, and uses a stable per-page UUID for safe retries.
6. Verify the receipt exists in `/admin` after a fresh reload; transition state, create a project, issue a **test-account-only** invitation, then test messages via customer and staff logins. Do not invite or store real client data.
7. Inspect CloudWatch application errors, audit table append record and access logs after testing. Record screenshots/QA results **without passwords, tokens, one-time invite links or real customer data**.

### Copy/paste: staging diff command

```bash
export AWS_PAGER='' AWS_REGION=ap-southeast-2 AWS_DEFAULT_REGION=ap-southeast-2
test "$(aws sts get-caller-identity --query Account --output text)" = "301338930958" || exit 1
cd ~/AZELVORI-STUDIO
git switch main && git pull --ff-only origin main
npm ci --ignore-scripts
npm run build:api
npx cdk diff Azelvori-staging --no-change-set --app 'node --import tsx infrastructure/cdk/app.ts' -c stage=staging -c appOrigin=https://main.d3uhwi8blbgrci.amplifyapp.com -c intakeEnabled=false -c pilotEnabled=true -c legalReady=false -c lambdaConcurrency=shared
```

Once output is reviewed and acceptable, use the same command replacing `diff` with `deploy` and remove `--no-change-set`.

## Security contract

- `pilotEnabled=true` is allowed **only** when `stage=staging` and **public intake is disabled**. Attempting pilot mode in dev/prod or with public intake fails CDK validation.
- New `POST /api/v1/admin/pilot/leads` uses the *existing founder Cognito JWT authorizer and validated founder grant*, and verifies exact app origin and UUID idempotency key.
- Backend ignores any data provided in the POST body; all persisted values are fixed/synthetic and validated by the existing `submitLead` domain path.
- Each request is rate-limited, deduplicated and audited by the existing DynamoDB transaction; no arbitrary customer data is accepted through this test endpoint. Revoking the founder grant blocks further writes.
- A link is not an access-control mechanism. The new route must not be made anonymous or promoted to public intake.
- Existing public-intake legal guard remains in force; never claim `legalReady=true` without reviewed published legal identity/privacy content.
- Payments, attachments, customer self-registration and commercial acceptance remain outside this pilot.

## Acceptance and evidence tracker

| Check | State | Proof |
|---|---|---|
| Code + contract tests | **PASS** | [PR #11 QA 40168690843](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/40168690843) |
| JWT founder negative tests | **PASS** | `tests/integration/api.test.ts`, [CI](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/40168690843) |
| CDK staging/prod guardrails | **PASS** | `tests/unit/infrastructure.test.ts`, [CI](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/40168690843) |
| Chromium/WebKit mobile E2E | **PASS (synthetic)** | `tests/e2e-workspace/workspace.spec.ts`, [CI](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/40168690843) |
| Merge to `main` | **DONE** | [Commit `0bf1e84`](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/commit/0bf1e84c2b7392cab6edbc089a75e4a3cec45ac1) |
| Amplify/CloudFormation release | **NOT VERIFIED** | AWS operator evidence required |
| Live Cognito/DynamoDB end-to-end | **NOT VERIFIED** | Test account + real AWS only |
