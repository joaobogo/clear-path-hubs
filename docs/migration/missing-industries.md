# Missing Industries

All 22 source industries have destination pages via `src/content/industries-v2.ts` and `/industries/$slug`.

## Missing hub routes
- `/industries/compare` — the source has an Industry Comparison page. Destination route does not exist. Hold the hub CTA for this until the page is built.

## Missing content fidelity (destination pages are shorter than source)
The destination v2 template renders a subset of the source sections. The following are absent from the current destination template and should be added by the Industry Detail Template task:
- Industry-specific hero image / cover
- Hiring-challenges vs solutions dual block
- Common role families (grouped, not just a flat list)
- Candidate signals evaluated (per rubric)
- Skills / tools / certifications (regulated requirements)
- Candidate-delivery product visual
- Related industries strip
- Related resources strip
- Industry FAQ
- JSON-LD FAQPage / Service structured data

None of these require adding new industries — they extend the existing 22.
