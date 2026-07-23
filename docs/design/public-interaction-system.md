# TaaSFlow V2 — Public Interaction System

**Purpose:** enumerate every interactive pattern allowed on the public website, its purpose, mechanics, desktop/mobile behavior, and accessibility contract. Complements `public-creative-direction.md`.

**Principle:** every interaction must explain something a visitor is trying to understand. Decoration disguised as interaction is rejected.

---

## Approved interactions

### 1. Role-switching Ranking Demo (flagship)

**Question answered:** "Does scoring really change with the role?"

**Mechanic:** three role chips (e.g. *Backend Engineer* · *Product Manager* · *RevOps Lead*). Selecting a chip reorders a list of 5 anonymised candidate cards using a **FLIP** animation. Each card exposes score, top-3 requirement chips, and one evidence quote. Reordering is deterministic, from real seed data.

**Desktop:** horizontal chip rail above a vertical stack of 5 cards; reorder animates at 240ms per card, staggered 40ms.
**Mobile:** chips become a horizontal scrolling rail; cards stack full-width; reorder animates at 180ms with no stagger.
**A11y:** chips are `role="tablist"`, cards live in an `aria-live="polite"` region announcing "Ranking updated for Backend Engineer, top result: [name], score 87." Keyboard: arrow keys switch chips, Enter confirms.
**Reduced motion:** cards reorder instantly; announcement still fires.

---

### 2. Cost Contrast Slider

**Question answered:** "What does the traditional model actually cost me?"

**Mechanic:** two sliders — *roles per year* and *average salary*. Two totals update in real time: "Traditional agency (20–25%)" and "TaaSFlow subscription." Uses the canonical pricing config; never invents numbers.

**Desktop:** two sliders side-by-side, two totals below in matched typography, delta chip on the right.
**Mobile:** sliders stack vertically; totals become a two-row card; delta chip sits on top.
**A11y:** sliders use native `<input type="range">` with visible labels and value displays. Totals are `aria-live="polite"`.
**Reduced motion:** number changes are instant (no count-up).

---

### 3. Sourcing→Delivery Timeline Scrubber

**Question answered:** "How fast do I actually get a shortlist?"

**Mechanic:** horizontal timeline from Day 0 to Day 14. A draggable indicator scrubs through named milestones (Intake locked · Sourcing wave 1 · Evidence extracted · Shortlist ready). Below the timeline, a caption changes to describe what happens at that day.

**Desktop:** horizontal rail, draggable handle, milestone dots that snap.
**Mobile:** vertical rail on the left edge of a text column; taps advance one milestone; swipe scrubs.
**A11y:** rail is a `role="slider"` with `aria-valuemin/max/now` and text label. Arrow keys move ±1 day, PageUp/Down ±3 days.
**Reduced motion:** snap without transition.

---

### 4. Audience Lane Switcher

**Question answered:** "What's in it for MY role?"

**Mechanic:** four tabs — *Founder* · *HR Lead* · *Enterprise* · *Agency Buyer*. Selecting a tab swaps a three-panel value block: a headline problem, a specific outcome, and a small product primitive relevant to that audience.

**Desktop:** tabs top-left of a wide panel; content crossfades at 240ms.
**Mobile:** tabs collapse to an accordion; only one lane expanded at a time.
**A11y:** Radix Tabs primitive (already in the design system). Full arrow-key navigation, `aria-controls`, `aria-selected` handled.
**Reduced motion:** no crossfade — instant swap.

---

### 5. Requirement Coverage Explorer

**Question answered:** "How is candidate–role coverage decided?"

**Mechanic:** a role's requirement list (5 rows, must-have vs nice-to-have marked). Hovering a requirement highlights the evidence in a sample CV excerpt on the right and updates a coverage bar. Fully keyboard-navigable via arrow keys down the list.

**Desktop:** split view — requirements left, evidence right.
**Mobile:** stacked — tapping a requirement expands the CV excerpt beneath it.
**A11y:** requirements are a `role="listbox"`, evidence panel is `aria-live="polite"`. Signal color never carries meaning alone — every state has an icon and label.
**Reduced motion:** highlight is instant; no easing.

---

### 6. Hiring-Stage Walkthrough

