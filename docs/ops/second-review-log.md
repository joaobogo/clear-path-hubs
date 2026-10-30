# Claude second review: run log

One entry per run. Procedure: `docs/ops/second-review-runbook.md`.

## 29 Oct 2026, first run (manual, before the schedule started)

Positions: Group Marketing Manager (Stratium Partners), Mushroom Harvesting
Manager (Hughes Mushrooms).

Database
- Eligibility recompute applied across all positions: 18 matches restored
  from not_eligible to eligible (17 Group Marketing Manager, 1 Mushroom
  Harvesting Manager), each with an `eligibility_recomputed` audit row; 9
  missing failed-check records written for real dealbreaker exclusions on
  three other roles. A second run changes nothing.
- Hughes, on the owner's instructions (Recruiter review 29 Oct 2026):
  Chiedza Chaya's briefing corrected (sponsorship removed as a weakness,
  first paragraph replaced, highlights dated), review note, manual override
  25 attributed to the owner; passport and permit numbers, date of birth,
  religion, gender, marital status and home address removed from the
  extracted CV text, the stored score run text and three audit-history
  copies (the uploaded CV file is unchanged; the score is unchanged).
- Daim Shah: the "no dated employment" flag was wrong (five dated roles
  under "Career Overview"); blocking note corrected, a correction note
  supersedes the re-upload request. No email sent.

Second review
- All 32 Group Marketing Manager candidates reviewed by four reviewers and
  checked by the final reviewer; one internal note each and one admin task
  with the ranked proposed scores. Final reviewer changed one call: Kumar
  Sambhav Verma's target-market requirement is met (regional remit including
  Singapore), proposed 85.
- Web research: Firecrawl had no credits; standard web search was used.
  Some trade-press sites are outside the session's network allowlist.

Code (merged to main)
- v1.7.1: market experience for any country; protected-attribute criteria
  blocked at intake, role edit and publish with suggested rewrites;
  requirement changes queue a rescore; thin CVs get one re-read and an
  admin task; scoring guardrails card on data health.
- v1.7.2: degree subject read from its own words; stated tenure that dated
  roles contradict is partial; education dates judged at the range;
  letter-spaced PDF text rebuilt; "Career Overview" counts as work history.

Open
- Lovable's GitHub sync is off (since 27 Oct). Until the owner reconnects
  it, Lovable runs engine v1.5.4 and the rescore must wait.
- Owner decision: weight of the key market requirement (see the task).

## 29–30 Oct 2026, night run (owner away; Claude is now the primary scorer)

Group Marketing Manager (Stratium Partners), 40 candidates (8 new since the
first run).

Database
- Eligibility: 7 new applicants had been excluded only for "no" to the
  optional Arabic question (deployed engine v1.5.4). Restored with the
  recompute, and the guard trigger (migration 0007) added; it blocked 9 more
  such writes during the night.
- Role data applied as the PDF specifies, since Lovable had not done it:
  - requirements now lead with target-market marketing;
  - the senior-leadership wording is fixed;
  - the Asia item is removed from the nice-to-haves;
  - the job description's Requirements section and the posting's EEO and
    languages lines are replaced;
  - rubric v5 is recorded, and v1 (the nationality-era rubric) is
    superseded.
  The PDF's sixth screening question is not added: a posting is capped at
  five, and removing one would delete 40 candidates' answers.
- The requirement change queued a rescore. The deployed v1.5.4 pipeline
  regenerated briefings through the AI gateway, which was out of credits,
  and blanked 17 briefings (8 of them good) before the remaining 18 were
  held. No copy existed; all were rewritten.
- 12 unscored candidates across four roles had no admin task; one each was
  opened with the specific next step.

Profiles (five reviewers, one per batch of 8, plus one for profile fields)
- 38 of 40 candidates have a complete hand-written briefing:
  - all 10 current requirements judged and all 5 screening answers analysed;
  - CV quotes checked word for word against the stored text;
  - no he/she, no protected attributes;
  - facts beyond the CV written as "Public sources (domain) show …".
  Boral Al Tarifi (cover letter only) and Alvito Tereza (unreadable CV) have
  notes and CV-request tasks.
- Headline, years of experience and work history were filled or corrected
  from the dated roles. Corrections: Sebastian 1→15, Fares 0→16, Mehdi
  2→16, Hany 10→22, Aaron 30→10, Radwa 28→20.
- Names now match the CV: Sebastian Fernandes, Wael Kanaan, Janice Lee and
  Radwa Abdel Ghani; the other names Radwa has used are in a note.
- Profile summary, education and skills: being filled from the CVs (in
  progress when this entry was written; see the next entry).
- Claude's scores are recorded as overrides on 36 current runs
  (reason_code claude_primary_review). Top: Melissa Wingfield 86, Myreine
  Abdel Massih 86, Kumar Sambhav Verma 85, Radwa Abdel Ghani 83. Full
  ranking in task 2f7a394c. Nothing approved; client visibility unchanged.
- Web research: Firecrawl had no credits. WebFetch could not reach LinkedIn
  and several trade sites, so external facts come from search results and
  are marked "confirm at screening".

Code (merged to main)
- A failed briefing generation keeps the previous briefing instead of
  writing null over it.
- A hand-written briefing is kept on rescore while it covers the current
  requirements.
- Migration 0007: eligibility guard. Migration 0008:
  `reapply_claude_overrides` carries Claude's scores onto rescored runs.

Open
- Lovable: sync with main, publish, rescore through the pipeline, then run
  `reapply_claude_overrides` (prompt in
  docs/handoff/gmm-v17-lovable-addendum.md).
- The shared research conversation the owner linked could not be read
  (bot check). Paste its text or attach its PDF to use it.
