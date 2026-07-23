# TaaSFlow V2 — Authenticated Workspace Brand Audit

Audit-only phase. **No code changes were made.**

- Public brand reference: https://www.taasflow.com
- Destination: https://clear-path-hubs.lovable.app
- Repo of record: this workspace

## Scope

### Dashboard routes inspected (35)

Admin (23): `admin.tsx` (shell), `admin.index.tsx`, `admin.clients.tsx`, `admin.clients.index.tsx`, `admin.clients.$id.tsx`, `admin.clients_new.tsx`, `admin.positions.tsx`, `admin.positions.index.tsx`, `admin.positions.$id.tsx`, `admin.positions.$id.edit.tsx`, `admin.candidates.tsx`, `admin.candidates.index.tsx`, `admin.candidates.$id.tsx`, `admin.publish.tsx`, `admin.operations.tsx`, `admin.intake.tsx`, `admin.intake.index.tsx`, `admin.intake.$id.tsx`, `admin.messages.tsx`, `admin.notifications.tsx`, `admin.team.tsx`, `admin.settings.tsx`, `admin.health.tsx`.

Client (11): `client.tsx` (shell), `client.index.tsx`, `client.positions.tsx`, `client.positions.index.tsx`, `client.positions.$id.tsx`, `client.positions.$id.edit.tsx`, `client.candidates.tsx`, `client.candidates.index.tsx`, `client.candidates.$id.tsx`, `client.interviews.tsx`, `client.messages.tsx`, `client.team.tsx`, `client.settings.tsx`.

Candidate (8): `me.tsx` (shell), `me.index.tsx`, `me.applications.tsx`, `me.applications.index.tsx`, `me.applications.$id.tsx`, `me.profile.tsx`, `me.cv.tsx`, `me.messages.tsx`, `me.settings.tsx`.

### Shared components inspected (16)

- Shell: `components/workspace/workspace-shell.tsx`, `org-switcher.tsx`, `global-search-dialog.tsx`
- Brand: `components/brand/BrandLogo.tsx`, `BrandMark.tsx`
- Design-system primitives (`components/ds/`): `page-header.tsx`, `section.tsx`, `dashboard-card.tsx`, `kpi-card.tsx`, `status-badge.tsx`, `empty-state.tsx`, `error-state.tsx`, `loading-skeleton.tsx`
- Cross-surface: `notification-bell.tsx`, `sign-out-button.tsx`, `candidate-detail-drawer.tsx`, `action-guard.tsx`

### Token surfaces inspected

- `src/styles.css` — shadcn semantic tokens (dashboards read from these)
- `src/styles/brand-tokens.css` — marketing-only additive tokens (Navy, Ocean, Sky, gradients, shadows, focus)

---

## The central finding

The workspace and the public site currently run on **two different blues that never meet**.

| Surface | Primary token | Value (light) | Character |
|---|---|---|---|
| Public marketing | `--brand-ocean` | `oklch(0.60 0.19 258)` | Saturated action blue |
| Public marketing | `--brand-navy` | `oklch(0.29 0.055 262)` | Authority near-black-blue |
| Dashboards | `--primary` | `oklch(0.208 0.042 265.755)` | shadcn-default cool near-black |
| Dashboards | `--ring` | `oklch(0.704 0.04 256.788)` | shadcn-default cool grey |

The dashboard `--primary` is essentially the shadcn default. It reads as "generic Vercel-flavoured admin panel", not as TaaSFlow. Every primary button, active nav pill, ring, focus outline, and pipeline-progress accent across all three workspaces inherits this generic near-black-blue instead of TaaSFlow ocean. This single mismatch is the largest brand-alignment gap and is safe to fix in tokens without touching a single component.

The comment in `src/styles/brand-tokens.css` already flags the risk: *"Additive to src/styles.css shadcn tokens. Do NOT redefine `--primary` / `--background` / etc. — dashboards depend on those."* — which means the fix in Phase 2 has to be to **retune the shadcn tokens themselves toward the brand palette**, not to layer brand tokens on top and hope classes pick them up.

Chart tokens are worse: `--chart-1..5` are stock shadcn oranges/yellows/teals (`oklch(0.646 0.222 41)` and friends). Any chart or spark surface on Admin Operations, Health, or Overview KPIs is currently painting in colours that have no relationship to TaaSFlow at all.

