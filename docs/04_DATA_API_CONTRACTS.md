# 04 — Data Model, API, Authorization & Event Contracts

**Style:** REST + JSON over TLS; canonical state in DynamoDB; binary in private S3; AppSync Events for notifications.  
**Versioning:** `/api/v1` + schema version; stable public IDs separate from internal composite keys.  
**Do not implement without:** threat-model review of read/write access patterns & IAM.

## 1. Data entities / canonical schema

| Entity | Key fields | Relationships / invariants |
|---|---|---|
| User | userId(Cognito sub), emailVerified, displayName, createdAt | no plaintext passwords; soft-disable |
| Tenant | tenantId, legalDisplayName, status, billingProfileId | tenant may own N projects |
| Membership | tenantId, userId, role, status, grants | only founder can alter global admin |
| Lead | leadId, serviceType, contactEmail, brief, status, consentAt | PII protected; anti-spam |
| Project | projectId, tenantId, serviceType, state, quoteId, scopeVersion, assignedPM, deliveryDue | cannot change tenantId |
| ProjectMember | projectId, userId, role, grantList | permission resolved on every request |
| Brief | briefId, projectId, version, description, specs, requirements, deviceTargets | immutable revisions |
| Quote | quoteId, projectId/leadId, version, lineItems, THB, subtotal, tax, total, expiry, termsHash | accepted snapshot immutable |
| ContractAcceptance | acceptanceId, quoteVersion, userId, atUTC, ipReduced, termsHash | signed/e-sign policy as reviewed |
| Milestone | milestoneId, projectId, label, dueAt, acceptanceCriteria, status, acceptedAt | weighted progress formula |
| Task | taskId, projectId, scope, assignee, status, dependencies, qaEvidenceId | internal only |
| Conversation | conversationId, projectId, kind, visibility, participants | CUSTOMER vs INTERNAL irrevocable |
| Message | messageId, conversationId, senderId/agentId, textRef/body, createdAt, clientMessageId, editedAt | idempotent; ownership |
| Attachment | attachmentId, projectId, owner, storageKey, mime, bytes, sha256, scanStatus, expiresAt | never public object key |
| Preview | versionId, projectId, artifactHash, commitHash, status, baseUrlRef, expiresAt, verifiedQA | immutable version |
| Revision | revisionId, projectId, versionId, selector, comment, status, scopeImpact | exact preview tie |
| Invoice | invoiceId, quoteId, projectId, subtotal, tax, dueAt, state, issuerSnapshot | totals immutable |
| PaymentAttempt | attemptId, invoiceId, provider, externalId, status, amount, currency, idempotencyKey | no optimistic success |
| ProviderEvent | providerEventId, provider, receivedAt, processedAt, result, payloadHash | unique external event |
| LedgerEntry | ledgerId, invoiceId, entryType, amount, currency, source, createdAt | append-only |
| Approval | approvalId, projectId, type, resourceVersion, actorId, status, atUTC | approvals not backdated |
| SupportTicket | ticketId, projectId, status, severity, warrantyStatus | customer-tenant bound |
| AIWorkspace | workspaceId, projectId, status, policyVersion, spendLimit, agentCount | per-project isolated |
| AIMessage | workspaceId, seq, code(M000001), kind(MN/MQ/TR/C), sender, receiver, payloadRef, ackStatus | unique monotonic seq |
| AgentTaskRun | runId, taskId, agentRole, toolGrants, sourceHash, outputHash, costEstimate, result | auditable |
| AuditEvent | auditId, actor, tenantId, projectId, action, target, beforeHash, afterHash, atUTC, requestId | restricted append-only |

**PII minimization:** do not retain unnecessary phone, ID documents or payment card details. Logs exclude message bodies and secret refs. User deletion may require legally compliant retention of invoices; anonymize subject where possible.

