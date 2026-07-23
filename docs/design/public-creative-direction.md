# TaaSFlow V2 — Public Creative Direction

**Status:** Locked direction for public website (marketing surface only).
**Out of scope:** authenticated workspaces, auth, DB, processing — canonical.
**Guardrail alignment:** Premium Experience Guardrails (copy limits, no generic SaaS/AI imagery, progressive disclosure).

---

## 0. Brand positioning translated to design

TaaSFlow is a **premium recruiting operating system** — human-led, technology-supported, transparent, global, precise. The design must read as an **operating system for a service**, not a SaaS product and not an agency brochure.

**Three visual anchors:**

1. **Editorial calm** — generous whitespace, precise typography, restraint over decoration.
2. **Operational clarity** — real product surfaces (score bars, coverage meters, stage rails) treated as first-class visual language, not screenshots-in-frames.
3. **Human evidence** — quotes, named partners, named candidates (anonymised where required), specific numbers — never stock imagery, never faceless "team collaborating" photos.

If a section can't be classified as **editorial**, **operational**, or **human**, it doesn't ship.

---

## 1. Brand color system

Anchored on the existing `--taas-*` token layer (already certified in dashboards). The public surface uses the **same tokens** — no separate marketing palette.

### Primary — Ocean (trust, depth, operational)

| Token | OKLCH | Use |
|---|---|---|
| `--taas-ocean-950` | oklch(0.18 0.05 245) | Section backgrounds (dark bands), footer |
| `--taas-ocean-800` | oklch(0.30 0.09 245) | Primary headings on light, brand marks |
| `--taas-ocean-600` | oklch(0.48 0.14 245) | Primary CTA, active nav, links |
| `--taas-ocean-400` | oklch(0.68 0.11 245) | Hover states, secondary accents |
| `--taas-ocean-100` | oklch(0.94 0.02 245) | Subtle surface tint, hover cards |

### Neutral — Paper (editorial surface)

| Token | OKLCH | Use |
|---|---|---|
| `--taas-paper-50` | oklch(0.99 0.003 90) | Page background (warm off-white) |
| `--taas-paper-100` | oklch(0.97 0.005 90) | Card surface |
| `--taas-paper-200` | oklch(0.93 0.006 90) | Dividers, hairlines |
| `--taas-ink-900` | oklch(0.18 0.01 260) | Body text |
| `--taas-ink-700` | oklch(0.32 0.01 260) | Secondary text |
| `--taas-ink-500` | oklch(0.52 0.01 260) | Meta, captions |

### Signal — Operational status (used only in product visuals)

| Token | Use |
|---|---|
| `--taas-signal-success` | Stage progressed, requirement met, positive delta |
| `--taas-signal-warn` | Partial coverage, pending review |
| `--taas-signal-danger` | Gap, blocked stage, unmet requirement |
| `--taas-signal-info` | Evidence, source citation |

Signal colors **never** appear as decorative accents on marketing copy. They exist to make **operational visuals** legible. This rule is what stops the site from feeling like a generic SaaS dashboard clone.

### Rejected color patterns

- Purple → indigo gradients on white (generic AI startup)
- Neon green / mint accents (startup energy — wrong register)
- Full-bleed animated gradient meshes (AI landing page cliché)
- Multi-color category chips (industry pages must use ONE accent + neutrals)

### Contrast rules

- Body text ≥ 7:1 on paper background (AAA).
- Interactive text ≥ 4.5:1 (AA) minimum; visited/hover never drop contrast.
- Signal colors are always paired with an icon + label — never color alone.

---

## 2. Typography hierarchy

Two families, one purpose each.

**Display / Headline:** `Instrument Serif` — editorial, human, confident. Used only at H1–H2 and hero pull-quotes. Signals "this is a service run by people," not "this is software."

**UI / Body / Product:** `Inter` (variable) — operational, neutral, dense-legible. Used for everything else.

No third family. No decorative script. No monospace outside code blocks in the resources hub.

### Scale (fluid, clamp-based)

