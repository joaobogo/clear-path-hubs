# TaaSFlow V2 — Public Component Language

**Purpose:** define the vocabulary of components that build every public surface. Every component below maps to a token, an anatomy, a variant set, and an accessibility contract. Nothing outside this vocabulary ships on the public site.

Complements `public-creative-direction.md` and `public-interaction-system.md`.

---

## 1. Layout primitives

### `Section`
Vertical band. Padding: 96 / 128 / 160px. Variants: `paper` (default), `paper-tint`, `ocean-950` (dark). Max 2 `ocean-950` per page.

### `Container`
Max-width 1200px reading / 1440px canvas. Horizontal margin: 96 / 48 / 20.

### `Grid`
12 columns · gutter 32/24/16 · `min-w-0` on every text cell · `shrink-0` on fixed cells (per responsive rules).

### `Stack` / `Cluster`
Vertical / horizontal spacing utility built on the 8pt scale. No arbitrary gap values.

---

## 2. Typography components

### `Eyebrow`
Uppercase Inter 12/600, tracking 0.12em, ocean-600. ≤5 words. Always paired with a heading below it.

### `Display`
Instrument Serif, clamp scale, tracking -0.02em. ≤10 words. One per section max.

### `Lead`
Inter 18/400, ink-900. ≤35 words.

### `Body`
Inter 16/400, ink-900. Line-length capped at 68ch.

### `Meta`
Inter 13/500, ink-500. Used for dates, labels, source lines.

---

## 3. Card variants (three only)

### `EditorialCard`
Portrait or 4:3 unique image · eyebrow · headline · one-line dek · meta row. Whole card is a link. Radius 0 for photo, 12 for footer meta panel. No hover scale — only shadow deepen.

### `OperationalCard`
Left 3px ocean-600 rule · eyebrow · headline · body ≤22w · one inline product primitive fragment. **No icon-in-tinted-square.** Radius 12. Hover: -2px translate, shadow deepen.

### `HumanCard`
Portrait 4:5 unique photo · name · role · quote ≤35w · muted company mark. Radius 0. No hover motion.

**Grid rule:** never render four or more identical `OperationalCard`s in a row. If a section calls for four features, use two `OperationalCard`s + one `HumanCard` + one editorial diagram — mixed rhythm.

---

## 4. Product-visual primitives (real HTML/CSS, not images)

### `ScoreCardFragment`
Candidate row: photo optional (anonymised silhouette allowed) · name masked · role · score bar (0–100) with tick marks · 3 requirement chips · 1 evidence quote (italic, ≤20w).
Used in: hero, ranking demo, industry pages.

### `RequirementCoverageMeter`
Vertical list of 5 requirements · per-requirement bar with must-have marker · overall coverage % on the right.
Used in: How it works, requirement explorer.

### `StageRail`
Horizontal (desktop) / vertical (mobile) rail of 5 stages · current stage annotated with `aria-current="step"` · thin ocean-800 connectors.

### `EvidenceCitationBlock`
Quoted CV excerpt with the matching phrase highlighted (ocean-100 background) · source line reference in meta type below.

### `DeliveryLedger`
Timeline of anonymised, real delivery numbers. Each row: date · role · days-to-shortlist · outcome tag.

**All primitives are annotatable** — a thin ocean-600 leader line + small label caption. Annotations feel like an architectural drawing, not a tooltip.

---

## 5. Controls

### `Button`
Three variants (Primary/Secondary/Tertiary) as defined in creative direction. Icon slot on the right only. Minimum 44px height, 16px horizontal padding. Focus ring 2px ocean-600 + 2px paper offset.

### `Chip`
Text-only pill. Ocean-800 on paper-100 (inactive) / paper on ocean-600 (active). 32px height. Used for role filters, industry filters, stage tabs.

### `Slider`
Native `<input type="range">` with custom track. Ocean-600 fill, paper-200 track, 24×24 handle with 2px ocean-800 border. Full keyboard support built-in.

### `Tabs`
Radix Tabs. Underline indicator (2px ocean-600, animated 240ms). No filled backgrounds on tab triggers.

### `Accordion`
Radix Accordion. Trigger row: headline + chevron. Content: paper-tint background, 24px padding, 240ms expand.

### `Combobox`
Radix + cmdk. Used for industry search, role explorer.

### `Dialog` / `Sheet`
Radix Dialog / Sheet. Sheet used for mobile nav only. Dialogs never auto-open.

---

## 6. Navigation components

### `SiteHeader`
Sticky top, auto-hide on scroll down / reveal on scroll up. Height 64px desktop / 56px mobile. Contains: brand mark · primary nav (NavigationMenu with dropdowns) · primary CTA · mobile menu trigger.

### `SiteFooter`
Five columns desktop (Company · Industries · Candidates · Resources · Legal). Single column mobile with accordion sections.

### `Breadcrumb`
Used on Industry detail, Resources detail, Legal. Meta-type, chevron separators.

