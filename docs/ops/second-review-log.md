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

## 30 Oct 2026, morning: owner's market rule, re-judgment and completion

Profiles
- Profile summary, education and skills were filled from the CVs for 39 of
  40 candidates; Alvito Tereza has no readable CV. Fixes: Hany Badr's MBA is
  marked in progress, and Wael's and Radwa's summaries now open with their
  names.

Owner's rule
- Marketing for a company or brand from a target market counts as
  experience of that market, wherever the person sat. The owner's example
  was Myreine Abdel Massih, marketing Japanese brands from Dubai.
- Engine v1.7.3 (merged to main) adds a brand-origin dictionary and
  "Japanese brands"-style phrases. Campaigns aimed at a market's consumers
  count; an unnamed APAC or EMEA remit is partial instead of missing.

Re-judgment
- All 38 briefed candidates were re-judged under that rule, and every red
  verdict was checked for partial credit. Concerns calling brand-based or
  remote market work a weakness were removed.
- Notable changes: Radwa 83→85, Nora 76→78, Janice 72→74, Reda 58→72
  (Raffles), Matin 55→70, Shaima 60→67 (LG), Shailesh 70→72 (Hello
  Kitty), Fares 66→69, Tarek 64→67, Hemal 58→61, Dadirai 68→70; smaller
  Arabic and qualification partials elsewhere.
- New overrides were recorded on the current runs where the score changed.
  Each candidate has a "Claude re-judgment · 30 Oct 2026" note.

New applicant
- Omer Ikram (05:22 UTC) was scored 63.5 by v1.5.4 with no briefing (AI
  out of credits).
- Full profile written. Proposed 75, market met (ZTE China regional sales
  and marketing; Huawei, China Mobile Zong).

Checks
- 02:51, 04:51 and 06:51 UTC: no unexplained exclusions; Lovable unchanged
  (latest edit 3b96eeb).
- Admin task 2f7a394c now carries the final ranking of all 41.
- Top: Melissa Wingfield 86, Myreine Abdel Massih 86, Kumar Sambhav Verma
  85, Radwa Abdel Ghani 85, Nora Tourky 78.

## 30 Oct 2026, afternoon: offline rescore and final ranking

- Owner's instruction: do everything from here; Lovable only pulls from
  GitHub at the end.
- Offline rescore tool (src/lib/scoring/offline-rescore.ts,
  scripts/offline-rescore): scores a role with the repository's engine and
  writes each run as one self-verifying SQL transaction (result, snapshot
  and CV text fingerprints). 42 Group Marketing Manager matches rescored
  on v1.7.3 in five batches; every statement passed its fingerprints.
  Two CVs carry private-use bullet glyphs that do not survive copying;
  the agents restored them from the database positions, and the SQL
  carried them as JSON escapes (same jsonb value).
- Found and fixed v1.7.4: advertising platforms (TikTok, WeChat, Tmall,
  Shopee…) were on the brand list, so "paid media on TikTok" counted as
  marketing a Chinese brand for 8 CVs; a brand named as a channel is now
  weak. Those 8 are being rescored on v1.7.4.
- Round-2 research file (owner) applied to the 9 newest candidates:
  profile fixes, verified web additions with sources, headlines and
  summaries, personal data removed from CV text, evidence and audit
  copies. Degree verdicts were restored to met for five candidates with
  postgraduate degrees (the file's "bachelor's to confirm" is a screening
  question).
- New applicants: Samar El Alam (full profile, 82, market met thin);
  Brianna Phares, Maria Dodero, George Schempers (being completed);
  Christian Abdel Nour (not eligible: no bachelor's, dealbreaker; the
  missing check record was written). Hughes: Thaddeus Kwasi Armoh (second
  review in progress).
- Claude's scores carried onto the new runs (reapply_claude_overrides,
  37) and, on the owner's "lift where there is proof": Melissa Wingfield
  91, Myreine Abdel Massih 91, Kumar Sambhav Verma 89, Radwa Abdel Ghani
  87. Final ranking in task 2f7a394c. Nothing approved; all hidden.
