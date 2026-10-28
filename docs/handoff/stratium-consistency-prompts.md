# Stratium Partners / Group Marketing Manager: one score everywhere

Written 29 October 2026 after reading the code on GitHub. Paste each prompt into Lovable as one message, in order. Each ends with a report; check it before the next.

## Why scores disagree today

- A recruiter override is stored as a decision record (`score_decisions.approved_score`). The candidate's score run is not touched.
- Admin lists, rankings, band labels and the unicorn read the candidate's current score run; client screens read the run that was approved (`approved_score_run_id`), and approval takes the current run. Both use `final_score`, else `score` (`src/lib/scoring/published-score.ts`). Neither reads `score_decisions`.
- So any screen Lovable did not edit by hand still shows the platform score (Radwa 66) while the screens it edited show the override (Radwa 80). That is the inconsistency.
- The platform already has the right mechanism: a human-adjusted run (`src/lib/scoring/human-adjusted-run.server.ts`). It inserts a NEW run with `evaluation_method = 'human_adjusted'`, the reviewer and the reason, points the candidate at it and keeps the machine run unchanged. Every screen then shows the same number with no other change.
- Lovable's work since 19 October is not on GitHub (latest commit there: 19 Oct, "Added Attio and email notif"), so it cannot be reviewed.

## Order of work

1. Prompt A: Lovable pushes its unsynced work to GitHub.
2. Claude merges it with the scoring fixes waiting on the branch `claude/tender-faraday-kfzxe7`, into `main`, with your go:
   - Recruiter-style rules (engine v1.6.0) for the degree field, the "if outside the UAE, relocate" condition and minimum years.
   - The override reader fix.
3. Prompt B: the read-only check.
4. Your decisions on `docs/handoff/stratium-recruiter-review.md`, the per-candidate review and recommended overrides.
5. Prompt D, then the candidate prompts 02 to 17 again: writes each briefing field by field, with no merging and no duplicates, and the recruiter's verdict in place of the stale AI read.
6. Prompt C: re-score on v1.6.0 and make each agreed override the candidate's current run. Use the override values you agreed in step 4, not the list printed in the prompt.

If Prompt C runs before step 2, the re-score uses the old keyword rules and the degree, relocation and years rows stay wrong.

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
   Overrides (as recorded on 28 Oct; replace with the values you agree in the recruiter review): Radwa 80, Kumar 75, Amalie 75, Nora 70, Tarek 66, Shailesh 66, Syed Mansoor Hussain 60, Arindam 58, Reda 55, Shaima 55, Dylan 48, Lilian 45, Tehmina 40, Sana 38. None for Boral or Alvito.
   First confirm that src/lib/scoring/engine-version.ts says taasflow-scoring-v1.6.0. If it does not, stop: the new rules are not deployed yet.

3. Remove any screen-specific override logic you added (for example in src/lib/scoring/published-score.ts, src/routes/_authenticated/admin.candidates.$id.tsx or the 0004 "override rankings" migration) if it reads score_decisions directly. With step 2 every screen already reads the right number; a second path is how screens drift apart again.

4. Boral Al Tarifi: no current score anywhere (not 62), status "manual review required - no CV submitted", excluded from rankings and counts.

5. Run Prompt B again and show the full table. Every row must be PASS.

6. Run the test suite, the type check and the build, paste the results, and push to GitHub main.
```

---

## For the owner to decide

- After approval, should the client see the recruiter's number (Radwa 80) or the platform's (66)? With Prompt C, approval publishes the current run, so the client sees the recruiter's number and the platform's run stays on record. If you want clients to see the platform number, say so before running Prompt C.

---

## Prompt D. Write each briefing exactly, field by field (fixes the duplicated and merged briefings)

What the admin page showed for Radwa on 29 Oct: "AI read: Reject, confidence 95%" on the top-ranked candidate; one merged paragraph shown twice (as the pitch and again below it); 9 highlights where prompt 02 set 6, mixing the old AI list back in (including figures the pack left out on purpose); "Why they fit" still the old AI items; shortfall details repeating their own titles. Prompt 02 was merged into the old briefing instead of replacing it. Paste this once, then paste the candidate prompts 02 to 17 again, one at a time.

```
For the Stratium Partners "Group Marketing Manager" candidates, when I paste a candidate prompt (02 to 17), write the briefing to the stored insights record EXACTLY like this. Replace each field whole; never merge with old values, never keep old items, never add, paraphrase or reorder.

- "CANDIDATE BRIEFING TITLE LINE" -> insights.headline_suggested (exact text)
- The read section ("TaaSFlow's pitch", "Honest read" or "Balanced view"):
    paragraph 1 -> insights.pitch_summary
    paragraphs 2 and onward -> insights.narrative, separated by one blank line
    Never put the same text in both fields.
- The heading of that section sets insights.pitch_tone: "TaaSFlow's pitch" = "sell", "Honest read" = "cautious", "Balanced view" = "balanced".
- "HIGHLIGHTS" -> insights.highlights, an array with exactly the items given, in order.
- "WHY THEY FIT" -> insights.strengths, an array of { title, detail, cv_quote } with exactly the items given. "Text" goes to detail and "Quote" to cv_quote. Do not repeat the title inside detail.
- "WHERE THEY MAY FALL SHORT" -> insights.concerns, an array of { title, detail } with exactly the items given. Do not repeat the title inside detail.
- Verdict: set insights.overall_recommendation from the recruiter's override score (70 or more = "advance", 50 to 69 = "consider", under 50 = "reject"), set insights.recommendation_source = "recruiter", and set insights.confidence = null. The page then shows "Recruiter read: <verdict>" instead of the model's old read. For Boral Al Tarifi and Alvito Tereza (no override) leave the verdict fields unchanged.
- Profile fields (headline, location, experience, LinkedIn, name aliases) go to the candidate profile exactly as given.
- Review notes and the override follow the original prompt rules.
- Any automatic regeneration of insights must skip a record where recommendation_source = "recruiter", so recruiter text is never overwritten. Show me the code that enforces this, or add it.

After each candidate, print every one of these fields back exactly as stored, with the count of highlights, strengths and concerns, and confirm pitch_summary and narrative share no sentence.
Do not approve, publish or change client visibility.
```

