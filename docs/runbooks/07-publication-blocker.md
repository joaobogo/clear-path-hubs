# Runbook 07 — Candidate Publication Blocker

**Symptoms**
- Match at `internal_review` cannot be published; Publish Desk shows a blocker chip.

**Diagnosis** (blocker taxonomy, in check order)
1. `score < min_publish_threshold` (default 60) → requires override.
2. Missing consent for `talent_network` when the position requires it.
3. Missing evidence (runbook 06).
4. Duplicate active match for same candidate on same position at `delivered+` stage.
5. Tenant paused (`organizations.status='paused'`).

**Safe action**
- Score below threshold → `publishCandidateWithOverride(matchId, reason)` — platform_admin only, logs override reason.
- Missing consent → contact candidate; do NOT publish without consent.
- Duplicate → `dedupeMatch(keepMatchId, dropMatchId, reason)` — moves history, drops the loser.
- Tenant paused → resume via canonical `resumeOrganization`.

**Expected result**
- Match moves to `delivered`; client receives notification.

**Escalation**
- Level 2 for override; Level 4 if consent is missing and admin considers publishing anyway → escalate to legal.

**Rollback**
- `unpublishMatch(matchId, reason)` — reverts to `internal_review`; notifies client that the candidate was withdrawn.

**Audit**
- Overrides always logged with reason; consent absence recorded in `consent_records`.
