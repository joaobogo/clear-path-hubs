# TaaSFlow — Motion & Microinteraction System

One restrained motion system for the public website. Motion earns its place by improving hierarchy, feedback, understanding, navigation, or product demonstration — nothing else.

## Non-negotiables

- Normal motion runs **150–400ms**. Storytelling sequences up to **600ms**, only when a step is being explained.
- **Never block interaction.** Content is fully present in the DOM before its reveal animation runs.
- **Preserve layout.** No animated `width`/`height` swaps that reflow neighbors; use `opacity` + `transform`, or animated `grid-template-rows` on collapse containers.
- **Focus stability.** Never move focus for animation; never animate the focused element's position.
- **Reduced motion.** A single global override in `src/styles/motion.css` collapses every animation and transition to 1ms and forces revealed content visible. All primitives respect it.
- **No bouncing, no parallax on every section, no constant movement.** Loading pulses are the only allowed loop and they run on skeletons only.

## Tokens

Durations (CSS: `--taas-motion-*`, JS: `MOTION.duration.*` in `src/lib/motion.ts`):

| Token     | Value  | Use                                              |
| --------- | ------ | ------------------------------------------------ |
| `instant` | 80ms   | Hover color, focus ring                          |
| `fast`    | 120ms  | Button press, checkbox, small state              |
| `base`    | 180ms  | Tab swap, menu open, tooltip, default            |
| `slow`    | 280ms  | Section reveal, card expansion, number tween     |
| `slower`  | 420ms  | Requirement highlight decay                      |
| `story`   | 600ms  | Storytelling sequences (ceiling)                 |

Easings (`--taas-ease-*`):

- `standard` `cubic-bezier(0.2, 0, 0, 1)` — default for UI
- `emphasized` `cubic-bezier(0.2, 0, 0.1, 1)` — section entry
- `outSoft` `cubic-bezier(0.16, 1, 0.3, 1)` — number tweens
- `inOut` `cubic-bezier(0.4, 0, 0.2, 1)` — reversible states
- `spring-subtle` `linear(...)` — **only** for product micro-interactions (drag snap, candidate re-order)

## Reusable patterns

| Pattern                     | Primitive / utility                                                   | Behaviour                                                                                          |
| --------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Section entry               | `<Reveal>` (`src/components/motion/reveal.tsx`), `motion-reveal`      | 8px rise + fade, once, on viewport intersection. Never gates content.                              |
| Number changes              | `<AnimatedNumber>` (`src/components/motion/animated-number.tsx`)      | 280ms tween, `tabular-nums`, `aria-live="polite"`.                                                 |
| Calculator result changes   | `<AnimatedNumber>` + width-reserved container                         | Tween outputs; container reserves width to prevent shift.                                          |
| Tab switching               | `motion-tab-swap` on panel content only                               | Content crossfade in 180ms. Tab strip itself doesn't animate.                                      |
| Candidate selection         | Border + shadow token swap on `motion-surface`                        | No scale, no bounce. Selection ring uses `motion-highlight` (one-shot).                            |
| Requirement highlighting    | `motion-highlight` → `motion-highlight-off`                           | 180ms in, 420ms decay. Fires once on interaction.                                                  |
| Process progression         | Line/step tokens transition via `motion-surface`; step number tween   | Progress bar animates `transform: scaleX()`, never `width`.                                        |
| Card expansion              | `motion-collapse` on a `grid grid-rows-[0fr]` → `grid-rows-[1fr]`     | No max-height jump; keyboard focus stays on the header.                                            |
| Menu / dropdown opening     | `motion-menu-open` (Radix already handles trap + focus)               | 180ms fade + 8px rise from top. Close is instant.                                                  |
| CTA feedback                | `motion-press` + `motion-press-active`                                | 1px inward on `:active` only. No hover jitter.                                                     |
| Loading                     | `motion-loading` (opacity pulse) or `motion-shimmer` (skeleton)       | Applied to skeletons only; never to actual content.                                                |

## Application rules

- **Reveal is opt-in, not universal.** Apply `<Reveal>` to first-fold section headers and hero visuals. Don't wrap every card or paragraph — that becomes constant movement.
- **One reveal per section.** If a section reveals, its children come in with it or not at all. No cascade beyond 6 items; use `<Stagger step={60} max={6}>`.
- **Interactive elements never wait for entry animation.** Buttons, inputs, and links must be clickable from render.
- **Icons don't animate on hover.** Only the container's border and shadow.
- **Number-only areas reserve width.** Use `tabular-nums` and, when width could change, a `min-w-[Nch]` on the wrapper.
- **Product demonstration sequences** (Operating System stages, Workspace tour) may use up to `story` (600ms) per beat and step timing. Users can skip forward.
- **Springs only for product micro-interactions** (ranked-list re-order, drag snap). Never for section entry, tabs, or menus.

## How reduced motion is enforced

`src/styles/motion.css` includes one global block:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  [data-reveal] { opacity: 1 !important; transform: none !important; }
}
```

`useReducedMotion()` in `src/lib/motion.ts` mirrors this in JS so tweens (`useAnimatedNumber`) settle to the target immediately instead of running.

## Certification checklist

- [ ] Every animation duration falls within tokens (`instant`–`slower`); story-mode only where a step is being explained.
- [ ] No animated property causes layout shift (checked via DevTools "layout shift regions").
- [ ] No element blocks pointer events during entry animation.
- [ ] `prefers-reduced-motion: reduce` collapses all motion (verified with system setting).
- [ ] No page has more than one continuous loop (skeleton loading only).
- [ ] Springs appear only on product micro-interactions.
- [ ] Focus never moves for animation purposes.