- Known: the raw engine numbers run high on thin links (Wael 100, Shaima
  97.5); the override is the score to use. Lovable's 08:39 edit was a
  roadmap note and regenerated types (added to main).

## 30 Oct 2026, 15:00–16:50 (owner online): one published number

- Incident: the owner approved and published seven Group Marketing Manager
  candidates. The client workspace showed the engine's number of the
  approved run (Radwa 98, Myreine 98, Marios 96 with the intro-video bonus,
  Kumar 91, Samar 90, Nora 85, Melissa 81) while the admin list showed the
  review overrides (87, 91, 74, 89, 82, 78, 91). Two further approvals
  (Amrith Gopinath, Erum Ehsan) failed with "Nothing was changed"
  (TF-9A56ABBA): the evidence gate blocks a must-have with no evidence and
  no written override. The owner unpublished the seven at 15:30.
- Cause: the client reads `score_runs.final_score`; the review scores were
  only `score_decisions` overrides, which the admin index prefers and the
  client never reads. Hand-typed override numbers also could not be
  reconciled with the requirement rows the client shows.
- Fix (database, live at once): `apply_reviewed_verdicts(position, apply)`
  (migration 0009) writes each candidate's reviewed verdicts as a
  human-adjusted score run scored by the platform formula (coverage x
  weights, carried caps, must-have floor, and "a candidate missing a
  must-have is not shown as Top", cap 84), supersedes the engine run and
  re-points current and approved pointers. Reviewed rows are marked
  human-verified; met and partial rows carry the reviewer's CV quote and
  the linked screening answer so the client's requirement rows match.
  Trigger `score_decisions_override_matches_run` refuses an override that
  differs from its run. `reapply_claude_overrides` now delegates to it.
  Evidence-gate justifications recorded for the strong candidates whose
  target-market must-have is not evidenced (Amrith, Erum, Amalie, Kajall,
  Sana Gul, Mohammad Khateeb, Syed Mansoor, Oksana, Baburaj, Lilian).
- Result: 45 human-adjusted runs (43 GMM, 2 Hughes); admin index =
  current run = approved run for every candidate; no override differs from
  its run; the function reports `unchanged` on re-run. Scores are now the
  formula over verified verdicts: Wael Kanaan 100, Hany Badr 97.5
  (screening contradicts CV flag), Radwa 97.5, Samar 97.5, Myreine 95.5,
  Basma 95, Fares 95 (+5 video), Nora 95, Shaima 95, Kumar 93, Omer 93,
  Sebastian 93, Nour 92.5, Umair 90.5, Tarek 90, Melissa 88, Shailesh 88,
  Marios 85.5 (+5 video), Mehdi 85.5, Reda 85, Mohammad 84, Syed 84,
  Amrith 83, Arindam 83, Hemal 83, Kajall 83, Matin 83, Sana Gul 83,
  Aaron 80.5 (+5 video), Erum 80.5, Brianna 78.5, Amalie 78, Dadirai 78,
  Dylan 78, Janice 78, Oksana 75.5, Baburaj 73, Lilian 73, Maria 71,
  Ghazal 63, Tehmina 63, Sana Shajahan 63, Chiedza 58, Thaddeus 57.
  The seven still carry admin_status approved and are hidden until the
  owner re-publishes.
- Consistency query (run any time):
  `with v as (select * from v_admin_candidate_index where position_id = :p)
   select count(*) filter (where v.final_score is distinct from cur.final_score) admin_vs_run,
          count(*) filter (where app.final_score is not null and app.final_score is distinct from v.final_score) client_vs_admin
   from v join candidate_matches cm on cm.id = v.match_id
   left join score_runs cur on cur.id = cm.current_score_run_id
   left join score_runs app on app.id = cm.approved_score_run_id;` — both 0.
- Code on main: client requirement rows honour a verified verdict (no
  keyword rescue of a verified "not evidenced" row); approval errors name
  the retired override; migration 0009 with metadata; types.
- Still true on the live v1.5.4 build until Lovable pulls main: a nice-to-
  have the review marked "not evidenced" can read "Partially met" on the
  client page when the CV mentions a related word (Melissa and Nora, MBA
  row); the score is unaffected. The intro-video bonus (+5) shows on the
  client list and, on main, on the admin list too.


## 2 Nov 2026 — Mushroom Harvesting Manager fixes and Adiya Vatsa

- Bug: `apply_reviewed_verdicts` matched verdicts to requirement rows by
  id. The Mushroom role numbers verdicts from 1 and rows from 0, so each
  verdict landed one row down (Thaddeus's people-management row read as
  missing). Migration 0010 matches by wording (`requirement_text_key`),
  always builds from the latest engine run, reads only authored briefings
  (a machine briefing is never applied as a human verdict; unreviewed
  candidates are skipped), and compares rows regardless of order.
- Consistency rule: a direct "yes" to the rota screening question, or a CV
  statement of flexible hours, counts as met for "Flexible approach to
  working hours".
- Thaddeus Armoh 57 → 64 (rota met; picking and supervision still
  missing). Chiedza Chaya 58, each verdict checked against her CV.
- Adiya Vatsa: CV and introduction video sent to John Kasprzak on 1 Nov;
  record created by staff on the owner's instruction (application
  reference 8FAAA3, source direct email, privacy notice not yet
  acknowledged). Engine run 50; authored review 67.5 (hands-on mushroom
  cultivation and harvesting met; management and food-safety partial; no
  commercial farm experience). Hidden and pending. Work authorisation:
  owner reports she lives in the UK and holds a UK visa; the CV says
  Skilled Worker sponsorship required, so visa type and end date are
  recorded as to confirm. Video: Google Drive, shared with anyone who has
  the link (migration 0010 lets the database accept Drive links).
