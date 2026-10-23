# Private workspace implementation and pilot gate

Updated: 2026-10-23. This increment connects the brief CRM to a private planning workspace. It implements application code and AWS configuration; it has not deployed or verified a live customer system.

## Working journey

1. The founder qualifies a brief in `/admin`, reviews the customer-visible title/scope and creates a workspace. A unique lead link and idempotency receipt prevent duplicate projects. Only QUALIFIED, SCOPED, QUOTED or WON leads qualify.
2. `/admin/projects` shows project work states, three weighted milestones, customer-visible messages and membership controls. This is planning access, not deposit confirmation or authorization to start paid work.
3. The founder enters an email. Cognito creates an account if absent, with its own initial-credentials email. The app displays a separate project-invitation link once; the founder sends that link through their chosen channel. No message is automatically sent by this development task.
4. The customer follows the fragment link, signs in with the invited account, verifies their email if needed and explicitly accepts. `/app` then lists only accessible projects. Tokens are removed from the address immediately and kept for at most 15 minutes in per-tab session storage across hosted-login redirects; acceptance/logout removes that copy. The invitation itself expires after 72 hours.
5. Messages appear as saved only after HTTP 201 with a valid persisted record. Failed sends retain the draft and request key. The UI checks new messages every 15 seconds while visible. Older messages are loaded in pages of 25; this is not an AppSync realtime or complete event-catch-up implementation.
6. The founder marks a milestone for review. Customer confirmation pins the project version shown when the dialog opened. A concurrent edit causes 409 and requires review of the refreshed version. Accepted milestones retain actor/time and cannot be reset by the founder. All milestones must be accepted before the simplified project state can become COMPLETED.

Milestone acceptance covers the displayed planning record. It does not yet bind an immutable deliverable, build hash, contractual quote or payment event. The full commercial lifecycle in the master plan remains separate.

## API additions

All routes below require API Gateway JWT authorization, `token_use=access` and `azelvori/access`. Actor identity comes only from trusted gateway claims. `/me` and email operations additionally use Cognito GetUser, bind the returned `sub` and require the client scope `aws.cognito.signin.user.admin`. The application never trusts a browser-supplied email, role, tenant or sender ID.

| Method / `/api/v1` path | Additional check | Request |
|---|---|---|
| GET `/me` | Cognito identity | Returns identity and active founder flag |
| POST `/me/email/request` | Authenticated account; 5/minute | Explicitly request email verification code |
| POST `/me/email/verify` | Same; separate 5/minute limit | `{code}`: six digits |
| GET `/projects?cursor=...` | Revalidate each project grant | 25 directory/index entries per page |
| GET `/projects/{id}` | Active tenant + tenant membership + project grant, or founder | Project record |
| POST `/admin/projects` | Active founder; qualified lead | `{leadId,title,summary}` + UUID `Idempotency-Key`; 201 |
| PATCH `/admin/projects/{id}` | Active founder | `{state}` OR `{milestoneId,milestoneState}` + `If-Match` |
| POST `/admin/projects/{id}/invitations` | Active founder; 5/minute | `{email}` + UUID key; 201, raw token only for persisted winner |
| POST `/admin/projects/{id}/invitations/{invite}/revoke` | Active founder, same project | Revoke pending invitation |
| POST `/invitations/accept` | Verified matching email, active latest invitation/tenant | `{token}`; atomic one-time membership grant |
| GET `/admin/projects/{id}/members?cursor=...` | Active founder | Members of this project only |
| POST `/admin/projects/{id}/members/{user}/revoke` | Active founder | `If-Match` member version |
| GET `/projects/{id}/messages?cursor=...` | Current project access | Newest page, chronological display |
| POST `/projects/{id}/messages` | Current project access; 5 fresh sends/minute/project | `{text}` 1–2000 characters + UUID key; 201 |
| POST `/projects/{id}/milestones/{milestone}/accept` | Active customer grant; founder cannot accept for customer | `If-Match` project version + UUID key |

Errors use the existing no-store envelope. Unknown/inaccessible projects share a 404 response. Field validation is strict; versioned mutations require a positive integer. TTL cleanup is not used as an authorization decision.

## Storage and developer threat review

Existing operations and audit tables are reused; no additional database resource is required. All reads use strongly consistent primary-key access. Lists use bounded Query operations, not Scan.

