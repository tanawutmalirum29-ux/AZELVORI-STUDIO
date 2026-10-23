# Private workspace QA evidence

Date: 2026-10-23 (Asia/Bangkok). Baseline: `17b4baf020e76c66ee72990cac08a24610c9375c`, including the existing brand artwork and hosting checks.

## Verification scope

Local checks completed: TypeScript, production frontend/Lambda build, 115 unit/integration/contract/infrastructure tests, CDK synthesis, hosting preflight and dependency audit (zero reported vulnerabilities at check time). `git diff --check` passed.

Verified application/test/infrastructure commit: [`5b5af813aabc5fb557055dc896a2744d50442eb1`](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/commit/5b5af813aabc5fb557055dc896a2744d50442eb1).

[Studio quality gates run 39989603889](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/39989603889) completed **SUCCESS**. Logs confirm 115 tests across ten files, 50 public browser scenarios and 50 private-workspace browser scenarios, with no failed or flaky cases reported in that final run. Build, hosting preflight, CDK synth and dependency audit also passed.

[Verified QA artifact](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/39989603889/artifacts/12516723464) contains both browser reports, screenshots, production frontend and synthesized templates. Retention expires 2026-11-06. The subsequent documentation-only evidence commit does not change the tested application, tests, dependencies or infrastructure.

## Added regression coverage

- Qualified-brief creation, unique project association, ten retries/one result, changed payload with reused key and unprivileged creation rejection.
- Customer A/B separation for list, detail, messages, acceptance and founder endpoints; forged fields, stale listing entries and foreign cursors.
- Verified-email binding; random token hashes without raw token storage; single-use, expiry before asynchronous TTL deletion, replacement, cancellation and concurrent acceptance.
- Retry-safe Cognito provisioning; an existing account receives no duplicate email; external delivery/transaction failures cannot grant project access.
- Revoked project/tenant/staff grants; mutation rejection if access changes after its read and before transaction commit; old invitation/replay cannot restore revoked access.
- Durable message receipts, replay collapse, server-controlled sender/time, text validation, quota and deterministic paging.
- Customer-only milestone acceptance tied to exact version, immutable accepted milestones, concurrent update rejection and all-milestones completion guard.
- Gateway-claim/token-use/scope validation, version requirements, malformed payloads, unknown routes, sanitized failures and explicit email-verification flow.
- Dynamo strong reads, bounded/scoped Query, combined condition+Put for the same item, complete key normalization, distinction between conflict and provider outage, pool-specific Cognito IAM and all private routes protected by JWT/scope.

## Browser matrix

Both suites target Chromium and WebKit at 320×568, 390×844, 768×1024, 844×390 and 1440×900. The public suite includes `/invite` and `/admin/projects` without configuration, along with the existing public/wizard/demo flows. The workspace suite has five scenarios per browser/viewport:

1. Failed message send preserves draft/key; retry renders escaped text; reload reads the persisted API fixture; page has no horizontal overflow and passes configured axe checks.
2. Review dialog pins the displayed version; 409 forces a fresh review; successful acceptance derives progress from the milestone.
3. Founder opens a qualified brief, creates a workspace, creates/revokes an invitation and cancels/confirms member withdrawal.
4. Invitation removes the fragment from the address, explicitly requests/verifies email, accepts and removes the short-lived token copy.
5. Poll detects access revocation and clears private UI content.

Workspace browser tests use synthetic OIDC sessions and deterministic intercepted HTTP responses. They verify the production UI across browsers, **not** actual Cognito login, email delivery or DynamoDB durability. Domain/adapter tests separately cover backend decisions and AWS command construction. No production auth bypass or mock API is shipped.

The managed cloud browser additionally inspected the actual `/invite` missing-link and `/app` unconfigured-account pages. Both present honest states without synthetic private project data. Authenticated visual evidence comes from the CI screenshots.

Reviewed the final WebKit screenshots for the founder at 320px and customer at 320px/1440px. Milestone descriptions now retain readable width with controls below on mobile; the saved text is rendered literally, and the project, message form and invitation controls stay within the page. These are synthetic QA views, not screenshots of a live customer account.

## Repairs made during implementation

- Merged Dynamo condition and Put actions for the same key so a transaction never targets that item twice.
- Normalize Dynamo Get keys to `pk`/`sk`, including invitation acceptance conflict recovery, preventing a full row from being sent as a key.
- A concurrent invitation retry returns a raw link only for the transaction's persisted winner; replay receipts never store the raw token.
- Recheck the creation receipt when another request has just inserted the unique lead link.
- Pin review confirmation to the version shown when opened, rather than a newer background-polled version.
- Clear sensitive workspace state after authorization failure; retain drafts/request IDs only for retryable failures.
- Map revoked Cognito sessions to 401 and make fragment handling tolerate unavailable session storage.
- Preserve prior brand work, add responsive private pages and expose verified joining email instead of raw subject IDs in member controls.
- CI screenshot review found 320px milestone descriptions squeezed beside controls despite passing the overflow check. Move controls below the description on narrow screens and add a minimum readable text-width assertion.
- The first browser run passed 40/50 workspace cases; its chat retry locator matched wrapping-label text rather than the textbox accessible name after typing. The screenshot confirmed the draft remained. Use role/name lookup and rerun the full matrix; no failing test was removed.

## Launch verdict

**Hold for live pilot/production.** This is developer verification and automated testing, not independent acceptance. Pending: AWS staging deployment and real identity/transaction tests, email/recovery/session lifecycle, operational notifications and restore drill, reviewed seller/privacy/retention details, private uploads, quotes/payments and immutable deliverable previews. See [staging checklist](15_PRIVATE_WORKSPACE_PILOT.md).