**Question answered:** "Where is my candidate in the process, and what happens at each stage?"

**Mechanic:** the Stage Rail primitive (Sourcing · Shortlist · Interview · Offer · Placement). Clicking a stage reveals a short explanation (≤35w) plus the client and candidate view of that stage side-by-side.

**Desktop:** horizontal rail, stage detail expands below.
**Mobile:** vertical rail, stage detail expands inline as an accordion.
**A11y:** rail exposes `aria-current="step"`; each stage is a button with a descriptive label.
**Reduced motion:** no rail-fill animation; the current stage tick simply appears.

---

### 7. Industry Role Explorer

**Question answered:** "Do you understand the roles in MY industry?"

**Mechanic:** on an industry detail page, a searchable/filterable list of the 6–12 canonical roles for that vertical. Selecting a role reveals the role's must-have requirements and the evidence signals TaaSFlow looks for.

**Desktop:** split — role list left, role detail right.
**Mobile:** list becomes a searchable dropdown; detail renders below.
**A11y:** combobox pattern (Radix), full keyboard support, results announced via `aria-live`.
**Reduced motion:** no transitions on detail swap.

---

### 8. Dashboard Annotation Tour

**Question answered:** "What do clients actually see day-to-day?"

**Mechanic:** a real HTML rendering of the client dashboard's key surfaces (Kanban board, candidate card, evidence panel) with **numbered annotation pins**. Clicking a pin reveals a caption and dims the rest of the surface.

**Desktop:** full-width annotated composition, pins visible.
**Mobile:** the surface becomes a horizontal scrollable canvas; pins convert to a vertical list beneath, tapping a list item scrolls the canvas to the pin.
**A11y:** pins are buttons with descriptive `aria-label`s. Captions render in an `aria-live` region.
**Reduced motion:** dimming becomes instant.

---

## Cross-cutting interaction rules

- **No autoplay.** Every interaction requires an explicit user action to start.
- **State is URL-addressable where it matters** — role switcher, industry filter, and stage walkthrough push shallow query params so states are shareable.
- **Progressive enhancement.** With JS disabled, every interaction reveals its underlying content (all states rendered, JS hides the inactive ones). No blank areas.
- **One flagship interaction per section.** Never stack a slider, a tabset, and a scrubber in the same viewport.
- **Interaction latency budget:** first paint of state change ≤ 100ms; visual completion ≤ 300ms.

---

## Rejected interaction patterns

| Pattern | Why rejected |
|---|---|
| Rotating hero carousel | Hides content, users don't wait |
| Autoplay video with sound | Hostile, breaks screen readers |
| Cursor-following blobs / spotlight | Purely decorative, distracts |
| Scroll-hijacking / scroll-jacking | Breaks reading rhythm and accessibility |
| Excessive parallax layers | Slows reading, wrong register for premium |
| Constant animated gradient meshes | Generic AI-landing signature |
| Text scramble / typewriter on load | Delays comprehension |
| "Magnetic" buttons | Decoration disguised as feedback |
| Full-page transitions on route change | Adds latency, hides content |
| Chat bubble that opens automatically | Interrupts, feels like a lead-cap SaaS |
| Cookie banners that block scroll | Hostile |
| Infinite scrolling on marketing pages | Hides footer and CTAs |

---

## Motion + interaction budget per page

- ≤ 1 flagship interaction
- ≤ 2 secondary interactions (tabs, accordions, coverage explorer)
- ≤ 1 dark band
- ≤ 3 scroll-reveal moments
- 0 decorative-only motion

---

## Accessibility rules for interactions

- Focus visible on every interactive control (2px ocean-600 outline, 2px paper offset).
- All interactive visuals operable via keyboard alone; tab order matches visual order.
- Live regions announce state changes; never spam — debounce announcements to ≥500ms.
- Reduced motion honored on every animated transition.
- Target size ≥ 44×44 on mobile, ≥ 32×32 on desktop.
- Never rely on color alone — icon + label for every signal.

---

**Verdict: PASS** — eight approved interactions with clear purpose, desktop/mobile mechanics, and a11y contracts. Twelve rejected patterns explicitly listed. Budget rules prevent stacking.
