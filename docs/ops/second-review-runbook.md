# Claude second review: runbook

Lovable's engine does the first scoring. Every two hours Claude does the
second review: it reads each candidate as a director of recruitment would,
checks the engine's verdict on every requirement, looks for public
professional evidence beyond the CV for the strongest candidates, and
records what it found. This file is the procedure each run follows.

## What a run may and may not do

May:
- read anything in the database;
- write internal notes (`candidate_notes`, visibility `internal`,
  `client_shareable = false`, `note_type = 'screening'`);
- open admin tasks (`tasks`, `task_type = 'candidate_review'`);
- run `recompute_screening_eligibility` and write the eligibility records
  it creates;
- fix the scoring code on `claude/tender-faraday-kfzxe7` with tests, merge
  to `main` when the full suite is green, and record the change in
  `docs/ops/second-review-log.md`.

Never:
- approve a score, release a candidate, publish, or change
  `client_visibility` or `admin_status`;
- write a `score_decisions` row. An override is a person's decision; the
  run proposes one in the note and the task, and an admin applies it;
- edit an existing score run (runs are immutable);
- email or message a candidate or a client;
- record or use nationality, citizenship, ethnicity, religion, age, gender,
  marital status, family, health, photos, home address, phone numbers,
  personal email, ID or passport numbers, or anything from personal social
  media. Market and work-location experience is professional and allowed.

## Each run

1. **Pick the work.** Active, non-test positions. For each match: the
   current score run, CV text, screening answers, briefing
   (`candidate_evidence.extracted.insights`) and existing notes. A match
   needs review when it has no note containing
   `[claude-review run=<current_score_run_id>]`, or when it is unscored
   for over an hour, or ineligible with no failed eligibility check.
2. **Check the engine, requirement by requirement.** For each requirement,
   read the CV the way a recruiter would and compare with the engine's
   status. Record every disagreement as: requirement, engine status, the
   recruiter read, the CV line that decides it. A disagreement that would
   recur on other CVs is an engine bug: fix it in code (see "May").
3. **Look beyond the CV** for candidates scored 70 or above, the top ten on
   each position, and anyone where the engine and the recruiter read differ
   by ten points or more:
   - start from what the candidate gave: their LinkedIn URL, employers,
     titles;
   - search for professional facts: roles and dates, scope (team size,
     budgets, markets, brands), launches, awards, speaking, press about
     their work;
   - accept a fact only when the source matches the candidate on at least
     two of: full name, employer, title, city or period. One match is a
     different person until proven otherwise;
   - quote each fact with its URL and mark it "external: confirm at
     screening". A fact that would change a requirement's status is
     evidence for the proposed score, not for the engine's.
4. **Write the note** (under 8,000 characters), in this shape:

   ```
   Claude second review · <date> · engine <version>
   [claude-review run=<score_run_id>]

   Read: <one sentence, the recruiter verdict>
   Engine score <n>; recruiter read <n> (<agree | why it differs>).

   Requirements
   - <requirement>: engine <status>, recruiter <status>. <CV line or reason>

   Beyond the CV (external: confirm at screening)
   - <fact>. Source: <url>

   Strengths a client should see
   - ...

   Risks and questions for screening
   - ...

   Proposed score: <n>, because <reason>. Not applied.
   ```

5. **Open one task per position per run** when there is something to act
   on: proposed scores differing from the engine by five or more,
   candidates needing a better CV, engine fixes made. Title
   `Claude second review: <position> (<date>)`; description lists each
   candidate with engine score → proposed score and the reason; metadata
   `{"source":"claude_second_review","run_at":...,"match_ids":[...]}`.
6. **Log the run** in `docs/ops/second-review-log.md`: time, positions,
   candidates reviewed, notes written, tasks opened, code changes, and
   anything skipped and why. Commit and push the log to the branch.

## Being fair

- Read titles, scope and outcomes, not keywords. A "Director" at a
  20-person firm and at a 2,000-person group are different; say which.
- Treat gaps, career changes and independent consulting on their merits.
  Consulting with named clients and outcomes is experience.
- A postgraduate degree implies a first degree. A degree in a related field
  meets "or a related field".
- Location satisfies a relocation condition; never infer location from
  name, schooling or language.
- When the CV cannot settle something, it is a screening question, not a
  zero.
- Strong candidates deserve the evidence that shows how strong they are:
  quantify scope and results from the CV and verified sources.
