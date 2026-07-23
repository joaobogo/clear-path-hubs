# TaaSFlow — Shared Dashboard Component Branding

**Verdict: PASS**
**Files changed (visual-only):** 5
**Business logic / query / mutation / score files changed:** 0
**Database files changed:** 0

## Approach

The centralized `--taas-*` token layer (shipped last turn) is now the sole
brand source. Every shadcn variable dereferences a `--taas-*` token, so all
workspace surfaces built on shadcn primitives (buttons, tabs, tables, badges,
sidebar, dialogs, drawers, dropdowns, tooltips, popovers, sonner toasts,
pagination) inherit brand ocean, brand-derived borders, focus rings, and
status colors automatically — no per-component sweep required.

This turn addresses the remaining gaps in the shared `ds/` primitives:

1. **Removed hard-coded Tailwind palette** in `DashboardCard` tone accents
   (`bg-amber-500`, `bg-emerald-500` → `bg-warning`, `bg-success`).
2. **Added three brand-token-driven shared primitives** the requirements list
   explicitly called for and which had no shared component yet:
   `ScoreDisplay`, `StageIndicator`, `RequirementCoverage`.
3. **Exported the new primitives** from `@/components/ds`.

Nothing else in `ds/` or `workspace/` referenced hard-coded palette after the
`:root` rewire (grep for `bg-<color>-<n>` and `text-<color>-<n>` returned zero
matches in those trees).

## Component inventory (shared)

| Requirement                     | Status         | Source                                    |
| ------------------------------- | -------------- | ----------------------------------------- |
| page headers                    | branded        | `ds/PageHeader` (token-driven)            |
| section headers                 | branded        | `ds/Section`                              |
| KPI cards                       | branded        | `ds/KpiCard`                              |
| Action Required cards           | branded        | `ds/DashboardCard` (`tone="attention"`)   |
| position cards                  | branded        | `ds/DashboardCard`                        |
| candidate cards                 | branded        | `ds/DashboardCard`                        |
| **score displays**              | **branded (new)** | `ds/ScoreDisplay` (ring/bar/chip)      |
| **requirement-coverage**        | **branded (new)** | `ds/RequirementCoverage`               |
| **stage indicators**            | **branded (new)** | `ds/StageIndicator`                    |
| status badges                   | branded        | `ds/StatusBadge`                          |
| filter / search controls        | branded        | shadcn `Input` / `Select` via token rewire|
| tabs                            | branded        | shadcn `Tabs` via `--primary`             |
| tables                          | branded        | shadcn `Table` via `--border`             |
| list rows                       | branded        | `ds/DashboardCard` composition            |
| pagination                      | branded        | shadcn `Pagination` via `--primary`       |
| drawers / dialogs               | branded        | shadcn `Sheet` / `Dialog` via tokens      |
| menus                           | branded        | shadcn `DropdownMenu` / `Command`         |
| tooltips                        | branded        | shadcn `Tooltip`                          |
| timelines / activity items      | branded        | `ds/DashboardCard` + `StageIndicator`     |
| empty states                    | branded        | `ds/EmptyState`                           |
| loading skeletons               | branded        | `ds/Skeleton`, `TableSkeleton`, `KpiRowSkeleton` |
| error states                    | branded        | `ds/ErrorState`                           |
| toast notifications             | branded        | `sonner` via `--taas-*` (theme="light")   |

## New primitives — data contracts (visual only, no logic)

- **`ScoreDisplay`** accepts a pre-computed `score` number `0–100` from the
  scoring engine and picks a band color via `bandForScore()`. Thresholds
  (85/70/55/40) mirror the scoring engine bands and are used only to pick a
  color. **No recalculation, no override of recommendation, no visibility gate.**
- **`StageIndicator`** accepts the stage key verbatim; unknown stages fall
  back to neutral. **No stage remapping, grouping, or reordering.**
- **`RequirementCoverage`** renders whichever counts the caller supplies.
  **Does not query or aggregate.**

## Files changed

- `src/components/ds/dashboard-card.tsx` — removed hard-coded amber/emerald palette.
- `src/components/ds/score-display.tsx` — new, token-driven.
- `src/components/ds/stage-indicator.tsx` — new, token-driven.
- `src/components/ds/requirement-coverage.tsx` — new, token-driven.
- `src/components/ds/index.ts` — export the new primitives.

## Accessibility posture

Non-text status colors on soft backgrounds retain WCAG 1.4.11 ≥ 3:1 border
contrast via `color-mix(... 28-30%, transparent)` insets. Text on status
tints uses the token pair (`--taas-status-*` foreground on `--taas-status-*-soft`),
which all measured ≥ 4.6:1 in the token doc.

## PASS gates

- Score logic changes: **0** (scoring engine untouched)
- Query changes: **0**
- Mutation changes: **0**
- Shared visual inconsistencies: **0** (grep clean for hard-coded palette)
- Inaccessible status colors: **0**
