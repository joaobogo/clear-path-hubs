# Homepage Content Map — TaaSFlow V2

Route: `/` · File: `src/routes/index.tsx` · Shell: `SiteShell`

## Section order (11)
1. **Hero** — headline, workspace preview mock, primary + secondary CTA.
2. **Dashboard-first value** — "The workspace is the product" · 4 pillars.
3. **How it works** — 4 numbered steps (intake → sourcing → shortlist → hire).
4. **Candidate delivery & ranking** — profile card with evidence bars + CV quote.
5. **Transparency & live pipeline** — live activity feed + benefits list.
6. **Admin / Client / Candidate workspaces** — 3 workspace cards.
7. **Speed & predictable recruiting** — 3 value cards.
8. **Enterprise & global reach** — 2 cards linking `/enterprise` and `/global-talent`.
9. **Industry coverage** — 8 industry chips + "All industries".
10. **Proof / customer outcomes** — 3 testimonial cards (role-anonymized).
11. **Final CTA** — dark navy panel, "Start hiring" + "Browse open jobs".

## Content preserved (from legacy homepage)
- "Talent as a Service" eyebrow.
- "One live workspace / Ranked candidate delivery / Evidence per requirement / Transparent status" pillars.
- 4-step process narrative (intake → sourcing → shortlist → hire).
- Industry chip taxonomy (SaaS, Finance, Healthcare, Consulting, Accounting, Tech, Private Equity, Legal).
- Enterprise-ready and global-reach cards.

## Content rewritten
- Hero: replaced `"Ranked candidates in 14 days"` → `"Ranked candidates. No black box."` (qualitative).
- Removed `"14 days / 20,000+ / 50+ countries / 0% placement fees"` KPI band.
- Removed `"Agencies take 6–10 weeks"` comparison.
- Removed proof band `"80+ · 20,000+ · 50+"` numeric tiles → 3 anonymized testimonial cards.
- Speed section: `"6–10 weeks"` → `"days, not months"` and `"budget with confidence"`.
- Final CTA: `"Start hiring without the placement fee"` → `"Bring your next hire into the workspace"`.

## Claims removed or flagged
| Claim | Status |
|---|---|
| "14 days to first shortlist" | REMOVED — flagged in `content-claim-checklist.json` |
| "0% placement fees" | REMOVED from hero; softened to "no per-hire placement commissions" in Speed |
| "50+ countries" | REMOVED |
| "20,000+ candidates placed" | REMOVED |
| "80+ companies served" | REMOVED |
| "Agencies take 6–10 weeks" | REMOVED |
| "40% component debt reduction" quote | Prefixed with `~` and attributed to CV, page 2 (illustrative, marked as sample) |

## Content rules compliance
- ✅ No unverified numerical claims (all removed or explicitly illustrative).
- ✅ No vague AI language.
- ✅ One primary CTA per section (Start hiring in hero + final; deep-link CTAs elsewhere are secondary).
- ✅ Mobile hierarchy — hero stacks; workspace mock renders full-width below headline (verified 390px).
- ✅ Accessible contrast — navy on paper, ocean accents, min-h-11 CTAs, focus-visible rings.
- ✅ Dashboard visuals readable — `min-w-0`, truncate on names, tabular-nums for scores.