- The PDF itself is not in file storage yet (this environment cannot reach
  it); only the text is stored. To attach it: taasflow.com/apply/status,
  reference 8FAAA3 and her email, "Replace your CV". The pipeline then
  re-reads it; re-run `apply_reviewed_verdicts` for the role afterwards.
  Her review is stored under its own label (`claude-review-2026-11-02`)
  so the pipeline's briefing cannot overwrite it.
- Five screening questions unanswered (three dealbreakers); eligibility
  rests on the CV until she answers.

## 2 Nov 2026 (later) — Hughes Mushrooms: owner research applied and rescored

- Source: the owner's candidate deep research (PDF, 2 Nov) plus the owner's
  guidance: realistic, not punitive scores; almost every applicant stays
  eligible so the client can see them once approved; present each person at
  their best without overstating.
- Reviewed verdicts from the research written as authored briefings
  (engine_version 'owner-research-2026-11-02') for Chiedza, Daim, Adiya,
  Anna and Vijay; Thaddeus's existing review already matched the research.
  Mapping: research "unknown" with related evidence -> partial; a rota "yes"
  or a CV flexibility statement -> flexibility met; student/course mushroom
  work -> partial at most.
- Daim scored for the first time (offline rescore on v1.7.4: engine 58).
  Abdul still cannot be scored: the engine finds no dated roles in the CV
  (MM/YYYY ranges); fix in progress on branch research-fix/unscored-matches.
  Chiedza's v1.7.4 offline rescore also reported no dated roles, so it was
  not run (it would have voided the existing score); she keeps the v1.5.4
  base run.