| Role | Size (clamp) | Weight | Family | Tracking |
|---|---|---|---|---|
| Display XL (hero) | clamp(2.75rem, 5vw + 1rem, 4.75rem) | 400 | Instrument Serif | -0.02em |
| H1 | clamp(2.25rem, 3.5vw + 1rem, 3.5rem) | 400 | Instrument Serif | -0.02em |
| H2 | clamp(1.75rem, 2vw + 1rem, 2.5rem) | 400 | Instrument Serif | -0.01em |
| H3 | 1.375rem | 600 | Inter | -0.005em |
| Eyebrow | 0.75rem | 600 uppercase | Inter | 0.12em |
| Lead paragraph | 1.125rem | 400 | Inter | 0 |
| Body | 1rem | 400 | Inter | 0 |
| Meta / caption | 0.8125rem | 500 | Inter | 0.01em |
| Product label | 0.75rem | 600 | Inter | 0.06em |

### Copy limits (enforced at design-review, not just copy-review)

Eyebrow ≤5 · Headline ≤10 · Paragraph ≤35 · Card ≤22 · Step ≤18 · FAQ preview ≤45 · CTA ≤4 words.

Any headline that hits 10 words is a design failure — visual weight collapses.

---

## 3. Grid and spacing

**12-column grid**, 1440px max content width, 1200px reading max.
**Gutter:** 32px desktop / 24px tablet / 16px mobile.
**Margin:** 96px desktop / 48px tablet / 20px mobile.

**Vertical rhythm — the 8pt scale:** 4 · 8 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 160.
Section padding uses 96/128/160 only. No arbitrary vertical values.

**Whitespace rule:** every section must have at least one region of "empty" ≥ 25% of its visual area. Editorial calm depends on it.

**Section rhythm pattern:**
- Paper (light) → Paper (light) → Ocean-950 (dark band) → Paper.
Dark bands used sparingly — reserved for either the interactive demo, the process story, or the final CTA. No more than **two** dark bands per page.

---

## 4. Product-visual style

The single most important differentiator. TaaSFlow doesn't show "app screenshots in a laptop mockup." It shows **isolated, oversized, real product primitives** — floating on paper, annotated like an editorial diagram.

### Approved product-visual primitives

1. **Score Card fragment** — one candidate row, 0–100 score bar, three requirement chips, one evidence quote.
2. **Requirement Coverage meter** — 5 requirements, per-requirement bar, "must-have" markers.
3. **Stage Rail** — sourcing → shortlist → interview → offer, current stage annotated.
4. **Evidence Citation block** — quoted CV excerpt with highlight + source line reference.
5. **Delivery Ledger** — timeline of days-to-shortlist, real anonymised numbers.

Every product visual is:
- Rendered as **real HTML/CSS** (not an image), so it stays crisp and inspectable.
- **Annotated** with thin ocean-600 leader lines and small labels — architecture-drawing energy.
- Shown at **1.1×–1.3× normal scale** — treated as artifacts, not decoration.

### Rejected product-visual patterns

- Full dashboard screenshots in tilted 3D laptops.
- "Glassmorphism" cards floating over blurred UI.
- Fake charts with meaningless data.
- Feature grids of 6 identical rounded rectangles with icons.

---

## 5. Illustration style

**No illustrations of people. No isometric offices. No abstract blobs. No AI-generated "diverse team" scenes.**

Illustration on this site means **one of two things only:**

1. **Editorial diagrams** — thin-line, single-weight (1.5px), ocean-800 on paper. Used for the 8-step process, the "traditional vs TaaSFlow" contrast, the scoring rubric explorer. Feels like an engineering notebook, not a Notion doodle.

2. **Photography — humans, not props.** Real named partners, real named team, real workspaces. Warm natural light, editorial framing. Never stock. Never posed handshake. Never laptop-close-up. When we don't have a real photo, we don't use one.

---

## 6. Icon system

**Lucide** exclusively — already in the codebase. 1.5px stroke, 20px default, 24px on CTAs, 16px inline with meta text.

Rules:
- Icons never carry meaning alone — always paired with a text label.
- No filled icons. No duotone. No gradient fills.
- No industry-specific icon per vertical — industries are differentiated by **content and one accent hue**, not by icon.
- Signal icons (check, alert, x) are the only ones allowed to take signal color.

---

## 7. Motion system

Motion serves comprehension. If a motion doesn't explain something, it doesn't exist.

### Timing tokens

