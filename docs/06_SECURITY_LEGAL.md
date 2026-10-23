# 06 — Threat Model, Data Protection, Legal & Payment Identity

**Audience:** developer, founder, security reviewer and Thai legal/accounting professionals.  
**Disclaimer:** แผนควบคุมความเสี่ยง ไม่ใช่คำวินิจฉัยทางกฎหมาย/ภาษี และไม่ใช่หลักฐานว่าผ่านการตรวจ compliance แล้ว

## 1. Key trust boundaries
1. Public internet → frontend/API (input untrusted)
2. Cognito tokens → application authorization (role/grant checked in DB)
3. Customer A ↔ Customer B (strong isolation)
4. Customer chat ↔ internal team and AI instructions
5. Company platform ↔ customer preview runtime (different origin/security principal)
6. Uploaded source/binaries ↔ build sandbox (untrusted execution)
7. Company app ↔ Stripe (signed webhooks and provider-hosted checkout)
8. AI agent ↔ authorized tool servers (scope/action whitelist)
9. App workforce ↔ AWS prod infrastructure (least privilege and audit)
10. Production ↔ backup/staging data

## 2. Threat inventory & mitigations
| Threat | Attack | Control | Test |
|---|---|---|---|
| IDOR/BOLA | customer guesses project ID | backend membership+object grant | A requests B every route |
| Cross-tenant realtime | subscribe to another channel | AppSync Lambda/IAM auth per channel and project, revoke | A subscribe B → deny |
| File URL leakage | forwarding presigned GET | short TTL, object authorization, content-disposition, origin controls | invalid/expired 403 |
| Prompt injection | malicious upload tells agent to steal secrets | treat retrieved text as data, restrictive tools, deny sensitive scopes | adversarial prompt tests |
| ZIP archive bomb/RCE | customer uploads malicious project | malware scan, size/depth limits, isolated execution | known benign test samples |
| XSS / markdown injection | stored customer message | encode on render, safe markdown, CSP | OWASP cases |
| CSRF/session hijack | cross-origin requests | secure cookies if used; SameSite, CSRF protections; proper OAuth PKCE | cross-site attempt denied |
| Payment spoof | fake payment redirect/webhook | signature+provider fetch, amount/currency check, idempotency | replay 10x no double credit |
| SSRF | agent/build requests metadata | isolated network, egress restrictions, block instance metadata | test blocked endpoints |
| IAM overgrant | leaked AWS keys | OIDC short-lived, Secrets Manager, access review | deny unauthorized mutation |
| Insider abuse | operator accesses client files | per-role access, audit, least-privileged staff, notification | staff cross-assignment deny |
| Preview XSS/cookie theft | custom JS escapes preview | separate domain/origin, CSP, iframe sandbox, no shared auth | preview cannot access portal storage |
| Supply chain | malicious package/postinstall | lockfile, SCA, trusted images, sandbox | scan dependencies |
| DDoS/cost abuse | high requests/storage/build spam | WAF/rate quotas, signed uploads, auto-throttling, budget controls | throttle/load test |
| Lost records | restore failure | PITR/versioning, snapshots, restore drills | evidence of restore |

## 3. Access control policy
- Production/admin MFA mandatory, business email verified. Prefer phishing-resistant factor where practical.
- Founder/Admin action on payment/refund/user role/source export requires elevated re-auth/confirmation.
- Service-to-service actions use IAM role with narrow `Action`, `Resource`, session duration; remove stale credentials promptly.
- Customer membership server-validated even if JWT contains cached role claims; membership revocation takes effect without trusting stale UI.
- Roles have access only to necessary data. Internal AI workspace not served from customer-facing APIs.
- Immutable audit events for actor, action, target hash, timestamp, correlation ID; do not log private message contents by default.
- Production deploy requires authorized approver + matching artifact digest + QA report.
- Root AWS user locked with MFA; never issue root access keys or share account password in chat.