- Recruiter exceptions (migration 0012): Anna and Vijay honestly answered
  "no" to the bundled dealbreaker ("hands-on picking AS WELL AS
  supervision") and were capped at 15. eligibility_checks
  'recruiter_review:7da77185-...' status 'excepted', eligibility 'excepted';
  apply_reviewed_verdicts no longer carries the disqualifying-answer cap for
  an excepted match. The "no" still counts as a gap.
- Reviewed scores (published, with the +5 video for Adiya): Thaddeus 64
  (unchanged), Daim 64 (new), Adiya 55 + video 5 = 60 (was 67.5 + 5; the
  student work is now partial, not met), Anna 59 (was 15), Chiedza 58
  (unchanged), Vijay 51 (was 15). Abdul unscored. Elena Fernandez-Miranda
  (not in the research; answered "no" to the rota dealbreaker) stays 15.
- Admin list = current run for every match; nothing approved or published.
- Not yet applied: the profile text updates, notes and web context drafted
  for Chiedza, Daim, Adiya and Anna (scratchpad), and the six engine fixes
  (branches research-fix/*). The bundled screening question split is held
  until the live engine is updated, because editing screening questions
  queues a live rescore on the old engine.

### Profiles (2 Nov 2026, same day)

- Profile fixes from the owner research applied to all seven research
  candidates, with a recruiter_dossier_field_edit audit row per changed
  field (actor NULL): recruiter-written headline and summary (student and
  course work described as such, no gendered pronouns, no visa wording),
  CV corrections (dates, locations, grades, all-caps names), high- and
  medium-confidence web context on employer/institution entries with source
  URLs, certifications parsed from the CV, and work authorisation in the
  recruiter-only field.
- Certifications are stored as {name, issuer, date} objects: the client DTO
  drops plain strings, so Daim's and Thaddeus's were invisible to the client
  before.
- Internal notes per candidate: recruiter notes, questions to ask,
  unverified items, and "where they could fit at a grower" (strengths
  first). Notes written before the owner's eligibility guidance were
  corrected before they were saved.
- Scores unchanged by the profile edits (admin list = current run for every
  match; nothing approved or published).

### Publishing (2 Nov 2026, owner instructions)

- Evidence-gate justifications recorded for the two mushroom must-haves on
  each scored Hughes candidate (requirement stays "not evidenced" for the
  client; the score already reflects it).
- Approved and published via approve_candidate_match on the owner's
  instruction: Daim 64, Thaddeus 64, Anna 59, Chiedza 58, Vijay 51, and
  Adiya (published 60 with the video bonus at the time).
- Adiya's introduction video and its +5 removed on the owner's instruction;
  published score now 55 everywhere (bonus is read-time only).
- Not published: Elena Fernandez-Miranda (dealbreaker "no" on the onsite
  rota; run not publishable) and Abdul Rehman (not scored yet).
- Client page no longer labels reviewed scores "Being re-checked" after an
  engine release (commit "Client page: a reviewed score is not ...").

## 2 Nov 2026 — Stratium Partners · Group Marketing Manager: new applicants and top-20 delivery

- 11 new applicants (28 Oct – 2 Nov) reviewed against the current requirements;
  authored briefings ("Claude second review (2 Nov 2026)") written to the latest
  evidence row, one internal note and audit rows each. Every cv_quote checked
  as an exact substring of the CV text.
- Reviewed verdicts applied with apply_reviewed_verdicts (dry run first: every
  previously reviewed candidate unchanged). Engine → reviewed: Maya Halabi 90 → 100,
  Nada Nechadi 100 → 95 (China role was one year of agency project work: partial),
  Sandrine Broocks 85.5 → 90.5, Sara Kobayaa 90 → 90, Karen Cordeiro 80.5 → 88,
  Ghita Ouzzi 89 → 87.5 (China time was a student volunteer project: partial),
  Falak Jalil 70 → 84, Duncan Elliott 83 → 83, Mohannad Hussein 85 → 80,
  Arindam Saha 73 → 78 (duplicate application; both matches briefed, the
  28 Oct one approved), Ahmed Fahmy 15 (stays not eligible: degree answer "No"
  is accurate per the CV).
- Owner instruction: deliver the top 20. Approved and published via
  approve_candidate_match: Hany Badr (already approved), Nour Moussa, Umair Iqbal,
  Tarek Sheiha, Shailesh Bhadra, Maya Halabi, Nada Nechadi, Sandrine Broocks,
  Sara Kobayaa. Client now sees 20 candidates.
- Approved but kept hidden (outside the top 20): Karen Cordeiro, Ghita Ouzzi,
  Falak Jalil, Duncan Elliott, Mohannad Hussein, Arindam Saha. Melissa Wingfield
  and Marios Tirkides stay hidden (hidden by the owner on 30 Oct).
- Not scorable, not delivered: Boral Al Tarifi (cover letter only), Alvito Tereza
  (CV has no text layer), Naren Vish and George Schempers (no dated roles the
  scorer can read).
- Name capitalisation corrected on two client-visible profiles (audited).