### `TableOfContents`
Sticky right column on long-form (resources articles, legal). Hash anchors ARE allowed here — this is the only surface where they're the primary nav.

---

## 7. Data-visualization components

### `RankingList`
Ordered list of ScoreCardFragments. Supports FLIP reordering (see interaction 1).

### `ComparisonTable`
Traditional vs TaaSFlow. Two columns of paired rows. Signal icons + labels for every ✓/✗ — never color alone.

### `CoverageBar` / `ScoreBar`
Horizontal bar with tick marks. Never renders below 8px height. ARIA `role="progressbar"` with valuemin/max/now.

### `Timeline`
Horizontal scrubber (desktop) / vertical stack (mobile). Used for the sourcing→delivery scrubber.

---

## 8. Media components

### `Photo`
Wraps `<img>` in `aspect-*` container. Unique per usage (see rule: no photo repeats across blog posts and product visuals). Default `loading="lazy"`, explicit `width`/`height`, `decoding="async"`.

### `Diagram`
Inline SVG editorial diagram. 1.5px stroke, ocean-800 on paper. `role="img"` with descriptive `aria-label`. Never uses fill — line only.

### `AnnotationLayer`
Overlays a product-visual primitive with numbered pins and captions. Used in the Dashboard Annotation Tour.

---

## 9. Feedback components

### `EmptyState`
Only used inside interactive demos when a filter returns nothing. One line of Instrument Serif + reset action.

### `Toast` / `Banner`
Not used on the public site. Marketing pages never surface toasts.

### `FocusRing`
Global style — 2px ocean-600 outline + 2px paper offset. Applied via `:focus-visible`. Never removed.

---

## 10. Composition patterns (page-level)

### `Hero`
Editorial split: display headline + lead + one primary CTA on the left; one oversized annotated product primitive on the right. No background image, no gradient, no floating shapes.

### `AudienceLanes`
Tabs (interaction 4) over a three-panel content block. One flagship primitive per lane.

### `ProcessBand`
Ocean-950 dark band. 8-step scrubber (desktop) / vertical rail (mobile). Editorial diagrams only, no icons.

### `IndustriesPreview`
Magazine grid, 3-up desktop / 1-up mobile. EditorialCards with unique covers.

### `Proof`
HumanCards (quotes) mixed with DeliveryLedger. Never a logo cloud alone.

### `ROIStrip`
Cost Contrast Slider (interaction 2) embedded in a paper section.

### `FAQ`
Radix Accordion, 8 questions max, ≤45w preview, ≤120w answer.

### `FinalCTA`
Ocean-950 dark band, one line of Instrument Serif, one primary CTA. Nothing else.

---

## 11. Component tokens (naming contract)

All components consume `--taas-*` tokens exclusively. No hardcoded Tailwind color utilities (`text-white`, `bg-black`, `bg-slate-*`) in public components. Enforced at review.

Utility aliases:
- `bg-surface-paper` → `--taas-paper-50`
- `bg-surface-paper-tint` → `--taas-paper-100`
- `bg-surface-ocean` → `--taas-ocean-950`
- `text-ink` → `--taas-ink-900`
- `text-ink-muted` → `--taas-ink-700`
- `text-brand` → `--taas-ocean-600`
- `border-hairline` → `--taas-paper-200`

---

## 12. Accessibility contract per component

Every component ships with:

1. Semantic HTML (`<button>`, `<a>`, `<nav>`, `<section>`, `<ul>`, not `<div onClick>`).
2. Keyboard support matching the WAI-ARIA authoring practice for that pattern.
3. Focus ring never removed without a replacement of equal or greater visibility.
4. `aria-label` on every icon-only control.
5. Live region for state-changing interactive components.
6. Reduced-motion variant.
7. 200% zoom survival on the reference component canvas.

---

## Component inventory summary

**Layout:** Section · Container · Grid · Stack
**Typography:** Eyebrow · Display · Lead · Body · Meta
**Cards:** EditorialCard · OperationalCard · HumanCard
**Product visuals:** ScoreCardFragment · RequirementCoverageMeter · StageRail · EvidenceCitationBlock · DeliveryLedger
**Controls:** Button · Chip · Slider · Tabs · Accordion · Combobox · Dialog · Sheet
**Navigation:** SiteHeader · SiteFooter · Breadcrumb · TableOfContents
**Data-viz:** RankingList · ComparisonTable · CoverageBar · Timeline
**Media:** Photo · Diagram · AnnotationLayer
**Feedback:** EmptyState · FocusRing
**Compositions:** Hero · AudienceLanes · ProcessBand · IndustriesPreview · Proof · ROIStrip · FAQ · FinalCTA

Anything outside this list requires an explicit exception before shipping.

---

**Verdict: PASS** — component vocabulary complete, mapped to tokens, anatomy defined, a11y contract set. Ready to drive Hero / How-it-works / Industries builds in subsequent prompts.
