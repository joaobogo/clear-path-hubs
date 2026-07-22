# Privacy Tests

Executable governance checks. Runs against the QA tenant and DB.

## Test matrix

| ID | Check | Method | Expected |
|---|---|---|---|
| PRV-01 | Every classified field has a retention policy or explicit `retain_forever` justification. | Cross-ref `data-inventory.md` against `retention_policies`. | 0 unclassified fields. |
| PRV-02 | `consent_records` accepts only the 6 defined consent types. | `INSERT` with unknown type → CHECK violation. | Rejected. |
| PRV-03 | Consent withdrawal is append-only (new row) — original grant row is never physically deleted. | Attempt DELETE as owner/staff → RLS + missing DELETE grant blocks. | Rejected. |
| PRV-04 | DSR access request never returns rows belonging to another subject. | Seed two candidates; run `dsr.access` for A; scan for B's email. | 0 leaks. |
| PRV-05 | Deletion request purges applications, evidence, messages, files (cascade). Preserves audit_events. | Fulfil deletion; verify counts. | applications=0, audit_events>0. |
| PRV-06 | Export bundle for a candidate excludes other subjects' data and internal fields (scores, client decisions, interview notes). | Inspect JSON. | Only own fields present. |
| PRV-07 | LLM gateway payload is redacted (no email/phone/address/name). | Unit test in `scoring-engine.server.ts`. | Regex scan finds no PII. |
| PRV-08 | Notification emails contain no CV, compensation, or full score — only links. | Snapshot test on outbound HTML. | 0 forbidden substrings. |
| PRV-09 | Audit events survive account deletion. Subject reference is retained by internal ID after PII strip. | Delete subject; count audit_events for entity_id. | > 0. |
| PRV-10 | Cross-tenant read denied. | Signed-in as org A tries to select org B's positions/candidates. | RLS blocks. |
| PRV-11 | Guest DSR requires verified email token before fulfilment. | Attempt fulfilment without verification. | Rejected. |
| PRV-12 | Retention run failure does not partially delete. | Force error mid-run. | rows_affected=0, status=failed. |

## Status

The migration for consent_records / data_subject_requests / retention_policies / retention_runs is applied. PRV-02, PRV-03, PRV-10 are enforced at the database layer today (CHECK constraints, RLS policies, missing DELETE grants).

PRV-04, PRV-05, PRV-06, PRV-07, PRV-08, PRV-09, PRV-11, PRV-12 depend on the DSR fulfilment server functions and retention sweeper, tracked as **BG-DSR-01** and **BG-RET-01**. They will move to executed + PASS once the pipeline blockers from Phase 17 (P1, P3, BG-02) are cleared.
