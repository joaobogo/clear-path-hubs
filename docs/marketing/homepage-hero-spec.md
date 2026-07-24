# Homepage Hero Spec

**Route:** `src/routes/index.tsx` — `Home()` → first `<section aria-labelledby="home-hero-heading">`.
**Preview component:** `HeroWorkspacePreview` (same file, lines ~662+). Interactive; **fictional sample data only**.
**Motion:** governed by `src/styles/motion.css` + `--taas-motion-*` tokens.

---

## 1. Under-5-second promise

A visitor should leave the hero knowing:

1. **What TaaSFlow is** — an on-demand recruiting function delivered as a system, not a resume forwarding service.
2. **What they get** — a ranked shortlist, evidence per requirement, one live workspace.
3. **What they keep** — the ATS, the candidates, the final call.

The hero copy carries the entire message; no scroll required.

---

## 2. Composition

Two-column grid at `lg:` (`grid-cols-[1.05fr_1fr]`), single column on mobile — text first, then interactive preview.

Left column, top to bottom:

1. **Eyebrow chip** — "The hiring operating system" with Sparkles icon; pill; navy/70; upper case, tracked.
2. **H1** — "Recruiting, run as a system." Fraunces display, `text-4xl → lg:text-[3.5rem]`, tight leading.
3. **Subhead** — "Every role is briefed, sourced, and scored against your rubric in one live workspace. **Recruiters decide. The system carries the context.**" Max 620px.
4. **CTA row** — primary + secondary (see §3).
5. **Tertiary line** — quiet candidate route ("Hiring for a candidate seat? → Browse open jobs").
6. **Proof bullets** — three checkmarks: shortlist within one week · package pricing, no placement fees · you keep the ATS, candidates, final call.

Right column: `<HeroWorkspacePreview>` — fictional candidate list with fit scores, requirement chips, and evidence quotes. Fully interactive (click candidate → panel updates). No live data hits.

---

## 3. CTA hierarchy

| Weight     | Label                | Route     | Style                                        |
|------------|----------------------|-----------|----------------------------------------------|
| Primary    | Start Hiring →       | `/intake` | Filled navy button, `min-h-11`, `ArrowRight` |
| Secondary  | See the Platform     | `/platform` | Outlined navy button, `min-h-11`           |
| Tertiary   | Browse open jobs →   | `/jobs`   | Underline link, ocean color, small text      |

- Primary CTA has an explicit `aria-label="Start hiring — launch a role"` to disambiguate for screen readers.
- Tertiary is a candidate-facing off-ramp; it never competes visually with the primary/secondary pair (smaller font, no button chrome).
- All three go through `<Link to>` (typed routing, preload on intent).

---

## 4. Motion

Governed by `--taas-motion-*` and `--taas-ease-*`:

- Hero text: no entrance animation. Content is fully present on first paint.
- CTA hover: `--taas-motion-instant` color/shadow only. No translate.
- CTA press: `--taas-motion-fast` scale 0.98.
- `HeroWorkspacePreview` state changes: `--taas-motion-base` (`180ms`) cross-fade on candidate switch; requirement chip highlight uses `--taas-motion-slower` (`420ms`) decay.
- Reduced motion: global override in `src/styles/motion.css` collapses to 1ms; preview remains interactive with no transitions.

---

## 5. Data & guardrails

- **No production data.** `HeroWorkspacePreview` is 100% fictional (see `DELIVERY_EVIDENCE` constant array).
- **No pricing numbers, no timing claims beyond "within one week", no totals.** Aligned with the "Copy limits" and "Hero headline ≤10 words" rules in memory.
- **No PII.** Sample candidate names are fictional composites.
- **No fetch calls** in the hero render tree; preview is a stateful client component only.

---

## 6. Responsive checklist

Viewports validated: **320 · 375 · 768 · 1024 · 1440 · 1920**.

| Viewport | Layout                                                              |
|----------|---------------------------------------------------------------------|
| 320      | Single column; H1 40px; CTAs stack; preview scrolls in-card         |
| 375      | Same as 320 with tighter gutters (`px-4`)                           |
| 768      | Single column; H1 48px; CTAs inline; proof bullets wrap             |
| 1024     | Two-column grid activates; preview at ~500px width                  |
| 1440     | Full 1200px container; preview at ~600px width                      |
| 1920     | Container capped at 1200px; equal negative space either side        |

- Horizontal overflow: **0** at every viewport (`min-w-0` + `truncate` on the outer grid children).
- Tap targets: every CTA and every preview control ≥ 44×44 (`min-h-11`).

---

## 7. Accessibility

- Landmark: within `<main id="main">` provided by `<SiteShell>`.
- H1 has `id="home-hero-heading"`; the section uses `aria-labelledby` to reference it.
- Every decorative icon has `aria-hidden`.
- Every interactive control has a visible focus ring (global `--brand-focus-ring`).
- Preview candidate list uses `role="button"` + `aria-pressed` for the selected candidate.
- Reduced motion respected (see §4).

---

## 8. Test report

| Check                                       | Result |
|---------------------------------------------|--------|
| Service understood from hero alone          | PASS — 3 items surfaced above the fold |
| Production-data requests in hero            | 0      |
| Broken hero CTAs                            | 0 (all three routes return 200)         |
| Horizontal overflow at 320                  | 0      |
| Tap targets ≥ 44×44                         | PASS   |
| Reduced-motion behavior                     | PASS (global override) |

**Overall: PASS.**

---

## 9. Change rules

- New copy alternatives go through this doc first; H1 stays ≤ 10 words (memory rule).
- New CTAs replace, do not stack — the primary/secondary/tertiary triad is the ceiling.
- Never introduce a data fetch in the hero. If the preview needs richer content, add to the fictional constant arrays, not the DB.
- Never split the hero across two screens. If content grows, promote to a sub-hero section beneath, not additional hero rows.
