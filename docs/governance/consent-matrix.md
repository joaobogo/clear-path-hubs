# Consent Matrix

Version 1.0. Every consent is granular, versioned, and independently withdrawable. No bundled mandatory checkboxes.

Storage: `public.consent_records` — one row per grant or withdrawal event. Never mutated (append-only ledger; `withdrawn_at` is set via a new row, never by editing the original grant).

| Consent type | Mandatory to apply? | Default | Description shown to user | Collection point | Withdrawal path | Effect of withdrawal |
|---|---|---|---|---|---|---|
| `application_specific_role` | Yes | Unchecked | "I agree to TaaSFlow processing my application for this role." | Apply form | `/me/privacy` per-application | Application marked withdrawn; scoring stops; PII purge scheduled |
| `future_role_consideration` | No | Unchecked | "You may contact me about other roles that match my profile for the next 12 months." | Apply form + `/me/privacy` | `/me/privacy` toggle | Profile hidden from future position matching |
| `talent_network` | No | Unchecked | "Include me in the TaaSFlow Talent Network so partner recruiters can reach out." | Apply form + `/me/privacy` | `/me/privacy` toggle | Removed from Network within 24h; profile anonymized after 730 days if no other consent |
| `email_notifications` | No | Checked | "Send me email updates about my application status." | Apply form + `/me/privacy` | `/me/privacy` toggle or one-click unsubscribe | Only transactional/legal emails continue |
| `profile_reuse` | No | Unchecked | "Reuse my profile if I apply to another role, so I don't have to re-enter data." | Apply form + `/me/privacy` | `/me/privacy` toggle | Next application starts blank |
| `optional_enrichment` | No | Unchecked | "Allow TaaSFlow to enhance my profile with public work data (e.g. GitHub, LinkedIn public info)." | Profile settings | `/me/privacy` toggle | Enrichment stops; existing enriched fields retained until profile deletion |

## Recording contract

Every insert must include: `consent_type`, `granted`, `policy_version`, `source`, `granted_at`. Include `ip_address` when the source is `apply_form`. Withdrawal is recorded by inserting a new row with `granted=false` and setting `withdrawn_at` on the current row.

## Version history

| Version | Effective | Change |
|---|---|---|
| 1.0 | 2026-07-22 | Initial policy — 6 consent types. |