| Key namespace | Purpose |
|---|---|
| `PROJECT#id / META` | Project and milestone state, record version |
| `TENANT#id / META`, `TENANT#id / MEMBER#sub` | Active tenant and tenant membership |
| `PROJECT#id / MEMBER#sub` | Project grant, verified joining email, version and active flag |
| `USER#sub / PROJECT#id`, `DIRECTORY#PROJECTS / PROJECT#id` | Customer/founder listing indexes, revalidated before disclosure |
| `LEADPROJECT#leadId / META` | Unique brief-to-workspace association |
| `INVITE#sha256(token) / META` | Email hash, project, expiry, pending/accepted/revoked state |
| `INVITEID#id / META`, `PROJECT#id / INVITEEMAIL#emailHash` | Owner revocation pointer and current invitation for this email |
| `PROJECT#id / MSG#timestamp#uuid` | Durable text, server identity/role/time and deterministic tie-break |
| `OP#sha256(actor,route,key) / META` | Payload hash and replay receipt; seven-day TTL |

The API stores no raw invitation token or temporary password. Tokens have 256 bits of randomness. Reissuing replaces the active pointer so an older unused link cannot grant access. Accepted links cannot reactivate a revoked grant; a fresh founder invitation is required. An inactive tenant membership prevents rejoining even with a fresh project invitation. Tenant membership expiry and organizational management remain deferred; operators must version any direct grant changes.

Mutations commit state, idempotency and audit atomically. Transactions condition-check the current tenant, membership/project-grant versions and founder active role as applicable. This blocks a write if access is revoked between its read and commit. Audit records contain action/actor/target/time, without message bodies, credentials or invitation tokens. A condition and update targeting the same Dynamo item are combined into one transaction action. Conditional failures are distinguished from throttling/provider outages.

Read authorization is checked on each request. Previously displayed/downloaded data cannot be erased remotely. On the next denied request, the UI clears the private project, messages, members, invitation link and draft. A request already authorized before revocation may finish; this is not a claim of instant revocation of all in-flight reads or Cognito JWTs. Backend grant revocation takes effect on subsequent checks even before access-token expiry.

Cognito provisioning and the Dynamo invitation transaction cannot be atomic. A failure can leave an account without project access. Retrying checks for an existing account and does not send repeated onboarding emails. If Cognito created an account but email delivery failed, an authorized operator must inspect its status and use Cognito's explicit resend/reset recovery; the app never marks that email verified or takes over another alias. An account alone grants no tenant/project access.

This is a developer design review plus regression coverage, not an independent penetration test. See the QA report for exactly what ran.

## Required staging evidence before a first customer

1. Connect the chosen AWS account/region, controlled frontend domain, monitored budget and alert destination. Keep public intake disabled and use synthetic users. Follow the CDK/Amplify runbook; no credentials belong in source or chat.
2. Review and deploy the updated CDK stack. It adds protected routes, the Cognito client scope, Lambda `USER_POOL_ID`, pool-specific AdminGetUser/AdminCreateUser and Dynamo ConditionCheckItem permission. Sign in again to obtain the new scopes. Verify actual CSP/CORS and refresh deep links `/app`, `/invite`, `/admin/projects` and `/auth/callback`.
3. Provision the founder DB grant separately. Verify real hosted login, TOTP enrollment, initial account-email delivery, email verification, password recovery, five-minute token expiry and logout. Automatic refresh remains unimplemented and needs a separately verified lifecycle before longer sessions.
4. Create two synthetic projects and two invited customers. Prove A cannot list/read/message/accept in B, including guessed IDs, foreign cursors, changed request fields and direct HTTP calls. Confirm customer cannot call founder routes.
5. Race two creates/sends/accepts and real Dynamo version updates. Revoke a member during a write; confirm conditional failure, no unauthorized write, subsequent reads denied and UI cleared. Check audit entries and alarm notifications without logging tokens or message bodies.
6. Exercise expired, replaced, revoked and wrong-email invites; initial-email delivery failure; existing-account retry; 409 milestone conflict; network retry with the same key; account recovery without privilege escalation.
7. Review business identity/contact, privacy/retention/erasure, actual terms, pricing and delivery obligations. Test backup restoration and alert response. Capture evidence and independent approval required by the original launch plan.

These steps are still pending. There is no connected AWS deployment result in this work. CI/browser fixtures prove application behavior under their model, not cloud deployment, real email delivery or customer acceptance.

## Remaining product work

Before a paid end-to-end launch: versioned quotes and accepted scope, payment-provider sandbox/webhooks, financial-state transitions, private file quarantine and expiring downloads, immutable previews/deliverables, robust notification/reconnect handling, retention/erasure and operating recovery. AI runner integration is a later phase. Existing branding and the public demonstration remain available while these are built.

## Provider contracts

- [Cognito AdminCreateUser](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminCreateUser.html)
- [Cognito GetUser scope and attributes](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_GetUser.html)
- [Cognito VerifyUserAttribute](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_VerifyUserAttribute.html)
- [DynamoDB TransactWriteItems](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html)