## 2. DynamoDB physical model (initial proposal)
Choose **one table for operational project data** only if query/revision patterns are validated; otherwise use separated `Identity`, `Operations`, `Messaging`, `Payments` tables with least-privileged access and easier retention.

Suggested dedicated tables:
- `Tenants` PK=`TENANT#id`, SK=`META` / `MEMBER#userId`; GSI by userId to list authorized tenant memberships.
- `Projects` PK=`TENANT#id`, SK=`PROJECT#id`; GSI by projectId for server resolution then membership verify.
- `ProjectItems` PK=`PROJECT#id`, SK=`MILESTONE#...` / `TASK#...` / `QUOTE#version` / `PREVIEW#version`; scope queries project first.
- `Messages` PK=`CONVERSATION#id`, SK=`MSG#timestamp#ULID`; conversation existence/role checked before query; GSI for idempotency clientMessageId.
- `Billing` PK=`INVOICE#id` and nested attempt/event; unique providerEventId via dedicated idempotency item.
- `Audit` PK=`AUDIT#tenantId`, SK=`UTC#ULID`; TTL only for types allowed by policy.
- `Outbox` event ID, createdAt, dispatch status, retryCount; stream/poller to EventBridge/AppSync.

**Race invariant:** DynamoDB TransactionWrite/condition to accept quote once, activate project once, mark invoice paid once. Do not use eventual reads to authorize critical operations; use strongly consistent reads where required.

## 3. Authorization model (pseudocode)
```text
authorize(actor, verb, resource):
  assert valid Cognito JWT (iss/aud/exp/signature)
  if global_admin: check MFA, active status, role, action policy
  else:
    resolvedProject = db.lookupByServerProjectId(resource.projectId)
    tenant = resolvedProject.tenantId
    membership = db.loadMembership(tenant, actor.sub)
    projectGrant = db.loadProjectGrant(resolvedProject.id, actor.sub)
    assert membership ACTIVE and verb permitted and projectGrant permitted
    assert resource.tenantId == tenant and resource.projectId == resolvedProject.id
  audit sensitive authorization failures with no private payload
```
Never trust `tenantId` or `isAdmin` sent by browser. Check authorization for object, list, attachment signed link, search, export, events, preview, and AI runner.

## 4. HTTP routes (high-level, subject to versioned OpenAPI)
| Verb | Endpoint | Permission | Result |
|---|---|---|---|
| POST | `/api/v1/leads` | public with rate limit | 202 lead receipt |
| GET | `/api/v1/me/tenants` | authenticated | list memberships |
| GET | `/api/v1/projects` | authenticated | permitted projects only |
| POST | `/api/v1/projects` | admin | scoped project |
| GET | `/api/v1/projects/{id}` | project.view | project detail |
| POST | `/api/v1/projects/{id}/briefs` | project.brief.edit | new brief version |
| POST | `/api/v1/quotes` | admin.quote.write | versioned quote |
| POST | `/api/v1/quotes/{id}/accept` | customer.quote.accept | immutable acceptance |
| POST | `/api/v1/invoices/{id}/checkout` | customer.billing.pay | provider checkout URL |
| POST | `/api/v1/webhooks/stripe` | provider signature | 2xx and async processing |
| GET | `/api/v1/projects/{id}/conversations` | project.chat.view | authorized conversations |
| GET | `/api/v1/conversations/{id}/messages?cursor` | conversation.read | paged ordered messages |
| POST | `/api/v1/conversations/{id}/messages` | conversation.write | saved message ack |
| POST | `/api/v1/projects/{id}/attachments/presign` | attachment.upload | scoped presign |
| GET | `/api/v1/attachments/{id}/access` | attachment.read | authorized expiring URL |
| GET | `/api/v1/projects/{id}/previews` | preview.read | versions |
| POST | `/api/v1/projects/{id}/previews/{version}/token` | preview.read | session-bound access |
| POST | `/api/v1/projects/{id}/revisions` | review.write | tracked revision |
| POST | `/api/v1/projects/{id}/approvals` | approve allowed | immutable approval |
| POST | `/api/v1/admin/projects/{id}/tasks` | admin/task.manage | created task |
| POST | `/api/v1/admin/jobs/{id}/approve` | admin.release | gate evidence |
| GET | `/api/v1/me/data-export` | authenticated | export request state |
| POST | `/api/v1/me/delete-request` | authenticated | ticket & tracking |

