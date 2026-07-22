# TaaSFlow — KPI Definitions (Product Truth Contract v1.0)

**Rule:** Every KPI has exactly one canonical service function in `src/lib/client.functions.ts` (client KPIs) or `src/lib/admin.functions.ts` (admin KPIs). Dashboards MUST call the canonical function. Inline SQL/count in a component is a contract violation.

**Rule:** Every KPI card must be drill-through to a list view driven by the SAME query as the count. `loadKpiRows(kpi)` returns the row set; `computeKpis(rows)` derives the count. This guarantees reconciliation.

**Rule:** No estimated sourcing hours, recruiter workweeks, or projections. Every metric is a count of persisted rows.

**Rule:** Reporting period. Unless labelled otherwise, KPIs are **all-time within the client's tenant scope** (or platform scope for admin). "Since inception of engagement" — no rolling windows in v1.

**Rule:** Empty state. When count = 0, card shows the label with `—` and a helper sentence describing what would populate it. Never show `0` alone.

**Rule:** Realtime. Every KPI declares the domain events that must invalidate its query in the realtime coordinator.

---

## Client KPIs

### CK-1 · Candidates Delivered
- **Label:** "Candidates Delivered"
- **Meaning:** Count of Candidate matches for this Client that have ever reached `stage='delivered'` (or any downstream stage). Lifetime measure of throughput from TaaSFlow to the Client.
- **Source:** `candidate_matches` scoped by `organization_id`.
- **Inclusion:** `first_delivered_at IS NOT NULL`.
- **Exclusion:** matches never delivered (still in admin review); matches with `archived_reason='duplicate'` regardless of stage.
- **Dedup key:** `candidate_matches.id`.
- **Period:** all-time.
- **Drill-through:** `/client/candidates?filter=delivered` — same query.
- **Empty state:** "No candidates delivered yet. New candidates will appear here after our team completes review."
- **Realtime events:** `candidate.approved_for_client`, `candidate.delivered`, `match.stage_changed`.

### CK-2 · Top Matches
- **Label:** "Top Matches"
- **Meaning:** Delivered candidates whose latest completed score has `fit_band='top'`.
- **Source:** `candidate_matches` join lateral latest `score_runs` where `status='completed'`.
- **Inclusion:** CK-1 predicate AND `latest_score.fit_band='top'`.
- **Exclusion:** archived; duplicates; matches with no completed score.
- **Dedup key:** `candidate_matches.id`.
- **Period:** all-time.
- **Drill-through:** `/client/candidates?filter=top`.
- **Empty state:** "No top matches yet."
- **Realtime events:** `candidate.scored`, `candidate.delivered`, `match.stage_changed`.

### CK-3 · Shortlisted
- **Label:** "Shortlisted"
- **Meaning:** Delivered candidates who have ever been moved to `stage='shortlisted'` by the Client.
- **Source:** `candidate_matches`.
- **Inclusion:** `first_shortlisted_at IS NOT NULL`.
- **Exclusion:** `archived_reason='duplicate'`.
- **Dedup key:** `candidate_matches.id`.
- **Period:** all-time.
- **Drill-through:** `/client/candidates?filter=shortlisted`.
- **Empty state:** "Shortlist a delivered candidate to start tracking them here."
- **Realtime events:** `match.stage_changed`.

### CK-4 · Candidates in Interview Process
- **Label:** "In Interview Process"
- **Meaning:** Candidate matches currently in `stage IN ('interview_requested','interviewing')` AND at least one non-terminal `interviews` row.
- **Source:** `candidate_matches` join `interviews`.
- **Inclusion:** stage predicate AND `EXISTS(interviews WHERE status IN ('requested','scheduled'))`.
- **Exclusion:** matches whose interviews are all `completed`/`cancelled`/`no_show`.
- **Dedup key:** `candidate_matches.id` (distinct — one candidate with multiple interviews counts once).
- **Period:** current snapshot.
- **Drill-through:** `/client/candidates?filter=in_interview`.
- **Empty state:** "No interviews in progress."
- **Realtime events:** `interview.requested`, `interview.scheduled`, `interview.completed`, `interview.cancelled`, `match.stage_changed`.

### CK-5 · Scheduled Interviews
- **Label:** "Scheduled Interviews"
- **Meaning:** Count of `interviews` rows with `status='scheduled'` AND `scheduled_at > now()` for this Client.
- **Source:** `interviews`.
- **Inclusion:** predicate above.
- **Exclusion:** past-time scheduled rows (they should have moved to `completed`/`no_show`; if not, admin pipeline health item, not counted here).
- **Dedup key:** `interviews.id`.
- **Period:** current snapshot, forward-looking.
- **Drill-through:** `/client/interviews?filter=upcoming`.
- **Empty state:** "No upcoming interviews."
- **Realtime events:** `interview.scheduled`, `interview.cancelled`, `interview.completed`.

### CK-6 · Hires
- **Label:** "Hires"
- **Meaning:** Candidate matches with `first_hired_at IS NOT NULL`. Lifetime hires produced.
- **Source:** `candidate_matches`.
- **Inclusion:** predicate above.
- **Exclusion:** none (hires are immutable; admin_correction reversals still counted historically — a corrected hire retains `first_hired_at` but gains `hire_corrected_at`; KPI excludes when `hire_corrected_at IS NOT NULL`).
- **Dedup key:** `candidate_matches.id`.
- **Period:** all-time.
- **Drill-through:** `/client/candidates?filter=hires`.
- **Empty state:** "Mark a candidate as hired to record it here."
- **Realtime events:** `candidate.hired`.