- `--motion-fast` 120ms — hover, focus, small state
- `--motion-base` 240ms — reveal, expand, tab change
- `--motion-slow` 480ms — orchestrated sequence (process step reveal)
- `--motion-ease` `cubic-bezier(0.22, 1, 0.36, 1)` — standard
- `--motion-ease-in` `cubic-bezier(0.55, 0, 1, 0.45)` — exits only

### Motion patterns approved

- **Scroll-triggered reveal** — 12px upward translate + fade, once, per section. Never re-triggers.
- **Interactive-visual transitions** — e.g. candidate ranking reorders when the user picks a role: 240ms FLIP animation. This is the flagship motion moment.
- **Stage rail progression** — filling bar with tick marks landing on each stage.
- **Number count-up** — only on real numbers, only when in viewport, 800ms max.
- **Hover lift** — cards translate -2px, shadow deepens; no scale, no rotate.

### Motion patterns rejected

- Cursor-following blobs / spotlights.
- Constant animated gradient meshes.
- Parallax on hero imagery.
- Auto-playing carousels (any rotation timer).
- Text scrambling / typewriter effects on load.
- Full-page fade transitions on route change.
- Motion that fires on every scroll.

### Reduced motion

`prefers-reduced-motion: reduce` → all reveal/orchestration motion becomes **instant opacity 0 → 1 with no translate**. Interactive-visual transitions still run but at 60ms, no FLIP — content simply updates. Never disable interactions; only decorative motion.

---

## 8. Interactive patterns

**Interactions must explain something.** Each pattern below is tied to a real question a visitor has.

Full inventory in `public-interaction-system.md`. Summary:

| Pattern | Answers the question |
|---|---|
| **Role-switching ranking demo** | "Does scoring change with the role?" |
| **Cost contrast slider** | "How much does the old model cost me?" |
| **Sourcing→delivery timeline scrubber** | "How fast do I actually get a shortlist?" |
| **Audience lane switcher** | "What's in it for MY role?" |
| **Requirement coverage explorer** | "How is coverage decided?" |
| **Hiring-stage walkthrough** | "Where is my candidate in the process?" |
| **Industry role explorer** | "Do you understand MY industry's roles?" |
| **Dashboard annotation tour** | "What do clients actually see day-to-day?" |

Every interaction is **keyboard-operable, reduced-motion-safe, and progressively enhanced** — the underlying content is readable without JS.

---

## 9. Card anatomy

Cards exist. Feature-grid-of-six-identical-cards does not.

### Card variants (only three)

1. **Editorial card** — used in resources, industry preview.
   - Portrait or 4:3 unique image · eyebrow · headline (≤10w) · one-line dek · meta row.
   - No CTA on the card; the whole card is the link.

2. **Operational card** — used in features, "what you get."
   - Left-accent 3px ocean-600 rule · eyebrow · headline · ≤22w body · one product-primitive fragment inline.
   - Never has an icon-in-a-tinted-square in the top-left. That's the SaaS template signature we're rejecting.

3. **Human card** — used in testimonials, team.
   - Portrait 4:5 · name · role · one-sentence quote (≤35w) · company mark.
   - Photo is unique per card; company mark uses `mix-blend: multiply` on paper for a muted, editorial feel.

### Card rules

- Minimum card height varies by content — **no forced equal-height grids** except in a single row of identical-purpose cards.
- Radius: 12px (paper) / 16px (elevated) / 0px (editorial photo cards).
- Shadow: `0 1px 2px oklch(0.2 0.02 260 / 0.06), 0 8px 24px oklch(0.2 0.02 260 / 0.04)` — barely-there.

Full spec in `public-component-language.md`.

---

## 10. CTA hierarchy

Three levels, no more.

| Level | Style | Use |
|---|---|---|
| **Primary** | Solid ocean-600, paper text, 12px radius, 44px min-height, ≤4 words | One per section max. Homepage: "Book a call" / "See it work" |
| **Secondary** | Outline ocean-600 on paper, ocean-800 text | Alternate path (Pricing, How it works) |
| **Tertiary** | Text link with animated underline (translateY 0→100% on hover, 120ms) | In-body links, "Read more", footer |

**CTA copy library (locked):**
- Book a call · See it work · Get started · View pricing · Read the story · Explore industries · Compare models · Try the demo · Talk to us

Anything longer than 4 words is rejected at review.

---

## 11. Mobile behavior

Mobile is not "desktop scaled down." It's the primary editorial reading surface.

