# PROMPT 0.3 — Data truth audit, demo workspace

Workspace: **Northwind Talent (Demo)** (`0c86fa1b-94ee-46b8-9a11-a42cee39bfed`)
Audited: 2026-08-13 (UTC), against live database rows (not fixtures).
Scope: every candidate delivered to the demo workspace and every field a client user can see.

## Method

Direct SQL over `candidate_matches` → `candidate_profiles` → `files` / `storage.objects`,
`score_runs` (approved or current), `candidate_evidence`, `candidate_evidence_items`,
plus the client-facing view `candidate_evidence_client`. Placeholder detection was a
regex sweep for `lorem|ipsum|placeholder|TBD|N/A|foo|bar|test test|xxx|todo` over
name, headline, summary, skills, experience and education. CV consistency was checked
by matching the profile email, phone, city and years-of-experience against the parsed
CV text (`candidate_evidence.raw_text_sample`).

## Per-candidate completeness

All ten candidates have: email, phone, city, country, headline, summary, timezone,
LinkedIn, portfolio and website URLs, years of experience, skills, experience,
education, languages, work authorization, availability (status + notice weeks +
earliest start) and compensation preferences (target, range, currency, period,
display string, note). No empty, zero, placeholder or `N/A` value was found in any
client-visible field.

| Candidate | Yrs | Skills | Roles | Edu | Langs | Stage | Visibility | Score | Fit label | Must-have cov. | Evidence quotes | Evidence items | CV (PDF pages) | Complete |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Beatriz Costa | 9 | 7 | 3 | 1 | 2 | hired | visible | 88.00 | strong_fit | 92% | 14 | 10 | 2 | 100% |
| Ana Ribeiro | 9 | 8 | 3 | 1 | 3 | offer | visible | 79.00 | strong_fit | 83% | 14 | 10 | 2 | 100% |
| Inês Lopes | 5 | 5 | 2 | 1 | 3 | interview_process | visible | 73.00 | worth_considering | 67% | 14 | 10 | 2 | 100% |
| Carla Nunes | 7 | 6 | 3 | 1 | 2 | interview_process | visible | 66.00 | worth_considering | 67% | 14 | 10 | 2 | 100% |
| Sofia Marques | 10 | 8 | 3 | 1 | 3 | shortlisted | visible | 63.00 | worth_considering | 67% | 14 | 10 | 2 | 100% |
| Tiago Almeida | 7 | 7 | 3 | 1 | 2 | shortlisted | visible | 58.00 | worth_considering | 58% | 14 | 10 | 2 | 100% |
| Miguel Torres | 8 | 8 | 3 | 1 | 2 | shortlisted | visible | 54.00 | worth_considering | 67% | 14 | 10 | 2 | 100% |
| Rui Fernandes | 6 | 6 | 3 | 1 | 2 | shortlisted | visible | 47.00 | not_a_fit | 42% | 14 | 10 | 2 | 100% |
| Diogo Silva | 4 | 5 | 2 | 1 | 2 | delivered | visible | 44.00 | not_a_fit | 33% | 14 | 10 | 2 | 100% |
| Pedro Matos | 2 | 5 | 2 | 1 | 2 | not_moving_forward | visible | 41.00 | not_a_fit | 25% | 14 | 10 | 2 | 100% |

## Required artefacts

| Check | Result |
|---|---|
| Downloadable PDF CV | 10/10 — `application/pdf`, 2 pages, ~45 KB, `parse_state = parsed`, and the matching object exists in the `cvs` bucket (`storage.objects` hit for every row) |
| Completed score run | 10/10 — `status = completed`, non-null score, fit label, confidence 1.0000, non-empty explanation |
| Evidence per requirement | 10/10 — 10 distinct `rubric_criterion_key` values per candidate, one per role requirement; 0 blank passages or interpretations |
| Client-visible evidence | 10/10 — every item is `reviewer_status = accepted` and `integrity_ok = true`, so `candidate_evidence_client` returns all 10 items per candidate (not an empty panel) |
| Requirement coverage payload | 10/10 — `matched` / `partial` / `missing` lists plus `must_have`, `preferred`, `screening_alignment` and category weights |
| Stage | 10/10 — distinct, plausible pipeline spread from `delivered` through `hired` |
| Visibility record | 10/10 — `client_visibility = visible`, `admin_status = approved`, `delivered_at` and `submitted_to_client_at` both set |
| Eligibility / recommendation | 10/10 — `eligible`, with `shortlist` / `review` / `do_not_recommend` matching the score band |
| CV consistency | 10/10 — profile email, phone, city and years of experience all appear in the parsed CV text |

## Flagged fields

No blocking gaps. Two items reviewed and cleared:

1. **Inês Lopes — 73.00 labelled `worth_considering`.** Not an inconsistency: the band
   table puts 73 in `strong`, but the engine downgrades a strong band when must-have
   coverage is under the calibration floor of 0.75 (hers is 0.6667). This matches
   `src/lib/scoring/bands.ts` + `src/lib/scoring/engine-calibration.ts` exactly.
2. **Sofia Marques — regex placeholder hit.** False positive: the word "bar" inside the
   phrase "the technical bar is above what this role needs". Genuine narrative copy,
   left untouched.

One non-blocking observation, no data change made:

3. `score_runs.evidence[].snippet` on these historical runs still contains the demo
   candidate's email and phone (they sit in the CV header line that was quoted).
   `score_runs` is deliberately immutable (`score_runs_immutable` trigger), and every
   client-facing surface passes quotes through `cleanQuote`
   (`src/lib/evidence/quote-hygiene.ts`) before render, while the engine now scrubs at
   write time. The client-visible `candidate_evidence_items` rows contain **zero**
   contact-info matches. No migration is appropriate here — rewriting immutable score
   history would be worse than the finding.

## Migration

**None required.** Every demo candidate is already 100% complete on all audited
dimensions, so no additive migration was authored — writing one would have been a
no-op `UPDATE` against rows that already satisfy the definition of done, and the
project rule is additive-and-necessary only.

**Rollback:** not applicable (no schema or data change was applied in this pass). For
reference, the reversible pattern this repo uses if a future gap appears is: snapshot
the affected columns into a timestamped `demo_backup_*` table in the same migration,
apply the additive `UPDATE`, and roll back with a single `UPDATE ... FROM
demo_backup_*` followed by `DROP TABLE demo_backup_*`.

## Verdict

**Demo workspace data: PASS — 10/10 candidates at 100% completeness**, no placeholder
values, no empty client-visible fields, no CV inconsistencies, PDF CV + completed
score run + per-requirement evidence + stage + visibility record present for every
candidate.
