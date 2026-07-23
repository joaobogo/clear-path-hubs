# Mobile Experience Audit — Public Site

**Verdict:** PASS
**Widths tested:** 320, 375, 430, 768 (via Playwright, 13 public routes each)
**Method:** Automated `scrollWidth` vs `clientWidth` sweep + manual review of each interactive section against the requirement list.

## Overflow sweep

| Width | Routes tested | Overflow found |
|-------|--------------|----------------|
| 320   | 13           | 0              |
| 375   | 13           | 0              |
| 430   | 13           | 0              |
| 768   | 13           | 0              |

Routes: `/`, `/pricing`, `/enterprise`, `/how-it-works`, `/industries`, `/industries/technology`, `/resources`, `/faq`, `/jobs`, `/about`, `/contact`, `/case-studies`, `/blog`.

## Fixes applied

1. **`/resources` benchmark grid overflowed** at 320/375/430 (546px in a 375px viewport). Root cause: default `grid` uses `minmax(auto, 1fr)` tracks; child `truncate` line inflated content min-size and pushed the whole card outside the viewport.
   - Fix in `src/routes/resources.tsx`: grid promoted to `grid-cols-[minmax(0,1fr)]` at the mobile track; `<BenchmarkCard>` inner column switched to `min-w-0 flex-1` and the caption dropped `truncate` in favour of natural wrapping (short claim, two lines maximum).

No other overflow, keyboard, or clipping fixes were required to reach PASS.

## Section-by-section review

Legend: ✓ meets rule / — not applicable.

| Section                 | Hover-free | No H-clip | Touch ≥44px | Results near controls | Sticky safe | Notes |
|-------------------------|------------|-----------|-------------|-----------------------|-------------|-------|
| Header                  | ✓          | ✓         | ✓ (44×44 menu button, `min-h-11` rows) | — | ✓ | Radix Sheet full-height, native scroll, accordion groups. |
| Hero                    | ✓          | ✓         | ✓           | ✓                     | — | Workspace preview stacks vertically under `sm:`. |
| Product demonstration   | ✓          | ✓         | ✓           | ✓                     | — | Tab bar re-flows to column at `<sm`. |
| Candidate-delivery panel| ✓          | ✓         | ✓           | ✓                     | — | Ranked list rendered as vertical cards under `md:`; horizontal rail available but optional. |
| ROI calculator          | ✓          | ✓         | ✓           | ✓ (results panel sits directly under sliders on mobile) | — | Sliders use native `<input type="range">`. |
| Model comparison        | ✓          | ✓         | ✓           | ✓ (dimension rail horizontal-scroll, both paths stack vertically on mobile) | — | No mandatory swipe — the *first* dimension is pre-selected and both path cards render immediately. |
| Operating-system flow   | ✓          | ✓         | ✓           | ✓                     | — | 8 stages stack; TaaSFlow vs Client roles shown side-by-side as cards, not table. |
| Workspace tour          | ✓          | ✓         | ✓           | ✓                     | — | Tab strip is a snap rail; active panel renders below. |
| Audience selector       | ✓          | ✓         | ✓           | ✓                     | — | Segmented control wraps under `sm:`. |
| Industry explorer       | ✓          | ✓         | ✓           | ✓                     | — | Category chip rail is scrollable; matching industries render as full-width list below. |
| Resources               | ✓          | ✓ (after fix) | ✓        | ✓                     | — | Insight cards, checklists, benchmarks all single-column at 320. |
| FAQ                     | ✓          | ✓         | ✓ (Radix Accordion) | ✓             | — | Native disclosure, no tooltips. |
| Footer                  | ✓          | ✓         | ✓           | —                     | — | Two-column stack on mobile, one-column at 320. |

### Rule-by-rule verification

- **No hover-only interactions.** All `hover:` classes are decorative colour changes; every interactive control also responds to tap / focus (Radix primitives + `focus-visible` rings).
- **No horizontally clipped interface.** 0 overflows in the automated sweep.
- **No mandatory carousel swiping.** Every horizontal snap rail (`industry-explorer`, `workspace-tour`, `model-comparison`, homepage lanes) shows the *entire* dataset either in a second, wrapping layout or in a vertical stack below the rail — swiping is an accelerator, never the only path.
- **Touch-friendly control sizes.** Header trigger `h-11 w-11`, mobile menu rows `min-h-11`, primary CTAs `py-2.5`+, sliders use native track (44px thumb). Icon-only buttons carry `aria-label`.
- **Results near controls.** ROI calculator: results directly below sliders on mobile. Candidate delivery: evidence panel opens under the selected candidate on mobile, not off to the side. Explorer: match list renders under the search input.
- **No sticky CTA obstruction.** No fixed-bottom CTA bar shipped; only the top header is sticky and it's 64 px with backdrop.
- **Dialogs fit the viewport.** Sheet uses `w-full max-w-sm` on `<sm`. No custom overlays used.
- **Product visuals readable.** Hero preview and workspace tour cards scale via aspect-ratio + `object-cover`; text overlays use tokenised sizes that stay ≥13 px at 320.
- **Tooltips have tap alternatives.** Every tooltip on the public site is decorative (score badges, calculator explainers). Primary explanations appear inline; tooltips are progressive enhancement.
- **Keyboard doesn't cover inputs without recovery.** All input-heavy routes (`/contact`, `/apply`, `/candidate-join`) rely on native `<input>`/`<textarea>` — the browser handles scroll-into-view. No custom overlays trap focus below the fold.

## Non-blocking observations (not required for PASS)

- The homepage stage-metric row (`/` — Operating System stage detail) has a 3-column grid that reflows to 2 columns at 375. Legible at 320 but tight; acceptable.
- Industry chip labels can be long (e.g. "Advanced manufacturing"); they use `truncate` inside the rail and the full label is visible in the results panel. Considered acceptable.

## Repro script

`/tmp/browser/mobile-audit/full.py` — visits all 13 routes at 4 widths and prints any route where `scrollWidth > clientWidth`. Kept for regression use.
