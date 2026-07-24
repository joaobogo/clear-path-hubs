# TaaSFlow — Motion & Microinteraction System

One restrained motion system for public site and authenticated product. Motion earns its place by improving hierarchy, feedback, understanding, navigation, or product demonstration — nothing else.

**Code:** `src/styles/motion.css` (primitives), `src/styles/industry-motion.css` (opt-in industry hero utilities), `src/lib/motion.ts` (JS mirror of duration/easing tokens).

## Non-negotiables

- Normal motion runs **150–400ms**. Storytelling sequences up to **600ms**, only when a step is being explained.
- **Never block interaction.** Content is fully present in the DOM before its reveal animation runs.
- **Preserve layout.** No animated `width`/`height` swaps that reflow neighbors; use `opacity` + `transform`, or animated `grid-template-rows` on collapse containers.
- **Focus stability.** Never move focus for animation; never animate the focused element's position.
- **Reduced motion.** A single global override in `src/styles/motion.css` collapses every animation and transition to 1ms and forces revealed content visible. All primitives respect it.
- **No bouncing, no parallax on every section, no constant movement.** Loading pulses are the only allowed loop, and they run on skeletons only.

## Tokens

Durations (CSS: `--taas-motion-*`, JS: `MOTION.duration.*`):

| Token     | Value  | Use                                              |
| --------- | ------ | ------------------------------------------------ |
| `instant` | 80ms   | Hover color change, focus ring appear            |
| `fast`    | 120ms  | Button press, checkbox, small state              |
| `base`    | 180ms  | Tab swap, menu open, tooltip, default            |
| `slow`    | 280ms  | Section reveal, card expansion, number tween     |
| `slower`  | 420ms  | Requirement highlight decay, sheet slide         |
| `story`   | 600ms  | Storytelling sequences (ceiling, marketing only) |

Easings:

- `--taas-ease-standard` `cubic-bezier(0.2, 0, 0, 1)` — UI default.
- `--taas-ease-emphasized` `cubic-bezier(0.2, 0, 0.1, 1)` — section entry.
- `--taas-ease-out-soft` `cubic-bezier(0.16, 1, 0.3, 1)` — number tweens, count-up.
- `--taas-ease-in-out` `cubic-bezier(0.4, 0, 0.2, 1)` — utility.
- `--taas-spring-subtle` (linear() spring) — product micro-interactions only (drag-drop settle, chip pop).

## Primitives

| Primitive               | Duration | Ease            | Notes                                       |
| ----------------------- | -------- | --------------- | ------------------------------------------- |
| Fade in                 | base     | standard        | opacity 0 → 1                               |
| Fade + rise             | slow     | emphasized      | + `translateY(8px → 0)`                     |
| Scale in                | base     | standard        | scale 0.98 → 1, opacity 0 → 1               |
| Slide in right (sheet)  | slower   | emphasized      | translateX(100% → 0)                        |
| Accordion open/close    | base     | standard        | animate `grid-template-rows: 0fr → 1fr`     |
| Skeleton pulse          | 1400ms   | in-out (loop)   | opacity 1 → 0.6 → 1                         |
| Number tween            | slow     | out-soft        | requestAnimationFrame count-up              |
| Requirement highlight   | slower   | standard        | flash `bg-primary/10` → transparent          |
| Boardroom slide advance | story    | emphasized      | marketing-only, one-shot                    |

## Interaction rules

- **Hover.** Instant (80ms). Color + shadow only. Never move an element on hover.
- **Press.** Fast (120ms). Scale 0.98 for buttons, no motion for inputs. Restore on `pointerup`.
- **Focus-visible.** Instant. Global ring token; never a custom ring per component.
- **Reveal on scroll.** Base to slow duration, once per element, at 20% viewport threshold. Use `IntersectionObserver` (see `src/components/perf/lazy-on-visible.tsx`), never scroll-linked transforms.
- **Route transition.** No page-level cross-fade; TanStack Router loader states drive skeletons instead.
- **Streaming assistant.** Text chunks arrive with no motion; the last chunk gets a 120ms color fade to indicate finality.

## Marketing storytelling

Storytelling (up to `story` 600ms) is limited to:
- `/how-it-works-deep` StepRail.
- `/pitch` and `/boardroom` slide advance.
- Industry hero cinematic loops (opt-in via `industry-motion.css`).

No storytelling motion inside authenticated product surfaces.

## Reduced motion

Global override in `src/styles/motion.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  [data-reveal] { opacity: 1 !important; transform: none !important; }
}
```

Any new motion primitive MUST work with this override in place — the content must remain fully visible and interactive.

## Enforcement

- Every `transition`/`animation` declaration in `src/**` uses a `--taas-motion-*` duration and a `--taas-ease-*` easing.
- No component-local `keyframes` outside `motion.css` / `industry-motion.css`.
- No `framer-motion` timings that exceed 600ms.
- CI grep contract:

```bash
# Fails if a duration like "duration-350" or "1000ms" is introduced outside motion.css.
rg -n --no-messages 'transition-duration:\s*[0-9]+m?s|animation-duration:\s*[0-9]+m?s' src \
  | rg -v 'styles/motion.css|styles/industry-motion.css'
```

Additions to motion vocabulary go through this document + `motion.css` in the same PR.