- **Type scale:** display XL caps at 2.75rem on <640px; hero paragraph 1rem, not 1.125rem.
- **Grid:** single column, 20px margin. Two-up card rows only on ≥768px.
- **Nav:** sheet drawer with accordion sections (already built) — pinned CTAs at bottom of the sheet.
- **Interactive visuals adapt, not shrink:**
  - Role-switching ranking → horizontal chip scroll for roles, ranked list stays vertical.
  - Cost slider → vertical slider with the two totals stacked, not side-by-side.
  - Stage rail → vertical rail with connectors on the left edge.
- **Sticky elements:** only the header (auto-hide on scroll down, reveal on scroll up). No sticky CTAs, no chat bubbles, no cookie bar clones.
- **Tap targets:** 44×44 minimum, 48×48 preferred for primary CTAs.
- **Reveal motion:** halved distance (6px translate) on mobile, honoring reduced motion.

---

## 12. Accessibility behavior

Baseline is **WCAG 2.2 AA**; we aim for AAA on body text contrast and target size.

- **Contrast:** body ≥ 7:1, UI ≥ 4.5:1, focus ring ≥ 3:1 against adjacent surface.
- **Focus ring:** 2px ocean-600 outline + 2px paper offset — visible on every surface, never removed.
- **Keyboard:** every interactive surface reachable in DOM order. All interactive visuals (ranking demo, cost slider, stage rail) operable with arrow keys + Enter/Space. No keyboard traps.
- **Screen readers:**
  - Interactive visuals expose current state via `aria-live="polite"` region.
  - Icon-only buttons have `aria-label`.
  - Decorative product primitives use `role="img"` with a concise `aria-label` describing the state shown.
- **Motion:** `prefers-reduced-motion` disables all decorative motion; content-update motion becomes instant.
- **Zoom:** layout survives to 200% zoom without horizontal scroll on 1280px viewports.
- **Language:** `lang="en"` on `<html>`; industry pages that quote non-English terms use inline `lang` attributes.
- **Landmarks:** one `<main>` per route, one `<h1>`, semantic `<nav>`/`<footer>`.

---

## Desktop examples (reference compositions)

- **Homepage hero** — editorial: Instrument Serif display headline left (7 words max), one lead paragraph (≤35w), one primary + one tertiary CTA. Right: a single oversized **Score Card fragment** annotated with three leader lines. No background gradient. No hero image behind text.
- **How it works** — dark ocean-950 band, 8 steps as a horizontal scrubber (desktop) / vertical rail (mobile). Each step has a single editorial diagram, ≤18-word caption, no icons.
- **Industries hub** — magazine grid, 3-up on desktop. Each card carries its unique cover, industry name, one-sentence positioning, and a coverage-meter fragment. Filter chips are text-only, no color per industry.
- **Pricing** — comparison table with the ROI calculator embedded; calculator uses real tokens, not a boxed widget.
- **Final CTA** — dark band, one line of Instrument Serif, one primary CTA. Nothing else.

---

## Mobile adaptations (reference)

- Homepage hero: headline → paragraph → CTA → **product primitive scrolls into view as a full-width card below the fold**. Never squeeze the primitive next to text.
- Process rail becomes a vertical timeline with sticky current-step indicator.
- Industry hub: single-column feed with 4:5 cover images, filter chips in a horizontal scroll rail (with fade edges).
- Pricing: tier cards stack; ROI calculator inputs stack vertically; result panel becomes sticky at bottom while the user adjusts inputs.

---

## Accessibility rules (canonical checklist)

- [ ] Every interactive visual reachable and operable via keyboard alone.
- [ ] Every icon-only control has `aria-label`.
- [ ] Every decorative image uses `alt=""`; every content image has a descriptive alt.
- [ ] `prefers-reduced-motion` honored on all motion tokens.
- [ ] One `<main>`, one `<h1>` per route; heading levels never skip.
- [ ] Focus ring visible on every surface, never `outline: none` without a replacement.
- [ ] Signal color never carries meaning alone — icon + label always present.
- [ ] Layout survives 200% browser zoom with no horizontal scroll.
- [ ] All copy respects the copy-limit contract.

---

**Verdict: PASS** — creative direction defined across all 12 axes, interaction principles enforced, rejected patterns explicitly listed. Ready to drive component build in the next scoped prompt.