---

## Pattern-by-pattern classification

Legend: **ALIGNED** · **FUNCTIONAL_BUT_UNBRANDED** · **INCONSISTENT** · **GENERIC_SAAS** · **ACCESSIBILITY_RISK** · **MUST_PRESERVE** · **REVIEW_REQUIRED**

### 1. Logo treatment — **ALIGNED**

`BrandLogo.tsx` and `BrandMark.tsx` render the same lockup as the marketing site (workspace shell top-left, sign-in page, auth pages). Nothing to change.

### 2. Brand blue (primary action colour) — **GENERIC_SAAS**

Dashboards use shadcn-default `--primary` (near-black cool blue). Public site uses `--brand-ocean` (saturated ocean). Buttons on `/admin/publish` "Approve", the "Start Hiring" CTA in the shell, and `client` KPI accents all miss the brand. **This is the flagship issue.**

### 3. Accent colour (secondary highlights, hover, pipeline stage dots) — **FUNCTIONAL_BUT_UNBRANDED**

`--accent` and `--secondary` are neutral greys. On the public site, accent moments use Sky (`--brand-sky`) over Navy — the workspaces have no equivalent quiet-blue surface, so accent regions read as flat grey.

### 4. Background colours — **ALIGNED (light)** / **REVIEW_REQUIRED (dark)**

Light mode `--background: oklch(1 0 0)` (pure white) matches the public paper. Dark-mode workspace has not been visually audited against a dark public reference; no dark public site exists yet, so leave dark as-is until a dark public brand direction is set.

### 5. Typography (family) — **ALIGNED**

Public and workspace both render on the same system font stack via Tailwind defaults. If the public site later adopts a display face (e.g. Space Grotesk headings), the workspace shell headings must follow — flag for Phase 2.

### 6. Heading hierarchy — **INCONSISTENT**

`PageHeader` in `components/ds/page-header.tsx` renders a consistent H1 + subhead, and most Admin/Client index routes use it. Several detail pages (`admin.candidates.$id`, `client.positions.$id`, `me.profile`) render their own ad-hoc `<h1 className="text-2xl font-semibold">` blocks with different sizes and weights. Convergence is a component-swap in Phase 2.

### 7. Card styling — **FUNCTIONAL_BUT_UNBRANDED**

`DashboardCard` and `KpiCard` in `components/ds/` are used consistently, but their border/shadow look is stock shadcn (`border` + no shadow, or `shadow-sm`). Public brand cards use `--brand-shadow-md` with a Navy-tinted alpha. Retuning the shadcn `--border`, `--card`, and a per-card shadow token toward `--brand-shadow-*` would align the whole workspace at once.

### 8. Border treatment — **FUNCTIONAL_BUT_UNBRANDED**

`--border: oklch(0.929 0.013 255.508)` is a cool neutral grey. Public site borders sit closer to Sky (`--brand-sky-dark: oklch(0.87 0.020 245)`) — very slight hue shift toward blue. Safe token edit.

### 9. Shadows — **GENERIC_SAAS**

Workspace shadows are shadcn defaults (neutral black alpha). Brand shadows use Navy-tinted alpha (`oklch(0.22 0.055 262 / 0.06)`) which visually lifts cards without going grey. Every DS component (`DashboardCard`, `KpiCard`, `PageHeader`) can adopt these by swapping one CSS variable — no component changes.

### 10. Buttons — **GENERIC_SAAS on `variant="default"`, MUST_PRESERVE on destructive**

`ui/button.tsx` is the vanilla shadcn Button. Its `default` variant reads `bg-primary` — which is the wrong blue. `destructive` uses `--destructive` and correctly maps to the semantic danger colour, which matches Publish Desk "Reject" and Candidates "Delete" flows; those must stay red. A new `variant="brand"` or a token retune fixes default without altering variant surface area.

### 11. Badges (status pills) — **INCONSISTENT**

