# Developer guide / foundation deployment

## Local commands

```bash
npm ci --ignore-scripts
npm run dev
npm run build
npm test
npm run infra:synth -- --quiet
```

The frontend runs at `http://localhost:4173`. Root `build` performs TypeScript validation, Vite production build and API bundling. CDK uses `node --import tsx` (no development IPC server). `services/api/dist` is regenerated deterministically. Production frontend output is `apps/web/dist`.

For browser tests outside the managed preview environment:

```bash
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

CI runs ten browser/viewport projects: Chromium + WebKit at 320×568, 390×844, 768×1024, 844×390, 1440×900. It saves reports, failure traces and screenshots. `/__qa` is a Vite development-only iframe harness; it is not bundled or published and is not a substitute for WebKit/device testing.

## Source boundaries

- `apps/web/src/pages`: public home, conditional brief wizard, standalone synthetic portal, accounts/CRM, alpha notices.
- `apps/web/src/lib`: API transport, hosted auth, draft minimization, Web Crypto UUID compatibility.
- `packages/contracts/src`: shared validation, service definitions, CRM state transitions and milestone progress.
- `services/api/src`: framework-independent HTTP handler, business rules and Dynamo adapter. No local demo backend or bypass identity header.
- `infrastructure/cdk`: one foundational environment stack. No S3, payments, realtime or AI resources claimed.
- `tests`: security-negative and concurrency tests, contract assertions, responsive flow tests and axe checks.

## API currently implemented

| Method/path | Authentication | Contract |
|---|---|---|
| GET `/health` | Public | Basic process health only; does not claim dependency health |
| POST `/api/v1/leads` | Public, allowlisted Origin, intake flag | JSON `LeadSchema`, UUID `Idempotency-Key`, 202 receipt after transaction |
| GET `/api/v1/admin/leads?cursor=...` | Cognito access token + `azelvori/access` + active founder DB grant | 25 records, opaque cursor; no global scan |
| PATCH `/api/v1/admin/leads/{id}` | Same founder checks | `{ "status": "ACKNOWLEDGED" }`, integer `If-Match` version; optimistic transaction + audit |

Errors: 400 invalid JSON/key/cursor; 401 missing trusted claims; 403 permission/origin; 404 unknown route/resource; 409 version/state/idempotency conflict; 413 body too large; 415 wrong media type; 422 validation; 428 missing version; 429 quota (`Retry-After: 60`); 503 intake closed/retry; 500 sanitized internal failure. Error body is `{error:{code,message,fields?},requestId}`. All API responses are `no-store`. `/api/v1/projects`, messaging, billing and preview endpoints are not implemented and return no synthetic data.

The lead validator rejects unrecognized properties (including forged roles/tenants), requires consent-notice version and rights acknowledgement, validates HTTPS references without embedded credentials, and requires reproduction details for game debugging. Body size is capped on UTF-8 decoded bytes. The wizard preserves a request UUID across network retries and changes it only when the payload changes.

## AWS deployment (not executed by this change)

Before deploying, choose account/region/origin and validate current service support, prices, quotas and access. Never paste credentials into this repo. Use the operator's existing AWS profile/SSO or an approved CI OIDC role.

Example synthesis with an explicit origin (replace the example with an actual controlled origin before deployment):

```bash
npm run build:api
npx cdk synth --app 'node --import tsx infrastructure/cdk/app.ts' \
  -c stage=staging -c appOrigin=https://staging.example.com --quiet
