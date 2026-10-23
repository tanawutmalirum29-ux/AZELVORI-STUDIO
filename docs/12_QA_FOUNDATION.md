# Foundation alpha QA evidence

Date: 2026-10-23 (Asia/Bangkok). Baseline before implementation: `842b8c6cd6654555e7b6f1510530a37ce8b711ea`.

## Completed CI evidence

Application/test/infrastructure commit: [`1746c77a7c5db401b27ccd9ad4f6e2a95c11c06a`](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/commit/1746c77a7c5db401b27ccd9ad4f6e2a95c11c06a).

[Studio quality gates run #4](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/39954890626) completed **SUCCESS** on 2026-10-23. Logs confirm 67 tests across six files, 50 browser scenarios, successful production build and CDK synthesis, and zero reported dependency vulnerabilities. Chromium and WebKit both passed all five target viewports, including keyboard skip navigation and homepage axe checks.

[QA artifact](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/actions/runs/39954890626/artifacts/12502675178) contains the Playwright report, page screenshots, production frontend and synthesized templates. Artifact retention ends 2026-11-06. The subsequent documentation-only evidence commit does not change the tested application, tests, dependencies or infrastructure.

## Verified results

| Check | Result | Scope |
|---|---|---|
| TypeScript | PASS | Frontend, shared contracts, API, IaC and tests |
| Production frontend + Lambda bundle | PASS | Vite split chunks and esbuild Node 22 target |
| Unit / HTTP integration / Dynamo contract / infrastructure tests | 67 PASS | Six test files; no live AWS connection |
| AWS CDK synthesis | PASS | Generates CloudFormation with intake disabled, MFA, JWT scopes, table protection and constrained IAM |
| Dependency audit | PASS, zero reported vulnerabilities after repair | `npm audit`; point-in-time tool result, not a full security audit |
| Cloud Chromium interactive smoke | PASS | Website → all five wizard stages → explicit local draft download; no fake submission success |
| Local responsive iframe inspection | PASS, 15 page/size combinations | Home, initial wizard, initial portal at all five target dimensions; no horizontal overflow after repair |
| Chromium / WebKit full browser matrix | 50 PASS in GitHub CI | Both engines at all five viewports; pinned source commit and run above |

## Defects found and fixed during implementation

- Initial font imports referenced unsupported subset CSS names; use verified bundled WOFF2 assets and include font licenses. External Google font requests removed.
- `crypto.randomUUID` is absent in some browser contexts. Added a Web Crypto `getRandomValues` UUID fallback, with format/uniqueness regression test. No weak random IDs.
- Decorative hero orbit extended beyond the 320px page. Clip the hero decoration and recheck five sizes.
- TS CLI helper attempted an IPC pipe unsupported in the environment. CDK now uses `node --import tsx` rather than the tsx development CLI.
- Explicit Cognito issuer construction is shared between JWT authorizer and frontend output, preventing malformed/double protocol URLs.
- Successful submission exports now include the real receipt; unsent drafts are labeled `LOCAL_DRAFT_NOT_SUBMITTED`.
- Server target-date validation uses Asia/Bangkok to match the Thai frontend.
- Full dependency audit identified a low-severity esbuild development-server advisory. Updated the direct dependency to patched 0.28.1 and revalidated the build.
- Browser CI exposed low-contrast service numbering and concept footer text. Increased contrast and marked decorative symbols as hidden from assistive technology.
- Browser CI exposed skipped conditional wizard validation when later consent was still unanswered. Shared per-step schemas now validate debugging fields, dates and rights independently; full strict server validation remains in place. Added three regression tests and manually confirmed all seven missing debugging fields report errors.
- Client receipt handling now requires HTTP 202 and validates the receipt ID, timestamp and status at runtime. Seven transport regression cases reject generic success and malformed responses while preserving server field errors.
- Reviewed saved WebKit screenshots. Replaced offscreen-only skip-link hiding with clipping (avoids a full-page capture artifact after scrolling), and made the main region focusable for keyboard skip navigation. Browser checks now verify Tab → skip link → Enter → main focus.

## Security and business regression coverage

Five service types, debug reproduction requirement, unsafe reference URLs, forged extra properties, contact validation, stale privacy version, missing rights acknowledgement, size limits, honeypot, origin restriction, UUID requirements, ten retries/one record, concurrent duplicates, different payload/same key, request rate limit, malformed/base64 JSON, trusted gateway context, token scope and token_use, non-staff denial, active grant revocation, version preconditions, allowed CRM transitions, concurrent status updates, unknown private routes, sanitized errors, atomic transaction command shape, conditional collisions vs outages, cursor validation, least-privilege CDK assertions and verified-milestone progress.

## Browser CI contract

The workflow runs Chromium and WebKit at 320×568, 390×844, 768×1024, 844×390 and 1440×900. Scenarios cover public pages, mobile menu, FAQ, denied/unconfigured accounts, website brief validation/export, debugging fields, all service types, demo chat escaping, exact-version comments/approval, dialog Escape, files/scope panels and axe WCAG checks on the public page. Reports and screenshots are uploaded per commit SHA. A configured job is not a PASS until the run completes successfully.

## Production verdict

**HOLD for production/pilot.** This is developer self-verification plus automated tests, not independent QA signoff. No AWS staging deployment, real Cognito authentication/MFA ceremony, real Dynamo transaction test, actual tenant data isolation, provider integration, payment, file quarantine, realtime event authorization, signed preview, restore drill, physical Android/iOS smoke, legal review or customer acceptance has been performed. Those gates remain required by the original plan. This limitation does not prevent the owner's explicitly requested source update on `main`.

See [implementation status](10_IMPLEMENTATION_STATUS.md), [developer guide](11_DEVELOPER_GUIDE.md) and [ADR-011](decisions/011_FOUNDATION_ALPHA.md).
