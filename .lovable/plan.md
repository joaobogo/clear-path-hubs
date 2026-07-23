# Plan: Intake Wiring + 304-Blog Content Build

## Part A — Intake wiring (small, ship first)

1. Extend `intakePayloadSchema` in `src/lib/intake-schema.ts` with the new optional fields the UI collects:
   - `experience`, `education`, `certifications`, `languages`
   - `hiringTimeline`, `reasonForHiring`
   - `workAuth`, `timezone`, `targetCountries[]`, `targetTitles[]`, `screeningQuestions[]`
   - `hiringChallenges`, `interviewProcess`, `decisionMakers`
2. Update `src/routes/intake.tsx` submit payload to forward all fields (not just the current subset).
3. Persist to `intake_submissions.payload` (already jsonb — no migration). Position-hydration logic in `src/lib/intake.functions.ts` reads `roleTitle`, `workModel`, `jd` — unchanged.
4. Verify: submit a test intake, confirm row lands in `intake_submissions` with the full payload.

## Part B — 304 blog posts (long-form + unique images)

**Reality check on scope.** 304 posts × ~2,000 words + 304 images is a very large generation job:
- Text: ~304 Gemini 3.5-Flash calls (cheap, fast — likely <15 min wall-time in parallel batches).
- Images: 304 Nano Banana 2 Lite generations (~$0.02 each ≈ $6 raw, but through credits it's ~30–60 credits total; wall-time 30–60 min).

I will run this via **offline scripts** (`code--exec` with the ai-gateway skill), not through the app — much faster and cheaper than doing it inside a server function per post.

### B1. Content architecture (one-time)
- Build `scripts/blog/manifest.ts`: for each of 304 slugs, derive `{ slug, title, category, industry?, primaryKeyword, uniqueAngle }` from the slug. The `uniqueAngle` is what prevents 304 posts from sounding identical.
- Build `scripts/blog/generate-post.ts`: calls Gemini 3.5-Flash with a strict system prompt enforcing Premium Guardrails:
  - Human voice, no "In today's fast-paced world…", no em-dash tics, no "unlock/leverage/robust"
  - 1,600–2,200 words, single H1 (title), 4–7 H2s, one benchmark callout, one checklist, one FAQ section
  - Per-post `uniqueAngle` injected so each reads distinctly
  - Output JSON: `{ markdown, metaTitle, metaDescription, ogAlt }`
- Writes back into `src/content/blog/{slug}.json` preserving `url`/`meta` and populating `markdown` + a new `meta` block.

### B2. Image generation
- `scripts/blog/generate-image.ts`: per slug, generate a unique hero using Nano Banana 2 Lite. Prompt derived from category + unique angle + brand palette (no generic AI/purple gradients).
- Save to `src/assets/blog/{slug}.jpg`.
- Register in `src/content/blog-hero-images.ts` (mirror of `industry-hero-images.ts` pattern).

### B3. Rendering
- Update the blog post route to render `markdown` (react-markdown, already in tree if present; otherwise add) and use the hero image + meta.
- Ensure each post's `head()` sets unique title/description/og:image/twitter:image.

### B4. Batch execution
Run in 6 batches of ~50 posts each to keep AI Gateway rate-limits happy and let me stop early if quality drifts:
- Batch 1: 50 posts — spot-check 5 for tone/length/uniqueness, adjust prompt, then continue.
- Batches 2–6: remaining 254.
- Images run in parallel after text passes review.

### B5. Verification
- Script: word-count histogram, duplicate-phrase detector (n-gram overlap between posts), unique-image checksum, meta-tag presence check.
- Run link crawler over `/blog/{slug}` for all 304.

## Technical notes

- Uses Lovable AI Gateway via `LOVABLE_API_KEY` (already provisioned). No new secret.
- Model: `google/gemini-3.5-flash` for text (best cost/quality for long-form). `google/gemini-3.1-flash-lite-image` for images.
- No changes to protected systems (admin/client/candidate dashboards, auth, scoring).
- The 304 JSON files stay in-tree — no DB migration for blog storage.

## Risks / decisions I need from you before Part B

1. **Credit spend.** Rough estimate: 30–80 credits total for the full run. Confirm OK, or cap at N credits.
2. **Image style.** Photographic, editorial-illustration, or abstract-geometric? (Guardrails say no generic AI/purple gradients.)
3. **Publish gate.** Ship all 304 as-published, or land them as drafts behind a `status: "draft"` flag for review?

Answer those three and I'll run Part A immediately, then kick Batch 1 of Part B.