```

After reviewing the synthesized stack, the authorized AWS operator bootstraps the chosen account if needed and uses the same app/context arguments for `cdk deploy`. Resource creation can incur charges; this repository has not run a deployment.

Stack outputs map to `apps/web/.env.local` for development or Amplify environment variables:

| Stack output | Frontend variable |
|---|---|
| ApiBaseUrl | VITE_API_BASE_URL |
| CognitoAuthority | VITE_COGNITO_AUTHORITY |
| CognitoClientId | VITE_COGNITO_CLIENT_ID |
| CognitoDomain | VITE_COGNITO_DOMAIN |
| Chosen actual public origin | VITE_SITE_URL (reserved for future canonical metadata) |

The callback is exactly `APP_ORIGIN/auth/callback`; logout returns to `APP_ORIGIN/login`. No trailing slash in `APP_ORIGIN`. Cognito requires TOTP MFA and invitation-based users; no self-registration in alpha. Create the founder's account via the authorized AWS identity workflow. Backend grant provisioning is separate from login:

```json
{
  "pk": "STAFF#<actual-cognito-sub>",
  "sk": "META",
  "data": {
    "userId": "<actual-cognito-sub>",
    "role": "FOUNDER_ADMIN",
    "active": true
  }
}
```

Provision only the intended founder using a restricted operator role; this is a sample schema, not an automatic privilege-grant script. Record operator, request and time in the administrative provisioning record. Setting `active:false` denies subsequent CRM requests even while a JWT is still unexpired. The application has no role-management endpoint and a browser cannot grant itself staff rights. Verify MFA enrollment and password recovery before pilot.

## Amplify hosting

Connect this repository and select `apps/web` as the app root (`AMPLIFY_MONOREPO_APP_ROOT=apps/web`). `amplify.yml` builds from repository root and publishes `apps/web/dist`. Import the SPA rewrite rule from `infrastructure/amplify-rewrites.json`; `amplify.yml` does not install rewrite rules automatically. Deep-link refresh on `/start`, `/demo`, `/auth/callback`, `/admin` must work. Configure custom headers from `customHttp.yml`; verify them on actual responses after deployment. Narrow CSP `connect-src` to the chosen API/identity origins during staging setup.

Keep both intake switches off initially:

- Backend: `intakeEnabled=false` (default CDK context).
- Frontend: `VITE_PUBLIC_INTAKE_ENABLED=false` (default).

Enabling live intake requires accurate reviewed identity/contact/privacy notices, staging evidence and `legalReady=true` plus `intakeEnabled=true` on the backend; set the frontend flag after that deployment is verified. The context guard enforces explicit acknowledgement; it cannot itself prove legal review occurred. Production additionally requires positive `budgetUsd`, monitored `budgetEmail`, and HTTPS origin. Budget notifications are account-wide and do not cap spending. The API error alarm still needs an operational notification action verified before live intake.

## Limitations and safe operation

- No SES acknowledgement emails yet: the UI only claims a persisted receipt, not that an email was sent.
- Browser sessions use per-tab sessionStorage; no persistent localStorage tokens. Access tokens expire in five minutes. Silent refresh and full account lifecycle remain future work. Test logout/revocation against Cognito; offline JWT validation can honor an issued token until expiration, while DB grant revocation applies on every staff request.
- Lead metadata retention is not automated in alpha. Idempotency receipts have seven-day TTL; rate records have short TTL. TTL cleanup is asynchronous. Publish/review retention and erasure operations before real PII intake.
- Idempotency memory/model and Dynamo command assertions do not prove actual AWS transaction behavior; staging tests are mandatory.
- CRM `WON` is a manually recorded sales status, not evidence of deposit payment or permission to activate a paid project.
- No production/customer databases should be copied into test fixtures.
- Data tables have deletion protection and RETAIN. Removing the stack is not a cleanup procedure for customer data.
- No client source execution, arbitrary files or live payments are supported in this foundation.

## Official references checked during implementation

- [Amplify monorepo build configuration](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html)
- [API Gateway JWT authorizers and scopes](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [Cognito authorization code / PKCE](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)
- [Cognito issuer and federation endpoints](https://docs.aws.amazon.com/cognito/latest/developerguide/federation-endpoints.html)
- [oidc-client-ts maintained protocol implementation](https://authts.github.io/oidc-client-ts/)

These are implementation references, not deployment evidence. Check the selected AWS account and latest provider documentation again before activation.
