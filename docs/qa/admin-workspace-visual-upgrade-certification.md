# TaaSFlow V2 — Admin Workspace Visual Upgrade Certification

**Status:** PASS
**Scope:** All Admin (`/admin/*`) routes
**Design authority:** `docs/design/dashboard-design-system.md`
**Read models:** `docs/architecture/dashboard-read-models.md`

## Operational priority contract

1. **Action Required** — Overview surfaces urgent items grouped by
   root cause (see incident grouping below).
2. **Records blocked by errors** — `Publish Desk` "Blocked" tab and
   `Operations` "Failures" queue.
3. **Candidates requiring review** — Overview "Review queue" + direct
   entry from Candidate list filter chip.
4. **Candidates ready to publish** — `Publish Desk` "Ready" tab
   dominates the page.
5. **New Client / position activity** — Overview activity feed with
   filters (Clients, Positions, Applications).
6. **Exact operational context** — every row shows org, position,
   candidate ref id, and last stage change timestamp.

## Surface-by-surface application

| Surface | File | Visuals applied |
|---|---|---|
| Overview | `admin.index.tsx` | Command Centre: 6 KPIs, Action Required, Review queue, activity |
| Clients | `admin.clients.index.tsx` | Compact table + status chips + row `⋯` menu; no per-row repair buttons |
| Client Detail | `admin.clients.$id.tsx` | CRM shell: contacts, positions, decisions, audit rail |
| Positions | `admin.positions.index.tsx` | Table with lifecycle chip, req count, active applications, staff owner |
| Position Detail | `admin.positions.$id.tsx` | ATS: requirements graphic, applications by stage, screening Qs |
| Candidates | `admin.candidates.index.tsx` | Compact list, filter by state, sort by final score |
| Candidate Review | `admin.candidates.$id.tsx` | Progressive evidence disclosure: summary → per-requirement drill |
| Publish Desk | `admin.publish.tsx` | 5 tabs (Needs Review, Blocked, Ready, Published, Held) with 6 readiness chips per row |
| Operations | `admin.operations.tsx` | Processing timelines, incidents grouped by root cause |
| Messages | `admin.messages.tsx` | Thread list + support-mode aware; internal notes segregated |
| Settings | `admin.settings.tsx` | 17 audited controls in labeled sections |

## Component rules honored

- **Compact operational summaries** — Overview KPI cards fit 6 across at
  ≥1280px; each card is single-line number + label + tiny delta.
- **Clear status chips** — `StatusBadge` semantic mapping; no raw
  enum strings; consistent order (state → severity → age).
- **Prioritized queues** — Publish Desk order: Blocked → Needs Review
  → Ready → Held → Published; sort within by oldest first.
- **Exact record context** — every row includes tenant + entity refs;
  clicking opens the canonical detail page (no duplicate drawers).
- **Progressive evidence disclosure** — Candidate Review shows the
  8-field evidence contract collapsed by requirement; source quote
  and file offset revealed on expand.
- **Score & requirement visuals** — `ScoreRing` + segmented coverage
  bar with tooltip legend.
- **Processing timelines** — Operations shows per-job timeline (queued
  → running → completed/failed) with duration and retry chip.
- **Root-cause incident grouping** — repeated `processing_jobs`
  failures with the same `error_code` + `error_message_hash` collapse
  into a single incident card with a count + expand.

## No raw JSON as primary interface

- Evidence payloads render as structured cards, not `<pre>`.
- Debug JSON hidden behind "Show technical details" toggle in Admin
  Candidate Review; requires `platform_admin` role to open.

## No per-row repair actions

- List rows expose only "Open" + a `⋯` menu with at most 3 items.
- Bulk repair actions live on `Operations` with explicit
  incident-scope selectors; each action logs to `audit_events` and
  uses the `processing_jobs_active_unique` guard to prevent duplicate
  jobs.

## Incident grouping (root cause)

`Operations` groups failures by
`(root_cause_code, error_class, target_entity_type)`. A group card
shows: count, first/last seen, canonical error, "affected entities"
count, single "Retry all" and "Escalate" action, and an expand for
per-entity drill. This replaces the previous per-incident card list.

## Density and readability

- Tables use 44px row height + hairline dividers; no zebra.
- Column widths pinned; `min-w-0` + `truncate` on text columns;
  numeric columns right-aligned tabular numerals.
- Sticky headers on tables ≥ 12 rows.
- Filter bar uses pill chips + a "Saved views" pane.

## Verification

- `rg -n "text-blue-|bg-blue-" src/routes/_authenticated/admin.*` → 0.
- `rg -n "<pre" src/routes/_authenticated/admin.*` → 0 in primary UI
  (only inside a `<Collapsible>` labeled "Technical details").
- Every list route uses a documented read model (see
  `dashboard-read-models.md`), no ad-hoc per-row fetches.
- All mutations are staff-gated via
  `middleware([requireSupabaseAuth])` + `is_platform_staff` server-side.

## Anti-patterns rejected

- Per-row repair buttons that duplicate incidents.
- Raw JSON as a primary interface.
- Repeated incidents shown as separate cards.
- Overcrowded KPI header (capped at 6).
- Long pipe-separated labels replaced by chips or a definition list.

**Verdict: PASS**
