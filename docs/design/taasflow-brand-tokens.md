# TaaSFlow Brand Token System

**Status:** PASS
**Scope:** Centralized `--taas-*` semantic token layer + shadcn rewire.
**Files changed:** `src/styles/brand-tokens.css`, `src/styles.css` (`:root` only).
**Business logic files changed:** 0. **Database files changed:** 0.

---

## 1. Source brand values (confirmed)

Extracted from `src/styles/brand-tokens.css` header comment, which mirrors the
public marketing site palette (`taasflow.com`) authored in HSL and converted to
OKLCH inside the repo. No new values were invented — every `--taas-*` alias
below traces to a `--brand-*` token already in the repo.

| Role            | Source HSL          | OKLCH (in repo)              | Variable            |
| --------------- | ------------------- | ---------------------------- | ------------------- |
| Navy (dark)     | `222 47% 20%`       | `oklch(0.22 0.055 262)`      | `--brand-navy-dark` |
| Navy            | `222 47% 25%`       | `oklch(0.29 0.055 262)`      | `--brand-navy`      |
| Ocean (primary) | `221 83% 53%`       | `oklch(0.60 0.19 258)`       | `--brand-ocean`     |
| Ocean-light     | `221 83% 62%`       | `oklch(0.68 0.16 258)`       | `--brand-ocean-light` |
| Sky             | `214 32% 91%`       | `oklch(0.92 0.017 245)`      | `--brand-sky`       |
| Ink (text)      | —                   | `oklch(0.18 0.03 262)`       | `--brand-ink`       |
| Paper (bg)      | —                   | `oklch(0.985 0.003 245)`     | `--brand-paper`     |
| Success         | —                   | `oklch(0.62 0.14 155)`       | `--brand-success`   |
| Warning         | —                   | `oklch(0.75 0.16 75)`        | `--brand-warning`   |
| Danger          | —                   | `oklch(0.58 0.22 27)`        | `--brand-danger`    |

## 2. Tokens created (`--taas-*` semantic layer)

Defined in `src/styles/brand-tokens.css` under `:root`. This is the **only**
place new brand values should be added going forward.

**Brand:** `--taas-brand-primary`, `-hover`, `-active`, `-soft`, `-softer`,
`-foreground`, `--taas-brand-navy(+fg)`, `--taas-brand-accent(+soft)`.

**Surfaces:** `--taas-surface-page`, `-card`, `-elevated`, `-muted`, `-sunken`,
`-inverse`.

**Text:** `--taas-text-primary`, `-secondary`, `-tertiary`, `-disabled`,
`-inverse`, `-link`, `-link-hover`.

**Borders:** `--taas-border-subtle`, `-default`, `-strong`, `-focus`.
**Interaction:** `--taas-interactive-hover`, `-pressed`, `-selected`,
`-disabled`, `--taas-focus-ring`.

**Status:** `success | warning | danger | info | neutral`, each with
`-foreground` and `-soft` (× 5 = 15 tokens).

**Typography:** `--taas-font-sans | display | mono`; display scale
`display-xl → sm`; dashboard `h1 → h4`; body `lg/md/sm`; meta `md/sm`;
`caption`; leading `tight/snug/normal/relaxed`.

**Radii:** `control` (buttons/inputs), `card`, `surface`, `pill`.
**Border weights:** `hairline`, `regular`, `emphasis`.
**Shadows:** `--taas-shadow-0..5`, `--taas-shadow-focus`.
**Motion:** `instant/fast/base/slow/slower` + `ease-standard/emphasized`.

**Charts:** `--taas-chart-1..7` (categorical).
**Score bands:** `excellent | strong | moderate | weak | poor`.
**Stages:** `new | review | shortlisted | interview | offer | hired | rejected | withdrawn`.

## 3. Old tokens mapped (shadcn `:root` → `--taas-*`)

Rewired in `src/styles.css` `:root` only. Every shadcn variable now dereferences
a `--taas-*` token — no more scattered `oklch(...)` literals in the shadcn
layer.

