# TaaSFlow — Core Entities (Product Truth Contract v1.0)

**Status:** Draft for approval. This document is the single source of truth. Any code, view, KPI, or copy that contradicts it is wrong.

## Conventions

- **Canonical ID** — the primary key every other layer references. UUID v4 unless noted.
- **Database source** — the one table that owns the truth. All others are joins or derivations.
- **Tenant ownership** — the row that decides RLS isolation. Every entity resolves to exactly one `organizations.id` (or `NULL` for platform-scoped entities).
- **Archival** vs **Deletion** — archival hides from active views but retains audit trail; deletion physically removes and cascades where declared.

---

## 1. Client
- **Definition:** A hiring company that has signed an engagement with TaaSFlow. Synonymous with an active `organization` of `type='client'`.
- **Canonical ID:** `organizations.id`
- **DB source:** `organizations` (filter `type='client'`)
- **Lifecycle:** `prospect` → `active` → `paused` → `churned`
- **Tenant ownership:** self
- **Uniqueness:** `(normalized_name, primary_domain)` unique when both present; otherwise `normalized_name` unique within `type='client'`.
- **Archival:** `status='churned'`; retained indefinitely for audit/billing.
- **Deletion:** platform_admin only, cascades to memberships, positions, matches (soft-delete via `deleted_at`).
- **User-facing term:** "Client" (admin), "Company" or "Your workspace" (client users).

## 2. Organization
- **Definition:** Generic tenant container. Superset of Client; also holds `type='taasflow'` for the platform team.
- **Canonical ID:** `organizations.id`
- **DB source:** `organizations`
- **Lifecycle:** identical to Client for `type='client'`; `type='taasflow'` has no lifecycle.
- **Tenant ownership:** self
- **Uniqueness:** `normalized_name` unique within `type`.
- **Archival/Deletion:** as Client.
- **User-facing term:** "Organization" (admin only). Never shown to client or candidate users.

## 3. Client user
- **Definition:** A human at a Client with an active membership. Not the same as `auth.users`; a person may hold memberships in multiple organizations.
- **Canonical ID:** `memberships.id` (the membership row is the truth). `profiles.auth_user_id` identifies the human.
- **DB source:** `memberships` joined to `profiles`.
- **Lifecycle:** `invited` → `active` → `suspended` → `revoked`
- **Tenant ownership:** `memberships.organization_id`
- **Uniqueness:** `(user_id, organization_id)` unique.
- **Archival:** `status='revoked'` retains history.
- **Deletion:** membership hard-delete allowed by client_admin; profile never deleted through this action.
- **User-facing term:** "Team member" (client), "Client user" (admin).

## 4. Candidate
- **Definition:** A person who has interacted with TaaSFlow. Identity anchor for all their applications, matches, and messages.
- **Canonical ID:** `candidate_profiles.id`
- **DB source:** `candidate_profiles`
- **Lifecycle:** `prospect` (created via application without auth) → `registered` (linked to `auth.users`) → `active` → `dormant` (no activity 12mo) → `withdrawn` (self-requested) → `deleted`
- **Tenant ownership:** none (candidates are platform-owned). Visibility to a Client is only via `candidate_matches`.
- **Uniqueness:** normalized `email` unique; secondary index on `(normalized_phone)` for dedup hints.
- **Archival:** `status='withdrawn'` retains anonymized shell.
- **Deletion:** GDPR/CCPA request → `status='deleted'`, PII wiped, CV objects removed from storage, matches retained with anonymized reference.
- **User-facing term:** "Candidate" (admin/client), "Your account" (candidate).

## 5. Candidate profile
- **Definition:** The structured, versioned representation of a Candidate's professional identity (contact, skills, experience, education, work-auth, comp expectations).
- **Canonical ID:** `candidate_profiles.id` (same row as Candidate; profile IS the candidate record).
- **DB source:** `candidate_profiles` + `candidate_evidence` (immutable snapshots per score run).
- **Lifecycle:** mirrors Candidate.
- **Tenant ownership:** none.
- **Uniqueness:** one profile per Candidate.
- **Archival:** N/A separately.
- **Deletion:** with Candidate.
- **User-facing term:** "Profile" (candidate), "Candidate profile" (admin/client).

## 6. Position
- **Definition:** A specific role a Client is hiring for. The canonical requisition.
- **Canonical ID:** `positions.id`; human reference `positions.reference` (6-char).
- **DB source:** `positions`
- **Lifecycle:** `draft` → `in_review` → `needs_clarification` → `approved` → `active` → `paused` → `filled` → `closed` → `archived`
- **Tenant ownership:** `positions.organization_id`
- **Uniqueness:** `reference` unique globally; `(organization_id, title, opened_at)` recommended-unique (soft warning, not enforced).
- **Archival:** `status='archived'` after 90d in `closed` or `filled`.
- **Deletion:** platform_admin only; blocked if `candidate_matches` exist (must archive instead).
- **User-facing term:** "Position" (admin/client), never shown to candidates as "Position" — see Public job.

