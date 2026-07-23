# Deep Candidate Intelligence

Turn every candidate page into a full briefing: a rich narrative, per-requirement evidence (why good / why bad), and an analysis of screening answers vs. what the CV supports. Fix the "evidence empty" root cause at the same time.

## What changes for the user

For every candidate in Admin (and, where appropriate, Client):

- **Executive narrative** — 2–3 paragraphs describing the person's story, seniority, and fit for THIS role.
- **Highlights** — 3–6 concrete achievements pulled from the CV.
- **Strengths for this role** — bullets like *"12 years leading B2B SaaS sales — matches the sales manager mandate"* each backed by a verbatim CV quote.
- **Concerns / gaps** — bullets like *"No evidence of managing a team > 5 people"*, again quoted where possible.
- **Requirement-by-requirement verdict** — for each must-have and preferred requirement: `met / partial / missing`, one-line rationale, CV quote.
- **Screening analysis** — every job-application answer shown alongside: what the CV supports, whether the answer is consistent, and a note.
- **Richer profile card** — headline, seniority, current role, years, industry, work authorization, languages, education, certifications are all filled when the CV mentions them.

## Backend

### 1. New LLM step: `generateCandidateInsights` (`src/lib/candidate-insights.server.ts`)

Uses the existing Lovable AI gateway (`google/gemini-2.5-flash`, JSON output).

Inputs:
- `cv_text`
- `position`: `{ title, description, requirements, preferred_requirements }`
- `screening`: normalized answers with question text

Returns structured JSON:

```text
{
  narrative: string,               // 2–3 paragraphs
  headline_suggested: string,
  seniority: "junior" | "mid" | "senior" | "lead" | "executive" | "unknown",
  highlights: string[],
  strengths: [{ title, detail, cv_quote }],
  concerns: [{ title, detail }],
  requirement_verdicts: [{
    requirement_id, requirement_text, required: boolean,
    verdict: "met" | "partial" | "missing" | "contradicted",
    rationale: string,
    cv_quote: string | null
  }],
  screening_analysis: [{
    question_id, question, candidate_answer,
    cv_supports: "yes" | "no" | "unclear",
    note: string
  }],
  overall_recommendation: "advance" | "consider" | "reject",
  confidence: 0..1
}
```

Fails soft: on gateway error returns `{ ok:false, reason }` — pipeline continues.

### 2. Wire into pipeline (`pipeline-runner.server.ts`)

After hydration, before scoring:

- Call `generateCandidateInsights` with position + screening.
- Persist to `candidate_evidence.extracted.insights` (same row that already exists).
- Pass `requirement_verdicts` into the scoring engine.

### 3. Evidence-aware scoring (`scoring-engine.server.ts`)

Extend `scoreCandidate({ cv_text, requirements, screening, insight_verdicts? })`:

- For each requirement, if the deterministic keyword pass returns `missing/partial` **but** the LLM verdict is `met` / `partial` with a `cv_quote`, upgrade the status one notch and add an `EvidenceRef` sourced from the LLM quote (`source: "cv"`, `location: "cv:llm"`).
- Downgrade to `contradicted` when the LLM verdict is `contradicted`.
- Guarantees non-empty `evidence[]` whenever the LLM produced any verdict with a quote — fixes the `publish_blocked: evidence_empty` class of failures at the source, not just the gate.
- Deterministic keyword scoring still runs first and wins ties.

### 4. Richer hydration (`cv-hydration.server.ts`)

Extend the JSON schema with:

- `summary` (up to 1500 chars, currently 600)
- `seniority`
- `key_achievements: string[]`
- `notable_projects: [{ name, impact }]`

Store the new fields in `candidate_profiles.consent.extracted` (already the sink for non-column extras).

## Frontend

### 5. Candidate drawer + admin candidate page

`src/components/candidate-detail-drawer.tsx` and `src/routes/_authenticated/admin.candidates.$id.tsx`:

- **Profile tab**: render `narrative`, `highlights`, seniority chip, work auth, languages, education, certifications when present.
- **Evidence tab**: new "Requirement verdicts" table (requirement · verdict badge · rationale · quote) and "Screening analysis" table (question · answer · CV supports · note).
- **Score tab**: keep the existing strengths/concerns, but source them from insights when the deterministic engine's list is empty.

Read from `candidate_evidence.extracted.insights` via the existing loader — no new server function needed for read.

### 6. Client-facing polish (optional, same turn)

`client-fit-presentation.ts` already produces the client-safe pitch — feed `narrative` and `strengths` into it so client Kanban cards show the human-readable rationale instead of the raw score line.

## Technical notes

- All LLM calls stay server-side; no keys ship to the client.
- Existing `HYDRATION_PARSER_VERSION` is bumped so old snapshots are re-hydrated on next pipeline run.
- Cost control: single Gemini flash call per pipeline run, ~4k tokens in / ~1k out. No repeated calls on view.
- Backfill: no migration needed. Once shipped, admins hit "Retry enrichment" (or the next pipeline tick) and the new evidence appears.
- Publish gate: the `evidence_empty` check remains removed (already shipped), but scored runs will now normally carry real evidence so the gate becomes meaningful again for the contradiction case.

## Files touched

- `src/lib/candidate-insights.server.ts` (new)
- `src/lib/cv-hydration.server.ts` (schema expansion, version bump)
- `src/lib/pipeline-runner.server.ts` (invoke insights, pass verdicts)
- `src/lib/scoring-engine.server.ts` (accept `insight_verdicts`, emit evidence)
- `src/lib/scoring-service.server.ts` (thread verdicts through)
- `src/components/candidate-detail-drawer.tsx` (new sections)
- `src/routes/_authenticated/admin.candidates.$id.tsx` (Evidence + Score tabs)
- `src/lib/client-fit-presentation.ts` (optional narrative pass-through)

No DB migration required.