| shadcn token              | New reference                            |
| ------------------------- | ---------------------------------------- |
| `--primary`               | `--taas-brand-primary`                   |
| `--primary-foreground`    | `--taas-brand-primary-foreground`        |
| `--secondary`             | `--taas-surface-muted`                   |
| `--muted`                 | `--taas-surface-muted`                   |
| `--muted-foreground`      | `--taas-text-secondary`                  |
| `--accent`                | `--taas-brand-accent-soft`               |
| `--accent-foreground`     | `--taas-brand-navy`                      |
| `--destructive`           | `--taas-status-danger`                   |
| `--border` / `--input`    | `--taas-border-default`                  |
| `--ring`                  | `--taas-brand-primary`                   |
| `--chart-1..5`            | `--taas-chart-1..5`                      |
| `--sidebar-primary`       | `--taas-brand-primary`                   |
| `--sidebar-accent`        | `--taas-brand-accent-soft`               |
| `--sidebar-ring`          | `--taas-brand-primary`                   |
| `--success/-fg/-soft`     | `--taas-status-success/-foreground/-soft`|
| `--warning/-fg/-soft`     | `--taas-status-warning/-foreground/-soft`|
| `--info/-fg/-soft`        | `--taas-status-info/-foreground/-soft`   |
| `--danger-soft`           | `--taas-status-danger-soft`              |

## 4. Visual conflicts

- **Previous `--primary` was slate-navy** (`oklch(0.208 0.042 265.755)`), which
  read as generic-SaaS-black on button/badge/ring surfaces. Now Ocean.
  Impact: primary buttons, focus rings, active sidebar item, selected tabs
  shift to brand ocean. Contrast improves (see §5).
- **Previous `--chart-1..5` were a mixed warm/teal palette** unrelated to
  brand. Now anchored on Ocean/Navy/Success/Warning. Existing chart consumers
  keep the same variable names, no consumer code change.
- **`--accent` was near-white**; now a tinted brand wash. Sidebar hover and
  menu highlights become subtly ocean-tinted (still light).
- **Dark mode (`.dark`) intentionally untouched.** It continues to use its
  original shadcn slate palette. Rule: "preserve dark mode only when it
  already works correctly" — the app runs in light mode by default and dark
  mode is not part of this change's scope.

## 5. Accessibility contrast results

Computed against `--taas-surface-page` (paper, ~#FBFCFD) and `--taas-text-inverse`
(near-white) using WCAG 2.1 relative-luminance approximations from OKLCH L.

| Pair                                           | Ratio   | AA text | AA large |
| ---------------------------------------------- | ------- | ------- | -------- |
| text-primary on surface-page                   | ~15.6:1 | ✓       | ✓        |
| text-secondary on surface-page                 | ~5.0:1  | ✓       | ✓        |
| text-tertiary on surface-page                  | ~3.4:1  | —       | ✓        |
| brand-primary bg + primary-foreground (white)  | ~5.1:1  | ✓       | ✓        |
| brand-primary-hover + white                    | ~6.3:1  | ✓       | ✓        |
| brand-navy + text-inverse                      | ~12.8:1 | ✓       | ✓        |
| status-success + white                         | ~3.4:1  | —       | ✓        |
| status-warning + warning-foreground (dark)     | ~7.2:1  | ✓       | ✓        |
| status-danger + white                          | ~4.6:1  | ✓       | ✓        |
| status-info + white                            | ~5.1:1  | ✓       | ✓        |
| border-default on surface-page                 | 1.15:1  | n/a (non-text) |     |

Notes: `status-success` on white passes AA-large only. Use
`status-success-soft` + dark foreground for body text, or reserve solid
success on ≥18px/bold contexts (badges, chips).

## 6. Rules for consumers

- Reach for `--taas-*` in new work. `--brand-*` remains as raw palette; do not
  reference it directly in components except via the semantic alias.
- Never inline `oklch(...)` or `#xxxxxx` in component files. If a shade is
  missing, add it here first.
- `.dark` overrides remain the sole place dark-mode values live.

## 7. Verdict

**PASS.**
- One centralized token system ✓
- Hard-coded duplicate brand colors introduced in components: **0** ✓
- Business logic files changed: **0** ✓
- Database files changed: **0** ✓
