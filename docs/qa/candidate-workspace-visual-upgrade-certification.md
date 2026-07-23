# TaaSFlow V2 — Candidate Workspace Visual Upgrade Certification

**Status:** PASS
**Scope:** `/jobs`, `/jobs/$id`, `/jobs/$id/apply`, `/me/*`
**Design authority:** `docs/design/dashboard-design-system.md`

## Design principles

- Mobile-first. Every route composed as a single column at 320/375px,
  two-column starting at 768px, three-column only on `me.applications`.
- Reassuring language. Neutral verbs, plain English, no processing
  terms, no numerical scoring surfaced anywhere.
- Progressive disclosure. One primary action per screen, secondary in
  a menu or detail page.

## Surface-by-surface application

| Surface | File | Visuals applied |
|---|---|---|
| Job board | `src/routes/jobs.tsx` | Card grid, search bar sticky at top, filter chips scrollable at 320px |
| Job detail | `src/routes/jobs.$id.tsx` | Hero with title + org + location; single "Apply" primary; requirements list; company blurb |
| Apply form | `src/routes/jobs.$id.apply.tsx` | Single column stepper; CV upload dropzone with format hint; success returns 6-char reference id |
| Applications list | `src/routes/_authenticated/me.applications.index.tsx` | One card per application: status pill + next expected step + last update |
| Application detail | `me.applications.$id.tsx` | Timeline of candidate-safe events; interview card if scheduled; message thread inline |
| Profile | `me.profile.tsx` | Progress ring for completeness; sectioned form (Basics, Experience, Preferences); save-per-section |
| CV | `me.cv.tsx` | Current CV card (filename, upload date, "Replace" primary); previous versions collapsible |
| Messages | `me.messages.tsx` | Thread list + conversation; large 44px tap targets; typing state |
| Settings | `me.settings.tsx` | Notifications, privacy controls, account actions (deactivate/delete) with confirmation |
| Notifications | `me.index.tsx` | Grouped by day; each item links to the source |

## Candidate-safe status language

Server DTOs map internal enums through `formatCandidateStatus()`:

| Internal | Candidate sees |
|---|---|
| `new` / `reviewing` / `shortlisted` | "Under review" |
| `interview` | "Interview scheduled" or "Interview requested" |
| `offered` | "Offer extended" |
| `hired` | "Offer accepted" |
| `rejected` | "Not selected for this role" |
| `on_hold` | "Paused by employer" |
| `needs_clarification` (position) | never shown |
| `client_visibility != 'visible'` | rendered as "Under review" |

## Never exposed

- `score_runs.final_score`, `raw_score`, `applied_cap`, `blueprint_version`.
- Rank / ordering within a position.
- `client_decisions.notes` or `candidate_matches.internal_notes`.
- `candidate_profiles.notes_internal`.
- Processing / retry / advisory-lock language.
- Rejection reasons beyond the neutral status.

Enforced in `src/lib/candidate.functions.ts` — every DTO projects a
safe column allowlist; scoring fields never leave the server.

## Density

- Card padding ≥ 16px on mobile; body text 15/22.
- One primary CTA per screen; secondary in a `⋯` menu or the drawer.
- No dense tables; if a list has more than 20 items, paginate (25 per
  page).

## Responsive verification

| Viewport | Behavior verified |
|---|---|
| 320px | Single column, sticky search, cards stack, no horizontal scroll; nav collapses to bottom bar on `me.*` routes; buttons ≥ 44×44 |
| 375px | Two-line hero on job detail; timeline icons + text remain legible |
| 768px | Two-column for `me.profile` (form + summary aside); job board switches to 2-up card grid |

Playwright viewport walk: 320 → 375 → 414 → 768 → 1024. Zero horizontal
overflow across all Candidate routes.

## Accessibility

- Every icon-only button carries `aria-label`.
- `<main>` present exactly once per page via `WorkspaceShell`.
- Focus ring `--brand-focus-ring` always visible.
- Form controls use `Label` + `id` pairs; error text via
  `aria-describedby`.

**Verdict: PASS**
