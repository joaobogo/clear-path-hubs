# Provider Register

> Public counterpart: section 6 of the Privacy Notice (`src/content/pages/privacy.json`). Both must stay in sync. Current public wording is flagged **pending legal review**.

Every external processor that touches TaaSFlow data. Minimize data sent — never ship a full candidate record when a subset suffices.

| Provider | Purpose | Data sent | Region | Retention at provider | Failure behavior | Deletion capability | Redaction rule |
|---|---|---|---|---|---|---|---|
| Supabase (managed Postgres, auth, storage, realtime) | Primary datastore, auth, storage, realtime | All application data | EU | Governed by TaaSFlow retention | Requests queued; user surfaced non-blocking error | Full delete via TaaSFlow-owned migrations | N/A (primary) |
| Google (Gemini models, via managed AI gateway) | CV parsing, evidence extraction, requirement scoring | CV text (redacted: email/phone/address removed); role JD; requirement list; candidate skills + experience summary | EU/US routed | Provider policy: not retained for training; 30-day operational logs | Fall back to deterministic-only scoring; job re-queued; user sees "processing" state | Delete-on-request supported by provider | Redact name (replace with `Candidate`), email, phone, street address, dates of birth before send |
| Resend (transactional email) | Send application receipts, DSR verification, notification digests | Recipient email, subject, HTML body | EU | 30-day delivery logs | Queued with exponential backoff; failure recorded in `notification_deliveries` | Suppression list managed by TaaSFlow | Never include CV, full score, or compensation in email body — link to signed URL instead |
| Cloudflare (edge compute, CDN, WAF, DNS) | Hosting, WAF | Request metadata (IP, UA, path) | Global edge | 7-day access logs | Automatic failover per Cloudflare | N/A (infrastructure) | N/A |
| Stripe | Payments, invoicing, tax calculation | Buyer email, org name, billing address, amounts | USA / Global | Per Stripe retention policy | Checkout blocked; position stays unpaid | Customer delete via Stripe API | Never send candidate data |
| Apollo.io | Sourcing, contact enrichment, B2B outreach | Prospect business contact data | USA | Provider policy | Outreach paused; no user impact | Delete-on-request | Never send candidate CV or scores |
| RB2B | Business-visitor identification (consent-gated) | Marketing page visit metadata | USA | Provider policy | Tracker no-ops | Delete-on-request | Loads only after affirmative consent |
| Calendly | Discovery-call scheduling | Booker name, email, notes | USA | Provider policy | Lead still written to `sales_calls` | Delete-on-request | Never send candidate data |
| Attio | CRM for client and lead records | Company, contact, deal metadata | UK / EU | Provider policy | Sync retried; lead retained locally | Delete-on-request | Never send candidate CV or scores |
| Microsoft 365 | Internal mail, Teams communications | Operational correspondence | USA / Global | Tenant policy | N/A | Tenant-managed | Never paste CVs into chat |

## Change control

Adding a new provider requires: (1) update this register, (2) create/extend a `provider.<name>.functions.ts` service module, (3) map redaction rules in code, (4) DPIA note appended to `docs/governance/dpia-log.md`.

## Prohibited exposures

- Never send `work_authorization`, `compensation_preferences`, or SENSITIVE_PERSONAL fields to the LLM gateway.
- Never send full CV binary to any provider; parsing happens in the Worker; only extracted text (redacted) leaves.
- Never send `audit_events` or `messages` to any external provider.
