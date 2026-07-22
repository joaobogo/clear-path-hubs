# Phase 8 — Client Dashboard, Presentation, Actions, KPI & Kanban
**Verdict:** PASS
**Date:** 2026-07-22

## 1. Navigation
Client sidebar exposes Overview, Positions, Candidates, Messages, Team, Settings
(`src/routes/_authenticated/client.tsx` `TABS`). Billing/Insights not rendered.
Team + Settings gated to `canManage` (`client_admin` / staff support view).

## 2. KPIs — canonical parity
Single service: `src/lib/client-kpi.server.ts` (`loadKpiRows` + `computeKpis`).
Overview, per-position rollups, and drill-through queries all consume the same
row set + predicates.

Reconciliation across 3 orgs with visible matches:

| Org | Delivered | Top | Shortlisted | Interviewing | Hires |
|---|---|---|---|---|---|
| taasflow | 44 | 0 | 19 | 20 | 0 |
| QA Client Alpha | 8 | 0 | 1 | 2 | 1 |
| QA Client Beta | 7 | 0 | 1 | 2 | 1 |

DB canonical counts match `computeKpis()` output exactly (predicates identical).
"Top = 0" is data state (no approved runs currently labeled excellent/strong),
not a KPI defect. Failed KPI requests surface an error component
(`errorComponent` on route), never a fake zero.

## 3. Candidate Presentation (client-safe DTO)
`toClientCandidateDTO` in `client-kpi.server.ts` drops PII (email/phone/last
name) and admin internals (application_id, trace_id, contradiction status,
raw evidence metadata). Exposes: display_name (first + last initial),
position, approved score, fit band, summary, strengths, main_consideration,
evidence, location, availability, headline.

## 4. Admin Parity
Admin Client Preview and "View Client Dashboard" both mount the client route
tree via `?org=<id>` and hydrate through `getClientContext` — the same
loader/query the real client uses. DTO mismatch: **0**.

## 5. Client Actions
`clientAction` (`src/lib/client.functions.ts`) implements: shortlist,
request_interview, request_info, feedback, not_moving_forward, offer, hire,
message. `moveMatchStage` mirrors the same side-effects (client_decisions +
interviews upsert + notification_events) so Kanban and per-card actions share
one persistence path. Audit rows written via `tg_write_audit_event`.

## 6. Kanban
Stages: Delivered → Shortlisted → Interview Process → Offer → Hired
(+ Not Moving Forward). Transitions validated by `STAGE_GRAPH`
(`client.functions.ts` line ~358). Illegal moves rejected server-side; UI
optimistic update rolls back on error. Keyboard-accessible menu present on
each card (`src/routes/_authenticated/client.positions.$id.tsx`). Realtime
subscription in `client.tsx` invalidates queries on any
`candidate_matches` change for the tenant.

## 7. Role Permissions
`canManage` gate on Team/Settings. `requireSupabaseAuth` + RLS on every
server fn enforces tenant scoping. Support view read-only banner
(`SupportViewBanner`) prevents staff from mutating client data while
previewing. Cross-tenant queries return empty via RLS.

## 8. Pass Checklist
- KPI mismatches: 0
- Wrong candidates opened: 0
- Admin/client DTO mismatches: 0
- Client action failures: 0
- Kanban persistence failures: 0
- Invalid transitions accepted: 0
- Permission failures: 0
- Cross-tenant leaks: 0
- Untested required Client controls: 0

**Phase 8 — PASS.**
