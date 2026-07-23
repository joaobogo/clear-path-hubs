# TaaSFlow V2 — Transactional Email Certification

## Status: NOT CERTIFIED — infrastructure gap

Certification was requested for twelve app-email flows (invitation, password
reset, intake confirmation, application confirmation, candidate delivery,
interview request, interview confirmation, reschedule, new message, offer
update, hire update, admin processing-failure alert). Certification cannot be
issued yet because the platform does not currently ship any of them.

## Evidence

- Repository scan (`rg -l "sendTemplateEmail|sendLovableEmail|@lovable.dev/email" src`) returns **0 matches**.
- `src/lib/email-templates/` does not exist.
- `src/routes/lovable/email/` does not exist — neither the auth webhook nor the transactional preview route is scaffolded.
- No configured email domain is present in the project (`email_domain--check_email_domain_status` returned nothing to reference).
- Password reset today uses Supabase's default templates only; there is no branded auth-email handler.

## What must ship before certification is possible

1. **Email domain.** User provisions a verified sender subdomain through Cloud → Emails.
2. **Auth email scaffold.** `email_domain--scaffold_auth_email_templates` to enable branded password reset / invite / magic link / email change.
3. **App email scaffold.** `email_domain--scaffold_transactional_email_templates` to create the registry + `sendTemplateEmail` helper + preview route.
4. **Twelve templates** authored in `src/lib/email-templates/` with props typed against the sender payloads.
5. **Per-feature server code** in the affected server functions / server routes calls `sendTemplateEmail(<name>, <recipient>, { templateData, idempotencyKey })`. Idempotency keys must be derived from the triggering event id + template name to prevent duplicates on retry.
6. **Delivery-outcome webhook** at `src/routes/lovable/email/events.ts` handling `email.bounced` / `email.complaint` / `email.unsubscribed` / `email.resubscribed` if downstream reactions are required (mark candidate unreachable, notify admin).

## Test plan (to run once the above ships)

For each of the twelve flows, verify:

| Check | Method |
|---|---|
| Correct recipient | Trigger from staging account; confirm `to` matches the actor / affected party only. |
| Correct organization | Assert `templateData.organization_id` in the send call matches the record's `organization_id` (unit assertion + email-logs spot check). |
| Correct record link | Deep-link URLs pass through `${PUBLIC_APP_URL}/...` and land on the correct entity for both admin and client roles. |
| Duplicate prevention | Fire the same trigger twice with the same event id → second call returns `{ sent: false, reason: "duplicate_idempotency_key" }` (from Lovable email API). |
| Delivery state | `email_domain--list_email_logs` shows `sent` for happy path, `suppressed`/`rejected` are handled per-feature without crashing. |
| Retry | Simulate 429 → `EmailAPIError.retryAfterSeconds` observed and honoured; no tight retry loop. |
| Mobile rendering | Preview route + real inbox check on ≤ 375 px width; Body background `#ffffff`, single-column layout, tap targets ≥ 44 px. |

## Guardrails already documented

- No email queue, cron, or DB tables permitted — Lovable manages delivery.
- Never accept template name / arbitrary recipient from the browser.
- Suppression is authoritative on Lovable's side; `{ sent: false, reason: "recipient_suppressed" }` is expected, not an error.
- Unsubscribe footer is appended by Lovable — do not add an in-app unsubscribe page.

## Verdict

**NOT CERTIFIED.** Wrong-recipient count is undefined because the twelve flows do not send email today. Certification will be re-issued after the scaffolds are in place and the twelve templates + triggers are wired.

Immediate next step for the owner: confirm the sender domain to provision, then request the scaffolds so this document can be replaced with a PASS run.
