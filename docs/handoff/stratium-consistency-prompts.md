# Stratium Partners / Group Marketing Manager: one score everywhere

Written 29 October 2026 after reading the code on GitHub. Paste each prompt into Lovable as one message, in order. Each ends with a report; check it before the next.

## Why scores disagree today

- A recruiter override is stored as a decision record (`score_decisions.approved_score`). The candidate's score run is not touched.
- Every list, board, ranking, export, band label, unicorn and client screen reads the candidate's current score run (`final_score`, else `score`, via `src/lib/scoring/published-score.ts`).
- So any screen Lovable did not edit by hand still shows the platform score (Radwa 66) while the screens it edited show the override (Radwa 80). That is the inconsistency.
- The platform already has the right mechanism: a human-adjusted run (`src/lib/scoring/human-adjusted-run.server.ts`). It inserts a NEW run with `evaluation_method = 'human_adjusted'`, the reviewer and the reason, points the candidate at it and keeps the machine run unchanged. Every screen then shows the same number with no other change.
- Lovable's work since 19 October is not on GitHub (latest commit there: 19 Oct, "Added Attio and email notif"), so it cannot be reviewed.

---

## Prompt A. Push your work to GitHub (no other change)

```
Your changes since 19 October are not on GitHub. The newest commit on main in github.com/joaobogo/clear-path-hubs is 0ebc8c511 "Added Attio and email notif" (19 Oct). Files you reported changing (src/lib/scoring/protected-attributes.ts, src/lib/recruiter-corrections.functions.ts, src/lib/ai/run-id.server.ts, drizzle/migrations/0003_*, 0004_* and others) do not exist there.

1. Check the GitHub connection in project settings and make sure it syncs to the main branch of joaobogo/clear-path-hubs.
2. Push every pending change to main as normal commits. Do not force-push and do not rewrite history.
3. Report: the GitHub connection status, the commit hashes you pushed, and the list of files in them.
Change nothing else.
```

---

## Prompt B. Read-only consistency check (change nothing)

```
Read only. Change nothing, approve nothing, publish nothing.

For each of the 16 Stratium Partners candidates on "Group Marketing Manager", show one row with:
name | candidate_matches.current_score_run_id | that run's created_at, evaluation_method, rubric/criteria version, score, final_score, fit_label | the run before it (id, created_at, score) | latest score_decisions row of type override (approved_score, reason, created_at) | the AI read on the current run (advance/consider/reject and confidence)

Then, for each candidate, show the score value as each of these screens computes it (call the same server function the screen calls, do not recompute by hand):
1. Admin candidates list (/admin/candidates)
2. Admin candidate page (/admin/candidates/<id>)
3. Admin position page ranking (/admin/positions/<id>)
4. Admin review queue and publish desk (/admin/scoring/review, /admin/publish)
5. Client candidates list DTO (getClientCandidates) and its fit band
6. Client candidate page (/client/candidates/<id>)
7. Client role board (/client/positions/<id>, pipeline board)
8. Comparison and its PDF export
9. Unicorn marker (score of 95 or more) and "strong fit" counts

Report PASS only if every screen shows the same number for a candidate. List every candidate and screen that differs.

Also answer:
a) Did the re-score in your last step create NEW score runs today against criteria version 4? Your table showed every new score identical to the old one (Arindam 62.8, Reda 58.4). Show the run ids and created_at for old and new runs. If no new runs were created, say so plainly.
b) Does any current run's AI read or reasons still mention nationality, citizenship, heritage, ethnicity or origin? Show any hits.
c) Alvito Tereza: is OCR text attached, and does he have a score?
```

---

## Prompt C. Fix: make the override the candidate's current score run

Run only after Prompt B, and only if B shows any disagreement or no new runs.

```
Goal: one number per candidate on every screen, admin and client. Never approve, publish or change client visibility.

1. Re-score for real. For each Stratium candidate except Boral Al Tarifi (no CV) and Alvito Tereza (OCR pending), create a NEW machine score run against criteria version 4. Bypass any cache or run-id reuse for this request. Point the candidate at the new run. Do not edit or delete earlier runs. Show: name | old run id | new run id | old score | new score | new AI read.

2. Turn each recorded override into the candidate's current score run, using the existing human-adjusted mechanism in src/lib/scoring/human-adjusted-run.server.ts (or a small function built the same way):
   - Insert a NEW run that copies the machine run from step 1 (evidence, coverage, explanation, rubric version), with final_score set to the override value, evaluation_method = 'human_adjusted', the recruiter as actor, and the override reason recorded.
   - Set fit_label from the overridden score with the same band rule the scorer uses (src/lib/scoring/bands.ts), so the band words match the number.
   - Point candidate_matches.current_score_run_id at the new run. The machine run stays unchanged and readable.
   - Keep the score_decisions override row as the audit record, and write one History & Audit entry per candidate with reason "Recruiter final profile 28 Oct 2026".
   Overrides: Radwa 80, Kumar 75, Amalie 75, Nora 70, Tarek 66, Shailesh 66, Syed Mansoor Hussain 60, Arindam 58, Reda 55, Shaima 55, Dylan 48, Lilian 45, Tehmina 40, Sana 38. None for Boral or Alvito.

3. Remove any screen-specific override logic you added (for example in src/lib/scoring/published-score.ts, src/routes/_authenticated/admin.candidates.$id.tsx or the 0004 "override rankings" migration) if it reads score_decisions directly. With step 2 every screen already reads the right number; a second path is how screens drift apart again.

4. Boral Al Tarifi: no current score anywhere (not 62), status "manual review required - no CV submitted", excluded from rankings and counts.

5. Run Prompt B again and show the full table. Every row must be PASS.

6. Run the test suite, the type check and the build, paste the results, and push to GitHub main.
```

---

## For the owner to decide

- After approval, should the client see the recruiter's number (Radwa 80) or the platform's (66)? Prompt C shows the recruiter's number everywhere, with the platform's run kept for the record. If you want the client to see the platform number, say so before running Prompt C.
