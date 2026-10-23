# ADR-011 — Foundation alpha / source delivery

Date: 2026-10-23 (Asia/Bangkok). Status: implemented for the first development increment.

## Scope and authority

Owner requested implementation directly on `main` and authorized fixes found along the way. Source delivery on `main` is authorized for this increment. It does not activate AWS resources, collect live leads, accept payments, or claim independent release approval. Existing plan documents remain the target; this ADR defines the smaller working foundation that can be built and verified without cloud credentials or invented business details.

## Decisions

1. **React + TypeScript + Vite static frontend.** The architecture offered Next.js/React; a static React app reduces runtime/cost complexity for the current public site and account shell. Dedicated service pages, SSR/prerendered SEO and a content system remain later work. No universal SEO-complete claim; alpha uses noindex.
2. **One npm lockfile, four workspaces.** `apps/web`, `packages/contracts`, `services/api`, `infrastructure/cdk`. Shared Zod validation is authoritative for the implemented intake. Build and QA scripts live at root.
3. **Truthful preview by default.** Without configured HTTPS API and enabled intake, the wizard exports a local draft. `/demo` contains explicit synthetic examples; messages, comments and approval never call an API. `/app` cannot fall back to demo records. Unimplemented private endpoints return 404.
4. **Foundational CRM first.** Implement public lead creation and founder-only lead list/status. No public lead retrieval endpoint. No customer project records exist in this increment, so this is not a claim of completed multi-tenant authorization.
5. **Cognito code flow + PKCE via maintained OIDC library.** Access tokens authorize API Gateway scopes; the Lambda checks gateway claims and a current DB staff grant. MFA required for all invited users in the initial pool. Self-signup disabled for private alpha. No user-supplied role/tenant accepted. Sessions expire after short-lived access tokens; silent renewal is deliberately not enabled yet.
6. **Safe draft persistence.** Only service type and budget choice persist locally for seven days. Contact details, free text, source references and bug details remain in memory. Explicit export includes private fields and a clear local/not-submitted status. Submitted copies include the server receipt.
7. **No upload workaround.** The wizard explains files come later. It does not send files to public storage or pretend quarantine/scan controls exist.
8. **Main is not production activation.** CI has read-only repository permission, performs build/tests/synth/audit/browser checks, and has no deploy step or AWS keys. Creating infrastructure and enabling live intake are separate deployment steps.
9. **Auditable persistence.** One DynamoDB transaction creates the lead, receipt/idempotency record and audit event. Changes require version preconditions and permitted state transitions. The Lambda has PutItem-only access to the separate audit table.
10. **Self-hosted typography.** Manrope and Noto Sans Thai are bundled with OFL notices; no third-party font or analytics requests in the frontend.

## Plan clarifications

- E1-03 file attachments and full server drafts are deferred; UI makes this visible.
- E2 is a code foundation, not a deployed or production-approved identity service.
- E3–E6 remain future work. `/demo` is a UX example and is never evidence of these epics completing.
- Founder business decisions, legal review, service availability, real account configuration, notification ownership, staging verification, independent QA and restore drill remain launch blockers.
- No agents have been appointed and no autonomous runner has been activated by this change.

## Trade-offs

Static content gives a useful initial frontend but requires SPA rewrites and future SEO work. Short-lived tokens favor revocation containment over seamless sessions; idle users sign in again. Public rate limiting (five new submissions/minute/IP bucket plus API/Lambda throttles) is a baseline, not complete bot/DDoS protection. AWS budget alerts are monitoring, not a guaranteed cost cap. The current CSP permits AWS endpoint host families for setup; narrow these to verified API/Cognito origins during staging configuration.
