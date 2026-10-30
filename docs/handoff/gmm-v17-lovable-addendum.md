# Group Marketing Manager: the one thing left for Lovable

Position 228cd1ec-1ec1-4205-828c-7a92b1be42e1 (Stratium Partners, Dubai).
Claude is the primary scorer on this platform (owner, 30 Oct 2026); Lovable is
secondary. Everything that can be done from the database is done (see "Already
done"). What remains needs Lovable only because the running app is built from
Lovable's own copy of the code. That copy is still on engine v1.5.4: Lovable's
GitHub sync has carried nothing in either direction since 27 Oct, so the
v1.7.3 scorer and tonight's fixes on GitHub `main` have never reached it.

## Paste-ready prompt

```
Sync, publish and rescore only. Do not edit any data on the Group Marketing
Manager role or its candidates: requirements, job description, posting text,
rubric, eligibility, candidate briefings, profiles and scores were all
completed directly in the database on 29–30 Oct.

1. Bring this project in line with GitHub main (joaobogo/clear-path-hubs,
   the latest commit). If the GitHub connection is broken, say so and tell me
   exactly what to reconnect; do not re-create the code by hand.
2. Confirm src/lib/scoring/engine-version.ts says "taasflow-scoring-v1.7.3"
   (or later) and that src/lib/evidence/carry-forward-insights.ts
   exists. If not, stop and tell me.
3. Apply drizzle migrations 0006, 0007 and 0008. All three already exist in
   the database; re-running them is harmless.
4. Publish.
5. Rescore every candidate on position 228cd1ec-1ec1-4205-828c-7a92b1be42e1
   through the full pipeline: runPipelineForMatch(matchId, { force: true })
   for all 41 matches, including the four in manual review (Nour Moussa,
   Dadirai Mutasa, Boral Al Tarifi, Alvito Tereza). Not "recompute score":
   only the pipeline re-reads each CV file with its line breaks. The
   candidate briefings were written by hand against the current
   requirements; the new build keeps them and does not regenerate them.
6. Then run, in SQL:
     select * from public.reapply_claude_overrides('228cd1ec-1ec1-4205-828c-7a92b1be42e1', true);
   It moves Claude's scores onto the new score runs.
7. Check and report, without changing anything else:
   - every current score run shows engine_version taasflow-scoring-v1.7.3;
   - no match is not_eligible without a failed eligibility_checks row;
   - every candidate's latest candidate_evidence still has its briefing
     (extracted.insights with authored_by set) for the 39 that have one;
   - nothing was approved and every client_visibility is still hidden;
   - a table: name, engine score -> new engine score, Claude's score, and
     the market requirement status (met / partial / missing).
```

## Already done (no Lovable needed)

Eligibility:
- Two recompute runs restored 25 wrongly excluded candidates: 18 on 29 Oct
  and 7 more that night. The deployed v1.5.4 engine had excluded them for a
  "no" to optional questions such as Arabic. Each change has an audit row.
- A database guard (migration 0007) refuses such exclusions whatever build
  is running. During tonight's partial rescore it blocked 9 of them.

Role data (as the PDF specified):
- New requirements, nice-to-haves, job description and posting text are in
  place (content version 5).
- Rubric v5 records the criteria. The nationality-era rubric v1 is
  superseded and can never govern a score.

Candidates:
- A partial rescore on the live v1.5.4 build regenerated briefings through
  the AI gateway, which is out of credits, and wiped 17 of them. The
  remaining 18 rescores are held (`rescore_held` audit rows) until v1.7.3 is
  live.
- The code on `main` now keeps the previous briefing when generation fails.
  It also keeps a hand-written briefing while it still covers the current
  requirements.
- All 41 candidates were reviewed. 39 have a complete hand-written briefing:
  10 requirement verdicts, 5 screening answers, CV quotes checked word for
  word, and public evidence identity-matched on two points with sources.
- Profile fields were completed from the CVs: headline, years of
  experience, work history, summary, education and skills. Names were
  corrected to match the CV: Sebastian Fernandes, Wael Kanaan, Janice Lee and
  Radwa Abdel Ghani.
- Each candidate has internal notes dated 30 Oct.
- Claude's scores are recorded as overrides on the current runs (37
  candidates). The admin ranking shows them. Nothing is approved and no
  candidate is visible to the client.
- The owner's market rule is applied throughout: marketing a brand from one
  of the six markets counts as experience of that market wherever the
  candidate sat. Engine v1.7.3 applies the same rule.
- Every unscored candidate on an active role has an open admin task saying
  what is needed.

Not done, owner decision: a sixth screening question on target markets. A
posting is capped at five questions, and removing the sector question would
delete all 40 candidates' answers to it. Target markets are read from the
CV and recorded in each briefing instead.
