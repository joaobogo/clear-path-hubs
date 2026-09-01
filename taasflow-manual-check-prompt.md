# TaaSFlow full-platform manual check — Claude Code prompt

For a Claude Code session with browser access **and** the repo checked out. That
combination is the point: a browser-only auditor can say two screens disagree,
but only an agent with the source can say which derivation is right and why.

Weighting: client dashboard and admin dashboard are the bulk of the work. The
intake form and the job-application flow are covered end-to-end but more
briefly.

---

You have the TaaSFlow repo at `C:\Users\bmadu\OneDrive\Desktop\Claude\clear-path-hubs`
and browser access to https://taasflow.com with platform-admin credentials.

Run a full manual check of the product. You can read the source, so every
finding must say not just *what* is wrong on screen but *which* code produced
it. Report only what you actually observed — never infer a screen you did not
open, and never mark something PASS because the code looks right.

## Phase 0 — Gate: is the build you are testing the build you are reading?

1. `/admin/operations` → find "Engine running today:" beside the "Re-score all
   candidates" button.
2. In the repo: `grep ENGINE_VERSION src/lib/scoring/engine-version.ts`
3. `git log --oneline -1`

If the served engine is older than the repo's, **say so at the top of your
report and treat every subsequent failure as provisional** — a defect you find
may already be fixed in a commit that has not been published. Note the number
of commits between the two with `git log --oneline <last-published>..HEAD | wc -l`
if you can identify the boundary. Do not stop; just label the report.

## Phase 1 — Client dashboard (the largest section)

Sign in and reach `/client`. Work through it as a client would, then verify
each number against the code that produces it.

**1.1 Every number on the page.** For each tile, count and headline, find where
it comes from (`src/lib/client-overview.functions.ts`, `src/lib/client-kpi.server.ts`,
`src/lib/client-pipeline-lane.ts`) and check it against the list it summarises.
Specifically:
- Does the decision queue's item count match the number of rows shown? If the
  server truncated, does the page say so?
- Do the pipeline counts sum to the candidate list length? A candidate at
  `on_hold` or `withdrawn` is deliberately excluded (`STAGES_WITHOUT_LANE`) —
  confirm any gap is exactly that and nothing else.
- Does "Open roles" agree with the Roles page, the Account page and Insights?

**1.2 The role filter.** It lives inside the collapsed "Detail" section but
scopes the decision queue and the health headline above it, and it persists in
the URL. Set it, collapse Detail, reload. A chip should state the filter. Then
put a role id in the URL that does not exist on the workspace — the page must
say the filter matches nothing, not "no live roles".

**1.3 Empty and failed states.** For each panel, work out what it renders when
its query fails versus when it is genuinely empty. Where you can, break it: go
offline, or use devtools to fail the request. **A failed read must never render
as "you have nothing".** Report any panel where it does.

**1.4 The score card.** Open several candidates from the shortlist
(`/client/candidates/<id>`) and read the "How the number is made up" card.
- The must-have percentage and the evidence count must agree, or the card must
  show both and say they disagree.
- Where a requirement is "Not evidenced", the percentage must not be 100%.
- Cross-check against `src/lib/scoring/score-composition.ts` (`requirementBasis`)
  and `src/lib/client/requirement-status.ts` (`resolveRequirementStatus`).

**1.5 Decisions.** Shortlist someone, then request an interview, then try to
undo. Check:
- After deciding, the persistent Undo appears and survives a page refresh —
  the server window is five minutes (`UNDO_WINDOW_MS`), not the twelve seconds
  of the toast.
- A candidate whose interview is already requested must not be offered
  "Request interview" again.
- A candidate whose only interview was cancelled must not read "Interviewing".

**1.6 Comparison.** Compare three candidates. Concerns, education and the
interview guide are capped for display — each must show how many more exist.
A candidate with nine concerns and one with four must not look identical.

**1.7 Money.** Anywhere the client sees an amount, check the currency is one
that was actually recorded, and that whole units are shown. Note any figure
with a currency symbol where the underlying record has no currency.

## Phase 2 — Admin dashboard (the second largest section)

**2.1 Work queues on `/admin`.** Each tile's count comes from
`src/lib/admin-ops.server.ts`. For each: open the "see all" destination and
check the count matches what is listed. Report any tile whose number is a
different question from its list.

