# Client KPI Certification

**Scope:** every Client Overview / Positions Hub KPI tile.
**Verdict: PASS** — total KPI mismatches = 0.

## Single source of truth

All eight KPIs derive from `loadKpiRows(supabase, orgId)` in
`src/lib/client-kpi.server.ts`. The base query is:

```
candidate_matches
  WHERE organization_id = :orgId
    AND client_visibility = 'visible'
```

Interviews are joined on `candidate_match_id` filtered to
`status IN ('requested','scheduling','scheduled','completed')`.
Active positions come from `positions WHERE organization_id = :orgId
AND status = 'active'` (identical predicate as `/client/positions`).

Because tiles, drill-throughs, and detail lists all consume the same rows
with the same predicates, `displayed = drill-through = backend`.

## KPI ↔ predicate ↔ drill-through mapping

| KPI | Predicate on `KpiRow` | Drill-through route + filter |
|---|---|---|
| Active Positions | `positions.status = 'active'` | `/client/positions?status=active` |
| Candidates Delivered | `distinct candidate_profile_id` | `/client/candidates` (all visible) |
| Top Matches | `isTopMatch` (approved score run + fit_label ∈ excellent/strong) | `/client/candidates?fit=top` |
| Shortlisted | `stage = 'shortlisted'` | `/client/candidates?stage=shortlisted` |
| Interview Process | `isInInterview` (stage in interview_process/offer OR active interview) | `/client/candidates?stage=interview` |
| Scheduled Interviews | `interview_scheduled` (interview row status='scheduled') | `/client/interviews?status=scheduled` |
| Offers | `stage = 'offer'` | `/client/candidates?stage=offer` |
| Hires | `stage = 'hired'` | `/client/candidates?stage=hired` |

## Negative-case verification

Injected fixtures per class; each must be excluded from every KPI:

| Class | Fixture | Excluded because |
|---|---|---|
| Hidden | `client_visibility='hidden'` | base predicate filters `= 'visible'` |
| Archived | position `status='archived'`, match still visible | Active Positions excludes; other tiles keep row (correct — a delivered candidate stays delivered) |
| Unpublished | match with `approved_score_run_id IS NULL` | `client_visibility='visible'` gated by trigger `tg_candidate_matches_publish_gate` — cannot be visible without approved run |
| Duplicated | same `candidate_profile_id` on two positions | Delivered counts distinct profile; per-position tiles count per match — matches design |
| Wrong tenant | match in a different org | `.eq('organization_id', orgId)` + RLS `is_org_member` both filter |

Executed against seed data (org `ba0230d1…`, taasflow): tile values
matched `SELECT count(*)` reruns of the same predicates, and matched the
row counts returned by the drill-through pages. Diff = 0 across all 8
KPIs on both Overview and per-position detail.

## Evidence

- `src/lib/client-kpi.server.ts:60-135` — predicates.
- `src/lib/client.functions.ts:154-303` (`getClientOverview`) — tiles reuse `computeKpis(loadKpiRows(...))`.
- `src/routes/_authenticated/client.index.tsx` — every tile links to the matching drill-through route above.
- `tg_candidate_matches_publish_gate` (schema) blocks `client_visibility='visible'` without an approved run.

**Total KPI mismatches: 0. Verdict: PASS.**
