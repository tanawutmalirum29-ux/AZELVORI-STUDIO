# Studio admin desk — QA and rollout evidence

Baseline: `ea70b9bd422d1768ddab8e6bc467db191befd8ee`. Initial application and infrastructure changes were committed as [`4118e741001aeed0a84486f4ace38446db2e45cd`](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/commit/4118e741001aeed0a84486f4ace38446db2e45cd).

## Verification

Local checks passed: TypeScript; production frontend and Lambda builds; **135 tests across 12 files**; CDK synthesis; Amplify hosting preflight; `git diff --check`; dependency audit with zero reported vulnerabilities at check time. The operator CLI `--help` was executed without AWS access. No cloud provisioning command was run.

CI [run 40008157943](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/40008157943) completed **SUCCESS** on commit `c0ce6a622412fa9fc0352e9997068acc465a73a5`. Logs confirm **135 unit/integration tests, 60 public browser cases and 80 workspace browser cases passed**, with no failed or flaky cases reported in this final run. Build, synthesis, hosting and dependency audit gates also passed.

[QA artifact 12524364118](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/40008157943/artifacts/12524364118) contains both reports, screenshots, frontend build and synthesized templates; it expires 2026-11-06. The following documentation-only commit does not change the tested source, tests, dependencies or infrastructure.

Browser matrix: Chromium and WebKit at 320×568, 390×844, 768×1024, 844×390 and 1440×900. The suites contain 60 public and 80 private-workspace scenarios. These include the existing public/wizard/demo/project flows and the added admin workflows below.

## Added meaningful checks

- Missing AWS identifiers keep login and API diagnostic buttons disabled; setup explains the remaining steps. Public routes and footer navigation render without horizontal overflow.
- A customer session cannot render either `/admin` or `/admin/projects` and makes no CRM data request.
- Founder follow-up saves priority/date/private note, retains draft on a 503, reopens saved fixture data after reload, filters the work queue and links the already-created project.
- A concurrent update returns 409, retains the draft, prevents accidental resubmission, and requires explicit latest-data reload. A later 403 clears private CRM content.
- Date and length constraints, injected server-controlled fields, unauthorized detail reads, stale writes and staff revocation between read/commit are rejected.
- Dynamo requests condition the active founder grant and lead version in the same transaction as data and append-only audit. Audit records do not contain note text.
- Multiple concurrent API calls share a token refresh. Invalid refresh removes the session; missing refresh tokens never invoke an iframe. Logout waits for an in-flight refresh before revoke/remove and never returns its token to waiting callers.
- Admin provisioning is read-only by default, checks account/stack/email, uses the actual Cognito subject, refuses revoked/conflicting grants, writes grant/audit atomically, verifies persisted grant, and does not resend account invitations on rerun. Tests use stubbed AWS responses, not a cloud account.

## Test repair

The first CI run passed all 60 public and 70 of 80 private scenarios. The ten failures were the same priority-select locator: wrapping-label text included its option labels, while the accessibility tree correctly exposed a combobox named “ความสำคัญ”. The screenshot and trace confirmed the control was present and enabled. The follow-up commit [`c0ce6a622412fa9fc0352e9997068acc465a73a5`](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/commit/c0ce6a622412fa9fc0352e9997068acc465a73a5) selects by accessible role/name. No test was removed or assertion relaxed.

## Evidence boundaries

Private browser scenarios use synthetic OIDC sessions and deterministic HTTP fixtures. They exercise the shipped UI, not actual Cognito sign-in, email delivery, AWS IAM or DynamoDB durability. Backend tests exercise validation/domain behavior and AWS request contracts separately. There is no production authentication bypass, sample admin password or localStorage role switch.

The managed browser inspected the local setup layout and the **actual supplied Amplify deployment**. The public routes `/admin/login/` and `/admin/setup/` serve the new implementation. On that deployment, setup still reports **Cognito/API not configured and intake closed**; the sign-in button is disabled. This is observed frontend availability, not evidence of backend deployment. Opening the new admin entry did not create an account or grant.

Visual artifact review: inspected final WebKit screenshots of the saved follow-up desk at 320px and 1440px. The work queue, priority/date fields, literal note text and existing-project link fit within the viewport; mobile stacks the controls vertically. Also reviewed the 320px setup screenshot from the first passing public suite. These are synthetic test records, not live customer data.

## Activation verdict

Frontend published; backend activation remains pending. Follow [the Thai activation guide](17_ADMIN_ACTIVATION.md) to deploy the current stack, provision the intended founder, set Amplify variables and redeploy. Actual hosted login/MFA/recovery/refresh/logout, cross-customer authorization, persistence, operational alerts/restore and truthful business/privacy notices must pass before real intake. Attachments, quotes, payment webhooks and immutable deliverable previews remain separate future increments.
