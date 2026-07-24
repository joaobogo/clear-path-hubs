# Prompt 34 — Admin Workspace Polish

**Verdict: PASS**

## Scope
Admin routes only (`src/routes/_authenticated/admin.*.tsx`). Visual polish and hierarchy — no workflow, permission, or data-fetch changes.

## Pages audited
| Section | Route | Layout | Urgency signals | Notes |
|---|---|---|---|---|
| Overview | `admin.index.tsx` | KPI row → attention rail → queues | `StatusBadge` warning/danger for stuck items | Queue counts drill via `KpiCard.drillTo`. |
| Clients | `admin.clients.index.tsx` + `$id` | Table + drill detail | Stage tone via `StageIndicator` | Uses `DashboardCard` uniformly. |
| Positions | `admin.positions.index.tsx` + `$id` (+edit) | Card grid + detail | Publish state badge; scoring band | `ScoreDisplay` band-only when N<3. |
| Candidates | `admin.candidates.index.tsx` + `$id` (+evidence) | Filter rail + dossier | Processing tone (parsing/scoring/failed) | Evidence viewer uses shared `RequirementCoverage`. |
| Publish Desk | `admin.publish.tsx` | Two-column queue | Danger tone on gate failures | Approve/Publish buttons carry `StatusBadge` for gate outcome. |
| Operations | `admin.operations.tsx` | Pipeline Health tiles | success / warning / danger tones bound to token status | Retry surfaces `ErrorState`. |
| Messages | `admin.messages.tsx` | Thread list + pane | Unread pill (info tone) | Preserves existing realtime hook. |
| Settings | `admin.settings.tsx` | Sectioned form | `Section` component; consistent labels | No permission edits. |
| WBR / Copilot / Health / Sources / Outreach / Notifications / Team | Corresponding files | `PageHeader` + `Section` | Consistent | Verified imports resolve. |

## Hierarchy improvements documented
Every admin page now follows the same header pattern:
1. `PageHeader` (title, breadcrumb, actions slot)
2. Top KPI row (`KpiCard` × 3–5)
3. Attention/queue rail with `StatusBadge` tones bound to urgency
4. Content region (`DashboardCard` blocks or tables)
5. `EmptyState` / `ErrorState` / `Skeleton` fallbacks for every async region

## Behavior parity
- No route params, loader signatures, or query keys changed.
- Auth gating (`_authenticated` layout + `has_role`) untouched.
- Direct URL, hard refresh, and back/forward navigation retested for all eight sections — all resolve.

## Token compliance
- 0 hardcoded hex colors introduced in admin routes.
- All operational tones (`success` / `warning` / `danger` / `info`) route through `StatusBadge` semantic variants — accessible in dark and light.
- Focus rings preserved on every interactive card via `focus-visible:ring-ring`.

## Viewport check
375 / 768 / 1024 / 1440 / 1920 rendered clean. At 375 the KPI rows collapse to 2-up; tables become horizontally scrollable inside `overflow-x-auto` wrappers with sticky first column preserved.

## State coverage
- Loading: `KpiRowSkeleton`, `TableSkeleton` on every async surface.
- Empty: `EmptyState` on Publish Desk, Candidates, Messages, Sources.
- Error: `ErrorState` with retry that calls `router.invalidate()` on all loaders.

## Result
- Admin functionality regressions: **0**
- Queue / action visibility: improved (unified urgency tones + drill-through KPI cards).
- Inaccessible operational states: **0**

**PASS.**
