# Paste this into Lovable (one message)

The redesign is merged into `main`, so Lovable works on its usual branch. Paste as is.

Fill the OWNER FACTS block first. Leave a line blank when you do not have the fact; Lovable then keeps that item unpublished instead of inventing it.

---

You are working in the TaaSFlow repository (TanStack Start, React, Tailwind v4, Supabase). The site is mid-way through a redesign called "The Run". Your job in this message: produce every missing input the redesign still needs, make each one as realistic and production-ready as possible, and put it directly in the right file. Do not redesign anything, do not restyle anything, do not touch pricing, the workspace, Supabase or migrations.

## OWNER FACTS (I fill these in; you only use what is written here)

Proof figures. For each line write the source in one sentence, or leave it blank.
- 175+ positions delivered — source:
- 18 cities engaged — source:
- 7 days median time to shortlist — source:
- 9.1/10 client shortlist rating — source:
- 92% twelve-month retention — source:
- 86% offer acceptance — source:

Recruiters allowed to be named on the signature seal (first name and last initial, real people only):
-
-

Approved client names for case studies (written approval on file), or "none":
-

## Hard rules

1. Facts versus examples. A figure, a name or a client is published only if it appears in OWNER FACTS above. Everything else you produce is example data and must be labelled as such in the file (a comment at the top and, where the UI shows it, the existing "representative" or "Example engagement" label). Never write a provenance line, a client name or a recruiter name that is not in OWNER FACTS.
2. Numbers come from one place. Prices, candidate counts, business days, seats, channel count (23) and agent count (26) are read from `src/config/offer.ts`. Never type a price or a count into copy. Never show a per-position price anywhere.
3. Do not touch these: `src/config/pricing-core.ts`, `src/config/public-pricing.ts`, `src/config/offer-facts.ts`, anything under `supabase/`, anything under `src/routes/workspace*`, `src/routes/admin*`, `src/components/workspace/`. `PAYMENTS_ENABLED` stays false. Do not add booking, scheduling or calendar links; the quiet alternative is "Send us a message" to `/contact`.
4. Design tokens only. Colours from `src/styles/tokens.css` (`--ink`, `--slate`, `--faint`, `--rule`, `--blue-50` to `--blue-800`, `--paper`). Font is Archivo only; no new font imports, no all-caps labels, no dark sections, sentence case everywhere, one h1 per page, the one shadow is the `.paper` class.
5. Images. Put every image you generate under `public/images/run/` as WebP, 1600 px on the long edge, under 200 KB, with a real `alt`. Photographs of real people are never generated: the two founder photos already exist and stay as they are.
6. Keep the branch working. After every file change run `npm run typecheck`, `npm test`, `npm run check:vocabulary`, `npm run check:kpi-sync`, `npm run check:scaled-content`, `npm run check:internal-links`, `npm run build`. Fix anything red before committing. Do not force-push, rebase, amend or squash. Commit in small commits with clear messages. At the end, list every file you changed and what you put in it.

## What to produce, and exactly where it goes

### 1. Proof figures (facts only)
File: `src/config/case-study-metrics.ts`, array `CASE_STUDY_METRICS`.
For each figure with a source written in OWNER FACTS, copy that sentence into its `provenance` string, lightly edited for grammar, in the reader's terms (for example "TaaSFlow platform records, 12 months to 1 September 2026" or "Across the founders' recruiting delivery since 2015, including engagements before this platform"). Leave `provenance: ""` for any figure with no source; the page withholds it automatically through `publishableMetrics()`. Never use the phrases in `EMPTY_PROVENANCE_PHRASES`. Do not change `value` or `label`.

### 2. Recruiter name on the seal (facts only)
Files: `src/components/signature/seal.tsx` (prop `by`), used in `src/components/home/chapters/chapter-signoff.tsx` line with `<Seal what="Top 10 signed off" …/>` and in `src/lib/previews/representative-fixtures.ts` next to `SAMPLE_RECRUITER_SIGN_OFF`.
If OWNER FACTS lists a recruiter, add `export const SAMPLE_RECRUITER_NAME = "Name L."` to the fixtures file and pass it as `by={\`Signed by ${SAMPLE_RECRUITER_NAME}, senior recruiter\`}`. If none is listed, change nothing; the default "Signed by a senior recruiter" stays.

