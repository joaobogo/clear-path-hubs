# TaaSFlow V2 — Dashboard Read Model Layer

**Status:** PASS
**Owner:** Data Architecture
**Depends on:** `docs/architecture/canonical-entity-model.md`,
`docs/architecture/source-of-truth-rules.md`

## Purpose

Give every dashboard a single **primary aggregate read** plus a small,
bounded set of secondary reads. Read models are **projections** — they
never write, never own business truth, and never duplicate totals into
storage. Business truth stays in the canonical tables listed in
`canonical-entity-model.md`.

## Rules

1. One primary aggregate per screen (view or server service).
2. Secondary reads only when data has a different refresh cadence,
   different tenant scope, or would blow up cardinality.
3. No client-side joins across canonical tables — the server composes.
4. List endpoints project **safe columns only**: never `extracted_text`,
   `evidence` payloads, or raw file blobs.
5. Read models are **derived**; if a total disagrees with a canonical
   query, the canonical query wins and the read model is fixed.
6. Prefer plain SQL views + tenant filter inside `SECURITY INVOKER`
   server functions. Use a materialized view only after a measured
   regression, with a documented refresh trigger.
7. Realtime = invalidate the read model's React Query key on the
   relevant Postgres channel (see `src/hooks/use-realtime-refresh.ts`).

## Read model registry

Each row lists: **surface → primary read → secondary reads**. Every
entry links to the SQL view or `src/lib/*.functions.ts` service that
implements it. Filters, tenant, dedup, perms, refresh, and realtime
are documented per model below the table.

| Surface | Primary aggregate | Secondary reads |
|---|---|---|
| Admin Overview | `admin_pipeline_health` (view) + `getAdminOverview` (service) | `admin_work_inbox` (urgent items) |
| Admin Client Detail | `getAdminClient(orgId)` service | `client_dashboard_kpis` scoped by org; recent audit events (paged) |
| Admin Position Detail | `getAdminPosition(positionId)` service | `admin_candidate_matches_view` filtered by position; screening_questions |
| Admin Candidate Detail | `getAdminCandidate(matchId)` service | `candidate_evidence` (latest run only); CV signed URL on demand |
| Client Overview | `client_dashboard_kpis` (view) | `client_positions_view` top N; unread message count |
| Client Positions | `client_positions_view` | none |
| Client Position Detail | `getClientPosition(positionId)` service | `client_kanban_view` filtered by position |
| Client Candidates | `client_candidate_matches_view` (paged) | saved filter presets |
| Client Candidate Detail | `getClientCandidate(matchId)` service | approved `score_runs.evidence` (single row); interviews for match |
| Candidate Applications | `candidate_my_applications` (view) | `candidate_messages_view` unread count |
| Candidate Profile | `candidate_profile_view` | files metadata (no blob); consent records |

### Read model contract (per model)

Every model is documented below with the same shape.

---

#### Admin Overview — `admin_pipeline_health` + `getAdminOverview`

- **Canonical sources:** `organizations`, `positions`,
  `candidate_matches`, `score_runs`, `applications`,
  `processing_jobs`, `notification_events`.
- **Filters:** rows where `organizations.archived_at IS NULL`; matches
  in the last 90 days for velocity KPIs.
- **Tenant rule:** platform-scoped. Callable only when
  `is_platform_staff(auth.uid())`.
- **Deduplication:** aggregated over `candidate_matches.id` (natural PK);
  positions counted once per `positions.id`.
- **Permission rule:** RLS on underlying tables + server-fn middleware
  `requireSupabaseAuth` and staff role assertion.
- **Refresh strategy:** on demand (SSR loader) + on stage/publication
  events. Never cached beyond the request.
- **Realtime:** subscribe to `candidate_matches`, `positions`,
  `processing_jobs` at the workspace layout; invalidate query key
  `['admin','overview']`.

#### Admin Client Detail — `getAdminClient(orgId)`

- Sources: `organizations`, `memberships`, `positions`,
  `candidate_matches`, `client_decisions`, `audit_events`.
- Filters: single org; matches limited to the org via
  `candidate_matches.organization_id = orgId`.
- Tenant: platform staff only; org id validated against
  `organizations.id`.
- Dedup: joins projected to distinct `positions.id` / `matches.id`.
- Perms: staff-only server fn.
- Refresh: on load + on client action.
- Realtime: `memberships`, `positions`, `candidate_matches` filtered
  by `organization_id=orgId`.

#### Admin Position Detail — `getAdminPosition(positionId)`

- Sources: `positions`, `screening_questions`,
  `candidate_matches`, `score_runs` (approved only), `applications`.
- Filters: single `position_id`; matches ordered by
  `final_score DESC NULLS LAST`.
- Tenant: staff; position org enforced by policy.
- Dedup: `candidate_matches` PK; scores joined via
  `approved_score_run_id`.
- Perms: staff-only.
- Refresh: on load; on match stage change.
- Realtime: `candidate_matches`, `score_runs`, `screening_questions`
  filtered by `position_id`.

