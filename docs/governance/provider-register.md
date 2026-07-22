# Provider Register

Every external processor that touches TaaSFlow data. Minimize data sent — never ship a full candidate record when a subset suffices.

| Provider | Purpose | Data sent | Region | Retention at provider | Failure behavior | Deletion capability | Redaction rule |
|---|---|---|---|---|---|---|---|
| Supabase (Lovable Cloud) | Primary datastore, auth, storage, realtime | All application data | EU | Governed by TaaSFlow retention | Requests queued; user surfaced non-blocking error | Full delete via TaaSFlow-owned migrations | N/A (primary) |
| Lovable AI Gateway (LLM) | CV parsing, evidence extraction, requirement scoring | CV text (redacted: email/phone/address removed); role JD; requirement list; candidate skills + experience summary | EU/US routed | Provider policy: not retained for training; 30-day operational logs | Fall back to deterministic-only scoring; job re-queued; user sees "processing" state | Delete-on-request supported by provider | Redact name (replace with `Candidate`), email, phone, street address, dates of birth before send |
| Email provider (transactional) | Send application receipts, DSR verification, notification digests | Recipient email, subject, HTML body | EU | 30-day delivery logs | Queued with exponential backoff; failure recorded in `notification_deliveries` | Suppression list managed by TaaSFlow | Never include CV, full score, or compensation in email body — link to signed URL instead |
| Cloudflare (edge, Workers) | Hosting, WAF | Request metadata (IP, UA, path) | Global edge | 7-day access logs | Automatic failover per Cloudflare | N/A (infrastructure) | N/A |

## Change control

Adding a new provider requires: (1) update this register, (2) create/extend a `provider.<name>.functions.ts` service module, (3) map redaction rules in code, (4) DPIA note appended to `docs/governance/dpia-log.md`.

## Prohibited exposures

- Never send `work_authorization`, `compensation_preferences`, or SENSITIVE_PERSONAL fields to the LLM gateway.
- Never send full CV binary to any provider; parsing happens in the Worker; only extracted text (redacted) leaves.
- Never send `audit_events` or `messages` to any external provider.