## 7. Public job
- **Definition:** The candidate-facing projection of a Position when `visibility='public'` AND `status='active'` AND all publication gates pass (has JD ≥40 chars OR ≥3 required skills; has location or remote flag).
- **Canonical ID:** `positions.id` (same row; "Public job" is a view over Position).
- **DB source:** `positions` filtered by `is_public_job(positions.*)` (canonical predicate — must not be inlined elsewhere).
- **Lifecycle:** derived; a Position enters "Public job" set the moment predicate flips true.
- **Tenant ownership:** `positions.organization_id` (hidden from candidates; job board shows client-approved display name only).
- **Uniqueness:** inherits Position.
- **Archival/Deletion:** N/A (view).
- **User-facing term:** "Job" (candidate/public), "Public job" (admin), "Published role" (client).

## 8. Private search
- **Definition:** A Position with `visibility='private'` — not listed publicly; candidates only enter via admin sourcing or invite links.
- **Canonical ID:** `positions.id` where `visibility='private'`.
- **DB source:** `positions`.
- **Lifecycle:** same as Position; never appears in the Public job set.
- **Tenant ownership:** as Position.
- **Uniqueness:** as Position.
- **Archival/Deletion:** as Position.
- **User-facing term:** "Confidential search" (client), "Private search" (admin). Not shown to candidates.

## 9. Application
- **Definition:** A Candidate's declared interest in one specific Position, with CV attached at submit time.
- **Canonical ID:** `applications.id`; human reference `applications.reference` (6-char).
- **DB source:** `applications`
- **Lifecycle:** `submitted` → `withdrawn` (candidate) OR `submitted` → superseded by a `candidate_match` when admin processes it. `applications` row itself is immutable after submit except for `status`.
- **Tenant ownership:** `applications.organization_id` (denormalized from position at submit time).
- **Uniqueness:** `(candidate_profile_id, position_id)` unique WHERE `status='submitted'` — a candidate has at most one active application per position.
- **Archival:** none; historical record.
- **Deletion:** only via Candidate GDPR delete cascade.
- **User-facing term:** "Application" (all audiences).

## 10. Candidate match
- **Definition:** The processed, scored, admin-reviewable representation of a Candidate against a Position. Created by the pipeline from an Application OR by admin sourcing. This is the only entity Clients see for candidates.
- **Canonical ID:** `candidate_matches.id`
- **DB source:** `candidate_matches` (+ `score_runs`, `candidate_evidence`, `client_decisions` for context)
- **Lifecycle (`stage`):** `new` → `screening` → `reviewed` → `approved_for_client` → `delivered` → `shortlisted` → `interview_requested` → `interviewing` → `offer` → `hired` → `archived`. Terminal branches: `archived` from any stage; `rejected` from any pre-`delivered` stage.
- **Processing sub-state (`processing_state`):** `queued` → `parsing` → `parsed` → `enriching` → `enriched` → `scoring` → `scored` → `failed`. Orthogonal to `stage`.
- **Tenant ownership:** `candidate_matches.organization_id`
- **Uniqueness:** `(candidate_profile_id, position_id)` unique across all non-`archived`/non-`rejected` rows.
- **Archival:** `stage='archived'`; row retained for audit.
- **Deletion:** never in normal ops; GDPR cascade anonymizes candidate reference only.
- **User-facing term:** "Candidate" (client), "Match" (admin), never shown to the candidate as "Match" — the candidate sees their Application timeline.

## 11. Delivered candidate
- **Definition:** A Candidate match whose `stage` has ever reached `delivered` (or any downstream stage). "Ever reached" = the match has an audit event `stage_changed_to=delivered`.
- **Canonical ID:** `candidate_matches.id`
- **DB source:** `candidate_matches` WHERE `stage IN ('delivered','shortlisted','interview_requested','interviewing','offer','hired')` OR `first_delivered_at IS NOT NULL`.
- **User-facing term:** "Delivered" (client KPI), "Published to client" (admin).

## 12. Top match
- **Definition:** A Delivered candidate whose latest completed score is in the top fit band (`fit_band='top'`, computed by scoring service; band boundaries owned by scoring config, not the dashboard).
- **Canonical ID:** `candidate_matches.id`
- **DB source:** join `candidate_matches` to latest `score_runs.status='completed'`; filter `fit_band='top'`.
- **User-facing term:** "Top match" (client & admin).