## 4. PDPA / privacy policy design
Before production:
- Determine legal controller and processors (AZELVORI entity/founder, AWS, Stripe, email/AI providers).
- Map what personal data is collected: email, names, billing, project messages, uploads, optional device logs; explain purpose, lawful basis, retention, transfers and contact channel in privacy notice.
- Publish privacy notice in Thai; record meaningful consent only where consent is the valid legal basis (don't force “consent” for all necessary contract processing).
- Establish DSAR channel for access, correction, deletion, portability, objection/restriction where applicable; verify requester identity and preserve tax/contract legal retention where required.
- Classify customer-uploaded assets: PII, trade secrets, credentials. Contract should forbid uploading credentials; provide redaction guidance.
- International transfers/foreign hosting and using data with external AI providers require appropriate notices, contractual terms, and legal review.
- Data Processing Agreement with customers who entrust end-user data; document subprocessors and incident notification.
- Track cookie/analytics categories: essential vs optional, consent where required, avoid nonessential trackers by default.
- Retention schedule reviewed by counsel (example **policy proposal, not legal retention requirement**): unconverted leads 180 days; chat and attachments 12 months after project closure; inactive previews 30–90 days; audit/security logs 90–365 days; accounting/legal documents per applicable law; honor legal holds.
- Automate lifecycle TTL where safe; deletion requests need human review for invoicing/contractual exceptions.
- Establish incident response contact, breach assessment and statutory notification workflow based on current applicable PDPA law.

## 5. Business and trademark validation (Thailand)
- **AZELVORI STUDIO** is a proposed brand, not certified free of trademark conflicts. Before public brand investment, check exact name, similar spelling/sound, relevant classes (technology/software/game), overseas marks where selling, Thai business names/domain.
- DIP Thailand official search: https://search-new.ipthailand.go.th/search-detail and https://tm-checker.ipthailand.go.th/ . Preliminary online search ≠ clearance/legal opinion.
- Check company/trade registration requirements with DBD. **Do not display “Co., Ltd.” or registered company number until valid.**
- Founder operating as individual must use legally accurate provider name/tax data on agreements and receipts; company brand on website does not eliminate legal disclosure obligations.
- Clarify contract enforceability/e-signature process, consumer protection, cancellation and refunds with Thai counsel for retail customers.
- Verify withholding tax/VAT obligations (and threshold/tax invoice rules) with accountant based on business form, sales and service types; do not hardcode tax assumptions.

## 6. Payment privacy and provider constraints
**Customer-facing branding ≠ anonymous merchant.**
- Stripe onboarding requires truthful KYC/legal identity and bank account; issuer, processor and regulators may require disclosure.
- Stripe card statement descriptor can show recognized business brand if configured/eligible; not guaranteed all customer-facing bank views or payment methods hide legal name.
- Before live: account verification, test PromptPay/card, receipt legal name, refund fee/flow, chargeback experience, real bank statement display.
- If guaranteed business-account payee display is essential, assess registering entity then opening business bank account after compliance review.
- No attempt to evade KYC, beneficial ownership, AML or tax rules.
- Stripe Checkout: store session/payment intent IDs but **never full card numbers/CVV**; keep secret keys only server-side; verify signed webhook event and idempotency; authenticate refunds.
- Public finance copy must show who sells the service, deliverables, dispute contact, cancellation/refund policy and currency/fees.

Provider pricing is dynamic; as checked 2026-10-23 Stripe Thailand lists domestic cards 3.65% + 10 THB and PromptPay 1.65% per successful transaction (subject to conditions), verify again at https://stripe.com/th/pricing and https://stripe.com/th/pricing/local-payment-methods . Do not treat these rates as guaranteed long term.

## 7. Customer work IP/licensing clauses to define
**Pre-contract:** customer certifies authority to supply source/assets/domain/account access and requests only authorized work.  
**Ownership:** specify which custom code/assets transfer after payment, which reusable studio frameworks remain licensed, who owns generated assets subject to applicable rights.  
**Third-party assets:** OSS licenses, fonts, sounds, sprites, game engine licenses, paid assets; deliver license inventory and attribution.  
**Confidentiality:** NDA as appropriate, controlled access, retention and deletion; publicity/portfolio use only with opt-in written permission.  
**Warranty:** define defect vs scope change, covered period, reproducing criteria, severity, exclusions.  
**Game assets:** client-owned original characters and branding require rights and export permissions; forbid copied game art without license.  
**AI use:** clear notice about AI-assisted engineering and agreed restrictions on feeding confidential material to AI providers; never advertise fully human-authored if not true.

## 8. Secure Development Lifecycle checklist
- Threat model for each P0 capability + abuse case
- Dependency/license/secret scans on PR
- Server-side input validation; CSP, SSRF guard, XSS prevention, secure cookies
- Review access control for every new API, WebSocket channel, S3 object, admin task
- IaC review for no public data buckets, restricted IAM, encryption in transit/at rest
- Secrets rotate after suspected leak; never paste secrets in Issues/ChatGPT/customer chat
- Environments/staging parity, backup drills, restore verification
- Security review before payment and real customer uploads
- Document and test client data deletion/retention and subject-request flows

## 9. Incident severity & response policy
**SEV1:** cross-tenant data exposure, fraudulent paid access/refunds, leaked prod credentials, untrusted code execution in prod; immediately disable affected access, rotate credentials, preserve evidence, assess notifications and customer communication.  
**SEV2:** authenticated app unavailable > agreed threshold, widespread preview/chat/payments failure; rollback/circuit breaker and notify affected customers.  
**SEV3:** single project preview defect or chat lag with workaround; ticket and normal triage.

For all: incident ID, timestamp UTC, affected data/tenants, containment, logs, root cause, corrective actions, owner approval; conduct retrospective. Breach reporting deadlines depend on law and fact pattern; legal reviewer decides.

## 10. Official references and pending reviews
- AWS IAM security best practices: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
- AWS AppSync Event authorization: https://docs.aws.amazon.com/appsync/latest/eventapi/configure-event-api-auth.html
- S3 signed URL usage: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- Stripe identity/statement descriptor: https://support.stripe.com/questions/statement-descriptor-information
- Stripe Thailand pricing: https://stripe.com/th/pricing
- Trademark search (Thai DIP): https://search-new.ipthailand.go.th/search-detail
- Business registration authority: https://www.dbd.go.th/
- Personal Data Protection Committee (Thailand): https://www.pdpc.or.th/

**Pre-launch signoff required:** founder + independent application security reviewer + qualified Thai legal/accounting advice where applicable. Nothing in this plan is an assertion of legal compliance or trademark clearance.
