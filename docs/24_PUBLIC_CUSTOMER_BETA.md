# AZELVORI STUDIO — Public customer intake beta (real AWS)

**Customer scope:** Anyone with the public Amplify URL can browse and submit a real project brief through `/start`, receive a persisted `LEAD-...` receipt, and the founder can see the submission in `/admin`, qualify it, create a project and invite a customer into the existing private client portal. Staff can handle leads/chat within their currently implemented permissions. **Payments, actual file uploads, automatic public registration, and commercial contract issuance remain unavailable.**

## Exact changes

- `/start` sends actual brief data to the existing AWS API only when all three Vite build settings are valid: `VITE_PUBLIC_INTAKE_ENABLED=true`, `VITE_API_BASE_URL=https://...`, `VITE_PRIVACY_CONTACT_EMAIL=owner-verified address`.
- The backend is deployed with `intakeEnabled=true`, `pilotEnabled=false` and `publicBetaMode=true`. Public `POST /api/v1/leads` already implemented data validation, idempotent receipts, per-IP throttling, honeypot and cross-origin checks. The new **limited AWS shared-concurrency staging beta** uses route defaults of **1 request/second and burst 2** (best-effort API throttling, not an absolute spend cap).
- The public beta **does not work** if `legalReady=false`; the operator explicitly reviews the privacy/terms publication and enters an actual monitored contact email before typing approval. We do not invent the owner's identity or state that the business is registered.
- `/privacy` now explains actual handling, AWS Sydney data processing, recipient access, right-of-access/correction/deletion request channel, and no payments. The person deploying must verify that the published disclosure accurately describes their business.
- The privacy acknowledgment version is bumped to `public-beta-2026-10-25`, so previously accepted development-preview wording does not carry over unnoticed.
- `/terms` and public footer display truthful intake/payment availability.

## How to open real public intake

1. Verify [GitHub CI](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions) is green for the exact merged main commit and that AWS Amplify main can deploy this version.
2. Open AWS CloudShell in **ap-southeast-2**, same AWS account **301338930958** used for the staging stack. The repo must be checked out on clean up-to-date `main`.
3. Run:
   ```bash
   cd ~/AZELVORI-STUDIO
   git switch main && git pull --ff-only origin main
   bash scripts/open-public-beta.sh
   ```
4. Enter a **real monitored email address** that you control for the public privacy notice and customer data requests. Review [`/privacy`](https://main.d3uhwi8blbgrci.amplifyapp.com/privacy) and [`/terms`](https://main.d3uhwi8blbgrci.amplifyapp.com/terms); script requests explicit `LEGAL` authorization before activating live data collection.
5. Read the AWS CDK diff: confirm there are **no DynamoDB or Cognito replacements/deletions**. Expected: existing Lambda code and environment update; HTTP API default staging throttling; CloudFormation `PublicBetaMode` output. Only type `OPEN` after inspecting the diff.
6. Script deploys existing `Azelvori-staging`, checks `GET /health` reports `intakeEnabled: true`, and **only then** merges public Amplify branch environment variables with existing settings. It triggers a new Amplify release build. The script keeps existing branch env keys rather than replacing them blindly.
7. Verify Amplify main build **SUCCEED** and that `https://main.d3uhwi8blbgrci.amplifyapp.com/start` displays **ส่งบรีฟให้สตูดิโอ** and real public privacy/terms contact details.
8. From an **incognito browser without Cognito login**, submit a synthetic-only sample customer brief with an inbox you control (do not use a third party's real PII). Record receipt ID. Sign in as founder at `/admin`, reload leads and confirm the *same* receipt appears. Test status transitions, project creation, customer invitation, actual private chat. Then test a real customer only after the owner's own pilot is successful.

## Tests / evidence required

- CDK rejects public beta in prod/dev, when public intake disabled, without legal approval or a real contact email, or when founder pilot is simultaneously enabled.
- Protected founder paths remain JWT-authorized and backed by active grant, despite public intake being anonymous.
- API `/api/v1/leads` rejects oversized invalid/spam submissions, requires exact configured origin and UUID idempotency keys; duplicates must return the same receipt.
- API/CDK environment verified from the deployed CloudFormation stack. Frontend must reflect the same `VITE_PUBLIC_INTAKE_ENABLED=true` used at **build time**.
- Production-grade items not covered by beta: tested DDB restore, operational alarm notification destination, legal identity/retention review, security hardening of remembered-device refresh-token handling, staff MFA/assignments, launch-day monitoring/financial process.

## Costs and boundaries

AWS services have usage-based billing. API Gateway throttling and per-IP controls reduce risk but are **not** absolute cost caps. Review AWS Billing before opening publicly and consider AWS Budgets notification to your verified billing address. CloudWatch API error alarm was provisioned without a confirmed notification action; you must still connect/test a destination before unrestricted launch. If a public abuse incident occurs, close intake with `intakeEnabled=false` backend first, then update Amplify `VITE_PUBLIC_INTAKE_ENABLED=false`, and inspect AWS logs/audit. Keep current infrastructure settings otherwise.

## Release status

| Gate | Result |
|---|---|
| GitHub code, build, test, CI | **PENDING current final SHA** |
| GitHub PR merged | **PENDING** |
| AWS deployment with public beta flags | **NOT VERIFIED** |
| Amplify public release | **NOT VERIFIED** |
| Anonymous user sends actual test brief into DynamoDB | **NOT VERIFIED** |
| No payment / uploaded deliverable | **Explicitly unavailable** |
