# Runbook 08 — Wrong Client Visibility

**Symptoms**
- A client user reports seeing a candidate/position that does not belong to their organization.
- **Treat as a security incident until proven otherwise.**

**Diagnosis** (do NOT modify data first)
1. Get `trace_id` from the client report or their browser (`err_XXX` if any).
2. `SELECT * FROM candidate_matches WHERE id=$leakedId;` → confirm `organization_id`.
3. `SELECT * FROM memberships WHERE user_id=$reportingUserId;`
4. Run `security--run_security_scan` and `supabase--linter`.
5. Diff RLS on affected tables against `docs/technical/rls.md` — any recent migration change to policies?

**Safe action**
- **Do not mutate the leaking row.** Preserve evidence.
- If the leak is confirmed → `revokeSharedLink()` (if link-based), then `disableSurface(surface, reason)` to take the affected surface offline while patching RLS.
- Open Level 3 engineering escalation immediately.

**Expected result**
- Surface offline within 5 min; RLS patch shipped within 24 h; retro post-mortem within 5 days.

**Escalation**
- Immediate Level 3 + Level 4 (CTO). Legal notified if PII was exposed.

**Rollback**
- Roll back the offending migration if introduced in the last deploy; see runbook 14.

**Audit**
- All access recorded in `audit_events`; write an incident record referencing `trace_id`s + affected user IDs.
