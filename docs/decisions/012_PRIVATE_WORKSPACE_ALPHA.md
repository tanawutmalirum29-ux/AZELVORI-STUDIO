# ADR-012: Private planning workspace before paid activation

Status: implemented in source; staging and production acceptance pending. Date: 2026-10-23.

The founder needs to turn qualified briefs into isolated customer discussions and visible work checkpoints. Quotes, payment evidence and private build delivery are not implemented, so this increment creates a planning workspace without treating CRM WON or a manually selected project status as payment proof.

Reuse the operations table with strong tenant/project grants and transactional audit, rather than adding a parallel data service. Provision Cognito accounts on explicit founder invitation; bind membership to the verified email and hashed, single-use, 72-hour token. Keep project invitation links out of URL query strings. Account creation alone grants no access.

Ship one durable customer-visible text channel with transparent 15-second polling. Defer AppSync, internal channels, outbox, attachment storage and notifications until their authorization and reconnect semantics are implemented. No unimplemented endpoint returns fabricated customer data.

Customer milestone confirmation pins a project record version. Accepted milestones cannot be silently reset; this is not R-007 build/hash UAT approval. Fixed three-step weights and simplified work states are temporary alpha constraints; the full financial workflow remains in the product requirements.

Unit/domain/HTTP tests, AWS command-shape assertions and browser fixture tests are required for this source increment. Live Cognito, Dynamo transactions, delivery, revocation, recovery, legal and operational checks remain launch gates. See `15_PRIVATE_WORKSPACE_PILOT.md` and `16_QA_PRIVATE_WORKSPACE.md`.
