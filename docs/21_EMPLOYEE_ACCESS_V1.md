# Employee Access V1 — AZELVORI STUDIO

## Scope

- Only an active FOUNDER_ADMIN can issue employee accounts at /admin/employees.
- Employee records require first name, surname and nickname to identify each credential owner.
- Key starts at 00001, increments atomically and never wraps back to 00001; after 99999 the next key is 100000. The counter is retained forever and intentionally has **no TTL**. Revoked keys are retained for audit.
- Initial password is a strong random secret with a unique never-reused key embedded in the string. The password is displayed to the founder *once* and is NEVER persisted in the operations table. Do not screenshot or share publicly.
- Employee credentials have no scheduled account expiry. However access tokens and browser sessions expire/refresh as usual for authentication security.
- Disabling a credential via founder UI marks its grant inactive with DynamoDB transaction checks and then disables Cognito. This blocks work/chat APIs immediately even for existing access tokens. Reopening disabled credentials is intentionally unsupported.
- Employees sign in at /staff/login, use /staff/inbox. Staff are allowed to list customer projects, see project messages, send messages, and **acknowledge NEW leads**. Employees cannot issue credentials, grant access, approve contracts/milestones, create projects, read founder private comments or change prices.
- The staff and founder/customer Cognito user pools are separate. Each staff API route has its own JWT issuer/audience and only accepts reserved Cognito access scope. A staff login token cannot call founder/customer API routes.
- Employee messages are marked STUDIO in the customer-facing project chat. They are auditable with the employee's Cognito subject.

## Deployment and risk boundaries

This change creates **new AWS resources**, including a separate Cognito User Pool and App Client plus API routes, Lambda policies and code. It must **not** be assumed live because a GitHub PR is merged.

After CI passes:
1. Update CloudShell repository main and run npm ci --ignore-scripts and npm run build:api in the original Sydney ap-southeast-2 account.
2. Use the exact existing staging context: stage=staging, appOrigin=https://main.d3uhwi8blbgrci.amplifyapp.com, intakeEnabled=false, legalReady=false, lambdaConcurrency=shared.
3. Review npx cdk diff Azelvori-staging --no-change-set before any deployment. Existing founder/customer User Pool and DynamoDB should not be replaced or removed; only the **new employee** User Pool/App Client, Lambda deployment/IAM and relevant JWT routes should be added/updated.
4. If the diff includes replacement/deletion of existing tables, customer identity pool or a public-intake change, stop and reconcile contexts. New Cognito resources may incur AWS charges according to usage.
5. Deploy the same stack with npx cdk deploy only after review; verify stack update completes. Confirm Amplify main has published the merged frontend. GET /api/v1/employee/config should return only public staff pool/client identifiers.
6. Log into /admin/employees with an existing founder account. Create ONE employee. Copy credentials before dismissing the one-time view. Test /staff/login, /staff/inbox, replying to a seeded project and lead acknowledgement. Revoke the test key from the founder admin page, confirm active employee session immediately loses API access and can't sign in again.
7. Confirm that regular customers cannot see /admin/employees or /staff/inbox private data and that only founder JWTs can call /api/v1/admin/employees.
8. Preserve operations and audit tables, existing old employee records and the sequence counter on all future deploys.

## Limitations

Employee chat uses existing saved project conversations with 15-second visible-tab polling, not a real-time WebSocket. Leads can be marked ACKNOWLEDGED by staff but no auto-approval of business contracts is enabled. All active employees in V1 can view the project's shared customer conversation and intake queue; per-assignee routing and granular employee roles are future work.

If the generated password is lost, there is intentionally no self-service password recovery for employee keys (no employee email is collected). The founder should disable that key and issue a new one. Revoked keys must never be recycled. The first five digits are the *employee key*, not a five-digit password: that would be too weak for real staff accounts.

## QA

CI checks TypeScript, synth, integration and Chromium/WebKit. Browser tests use synthetic Cognito/API responses; independent live Cognito access and Lambda audit verification remain essential before accepting real customer work.
