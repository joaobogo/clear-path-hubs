# Industry Pages — Certification Report (Prompts 37–40)

**Status:** ✅ PASS — 57/57 industries certified.

## Prompt 37 — Related-Link Web
Every industry page now links to:
- **4 related industries** via `getIndustryRelationships()` — same-category first, then adjacent categories, with a global fallback that guarantees zero orphans.
- **One commercial anchor** — `/pricing`.
- **One audience anchor** — resolved per category (`/solutions`, `/enterprise`, or `/staffing-partnership`).
- **Start Hiring** — `/intake` (always rendered as the emphasised card).

Rendered in `src/components/marketing/industry-template.tsx` — sections *"Related industries"* and *"Industry link web"*.

## Prompt 38 — Resource Mapping
Every industry surfaces **5 resources** via `pickResources()`:
- **2 hiring guides** — prefers industry-specific blog posts (topics `hiring-benchmarks-2026`, `top-roles-compensation-2026`); falls back to curated category guides.
- **1 commercial explainer** — `/pricing` tiers.
- **1 process explainer** — `/how-it-works`.
- **1 category-relevant article** — prefers industry-specific `emerging-skills-shift-2026` / `workforce-outlook-2026` / `retention-culture-playbook`; falls back to category perspective posts.

## Prompt 39 — Motion System
Allowed motion in use:
- Hero reveal — `taas-reveal-up` on hero image.
- Role/signal switching — Role Explorer + Signal Explorer (existing).
- Related-industry transition — staggered `fade-in` with `hover:-translate-y-0.5` on related and resource cards.
- Process progression — animated on scroll (existing keyframes).

Explicitly avoided: no floating loops, no parallax, no cursor gimmicks, no blocking animations. All motion is `motion-safe:` gated for `prefers-reduced-motion`.

## Prompt 40 — QA Certification
`scripts/certify-industries.mjs` checks every visible industry for:
- unique slug, hero title, summary
- meta title + description
- cta title + description
- roles or role families
- candidate signals (with `signals[]` fallback for domain-derived rubrics)
- challenges

Run with `bunx tsx scripts/certify-industries.mjs`.

```
Total industries: 57
Passed: 57
Failed: 0
```

Role explorer, signal explorer, hero images, and mobile focal points remain
identical to the certified baseline established in Prompt 36.
