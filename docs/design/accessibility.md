# TaaSFlow — Accessibility Rules

Every shared component in `src/components/ds/*` ships accessible by default. Pages compose these primitives; they don't re-implement keyboard, focus, or ARIA behavior.

## Non-negotiables

1. **Visible focus.** Every interactive element uses the canonical focus ring:
   ```
   focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background
   ```
   Never `outline-none` alone (Tailwind v4 changed it to literal `outline-style:none`). Use `outline-hidden` if a rare reset is needed.

2. **One `<main>` per page.** The layout renders `<main>` around `<Outlet />`. Route components do not add their own `<main>`.

3. **Semantic headings.** One `<h1>` per page (owned by `PageHeader`). Sections use `<h2>` (via `Section` label) or `<h3>`. Never skip levels.

4. **Button and link names.**
   - Text buttons: children provide the name.
   - Icon-only buttons: `aria-label` required. Enforced by lint rule `jsx-a11y/no-icon-only-button-without-label`.
   - Links that wrap a card get `aria-label` mirroring the card title.

5. **Form labels.** Every form control has an associated `<Label htmlFor>` OR an `aria-label` if visually label-less. `Input` `placeholder` is NEVER the sole label.

6. **Dialog and drawer semantics.** Use shadcn `Dialog`/`Sheet` (Radix). Do NOT rebuild focus trapping. Each dialog has a `DialogTitle` (visible or `sr-only`) and a `DialogDescription`.

7. **Tab semantics.** Use shadcn `Tabs`. Keyboard: arrows to move, Home/End to jump, Enter to activate. Do NOT hand-roll tab lists.

8. **Keyboard operation.** Every interactive element reachable via Tab in DOM order. Kanban cards support Enter (open) + Space (grab) — provided by the `KanbanCard` component (to add in Phase A).

9. **Error announcement.** Field-level errors rendered inside a `<p role="alert" aria-live="polite">` bound to the input via `aria-describedby`. Handled by shadcn `<FormMessage>`.

10. **Contrast.** Every text-on-background pairing meets WCAG AA (4.5:1 for body, 3:1 for ≥18pt). Enforced by design tokens — no arbitrary colors allowed.

11. **Reduced motion.** Every animated element pairs with `motion-reduce:animate-none` or `motion-reduce:transition-none`. `Skeleton` already does.

12. **Touch targets.** ≥ 44×44 CSS px on viewports below `md`. See responsive spec.

## Class-by-audience conventions

- **Client-facing surfaces** must never expose internal error strings — only `ErrorState` sanitized copy.
- **Candidate surfaces** never show scores or match reasons in `aria-*` attributes either.
- **Admin surfaces** may show trace IDs but not stack traces to screen readers — logs only.

## Component checklist

Every new component in `src/components/ds/*` must:

- [ ] Provide an `aria-*` API when the visual role isn't obvious.
- [ ] Use focus-visible ring token.
- [ ] Support keyboard operation matching WAI-ARIA APG.
- [ ] Ship with a Catalogue story showing the default + interactive + disabled state.
- [ ] Pass automated axe checks in `tests/a11y.spec.ts` (to add in Phase A).

## Enforcement

- `eslint-plugin-jsx-a11y` (already in shadcn stack) at `strict` recommended-config.
- `axe-core` run via Playwright in CI on `/_dev/catalogue` and every dashboard index route. Critical violations fail the build.
