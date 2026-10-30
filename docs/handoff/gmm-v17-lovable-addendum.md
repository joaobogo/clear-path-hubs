# Group Marketing Manager: the one thing left for Lovable

Position 228cd1ec-1ec1-4205-828c-7a92b1be42e1 (Stratium Partners, Dubai).
Everything that could be done from the database was done on 29–30 Oct 2026
(see "Already done" below). What remains needs Lovable only because the
running app is still built from Lovable's own copy of the code, which is on
engine v1.5.4: Lovable's GitHub sync has carried nothing in either direction
since 27 Oct, so the v1.7.2 scorer on GitHub `main` has never reached it.

## Paste-ready prompt

```
Sync, publish and rescore only. Do not edit any data on the Group Marketing
Manager role; requirements, job description, posting text, rubric and
eligibility were all updated directly in the database on 29–30 Oct.

1. Bring this project in line with GitHub main (joaobogo/clear-path-hubs,
   commit 2910f1b or later). If the GitHub connection is broken, say so and
   tell me exactly what to reconnect; do not re-create the code by hand.
2. Confirm src/lib/scoring/engine-version.ts says "taasflow-scoring-v1.7.2"
   (or a later v1.7.x). If not, stop and tell me.
3. Apply drizzle migrations 0006 and 0007. Both already exist in the
   database; re-running them is harmless.
4. Publish.
5. Rescore every candidate on position 228cd1ec-1ec1-4205-828c-7a92b1be42e1
   through the full pipeline: runPipelineForMatch(matchId, { force: true })
   for all 40 matches, including the four in manual review (Nour Moussa,
   Dadirai Mutasa, Boral Al Tarifi, Alvito Tereza). Not "recompute score":
   only the pipeline re-reads each CV file with its line breaks.
6. Check and report, without changing anything else:
   - every current score run shows engine_version taasflow-scoring-v1.7.2;
   - no match is not_eligible without a failed eligibility_checks row;
   - nothing was approved and every client_visibility is still hidden;
   - a table: name, old score -> new score, the market requirement status
     (met / partial / missing) with the CV line it quoted.
```

## Already done (no Lovable needed)

On 29 Oct, in the database:
- Eligibility recompute: 18 matches restored in the morning. 7 more
  restored at 23:20 UTC, all on this role: Mehdi Rajan, Aaron Mahmoudi,
  Ghazal Rezvani, Erum Ehsan, Sebastian, Myreine Abdel Massih and Marios
  Tirkides. The live v1.5.4 engine had excluded each of them only for
  answering "no" to the optional Arabic question. Each change has an
  `eligibility_recomputed` audit row.
- A database guard (migration 0007) now refuses such exclusions whichever
  build is running. A blocked attempt leaves an `eligibility_guard_blocked`
  audit row.
- Role data, as the PDF specified:
  - requirements: target-market experience is the first must-have, and the
    senior-leadership wording is fixed;
  - the Asia item is removed from the nice-to-haves;
  - description and jd_text: the Requirements section is replaced, and the
    text above it is unchanged;
  - posting EEO statement and languages are set.
  - Content version 5. The automatic rescore was queued by the database's
    own trigger.
- Rubric version 5 records the new criteria. v4 is superseded. v1 (the one
  that mentions nationality) is marked superseded, so it can never govern a
  score.
- Protected-attribute checks: both detectors (the shared detector and the
  role publish check) find nothing in any of the new text.

Not done, owner decision: the PDF asks for a sixth screening question on
target markets. A posting is capped at five questions by a database rule,
and removing one (the sector question) would delete all 40 candidates'
answers to it. The market requirement is read from the CV meanwhile (engine
v1.7.2 and the second-review notes). To add it, choose a question to retire
for new applicants.

## Open decision for the owner (unchanged)

Each must-have counts the same in the engine. If "no target-market
experience, no shortlist" is the rule, make target markets a dealbreaker (as
a screening question, see above) or weight that requirement more heavily.