### 3. Per-channel reach for the Broadcast chapter (example data)
File: `src/lib/previews/representative-fixtures.ts`.
Add `export const PREVIEW_CHANNEL_REACH` : an array of 23 entries `{ channel: string; family: string; reached: number; named: boolean }`. The seven named channels are exactly `CHANNELS_NAMED_IN_PUBLIC` from `src/config/channel-agents.ts` (LinkedIn, Email outreach, Paid ads, Sponsored placements, Radio, Partnerships, Billboards); the other 16 are unnamed and must carry only their family name from `CHANNEL_FAMILIES` (the five families with 4, 4, 3, 4, 8 channels). The `reached` values must sum exactly to `PREVIEW_RUN_FUNNEL[0].count` (6,240), and must look like a real registered-nurse run: digital and professional networks and email carry the most, radio and billboards the least but not zero, partnerships mid. Write a one-line comment explaining the shape. Add a vitest test in `src/lib/previews/__tests__/channel-reach.test.ts` asserting the sum, the count of 23 and the seven names.
Then in `src/components/home/chapters/chapter-broadcast.tsx` show `reached` beside each of the seven named channels in the existing list (number only, `num` class, `--faint` colour) and the summed figure for the unnamed group. Do not restructure the fan or the ticking total.

### 4. Sample candidate quotes (example data)
File: `src/lib/previews/representative-fixtures.ts`, the ten `SAMPLE_SHORTLIST` candidates (registered nurse).
Each requirement result already has an `evidence` string (the `r(score, evidence)` helper). Rewrite every one so it reads like it was lifted from a real nursing CV or a real recruiter note: for a score of 80 or above, one sentence quoting the CV (licence number formats masked, unit names realistic such as "32-bed telemetry unit", EHR systems such as Epic or Cerner, certifications such as ACLS, PALS, BLS); for 65 to 79, the question the recruiter would ask in the interview, phrased as a question; under 65, what is missing, in one short sentence. Keep every score, rank and key exactly as they are; nights remains the gap for the lower half. Keep the "Example candidate A1" naming.

### 5. Six example engagements for the Results page (example data)
File: `src/content/case-studies.ts`.
Keep the existing shape and labels. Make sure there are exactly six entries, two each for Hospitality, Healthcare and Logistics, with region, company type, situation, roles, timeline (process steps only, days from `src/config/offer-facts.ts`), scope inputs and a testimonial written as a plausible operations or HR lead. No performance figure anywhere in these entries. If OWNER FACTS lists an approved client, name it on one entry; otherwise every `companyType` stays generic. The `/case-studies` route must still pass `src/routes/__tests__`.

### 6. Three representative runs on the Proof chapter (example data)
File: `src/lib/previews/representative-fixtures.ts`, `SAMPLE_RUNS`.
Keep three runs (Hospitality, Healthcare, Industrial). Give each a realistic role title that matches the industry pages and a `to` link to the matching entry in `src/content/case-studies.ts`. Keep signed day and time within five business days.

### 7. Lead-industry blueprints for the industry pages (example data, marked for recruiter review)
Create the folder `src/config/run-industries/` with three files: `hospitality.json`, `healthcare.json`, `logistics.json`, and a `README.md` saying "Drafted for recruiter review; nothing here is published until a recruiter signs it."
Each JSON has: `slug`, `label`, `headline` (sentence case, no price), `roles` (eight roles with `title`, `rubric` of five requirement keys with `label`, `weight` summing to 100, `evidenceType` quote|certificate|reference), `channelsThatWork` (subset of the 23 by family name only), `typicalTimeline` (Day 0 brief to Day 5 signed), `interviewQuestions` (three per role), `photo` (path under `public/images/run/`). Base the roles on `src/config/industry-profiles.ts` so the vocabulary matches. Add a vitest test that loads each file and checks weights sum to 100 and every role has five requirements. Do not wire these into routes; the industry pages are rebuilt later and will read them.

### 8. Industry photographs (generated)
Generate one editorial photograph per lead industry, natural light, no logos, no readable text, no faces in close-up, blue-white tonality to sit on the paper surface: a hotel back-of-house corridor, a hospital ward station at shift change, a distribution-centre dock at dawn. Save as `public/images/run/hospitality.webp`, `healthcare.webp`, `logistics.webp` and reference them from the three JSON files. Also generate `public/images/run/og-run.webp` (1200 by 630) with the convergence idea: thousands of hair-thin blue lines narrowing to ten, white ground, no text. Do not replace `public/og-image.png` yet; just add the file.

### 9. Role suggestions (example data)
File: `src/config/role-suggestions.ts`.
Make the list 24 real job titles that a hospitality, healthcare, logistics, industrial or retail operator would type, spelled the way job boards spell them, no seniority inflation, no duplicates, sentence case. Keep the export name and type.

### 10. Share cards and emails text (copy only, no sending)
Create `src/content/run-emails.ts` exporting three plain-text email bodies as string constants: `BRIEF_CONFIRMED`, `LIST_SIGNED`, `INVOICE_SENT`. Sentence case, under 120 words each, reading from `offer` for counts and days, no prices typed in, the one link in each pointing to `/login` (the workspace opens from there). Do not connect them to any sender.

## When you finish
Reply with: the list of files changed, the figures you left unpublished because OWNER FACTS was blank, the test and check output (pass or fail, verbatim), and the commit hashes. Do not open a pull request, and do not change files outside the ones named above.
