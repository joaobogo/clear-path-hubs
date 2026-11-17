# Respekt Personal Group: relocation-first scoring for the two warehouse roles

## 1. What exists today

| | Katowice (`3d4b5f22…`) | Wrocław (`b2238700…`) |
|---|---|---|
| Status | Active, 1 applicant | Active, 0 applicants |
| Must-haves | Relocate to Poland and work on site near Katowice; 12-hour day/night shifts; willing to do warehouse work (picking, receiving, packing) | Relocate to Poland and work near Wrocław; 10-hour shifts incl. one month of nights in three; willing to do warehouse work |
| Nice-to-haves (all "experience") | Warehouse/stock/logistics/DC experience; barcode scanner; forklift / order picker | Same three |
| Seniority | Junior | Junior |
| Education, language, years, age | None set | None set |
| Deal-breakers (role) | Won't relocate; won't do night shifts; can't pay own flight | Same |
| Screening questions | Relocate within 3 months (deal-breaker); pay own flight (deal-breaker); 12h shifts (deal-breaker); how long will you stay (text); accept housing/medical deductions (optional) | Same pattern, 10h-shift wording |
| Question weights | All 1 (the engine ignores them) | All 1 |

Formula for every role: must-haves 60%, nice-to-haves 20%, screening answers 20%.

What drags down an inexperienced Brazilian applicant on these roles:
- **No dated jobs on the CV: no score at all.** The run stops and an admin task opens. This hits young or informal-work applicants hardest.
- **Must-haves are read from the CV.** "Willing to relocate" and "accepts shifts" never appear in a CV. A "yes" only gives half credit, so the 60% block tops out near 50%.
- **Nice-to-haves are all experience.** No experience means 0 on 20% of the score.
- **Short CV:** capped at 69. Under ~300 readable characters: capped at 30. Must-haves below 40% covered: capped at 50.
- **Any deal-breaker "no":** capped at 15 and not eligible.
- **No language or degree penalty** exists on these roles today.
- **Missing checks:** nothing asks about a passport or a start date about 6 weeks after the visa process.
- **Wording mismatch:** the Katowice deductions question says housing 600 PLN and medical 180 PLN. The Wrocław post says housing 650 PLN and transport 180 PLN. I'll confirm the Katowice figures with you, not guess them.

The one Katowice applicant (`465b38a7…`) is rejected and not eligible. Their score is 15 because a deal-breaker answer capped it (46 before the cap).

## 2. Proposed setup (these two roles only)

**Pass/fail (deal-breaker yes/no questions):**
1. Willing to relocate to Poland (existing)
2. Accepts paying own flight (existing)
3. Accepts night shifts and 12-hour shifts. For Wrocław I'd keep its real shift pattern: 10 hours, nights one month in three. Please confirm.
4. Has a passport or can get one (new)
5. Can start after a visa process of about 6 weeks (new)

**Scored (100 points):**
- Commitment/motivation to move: 40. From the "how long will you stay" answer plus a new short "why Poland / what's your plan" answer. It rewards concrete plans, not polished writing.
- How soon they can start: 20. New choice question: ready right after the visa / within 1 month after / 2–3 months / later.
- Shift and schedule flexibility: 20. New choice question covering nights, 12-hour shifts, weekends and variable days off.
- Warehouse, logistics or physical work: 20, bonus only. Read from the CV or a yes/no question. No experience starts from a strong baseline and is never counted as a gap.

Anyone who passes every check and gives ordinary answers lands at 75 or higher. A candidate with no experience who is fully committed reaches about 80.

**Removed:** must-haves read from the CV, the three experience nice-to-haves, and the Junior seniority. No language, degree, years or age criteria.

## 3. Settings alone are not enough: a small, per-role code change is needed

The role settings can add the two new deal-breakers and drop the experience nice-to-haves. They cannot:
- set the 40/20/20/20 weights (the engine has one fixed 60/20/20 shape),
- make experience bonus-only,
- stop the "no dated jobs = no score", short-CV and must-have caps.

So I'd add a per-role scoring mode, off by default. Only these two roles get it.

## 4. Rescoring people who already applied

- Changing the criteria already queues every applicant on the role for a full rescore within minutes. Today that is the one Katowice applicant.
- They get a **new** score record. Old records stay untouched, and approval status (rejected) and client visibility (hidden) don't change.
- They haven't answered the new questions (passport, start date, motivation). Those count as "unknown", not "fail", until a recruiter records an answer from a call. Candidates normally get a one-time email asking for missing answers. That email stays off for these roles, as you asked.
- No client or candidate is notified. No other role changes.

## Technical details

- New column `positions.scoring_mode text not null default 'standard'`, allowed values `standard | relocation_volume`. Additive migration with a rollback note. Only the two Respekt position IDs are set to `relocation_volume`.
- `executeScoring` (`scoring-service.server.ts`): when the mode is `relocation_volume`, skip the "no dated jobs" stop. An unreadable file still opens an admin task.
- New `src/lib/scoring/relocation-volume.ts`, called from `scoreCandidate` when the mode is on:
  - four dimensions 40/20/20/20, stored in the run's calibration and weights;
  - experience scored as `max(baseline, evidence)` so a missing experience row is never a gap;
  - thin-CV, keyword-echo and must-have caps don't apply;
  - deal-breaker handling, recruiter overrides and the protected-attribute filter are reused unchanged.
- Engine version bump, recorded with each run.
- Screening questions gain an optional per-question dimension tag (`commitment`, `start`, `flexibility`, `experience`) that only this mode reads.
- Role edits go through the normal criteria save paths, which include the protected-attribute check. The new questions are in Portuguese.
- Suppress the screening-answers email for `relocation_volume` roles only.
- Tests (vitest):
  - standard roles score exactly as before (regression check on existing scoring tests);
  - no experience plus all passes scores at least 75;
  - each deal-breaker "no" gives not eligible;
  - a CV with no dated jobs still gets scored;
  - experience only adds points;
  - unanswered new questions count as unknown, not fail.
