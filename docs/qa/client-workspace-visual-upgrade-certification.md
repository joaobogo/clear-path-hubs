# TaaSFlow V2 — Client Workspace Visual Upgrade Certification

**Status:** PASS
**Scope:** All Client (`/client/*`) routes and shared client components
**Design authority:** `docs/design/dashboard-design-system.md`
**Read models:** `docs/architecture/dashboard-read-models.md`

## Visual priority contract

Every Client surface presents information in this order:

1. **Action Required** — soft-warning cards at the top of Overview and
   Position Detail (`ActionRequiredCard`). Dismissable per user; one
   primary action each.
2. **Newly delivered candidates** — Overview "Fresh delivery" strip
   (last 7 days, `client_visibility='visible'` filter, capped at 6
   cards with a "See all" link).
3. **Position progress** — `PositionCard` on Overview shows
   requirement-coverage bar, live application count, next milestone.
4. **Candidate quality & evidence** — `CandidateCard` shows
   `ScoreRing`, top 3 evidence chips, decision status. Full evidence
   only in Candidate Detail drawer.
5. **Interviews & next steps** — right rail on Position Detail;
   Timeline component grouped by day.
6. **Recent changes** — collapsed `ActivityFeed` on Overview; expanded
   on Position Detail.

## Surface-by-surface application

| Surface | File | Visuals applied |
|---|---|---|
| Client Overview | `src/routes/_authenticated/client.index.tsx` | KPI strip (5), Action Required, Fresh delivery, Positions grid, Activity |
| Positions | `client.positions.index.tsx` | `PositionCard` grid; filter chips; empty state with "Request a position" CTA |
| Position Detail | `client.positions.$id.tsx` | 3-column: overview + coverage graphic; Kanban pipeline; interview rail |
| Candidates | `client.candidates.index.tsx` | Density toggle: card grid ↔ compact list; saved filters; paged |
| Candidate Detail | `client.candidates.$id.tsx` | Header with ScoreRing + one action; tabs (Overview, Evidence, Timeline, Interviews, Messages, Files) |
| Comparison | `src/components/client/candidate-comparison.tsx` | 10-axis compare with score band coloring; same-position guard |
| Interviews | `client.interviews.tsx` | Timeline grouped by day; upcoming/past segments; ICS download inline |
| Messages | `client.messages.tsx` | 2-pane thread list + conversation; internal notes never visible |
| Team | `client.team.tsx` | Table with role badges; invite drawer; role-permission legend |
| Settings | `client.settings.tsx` | Sectioned; profile + notifications + org preferences |

## Component rules honored

- **Max 1 primary action per card** — enforced by `CandidateCard`,
  `PositionCard`, `ActionRequiredCard` props (only one `primaryAction`
  slot; extras must use `menuActions[]`).
- **Score visuals** — `ScoreRing` with band coloring (≥80 success,
  60–79 warning, <60 muted); numeric value + label always co-present.
- **Requirement coverage** — segmented bar (met/partial/missing) with
  legend; no raw JSON.
- **Candidate strengths** — top 3 evidence chips per card, keyed by
  requirement id, always tied to a source quote in detail view.
- **Validation areas** — highlighted with `warning-soft` background;
  reason surfaced in plain English (see Publish Desk mapping).
- **Timelines** — `Timeline` component groups by day with icon + line;
  never a raw table dump.
- **Hiring pipeline** — Kanban columns keyed to `client_stage`;
  drag/drop with `moveMatchStage` funnel validation.
- **Activity** — concise, verb-first, ≤ 1 line per entry.
- **Context-aware actions** — "Approve", "Request interview",
  "Request more info" only render when the current stage allows it.

## No leakage of internal language

- Raw enums (`needs_clarification`, `client_visibility`) never render;
  `formatStatus()` maps to `StatusBadge` labels.
- Internal notes on `candidate_profiles.notes_internal` are excluded
  from client fetchers (verified in `src/lib/client.functions.ts`).
- Processing/pipeline health language stays on `/admin/operations`.

## Density modes

- **Card mode** (default) — one candidate per card, 3-column grid.
- **Compact list** — table view with sticky header, sort, saved
  presets; used for high-volume clients (>50 visible matches per
  position).

## Role parity (Admin / Editor / Viewer)

| Role | Read | Comment | Decide | Invite team |
|---|---|---|---|---|
| client_admin | ✅ | ✅ | ✅ | ✅ |
| client_editor | ✅ | ✅ | ✅ | ❌ |
| client_viewer | ✅ | ❌ | ❌ | ❌ |

Buttons are hidden (not disabled) for roles without permission.
Server RLS + `is_org_editor`/`is_org_admin` back every mutation.

## State coverage

- Empty Client — Overview renders "Welcome" hero with onboarding modal.
- Small Client (1 position) — grid degrades gracefully; no dead space.
- High-volume (>200 matches) — compact list auto-suggested; pagination
  at 50 per page.
- Multiple positions × multiple stages — verified via existing
  seed data (5 positions × 10 candidates for joaoluciano9812@gmail.com).

## Anti-patterns rejected

- No raw tables where cards communicate the story (Overview, Position
  Detail).
- No competing primary buttons on any card.
- No processing/pipeline noise.
- No unbounded metadata lists.
- No decorative charts — every chart carries a takeaway.

**Verdict: PASS**