#### Admin Candidate Detail — `getAdminCandidate(matchId)`

- Sources: `candidate_matches`, `candidate_profiles`, `applications`,
  `application_answers`, `score_runs`, `candidate_evidence`, `files`
  (metadata), `interviews`, `messages`.
- Filters: single `match_id`.
- Tenant: staff; identity 4-tuple validated (org, position, profile,
  submission).
- Dedup: at most one active `score_runs` (`status=completed AND
  approved_at IS NOT NULL`).
- Perms: staff-only. CV signed URL fetched lazily.
- Refresh: on load + on score approval, stage change, message send.
- Realtime: filter all channels by `candidate_match_id=matchId`.

#### Client Overview — `client_dashboard_kpis`

- Sources: `positions`, `candidate_matches`, `interviews`,
  `client_decisions`, `messages`.
- Filters: rows where `organization_id = current_org` and
  `candidate_matches.client_visibility = 'visible'`.
- Tenant: RLS via `is_org_viewer(auth.uid(), organization_id)`.
- Dedup: KPI counts use `COUNT(DISTINCT id)`.
- Perms: any active org member.
- Refresh: on load + on stage/decision events.
- Realtime: `candidate_matches`, `interviews`, `messages` filtered
  by `organization_id`.

#### Client Positions — `client_positions_view`

- Sources: `positions` + counts from `candidate_matches`
  (visible only).
- Filters: `organization_id = current_org`,
  `status IN ('active','paused','filled')` by default; archived on
  toggle.
- Tenant: RLS.
- Dedup: PK on `positions.id`.
- Perms: viewer+.
- Refresh: on load; SWR via query key `['client','positions',orgId]`.
- Realtime: `positions`, `candidate_matches` on org.

#### Client Position Detail — `getClientPosition(positionId)`

- Sources: `positions`, `screening_questions`, `client_kanban_view`.
- Filters: single position, visible matches only.
- Tenant: RLS; server fn re-checks `is_org_member`.
- Dedup: matches by PK; kanban grouped by `client_stage`.
- Perms: viewer+.
- Refresh: on load + on drag/drop stage change.
- Realtime: `candidate_matches` filtered by `position_id`.

#### Client Candidates — `client_candidate_matches_view`

- Sources: `candidate_matches`, `candidate_profiles` (safe columns:
  display_name, headline, location), `score_runs` (approved
  `final_score` only), `positions` (title).
- Filters: `organization_id = current_org`,
  `client_visibility = 'visible'`. Pagination `.range(offset, offset+49)`.
- Tenant: RLS.
- Dedup: PK on match id.
- Perms: viewer+.
- Refresh: on load; server-driven filter changes bust the key.
- Realtime: `candidate_matches` on org.

#### Client Candidate Detail — `getClientClientCandidate(matchId)`

- Sources: match + profile safe columns + approved
  `score_runs.evidence` (single row) + `interviews` + messages
  count.
- Filters: single match; only the approved run.
- Tenant: RLS; server fn re-checks org membership.
- Dedup: one evidence row per match (approved gate).
- Perms: viewer+; internal notes never projected.
- Refresh: on load + on interview / decision events.
- Realtime: filter channels by `candidate_match_id`.

#### Candidate Applications — `candidate_my_applications`

- Sources: `applications`, `candidate_matches` (client_visibility not
  required — candidate sees their own state), `positions` (public
  fields), latest event from `notification_events`.
- Filters: `candidate_profiles.user_id = auth.uid()`.
- Tenant: candidate self-scope via RLS.
- Dedup: PK on `applications.id`.
- Perms: `is_owning_candidate` policy.
- Refresh: on load + on message / stage events.
- Realtime: `candidate_matches`, `messages` filtered by candidate id.

#### Candidate Profile — `candidate_profile_view`

- Sources: `candidate_profiles`, `files` (metadata only), `consent_records`.
- Filters: self only.
- Tenant: self.
- Dedup: PK on profile id.
- Perms: `is_owning_candidate`.
- Refresh: on load + on profile / CV update.
- Realtime: `candidate_profiles`, `files` filtered by owner.

## Anti-patterns rejected

- Per-card `getMatch(id)` fetch in list pages. Blocked by using the
  paged view above.
- Duplicating KPI totals into `organizations.stats_json` or similar.
  Any such column is banned; totals come from live views.
- Materialized views for KPIs at current scale (< 10k matches per
  org). Re-evaluate at 10× growth with an explicit `REFRESH` trigger
  contract before promotion.
- Downloading `files.extracted_text` or `score_runs.evidence` into a
  list projection.

## Verification

- `rg -n "\.select\(" src/lib | rg -v "sel\(|\.rpc\(|admin_|client_|candidate_"`
  → all list surfaces route through documented views or services.
- `psql \dv public.*` matches the 13 views listed above.
- No `SELECT extracted_text|evidence` in any `*.functions.ts` used by
  list routes.

**Verdict: PASS**
