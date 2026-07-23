# Admin Overview Finalization — Certification

**Verdict:** PASS
**Scope:** `/admin` route (`src/routes/_authenticated/admin.index.tsx`) and
`getAdminOverview` in `src/lib/admin.functions.ts`.

## What the surface now shows

One prioritized **Action required** panel followed by drill-through sections.
Every row deep-links to the exact canonical record.

| Section | Data source | Deep-link target |
|---|---|---|
| Processing incidents | `candidate_matches` where `processing_state ∈ {failed, provider_blocked, ocr_required, manual_review_required}` | `/admin/candidates/$id` |
| Urgent interview activity | `interviews` where `status = requested` OR (`status = scheduled` AND `scheduled_at ≤ now + 48h`) | `/admin/candidates/$id` (via `candidate_match_id`) |
| Intake inbox | `intake_submissions` where `requisition_pending = true` OR `status = submitted` | `/admin/intake/$id` |
| Candidates ready to publish | `candidate_matches` where `admin_status = approved` AND `client_visibility = hidden` | `/admin/candidates/$id` |
| Candidates awaiting review | `candidate_matches` where `admin_status = pending` AND `processing_state = scored` | `/admin/candidates/$id` |
| New applications (24h) | `candidate_matches` where `processing_state ∈ {queued, parsing, enriching, ready_to_score, parsed}` AND `created_at ≥ now - 24h` | `/admin/candidates/$id` |
| New intakes (7d) | `intake_submissions` where `created_at ≥ now - 7d` (canonical, not `positions`) | `/admin/intake/$id` |
| Positions awaiting review | `positions` where `status ∈ {submitted, needs_clarification}` | `/admin/positions/$id` |
| Client decisions | `score_decisions` where `decision_type = request_recompute` AND `created_at ≥ now - 7d` | `/admin/candidates/$id` |
| Important activity | `audit_events` (recent writes) | `/admin/operations` |

Action-required priority order: processing incidents → urgent interviews →
intake inbox → publish ready → review pending → positions review → client
decisions. First 10 items rendered; each disappears once actioned.

## Vanity metrics removed

- No "total candidates ever," "total positions ever," or "total organizations"
  standalone tiles.
- No sparkline / percentage-delta chrome without an actionable target.
- No card is decorative: every count is backed by a list of matching records
  reachable in one click.
- **Decorative KPIs = 0.**

## Drill-through accuracy

Each `RecordLink` receives the primary key of the exact record surfaced by
its counting query — no client-side re-derivation. Verified by tracing:

- `candidates_pending_review[i].id` → `/admin/candidates/$id` opens the same
  `candidate_matches.id` used in the count filter.
- `positions_review[i].id` → `/admin/positions/$id` matches the WHERE clause.
- `urgent_interviews[i].candidate_match_id` opens the parent match (not the
  interview row directly, since the admin candidate drawer is the canonical
  work surface for interview follow-up).
- `intake_inbox[i].id` → `/admin/intake/$id`.
- **Wrong drill-through records = 0.**

## Ordering

- Processing incidents: newest `processing_updated_at` first.
- Urgent interviews: soonest `scheduled_at` first (nulls first so newly
  requested interviews without a slot are surfaced immediately).
- Intake inbox: newest `created_at` first.
- Candidates awaiting review / ready to publish: newest `updated_at` first.
- Positions awaiting review: oldest `created_at` first (age = urgency).
- New intakes / applications: newest first.

## Empty state

When every list is empty the overview renders a single centered "Inbox zero"
card ("No positions, candidates, or processing incidents need attention right
now."). Individual sections keep their own empty-state copy when only that
list is empty.

## Partial request failure

`getAdminOverview` fires ten count queries and ten list queries in two
`Promise.all` batches. A single Supabase error inside one query surfaces as
`error.message` in the route's `errorComponent` — no half-rendered page.
Because both promise arrays use `await Promise.all`, the loader either
succeeds fully or throws once; there is no silent partial state that could
misreport zero for one section while the rest is fresh. The client-side
manual refresh button (`Refresh` in the header) re-runs the whole loader.

## Realtime updates

`admin.tsx` layout wires `useDashboardRealtime({ audience: "admin",
invalidateKeys: [["admin-overview"], … ] })`. On any Supabase Postgres change
event under the admin scope, the overview query is invalidated and refetched
in the background; the top-right timestamp shows the last successful
generation. Verified against the same subscription used by the rest of the
admin workspace.

## Mobile

- The Action Required panel collapses time / arrow chrome below the `sm:`
  breakpoint but keeps the tap target at ≥44px via `py-2.5`.
- Sections stack single-column below `lg:` (`grid-cols-1 lg:grid-cols-2`).
- All row labels use `truncate` so long organization / role names do not
  overflow.

## Gate compliance

- Wrong drill-through records: **0**.
- Decorative KPIs: **0**.
- **Verdict: PASS.**
