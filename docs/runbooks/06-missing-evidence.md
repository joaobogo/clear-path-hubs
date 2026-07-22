# Runbook 06 — Missing Evidence

**Symptoms**
- Score present but requirements show empty/insufficient evidence excerpts.
- Admin sees "Cannot publish — evidence incomplete" on Publish Desk.

**Diagnosis**
1. `SELECT requirement_id, evidence_excerpt, byte_offset_start FROM candidate_evidence WHERE candidate_profile_id=$1;`
2. Confirm CV `text_length > 500` (else runbook 02/03).
3. Confirm requirements have machine-parseable IDs (see position schema).

**Safe action**
- `requestManualEvidence(matchId, requirementId, excerpt, source='admin_manual')` — opens the manual evidence editor; admin pastes excerpt with byte offsets into the source CV text.
- If evidence truly absent → mark requirement as `unmet` explicitly with reason; score recomputes.

**Expected result**
- Publish Desk unblocks; requirement rendered as met/unmet with evidence source labeled.

**Escalation**
- Systematic missing evidence for a specific position → route to Product to review requirements phrasing.

**Rollback**
- Delete manual evidence row via `revertManualEvidence(evidenceId)`; score recomputes.

**Audit**
- Every manual evidence entry has `source='admin_manual'` + actor + reason in `audit_events`.
