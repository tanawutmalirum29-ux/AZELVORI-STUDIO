# AZELVORI STUDIO — Production Readiness Implementation Tracker

> Audit source: [Deep Research, 25 Oct 2026](2026-10-25_AZELVORI_PRODUCTION_READINESS_AUDIT.md) (baseline commit `74bff078`).
> This tracker records **implementation evidence, scope, and QA status**. It does **not** silently mark findings as fixed simply because a PR exists. Production release readiness must still be verified separately.

## Changes implemented

### UX-01 — Employee one-time credential handoff
- **Status: IN REVIEW** — [PR #10](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/pull/10); do not call this DONE until current SHA passes all CI and is merged.
- **Finding:** Audit "employee credentials" section (original report line 60): one-time secret is easy to lose or copy incorrectly, especially on a mobile device.
- **Scope:** `apps/web/src/pages/AdminEmployees.tsx`, `apps/web/src/styles.css`, `tests/e2e-workspace/workspace.spec.ts`.
- **Implementation:** mask password until toggled; dedicated copy key/password/bundle controls; fallback instruction when clipboard access is blocked; founder must explicitly tick saved-credentials confirmation before closing the one-time result.
- **Privacy:** never write the one-time password to localStorage, sessionStorage, URL, telemetry, or server logs; use existing transient React state. Clipboard copy is deliberate; **clipboard contents are controlled by the device and may persist until replaced**, so the UI warns about this. Do not claim that the app can securely clear clipboard history.
- **Acceptance:** Cypress is not used; Playwright tests should confirm copy values, reveal/hide, clipboard denied, confirmation gating, previous issuance/reissue behavior, no extra storage, accessibility, Chromium/WebKit five viewports, and CI build/synth/dependency audit.
- **Production verification:** NOT VERIFIED. Must check Amplify publishes the merged frontend and manually validate mobile clipboard permissions; no AWS/CDK deploy required for this frontend-only fix.

## Critical/high work explicitly NOT done (for Work)

| ID | Finding from audit | Status | Production impact / required verification |
|---|---|---|---|
| SEC-01 | Refresh tokens in JavaScript-readable Web Storage (30/365 day remember device) | NOT STARTED | Design/review BFF + HttpOnly/Secure/SameSite cookie session, XSS/CSRF/session migration |
| SEC-02 | Staff pool has MFA OFF | NOT STARTED | TOTP/device enrollment and existing-staff migration, revoke + recovery QA |
| SEC-03 | Staff sees shared projects/leads rather than assignments | NOT STARTED | Backend role/assignment enforcement + negative authorization tests |
| OPS-01 | `main` not protected by required checks | NOT STARTED | Protected branch/ruleset; bypass and emergency release controls |
| OPS-02 | Manual CloudShell deploy / CDK role-assumption warnings | NOT STARTED | Audit IAM trust/bootstrap without broadening privileges; controlled deployment |
| OPS-03 | Error alarms lack confirmed notification destination | NOT STARTED | Alarm destinations and tested delivery including test alarm |
| QA-01 | No confirmed full live AWS staging auth/revoke smoke | NOT STARTED | Exercise real Cognito, staff revoke/reissue, founder MFA, client chat |
| OPS-04 | DynamoDB PITR enabled but restore not exercised | NOT STARTED | Restore to separate table, verify schema/TTLs/access and record RTO/RPO |
| LEGAL-01 | Privacy/legal approval and public intake are gated | NOT STARTED | Legal review and launch decision; **do not turn public intake on** |
| UX-02 | Employee listing filters, last activity, and assignment UX | NOT STARTED | Small usability enhancements after backend tracking design |
| CRM-01 | Chat unread indicators, last-message ordering, notifications | NOT STARTED | Measure usage and implement without undermining message privacy |

## Release verification record

| Check | Status | Evidence |
|---|---|---|
| Source patch exists in PR | DONE | [PR #10](https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO/pull/10) |
| GitHub CI on final PR SHA | PENDING | Check PR Actions |
| Integration / browser QA on final PR SHA | PENDING | Check PR Actions |
| Merge to `main` | PENDING | Confirm merge SHA |
| Amplify frontend deployment | NOT VERIFIED | AWS Amplify job for merged SHA required |
| Live manual check (iPad/mobile clipboard and credentials) | NOT VERIFIED | Needs safe test account; do not post secrets in issues |

**Status definitions:** DONE = verified with specific evidence and limited scope; PENDING/IN REVIEW = not released; NOT STARTED = no implementation. Updating the checkbox or a design note alone never closes security or operational requirements.