**2.2 Ownership.** `/admin/positions` "Ownership & coverage" against
`/admin/team` "Workload". These must agree on which roles have an active
owner — both now resolve staff through `loadStaffOptions`. If they disagree,
that is a regression; say which one is wrong and why.

**2.3 Scoring.** For a candidate carrying an intro video, check the score and
band agree across: `/admin/candidates` list, the candidate header, the Score
tab, `/admin/scoring/review` (both the main queue **and** the "Blocking a
client deliverable" section), and the client's view of the same person. The
+10 video bonus must be applied consistently, and the band computed from the
total. These read through `src/lib/scoring/review-row-score.ts`.

**2.4 Unreadable CVs.** Find a candidate in `ocr_required`
(`/admin/parse-failures` will have them). Everywhere that candidate appears —
list, header, score tab, evidence record, review queue, client board — there
must be **no score, no band, and no written assessment**. A narrative
describing their experience is a claim with no source and is a blocker.

**2.5 Test-record scope.** Flip "Show test records" and confirm every count,
list and rollup moves without a reload — including Publish, Pipeline health,
Scoring review and Operations. Any figure that stays put is a finding.

**2.6 Every desk in the sidebar and every section tab.** Visit each. For each:
does the top bar name the screen (not "Admin")? Does an empty state say why it
is empty? Does any button do something other than its label?

**2.7 Re-score.** Do not run it unless the user has asked you to — it is a
real write. If you do, the completion message must say how many runs are
awaiting approval, because nothing changes for clients until they are approved.

## Phase 3 — Intake form

Submit a role end-to-end at `/intake`.
- Every required field: submit empty and confirm the error names the field and
  is reachable by keyboard.
- Partial completion: reload mid-form. Is anything preserved, and does the
  page claim more than it kept?
- On submit, follow through to `/intake/confirmation`, then find the role in
  `/admin/intake` and `/admin/positions`. The status shown to the client and
  the status shown to staff must describe the same thing.
- Check what the client sees on `/client` immediately afterwards: a submitted
  role that cannot publish yet must explain the wait, not render the
  brand-new-workspace welcome.

## Phase 4 — Job applications

- `/jobs` → open a role → `/jobs/<id>/apply`. Apply as a candidate with a real
  CV file.
- Repeat with a deliberately unreadable file (an image-only PDF if you can
  make one). Follow that candidate into admin and confirm Phase 2.4 holds.
- Check the public job page states only facts the employer actually gave:
  compensation must not appear unless `compensation_visibility` is `public`
  (`src/lib/jobs/public-facts.ts`).
- Follow the applicant view: `/apply/status`, `/apply/received/<id>`, and
  `/me` after sign-up. Does the candidate see a status consistent with what
  admin sees?

## What to look for throughout

Four shapes account for nearly every defect found in this product so far:

1. **Two surfaces answering the same question differently.** Usually because a
   module declares itself the single source of truth and a second caller keeps
   its own copy. When you find one, grep for other callers of the same fact —
   there is often a third.
2. **A guard that can never fire.** A condition compared against a value the
   vocabulary does not contain. `src/lib/vocabulary.ts` holds the real ones.
3. **A claim with no evidence.** A score, strength, narrative or percentage
   asserted where the record has no source for it.
4. **Failure rendered as emptiness.** A read that fails and renders as "nothing
   here" — worst when the emptiness reads as good news.

## Output

1. **Gate result** — served engine, repo engine, and whether findings are
   provisional.
2. **Findings**, numbered, ordered by severity (blocker / major / minor). Each
   one: the URL, exact reproduction steps, what you saw quoted verbatim, what
   you expected, and **the file and line that produced it**.
3. **Verified working** — a short list of what you checked and found correct,
   so the next run knows what was covered.
4. **Not testable** — anything you could not exercise, and why. An untested
   item is not a passing item; do not pad the pass rate with them.
5. **Coverage** — which screens you actually opened. If you did not reach part
   of the platform, say so plainly.

Do not fix anything. This is a survey. If you are tempted to fix something
trivial, note it as a finding instead — the value here is a complete picture,
and a half-audited platform with three fixes in it is worth less than a
finished report.