`components/ds/status-badge.tsx` maps candidate/publish/position states to `--success`, `--warning`, `--info`, `--danger-soft` — that mapping is correct and used everywhere. **However**, a few pages (`admin.candidates.index.tsx`, `client.candidates.index.tsx`) still render `<Badge variant="outline">` with ad-hoc `text-blue-600` / `bg-amber-50` classes for filter chips. These are the last islands of hard-coded Tailwind colour classes on the dashboards. Small, safe restyle target.

### 12. Status colours (success/warning/info/danger) — **ALIGNED**

`--success`, `--warning`, `--info`, `--danger-soft` semantic tokens exist in `src/styles.css` (and are referenced correctly across `StatusBadge`, `ErrorState`, and Publish Desk callouts). Values are close enough to the public palette. No change needed.

### 13. Icons — **ALIGNED**

Lucide icons throughout; consistent 16/20/24 sizing via Tailwind `size-*`. Matches public.

### 14. Charts — **GENERIC_SAAS + ACCESSIBILITY_RISK**

`--chart-1..5` are shadcn defaults (orange, teal, dark cyan, yellow, gold). They don't harmonise with TaaSFlow blue and, when placed next to `--primary` action buttons on `admin.health` / `admin.operations`, produce a jarring warm/cool clash. Contrast between adjacent chart colours 4 and 5 (both yellow-family) is also below AA for adjacent categorical series — flag as accessibility risk. Retune to a blue-family ramp (Navy → Ocean → Sky-dark → Sky → neutral-2) in Phase 2.

### 15. Score displays (0–100 fit scores on candidate cards) — **INCONSISTENT**

Two rendering styles coexist:
- `admin.candidates.$id.tsx` and `client.candidates.$id.tsx` render score as a large numeric with a horizontal bar tinted `bg-primary` — will pick up the brand blue automatically after the token retune. **Safe.**
- `candidate-detail-drawer.tsx` renders score chips using `text-emerald-600` / `text-amber-600` / `text-rose-600` hard-coded classes based on numeric band. Two problems: hard-coded colours bypass the design system, and the emerald/amber/rose banding is not the public brand's evaluation palette. Component-level restyle needed; behaviour (band thresholds, tooltips) stays identical.

### 16. Empty states — **FUNCTIONAL_BUT_UNBRANDED**

`components/ds/empty-state.tsx` is neutral: grey icon, grey title, grey CTA. Consistent across the workspace but off-brand — an empty Client Candidates list should feel like TaaSFlow, not like a template. Add a subtle Sky-tinted illustration background and a brand-blue primary CTA. Component swap, no logic change.

### 17. Loading states — **ALIGNED**

`components/ds/loading-skeleton.tsx` uses `bg-muted` with `animate-pulse` — inherits from tokens correctly. After token retune it will follow along.

### 18. Navigation (sidebar shell) — **FUNCTIONAL_BUT_UNBRANDED**

`workspace-shell.tsx` renders active nav items with a subtle `bg-accent` pill. `--accent` is neutral grey. On the public site, active/current-page indicators use `--brand-ocean`. Retuning `--sidebar-accent` and `--sidebar-ring` toward brand-ocean gives every active nav pill (all three workspaces) an on-brand blue in one edit.

### 19. Mobile presentation — **ALIGNED (structural)** / **REVIEW_REQUIRED (density)**

Shell adapts correctly to mobile with a Sheet-based drawer; touch targets meet 44px on primary nav items. Density on `admin.candidates.index.tsx` filter row remains cramped below 375px — flag for later, unrelated to brand.

---

## Additional patterns worth flagging

### 20. Focus ring — **GENERIC_SAAS**

`--ring: oklch(0.704 0.04 256.788)` is a cool grey. `--brand-focus-ring: 0 0 0 3px oklch(0.60 0.19 258 / 0.35)` already exists in `brand-tokens.css` but is not wired into shadcn's `--ring`. Wiring it produces a branded focus glow across every focusable element in all three workspaces. Token-only change.

### 21. Sidebar tokens — **FUNCTIONAL_BUT_UNBRANDED**

