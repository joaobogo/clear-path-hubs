# TaaSFlow V2 — Dashboard Brand Design System

**Status:** PASS
**Owner:** Design Systems
**Scope:** Authenticated Admin, Client, and Candidate workspaces.
**Authority:** TaaSFlow brand (Navy · Ocean · Sky) as expressed in
`src/styles/brand-tokens.css` and mapped to shadcn semantic tokens in
`src/styles.css`.

## 1. Principles

1. **Calm and premium.** Generous whitespace, one accent color per
   view, restrained motion.
2. **Information first.** Numbers, names, and status are the loudest
   elements on any screen. Chrome recedes.
3. **Progressive disclosure.** Show three facts and one action per
   card. Detail lives in the drawer.
4. **Role-appropriate density.** Admin = information-dense tables.
   Client = card + Kanban. Candidate = single-column narrative.
5. **One primary action per surface.** Secondary actions are ghost or
   link-style. Destructive actions live in a menu.
6. **No generic SaaS look.** Navy authority + Ocean action + Sky
   surface. No purple gradients, no glassmorphism, no rainbow badges.

## 2. Token map (single source of truth)

Machine-readable: `docs/design/dashboard-token-map.json`.
Human-readable source:

| Category | Token | Value / mapping | Notes |
|---|---|---|---|
| Brand navy | `--brand-navy` | oklch(0.29 0.055 262) | Authority; nav, headings |
| Brand ocean | `--brand-ocean` | oklch(0.60 0.19 258) | Primary action, links, focus |
| Brand sky | `--brand-sky` | oklch(0.92 0.017 245) | Surface, section backgrounds |
| Ink | `--brand-ink` | oklch(0.18 0.03 262) | Body text on light |
| Paper | `--brand-paper` | oklch(0.985 0.003 245) | App background |
| Surface | `--color-card` | var(--card) | Card container |
| Border | `--color-border` | oklch(0.929 0.013 255.508) | Hairline dividers |
| Success | `--color-success` / `--color-success-soft` | 155° | Hired, published |
| Warning | `--color-warning` / `--color-warning-soft` | 78° | Needs review |
| Info | `--color-info` / `--color-info-soft` | 240° | Neutral status |
| Danger | `--color-destructive` / `--color-danger-soft` | 27° | Rejected, error |
| Type — heading | Inter / system-ui, 600, tracking -0.01em | display, h1, h2 | |
| Type — body | Inter / system-ui, 400, 1.55 leading | body, table | |
| Type — mono | ui-monospace | ids, timestamps | |
| Scale | 12 / 14 / 16 / 20 / 24 / 32 / 40 | rem-based | |
| Spacing | 4pt: 4/8/12/16/20/24/32/40/48/64 | `--brand-space-*` | |
| Radius | 6 / 8 / 12 / 16 / 24 / pill | `--brand-radius-*` | Cards = 12, buttons = 8, chips = pill |
| Shadow | xs / sm / md / lg | `--brand-shadow-*` | Max 2 elevation levels per view |
| Motion | 120 / 180 / 280ms · cubic-bezier(0.2,0,0,1) | `--motion-*` `--ease-standard` | Fade/slide only |
| Focus | 3px ring at ocean 35% opacity | `--brand-focus-ring` | Always visible |
| Breakpoints | 640 / 768 / 1024 / 1280 / 1536 | Tailwind default | Workspace min = 1024 |

Rule: **never hardcode colors in components**. Every color reaches
JSX through a semantic token (`bg-card`, `text-muted-foreground`,
`text-success`, etc.).

## 3. Charts

- Palette: `--chart-1..5` (already OKLCH). Two colors per chart max
  unless comparing distinct series.
- No 3D, no gradients, no drop shadows.
- Every chart has a title, a single-line takeaway, and units.
- No decorative sparklines — if a number stands alone, it stands
  alone.

## 4. Iconography

- Library: `lucide-react`. Stroke 1.5, size 16 in dense UI, 20 in
  headers, 24 in empty states.
- Icons never carry meaning without a label except for well-known
  affordances (close, back, chevron).

## 5. Patterns (canonical components)

Implementation lives under `src/components/ds/`,
`src/components/workspace/`, and workspace subfolders. This section
declares the API and usage.

- `PageHeader` — page title, subtitle, breadcrumbs, and one primary
  action. No badge soup.
- `WorkspaceShell` — top nav, org switcher, global search, notifications.
- `Section` — labeled content block with optional aside.
- `KpiCard` — number, label, delta chip, optional sparkline.
- `ActionRequiredCard` — orange soft surface, headline, reason,
  primary action, dismissable.
- `CandidateCard` — avatar/initials, name, headline, score ring,
  stage chip, one action.
- `PositionCard` — title, org, status chip, requirement count, open
  applications count, one action.
- `ScoreRing` — circular progress; palette by band
  (≥80 success, 60–79 warning, <60 muted).
- `RequirementCoverage` — segmented bar (met / partial / missing).
- `Timeline` — vertical, one icon + one line + timestamp; group by day.
- `ActivityFeed` — same rhythm as Timeline, tenant-scoped.
- `DataTable` — sticky header, zebra off, 44px row height, sort chip,
  row menu.
- `FilterBar` — pill chips, one clear-all, saved views on the right.
- `Drawer` — right-side, 480/640/840 sizes; header + tabs + content
  + sticky footer.
- `Dialog` — center, max-w-lg; only for confirmation or short forms.
- `EmptyState` — icon, headline, one-line explainer, one CTA.
- `LoadingSkeleton` — matches the final layout, never spinners on
  first paint.
- `ErrorState` — icon, plain-language explanation, retry that runs
  `router.invalidate()` **and** `reset()`.
- `StatusBadge` — semantic (success/warning/info/danger); words only,
  no raw enum strings.

## 6. Interaction rules

- One primary button per header, one per drawer footer, one per
  dialog. Extras become ghost/link.
- Row-level actions live in a `⋯` menu; only "open" is inline.
- Hover reveals affordances but never reveals data.
- Keyboard: every action reachable; visible focus ring on all
  interactive elements.

## 7. Do-not list (audit rejections)

- No pure `text-blue-*` / `bg-blue-*` classes. Blue is `text-info`
  or brand ocean via token.
- No stacks of white cards on white background — alternate with
  `bg-muted/50` or `bg-brand-sky`.
- No shadow-2xl on cards; max `--shadow-elevation-2`.
- No badge on every field; status badges live at row/entity level.
- No 10px metadata; minimum body size 14px.
- No raw enum strings in UI (`needs_clarification`, `visible`); map
  through `formatStatus()`.
- No pipe-separated labels ("Active | Remote | 3 yrs"). Use chips or
  a definition list.
- No empty hero areas above the fold on dashboards; show KPIs
  immediately.
- No decorative charts. Every chart earns its space.
- No two primary buttons competing on a single card.

## 8. Responsive rules

Dashboards target ≥ 1024px; tablet and mobile use collapsed nav +
single-column stacks. Follow `responsive-layout-patterns` for header
rows (grid + `min-w-0` + `shrink-0`).

## 9. Governance

- New tokens land in `src/styles/brand-tokens.css` and
  `src/styles.css` in the same edit; anything else is a bug.
- New patterns land under `src/components/ds/` with a story-style
  usage note in `dashboard-component-inventory.md`.
- Any deviation requires a note in the component's file explaining
  why the token was insufficient.

**Verdict: PASS**
