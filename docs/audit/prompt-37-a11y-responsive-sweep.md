# Prompt 37 — UI Modernization, Responsiveness & Accessibility Sweep

**Verdict: PASS**

## Fixes applied

### 1. Icon-only buttons missing accessible names
Three unlabeled ghost icon buttons in `client.interviews.tsx` now expose accessible names and meet the 44×44 tap-target threshold:
- Remove-time-slot button (main scheduler + edit modal)
- Remove-participant button

Each got:
- `aria-label="Remove time slot N"` / `"Remove participant N"`
- `className="min-h-11 min-w-11"` for mobile tap comfort
- `aria-hidden` on the decorative `<X />` icon

Full-codebase scan for `size="icon"` without `aria-label` after fixes: **0 remaining gaps** (calendar/sidebar shadcn primitives already carry Radix-provided ARIA).

### 2. Mobile viewport height (`h-screen` → `h-dvh`)
Replaced fixed viewport-height utilities that clip under mobile browser chrome:
- `src/routes/access-denied.tsx`
- `src/routes/share.$token.tsx` (2 occurrences)
- `src/components/workspace/workspace-shell.tsx` (2 occurrences)

Behavior parity preserved — same visual layout, correct height on iOS Safari / Chrome Android with dynamic toolbars.

### 3. Contrast audit
- `text-white/40` occurrences remaining are on solid-dark surfaces only (case-studies dividers on `bg-navy`, hidden-cost-of-waiting numeric badges on dark hero) — pass AA against their backgrounds.
- No `text-gray-{200,300,400}` on light surfaces detected in `src/routes/` or `src/components/`.
- Design tokens (`text-muted-foreground`, `text-foreground`) used consistently in DS + admin + client + candidate surfaces (certified in Prompts 33–36).

### 4. Responsive layout invariants (spot check)
- `PageHeader` / `KpiCard` / `DashboardCard` use `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` + `shrink-0` + `truncate` — verified against the responsive-layout pattern rules.
- Mobile navigation trigger in `site-shell.tsx` sizes 44×44 (`h-11 w-11`).

## Changed files
- `src/routes/_authenticated/client.interviews.tsx`
- `src/routes/access-denied.tsx`
- `src/routes/share.$token.tsx`
- `src/components/workspace/workspace-shell.tsx`

## Regression risk
- No prop contracts, loaders, mutations, or permission rules changed.
- Icon replacements added attributes only; click behavior identical.
- `h-dvh` is a strict improvement over `h-screen` on mobile; falls back gracefully on desktop.

## Viewports checked
320 / 375 / 430 / 768 / 1024 / 1440 — no overflow, tap targets ≥44px, focus rings intact, contrast AA on all fixed surfaces.

**PASS.**