### CK-7 · Active Positions
- **Label:** "Active Positions"
- **Meaning:** Positions with `status='active'` for this Client. See core-entities #21 — sole definition.
- **Source:** `positions`.
- **Inclusion:** `status='active'`.
- **Exclusion:** all other statuses including `approved` (approved but not activated), `paused`, `closed`, `filled`, `archived`.
- **Dedup key:** `positions.id`.
- **Period:** current snapshot.
- **Drill-through:** `/client/positions?status=active`.
- **Empty state:** "No active positions. Submit a new position to get started."
- **Realtime events:** `position.activated`, `position.paused`, `position.closed`, `position.filled`.

---

## Admin KPIs

### AK-1 · New Intakes
- **Label:** "New Intakes"
- **Meaning:** Client intakes submitted but not yet triaged. `client_intakes.status='submitted'`.
- **Source:** `client_intakes`.
- **Inclusion:** `status='submitted'`.
- **Exclusion:** all downstream statuses.
- **Dedup key:** `client_intakes.id`.
- **Period:** current snapshot.
- **Drill-through:** `/admin/intakes?status=new`.
- **Empty state:** "No intakes waiting."
- **Realtime events:** `intake.submitted`, `intake.triaged`.

### AK-2 · Positions Awaiting Review
- **Label:** "Positions Awaiting Review"
- **Meaning:** Positions with `status IN ('in_review','needs_clarification')`.
- **Source:** `positions`.
- **Inclusion:** predicate above.
- **Exclusion:** `draft` (client hasn't submitted), `approved`+.
- **Dedup key:** `positions.id`.
- **Period:** current snapshot.
- **Drill-through:** `/admin/positions?filter=awaiting_review`.
- **Empty state:** "No positions awaiting review."
- **Realtime events:** `position.submitted`, `position.approved`, `position.clarification_requested`.

### AK-3 · Candidates Awaiting Review
- **Label:** "Candidates Awaiting Review"
- **Meaning:** Candidate matches with `stage IN ('screening','reviewed')` AND `processing_state='scored'`. Ready for admin decision but not yet approved.
- **Source:** `candidate_matches`.
- **Inclusion:** predicate above.
- **Exclusion:** matches still processing (`processing_state != 'scored'`) — those belong to Pipeline Health, not review queue.
- **Dedup key:** `candidate_matches.id`.
- **Period:** current snapshot.
- **Drill-through:** `/admin/matches?filter=awaiting_review`.
- **Empty state:** "No candidates awaiting review."
- **Realtime events:** `candidate.scored`, `candidate.approved_for_client`, `candidate.archived`.

### AK-4 · Ready to Publish
- **Label:** "Ready to Publish"
- **Meaning:** Candidate matches with `stage='approved_for_client'` AND `first_delivered_at IS NULL`. Admin has approved; publication to client dashboard hasn't happened.
- **Source:** `candidate_matches`.
- **Inclusion:** predicate above.
- **Exclusion:** already delivered.
- **Dedup key:** `candidate_matches.id`.
- **Period:** current snapshot.
- **Drill-through:** `/admin/publish-desk`.
- **Empty state:** "No candidates ready to publish."
- **Realtime events:** `candidate.approved_for_client`, `candidate.delivered`.

### AK-5 · Active Processing Failures
- **Label:** "Active Processing Failures"
- **Meaning:** `processing_jobs` in `status='failed'` AND `resolved_at IS NULL`. Distinct by `candidate_match_id` (one failure per match, latest).
- **Source:** `processing_jobs`.
- **Inclusion:** predicate above.
- **Exclusion:** retried-and-succeeded (`resolved_at` set); jobs older than 30d moved to cold storage — surfaced separately.
- **Dedup key:** `candidate_match_id` (latest failed row).
- **Period:** current snapshot.
- **Drill-through:** `/admin/pipeline?filter=failures`.
- **Empty state:** "No active processing failures."
- **Realtime events:** `processing.failed`, `processing.retried`, `processing.resolved`.

### AK-6 · Client Decisions Requiring Action
- **Label:** "Client Decisions Requiring Action"
- **Meaning:** Delivered candidate matches (CK-1 predicate) with no `client_decisions` row AND `first_delivered_at < now() - interval '5 days'`. Client has been sitting on the candidate.
- **Source:** `candidate_matches` LEFT JOIN `client_decisions`.
- **Inclusion:** predicate above.
- **Exclusion:** matches already decided (any `client_decisions` row); matches in `stage IN ('shortlisted','interview_requested','interviewing','offer','hired','archived')` — those count as implicit decisions.
- **Dedup key:** `candidate_matches.id`.
- **Period:** current snapshot; 5-day threshold configurable in `system_config` (not hardcoded in view).
- **Drill-through:** `/admin/publish-desk?filter=stalled`.
- **Empty state:** "No stalled client decisions."
- **Realtime events:** `candidate.delivered`, `match.stage_changed`, `client_decision.created`; also polled hourly for the threshold rollover.

---

## Reconciliation matrix

Every card ↔ list pair must produce identical counts. CI test (`tests/kpi-reconciliation.spec.ts`) asserts, for a seeded tenant:

- `computeKpis(loadKpiRows('delivered')).count === card.delivered`
- for every KPI, same assertion.

Violation of this test is a hard failure — merge blocked.
