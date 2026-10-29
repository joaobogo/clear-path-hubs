# Group Marketing Manager: what Lovable must do after the v1.7.x code

Paste this at the end of the Lovable prompt for position
228cd1ec-1ec1-4205-828c-7a92b1be42e1. It covers what can't be done in code.

## Before anything else: GitHub sync

Lovable's edits since 27 Oct (protected attributes, recruiter corrections,
OCR, drizzle 0003/0004, Hughes client) never reached GitHub. The newest
Lovable commit is 07c2a1e; the newest on GitHub main is 0ebc8c5 (19 Oct).
The branch `claude/tender-faraday-kfzxe7` carries an exact copy of those
edits plus the v1.7.0 fixes, so it merges cleanly either way. Until main
holds this branch, Lovable is running engine v1.5.4 and none of the fixes
below are live.

## Paste-ready addendum

```
Before step 1:
A. Confirm src/lib/scoring/engine-version.ts says "taasflow-scoring-v1.7.2"
   (or a later v1.7.x). If it is older, stop and tell me: the code fixes are
   not in this build. Lovable must be synced with GitHub main first.
B. Apply drizzle migration 0006_recompute_screening_eligibility. The function
   already exists in the database (created 29 Oct); re-running it is harmless.

In step 4 (eligibility + rescore), in this order:
C. Preview the eligibility recompute and show me the rows:
     select * from public.recompute_screening_eligibility('228cd1ec-1ec1-4205-828c-7a92b1be42e1');
   Expected now: no rows. It was already applied on 29 Oct: 17 matches on
   this role went from not_eligible to eligible (all had answered "no" only
   to the Arabic question), each with an audit_events row. If rows appear,
   show them to me before applying with apply = true:
     select * from public.recompute_screening_eligibility('228cd1ec-1ec1-4205-828c-7a92b1be42e1', true);
   Each change writes an audit_events row (action 'eligibility_recomputed').
   Run it a second time to show it returns no rows.
D. Rescore through the full pipeline (runPipelineForMatch with force: true),
   not "recompute score" alone. Every stored CV on this role is one long
   line; only the pipeline re-reads the original PDF with line breaks.
   The score-only path scores the old flattened text.
E. Every new run must show engine_version taasflow-scoring-v1.7.2 or later. Old runs
   stay; nothing is approved; client_visibility stays hidden.
F. In the report table, add: market requirement status (met / partial /
   missing) with the CV line it quoted, and eligibility before/after.
```

## What to expect (dry run on the stored CVs, nothing written)

New requirements, scored on the stored one-line text. Scores after the
PDFs are re-read with line breaks may shift by a few points.

| | Market requirement | Score |
|---|---|---|
| Kumar Sambhav Verma | Met (Tokyo role, Nov 2021 – Jun 2023) | 90.5, top |
| Radwa, Nora, Hany, Dylan | Partial (indirect exposure) | 90 / 85 / 77.5 / 73 |
| Melissa Wingfield | Missing | 80.5 (was 50) |
| Everyone else | Missing | 30 – 90 |

Range: 30 to 90.5 (was 50 to 66).

## Open decision for the owner

Each must-have counts the same. A candidate who meets the other five and
lacks the market experience still scores about 90 (Wael Kanan).
If AK means "no market experience, no shortlist", the market question has
to be a dealbreaker (it then gates eligibility), or the requirement needs
more weight than the others. The PDF says dealbreaker = false, so I left
it that way.