For each route: defined JSON schema, 400 validation, 401 unauth, 403 forbidden or consistent 404 unowned resource, 409 optimistic concurrency, 422 domain validation, 429 throttled, 5xx transient. Sensitive mutations demand `Idempotency-Key` and `If-Match` / version where relevant.

## 5. Example contracts
```json
{
  "request": {
    "serviceType": "GAME_BUGFIX",
    "title": "Character animation desync",
    "gameEngine": "Godot",
    "engineVersion": "4.x",
    "platform": ["WEB", "ANDROID"],
    "expected": "Attack and cape animations are synchronized",
    "actual": "Cape floats behind after facing up",
    "reproductionSteps": ["Open scene", "Face north", "Attack three times"],
    "attachments": ["att_uuid"]
  }
}
```

```json
{
  "projectId": "prj_...",
  "messageId": "msg_...",
  "conversationId": "conv_...",
  "clientMessageId": "client_generated_uuid",
  "createdAt": "2026-10-23T11:00:00Z",
  "status": "PERSISTED"
}
```

```json
{
  "error": {
    "code": "PROJECT_ACCESS_DENIED",
    "message": "Not found",
    "requestId": "req_...",
    "retryable": false
  }
}
```

## 6. Event contracts
Envelope:
```json
{
  "eventId": "evt_...",
  "type": "chat.message.created",
  "schemaVersion": 1,
  "occurredAt": "2026-10-23T11:00:00Z",
  "tenantId": "ten_...",
  "projectId": "prj_...",
  "resourceId": "msg_...",
  "traceId": "req_...",
  "metadata": {"conversationId": "conv_..."}
}
```
Names: `lead.created`, `quote.accepted`, `invoice.paid`, `project.activated`, `chat.message.created`, `attachment.scan.passed`, `build.started`, `build.succeeded`, `build.failed`, `preview.published`, `review.requested`, `uat.approved`, `handover.completed`, `security.access_denied`.  
**Events do not carry full PII, JWTs, raw text, file URLs or payment card data.**

### Realtime channel design
- `/tenant/{tenantId}/project/{projectId}/customer` only to authorized customer-facing participants.
- `/tenant/{tenantId}/project/{projectId}/internal` only internal staff/assigned agents.
- `/tenant/{tenantId}/project/{projectId}/review` only review-granted participants.
- Channel claims authorized by Lambda authorizer + DB membership, not merely string prefix. Client publishes chat through REST backend by default; backend publishes trusted events.
- Avoid broadcasting internal changes to customer chat channel.

## 7. Critical invariants and test cases
1. A access B project detail, list, messages, event channels, preview, files, invoices → denied.
2. Old token after membership revoked → denied by server authoritative membership check.
3. 2 webhook retries same payment → one ledger credit, one activation, same event receipt.
4. 2 tabs accept same quote → exactly one accepted version; second 409/canonical.
5. Send same `clientMessageId` 10 times → exactly one stored message.
6. “approved” UAT version X remains X even when preview “latest” moves to Y.
7. Payment redirect spoofed without real webhook → never paid.
8. Upload unscanned malware/infected ZIP → not accessible or executed.
9. Finance role tries source download → denied; developer attempts refund → denied.
10. AI task from project A tries write to project B → denied and alerted.

## 8. Migration and evolution
Maintain schemaVersion, migration scripts and idempotent backfills; preserve event compatibility; client versions tolerate additional fields; breaking changes require `/v2` and staged rollout. Infrastructure/backups must be tested in staging before production schema changes.
