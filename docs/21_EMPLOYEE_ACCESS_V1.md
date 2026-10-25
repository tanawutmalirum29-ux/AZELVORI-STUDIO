# Employee Access V1 — AZELVORI STUDIO

## Scope

- Only an active FOUNDER_ADMIN can issue employee accounts at /admin/employees.
- Employee records require first name, surname and nickname to identify each credential owner.
- New keys start at 00001, increment atomically and expand after 99999 to 100000. The **key itself can be reused only after its current employee is disabled**, using the founder's “นำคีย์กลับมาใช้” action; the original issuance and previous employee subject remain permanently revoked. The new-key counter is retained, with no TTL.
- Every credential issuance (new key or reused key) consumes a distinct persistent, atomic issuance counter that is NEVER reset. Passwords use a new `AZb-{issuance}-{key}-{random}` format; every new password is globally unique even if random bytes collide. Former `AZa-` passwords can never collide because they have a different prefix. Password appears to the founder once and is NEVER persisted as plaintext.
- Employee keys are reusable slots with no scheduled account expiry; credentials and browser sessions still expire/refresh as usual. Reuse requires deliberate founder action, not automatic reopening.
- Disabling the current credential makes that Cognito identity and its old password unusable. The founder can then reassign the *same key* to a fresh employee, **creating a new Cognito identity/sub and password**. Old tokens cannot inherit the replacement grant. Reissue uses a conditional directory write so simultaneous attempts cannot activate two users with the same key. Re-enabling the former identity is never supported.
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

If the generated password is lost, there is no self-service password recovery for employee keys (no employee email is collected). The founder should disable that credential and **reissue the same key** with a new globally unique password. Historical passwords and Cognito subjects must never be reused. The first five digits are the *employee key*, not a five-digit password: that would be too weak for real staff accounts.

## QA

CI checks TypeScript, synth, integration and Chromium/WebKit. Browser tests use synthetic Cognito/API responses; independent live Cognito access and Lambda audit verification remain essential before accepting real customer work.