## 13. Shortlisted candidate
- **Definition:** A Delivered candidate the Client has moved to `stage='shortlisted'` (or has ever been there — first-touch counted).
- **Canonical ID:** `candidate_matches.id`
- **DB source:** `candidate_matches` WHERE `first_shortlisted_at IS NOT NULL`.
- **User-facing term:** "Shortlisted" (all).

## 14. Interview request
- **Definition:** A Client action requesting an interview for a Shortlisted candidate. Creates an `interviews` row in `status='requested'`.
- **Canonical ID:** `interviews.id`
- **DB source:** `interviews`
- **Lifecycle:** `requested` → `scheduled` → `completed` → `no_show` OR `cancelled`. `cancelled` and `no_show` are terminal.
- **Tenant ownership:** `interviews.organization_id`
- **Uniqueness:** none (multiple interviews per match allowed).
- **User-facing term:** "Interview request" (client/admin).

## 15. Candidate in interview process
- **Definition:** A Candidate match with `stage IN ('interview_requested','interviewing')` AND at least one non-terminal `interviews` row (`status IN ('requested','scheduled')`).
- **Canonical ID:** `candidate_matches.id`
- **DB source:** derived (see above).
- **User-facing term:** "In interview" (client KPI drill-through label: "Candidates in interview process").

## 16. Scheduled interview
- **Definition:** An `interviews` row with `status='scheduled'` AND `scheduled_at > now()`.
- **Canonical ID:** `interviews.id`
- **DB source:** `interviews` with predicate above.
- **User-facing term:** "Scheduled interview".

## 17. Offer
- **Definition:** A Candidate match at `stage='offer'`. Represents the Client has extended a formal offer. Offer terms themselves are out of scope for v1 (not persisted).
- **Canonical ID:** `candidate_matches.id`
- **User-facing term:** "Offer" (all).

## 18. Hire
- **Definition:** A Candidate match at `stage='hired'`, transitioned by the Client via the canonical `client.markHired` mutation. Immutable once set (rollback requires platform_admin correction with audit reason).
- **Canonical ID:** `candidate_matches.id`
- **DB source:** `candidate_matches` WHERE `first_hired_at IS NOT NULL`.
- **User-facing term:** "Hire" (all).

## 19. Archived candidate match
- **Definition:** A Candidate match with `stage='archived'`. Reason required (`archived_reason` enum: `client_pass`, `candidate_withdrew`, `duplicate`, `not_relevant`, `position_closed`, `admin_correction`).
- **Canonical ID:** `candidate_matches.id`
- **User-facing term:** "Archived" (admin/client). Candidate sees the corresponding safe status (see status-language.md).

## 20. Closed position
- **Definition:** A Position with `status IN ('closed','filled','archived')`. `filled` is a Closed position that produced a Hire; `closed` is closed without a Hire (backed out, off-boarded, budget cut).
- **Canonical ID:** `positions.id`
- **User-facing term:** "Closed position".

## 21. Active position
- **Definition:** A Position with `status='active'`. Only Active positions can receive new Applications or new Candidate matches. This is the sole definition; do not re-derive from `approved AND visibility=public`.
- **Canonical ID:** `positions.id`
- **User-facing term:** "Active position".

## 22. Client-visible candidate
- **Definition:** A Candidate match visible to the owning Client. Predicate: `stage IN ('approved_for_client','delivered','shortlisted','interview_requested','interviewing','offer','hired')`. Enforced by RLS policy `client_visible_matches` and the canonical view `v_client_matches`.
- **Canonical ID:** `candidate_matches.id`
- **User-facing term:** "Candidate" (client).

## 23. Admin-approved candidate
- **Definition:** A Candidate match with `stage='approved_for_client'` (not yet Delivered, awaiting publication) OR any downstream stage. Fires the `candidate.approved_for_client` event. This is the publication gate.
- **Canonical ID:** `candidate_matches.id`
- **User-facing term:** "Approved" (admin), invisible to client (they see Delivered instead).

---

## Cross-entity invariants

1. Every Application belongs to exactly one Position and one Candidate.
2. Every Candidate match belongs to exactly one Position and one Candidate; at most one non-terminal match exists per pair.
3. A Client sees Candidates only through Candidate matches, only when `stage >= approved_for_client`.
4. A Candidate sees Positions only via their own Applications; never directly via Candidate matches.
5. `organizations.id` on `applications`, `candidate_matches`, `interviews`, `messages`, `notifications` is denormalized from Position at insert time and immutable thereafter.
6. Human-visible references (`positions.reference`, `applications.reference`) are 6-char, uppercase, unambiguous alphabet (excludes I, O, 0, 1).
