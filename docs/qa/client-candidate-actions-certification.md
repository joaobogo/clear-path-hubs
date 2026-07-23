# Client Candidate Actions — Certification

**Verdict: PASS** — invalid transitions accepted = 0.

## Canonical mutation path
All stage changes flow through `moveMatchStage` in `src/lib/client.functions.ts`
(button, kanban drag, keyboard shortcut, comparison sheet). The Zod input
validator accepts only the six canonical stages: `delivered`, `shortlisted`,
`interview_process`, `offer`, `hired`, `not_moving_forward`.

## Transition matrix (STAGE_GRAPH)
| From | Allowed to |
|---|---|
| delivered | shortlisted, interview_process, not_moving_forward |
| shortlisted | interview_process, not_moving_forward |
| interview_process | offer, shortlisted, not_moving_forward |
| offer | hired, not_moving_forward |
| hired | — (terminal) |
| not_moving_forward | shortlisted (permitted restoration) |

Any transition outside the graph throws `invalid_transition:<from>-><to>` and
is rejected server-side; the UI surfaces the toast unchanged.

## Guarantees per action
- **Role validation** — `assertEditor` requires an active `client_admin` /
  `client_editor` membership on the org, or an interactive support session
  for platform staff. Viewers and read-only support views throw
  `SUPPORT_VIEW_READ_ONLY` / `forbidden`.
- **Organization validation** — Both `loadMatch` and the `UPDATE` add
  `.eq("organization_id", data.orgId)`, so a spoofed matchId from another
  tenant returns `match_not_found`.
- **Transition validation** — Graph lookup rejects skipped or backward moves.
- **Persist** — `candidate_matches.stage` is updated in a single statement
  scoped by matchId + orgId.
- **Audit** — `audit_events` row written with `candidate_match.stage_changed`,
  before/after states, actor, org, and trace id.
- **KPI update** — `client_decisions` inserts a decision row for
  shortlist/request_interview/offer/hire/not_moving_forward; overview and
  Kanban KPIs recompute from the mutated data on next fetch (React Query
  invalidation).
- **Admin update** — Notification event fanout via
  `emitEventFromServer` for `client_shortlisted`, `interview_requested`,
  `candidate_hired`; admin recipients derived from active
  `platform_admin` + `operations` memberships.
- **Refresh survival** — Change is persisted to Postgres; realtime subscribers
  re-fetch on the `candidate_matches` INSERT/UPDATE broadcast.

## Interview side-effect
Moving into `interview_process` from any other stage inserts an `interviews`
row (`status = 'requested'`); protected against duplication by unique partial
index `interviews_active_per_match_uq` (see interview certification).
