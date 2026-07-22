# Runbook 03 — OCR Required

**Symptoms**
- `processing_state = 'ocr_pending'`.
- Extracted text < 50 chars.

**Diagnosis**
1. Confirm PDF has no text layer: inspect `candidate_evidence.parse_metadata.text_length`.
2. Confirm `cost_limits` for `ocr` not exhausted for the day (see runbook 04 pattern).

**Safe action**
- `runOcr(candidateProfileId)` — canonical writer, enforces per-day cap.
- If cap hit for the tenant, note in ticket and wait for next window (00:00 UTC reset).

**Expected result**
- Text extracted; `processing_state → parsed`; evidence rows populated.

**Escalation**
- OCR fails twice → Level 3.

**Rollback**
- None needed (OCR is read-only against storage).

**Audit**
- `provider_usage_events(operation='ocr')`; `support_actions('other')` if manually triggered.