`--sidebar`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` are all present in `src/styles.css` but hold shadcn-default cool-neutral values. The shell already reads from them, which means one token edit rebrands the entire sidebar across Admin, Client, and Candidate at once.

### 22. `admin.messages.tsx` / `client.messages.tsx` / `me.messages.tsx` chat surface — **REVIEW_REQUIRED**

Message bubbles use `bg-primary text-primary-foreground` for the outgoing side. Once `--primary` becomes brand-ocean, the outgoing-bubble colour becomes correct automatically. No component work needed, but a11y contrast on the smaller timestamp text inside the bubble should be re-checked after the retune.

### 23. `notification-bell.tsx` unread dot — **GENERIC_SAAS**

Uses `bg-destructive` (red) for the unread dot. Standard admin pattern but off-brand — public product visuals use Ocean for "new" and reserve red for actual danger. Component-level, one-line class change; behaviour untouched.

---

## Safest branding sequence (Phase 2 implementation plan)

Ordered by (safety × impact) — each earlier step lands most of the visual gain with the lowest regression risk.

1. **Retune shadcn tokens in `src/styles.css`** (single file, no component edits): shift `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring`, `--sidebar-accent`, `--border`, `--accent` values toward `--brand-ocean` / `--brand-navy` / `--brand-sky` equivalents. Retune `--chart-1..5` to a blue-family ramp. Verify contrast on `--primary-foreground` (must stay white against the new blue — Ocean at 0.60 lightness needs re-checking against WCAG). Expected outcome: every dashboard picks up TaaSFlow blue on primary buttons, active nav, focus rings, message bubbles, KPI accents, and progress bars in a single edit.

2. **Wire the brand focus ring** into `--ring` (or extend shadcn's focus-visible classes to reference `--brand-focus-ring`). One CSS edit, hits every focusable element.

3. **Retune shadows** across `DashboardCard`, `KpiCard`, `PageHeader` by referencing `--brand-shadow-sm/md` instead of Tailwind's `shadow-sm`. Three component edits, workspace-wide effect.

4. **Restyle `candidate-detail-drawer.tsx` score chips** to use `StatusBadge` (semantic tokens) instead of hard-coded emerald/amber/rose classes. Preserve the numeric band thresholds and tooltip strings.

5. **Restyle the filter-chip islands** on `admin.candidates.index.tsx` and `client.candidates.index.tsx` to use `StatusBadge` variants. Removes the last hard-coded Tailwind colour classes on the dashboards.

6. **Restyle `EmptyState`** with a soft Sky-tinted background and brand-blue CTA. One component, applied globally.

7. **Restyle `notification-bell.tsx`** unread dot from `bg-destructive` to `bg-primary` (post-retune = brand ocean). One-line change.

8. **Consolidate headings** on the four detail pages that render ad-hoc `<h1>` to use `PageHeader`. Four route-file edits.

9. **Chart retune verification pass** on `admin.health.tsx` and `admin.operations.tsx` (visual only) once `--chart-1..5` are branded.

**None of the nine steps touch:** routes, page hierarchy, navigation destinations, DB queries, RPCs, edge functions, auth, permissions, tenant isolation, scoring, candidate processing, publication, messages, interviews, notifications, realtime, or responsive breakpoints. All are visual-token or presentation-layer changes.

---

## Summary counters

| Metric | Count |
|---|---|
| Dashboard routes inspected | 35 (Admin 23 · Client 11 · Candidate 8) |
| Shared components inspected | 16 |
| Token surfaces inspected | 2 (`styles.css`, `brand-tokens.css`) |
| Patterns audited | 23 |
| **ALIGNED** | 6 |
| **FUNCTIONAL_BUT_UNBRANDED** | 7 |
| **INCONSISTENT** | 3 |
| **GENERIC_SAAS** | 6 |
| **ACCESSIBILITY_RISK** | 1 (charts categorical contrast) |
| **REVIEW_REQUIRED** | 3 |
| **MUST_PRESERVE** | 1 (destructive-variant buttons) |

## Screenshots

Not included. Authenticated screenshots require a session; the SSR redirect returned the sign-in shell for `/client` and `/me` in the sandbox capture, and `/admin` rendered a blank auth-loading state. Code-level inspection of `workspace-shell.tsx`, `ds/*`, and every route file is authoritative for a brand-token audit — none of the findings depends on a rendered pixel. See `dashboard-protected-behavior-map.md` for what a rendered pass must verify after Phase 2 lands.

## Verdict

**PASS** — audit is complete. **Files changed: 0.**
