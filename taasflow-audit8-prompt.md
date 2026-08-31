# TaaSFlow Audit #8 — browser agent prompt

Paste the block below into a Claude browser agent with admin access to taasflow.com.

It does three things in order: gates on whether the new build is actually live,
runs the manual re-score through the admin UI, then re-tests the audit #7 fixes
and sweeps for new defects.

The gate is not optional. Audit #7 reported 13 items as "STILL OPEN" that were
already fixed in the repo — the build serving taasflow.com was stale. Running
phases 2 and 3 against a stale build produces a report that measures nothing.

---

You are auditing TaaSFlow at https://taasflow.com with admin access. Work
through the phases in order. Do not skip Phase 0.

Report only what you can see on screen. Never guess a cause, never soften a
finding, and never mark something PASS because it "probably" works. If you
cannot test something, say so and say why — an untested item is not a passing
item.

## Phase 0 — Gate: is the new build live?

1. Sign in and go to `/admin/operations`.
2. Find the line reading **"Engine running today:"** next to the "Re-score all
   candidates" button.
3. It must read **`v1.5.2`**.

**If it reads anything other than v1.5.2, STOP.** Do not run Phase 1, 2 or 3.
Report exactly this and nothing else:

> BLOCKED — build not published. Engine running today: `<what you saw>`,
> expected `v1.5.2`. The fixes are in git but taasflow.com is serving an older
> build. Publish in Lovable, confirm this line reads v1.5.2, then re-run this
> audit.

Only continue past this point if the line reads v1.5.2.

## Phase 1 — Manual re-score (a real write to production)

Still on `/admin/operations`:

1. Click **"Re-score all candidates"**.
2. A confirmation appears titled "Re-score every candidate". Read it, then
   click **"Re-score all"**.
3. The button shows progress ("Re-scored N…"). Wait for it to finish. It may
   take several minutes and runs in batches of 50.
4. Record the final message verbatim. It will be one of:
   - `Re-scored N candidates on the current engine` (possibly with
     `· N skipped (archived role)` and/or `· N failed`)
   - `Every candidate is already scored on v1.5.2 — nothing to do.`
5. If it reports failures, go to Operations incidents and record what they say.

Then verify the re-score actually took effect:

6. Go to `/admin/candidates`. Count the candidates showing a **Stale** score
   chip. After a successful re-score this should be **0**, except for
   candidates on archived roles (which are skipped by design and should not be
   chipped as stale at all).
7. Compare that count against the **"Stale scores"** number on the admin
   dashboard. **These two numbers must agree.** If they disagree, record both
   numbers and the exact difference — that is finding TF7-10 and it means a
   database migration has not been applied.

## Phase 2 — Re-test the audit #7 fixes

For each item: state PASS or FAIL, the URL, what you expected, and what you
actually saw. Quote on-screen text exactly, including punctuation.

**2.1 — Screens name themselves (was: everything read "Admin")**
Visit each and read the page name in the top bar / breadcrumb:

| URL | Top bar must read |
|---|---|
| `/admin/agent-ops` | Agent operations |
| `/admin/parse-failures` | Unreadable docs |
| `/admin/data-health` | Data health |
| `/admin/dashboard-requests` | Dashboard requests |
| `/admin/scoring/review` | Scoring review |
| `/admin/decision-backlog` | Decision backlog |
| `/admin/outcome-sla` | Answers we owe |
| `/admin/evidence-gaps` | Missing evidence |

Any that reads "Admin" is a FAIL. Then open a candidate detail page
(`/admin/candidates/<id>`) and confirm the trailing crumb is the candidate's
**name**, not "Admin" and not a raw UUID.

**2.2 — Money is labelled in a currency it was actually quoted in**
Go to `/admin/dashboard-requests`. Look at the "Quoted and agreed" and
"Delivered" tiles.
- If quotes exist and all share a currency, the totals show that currency's
  symbol.
- If quotes are in more than one currency, the totals show **no symbol** and
  the line below reads "· quoted in more than one currency".
- A "£0" where no GBP quote exists is a FAIL. Cross-check by opening the
  request list below and reading the per-request "Quoted <amount>" lines.

**2.3 — The score card's two must-have numbers reconcile**
Open a client candidate detail page (`/client/candidates/<id>`) and find the
score breakdown card. It shows must-have coverage as weighted points (e.g.
"5 of 6") and, separately, an evidence count (e.g. "6 of 6 evidenced").
- Where those two numbers differ, the evidence line must show the split, e.g.
  **"6 of 6 evidenced (4 fully, 2 partly)"**.
- If it says "6 of 6 evidenced" with no split while the points line says "5 of
  6", that is a FAIL.

**2.4 — Education entries don't invent data**
Open several candidates in `/admin/candidates/<id>` and look at the Education
lists (both on the profile summary and the parsed-facts panel).
- FAIL if you see the literal word **"Degree"** where a qualification belongs.
- FAIL if you see a dangling separator like "BSc · —".
- FAIL if you see a bare "—" where dates belong.
- A missing institution should simply not appear; an entry with nothing in it
  should not render a row at all.

**2.5 — Departed contacts are marked**
Go to `/admin/decision-backlog` and read the **Notified** column.
- Names of people no longer on the client account must be followed by
  *"(no longer on the account)"* in italics.
- Click a **Nudge / follow-up** action. The confirmation dialog lists
  recipients — it must **not** name anyone marked as departed. If every
  notified contact has left, it should say "everyone on the client team with
  decision notifications on".

**2.6 — One candidate, one location**
Open a candidate in `/admin/candidates/<id>`. Note the location on the profile.
Then open the same candidate as the client sees them
(`/client/candidates/<id>`, using the org switcher or support view). The
location must be identical on both. Record both strings if they differ.

**2.7 — The positions list never repeats a row**
Go to `/admin/positions`. Set the page size to its smallest option. Page all
the way through the list, recording the title + organization of every row.
- **No position may appear on two pages.** Repeat this for each sort option
  (Updated, Title). A repeat is a FAIL — record the position and the two page
  numbers.
- Do the same on `/client/candidates` if it paginates: no candidate twice.

**2.8 — An empty list says why it is empty**
On `/admin/positions`, turn the **"Show test records"** toggle OFF (top bar),
then filter to something that returns nothing.
- The empty state must say "No positions match these filters" **and** carry a
  note that test records are hidden and how many were excluded.
- Do the same on `/admin/interviews`. With no interviews it must say clients
  request these and that nothing is waiting on staff — not a bare
  "No interviews yet."

**2.9 — The test-records toggle actually works**
Note the counts on `/admin` (dashboard tiles). Flip **"Show test records"**.
- Every count, list and rollup must change without a manual reload — including
  the ones on Publish, Pipeline health, Scoring review and Operations.
- If any number or the "test and internal organizations are hidden" note stays
  put, that is a FAIL. Name the specific screen and number.

**2.10 — An unapproved newest score is labelled**
Go to `/admin/candidates/<id>` for a candidate whose latest score run has not
been approved, and open the Score tab.
- A warning must say this is the newest assessment and **nobody has approved
  it**, and that other screens show the approved score.
- Cross-check: the score in the page header, the score on `/admin/candidates`
  list, and the score the client sees must all be the **approved** one, and
  must agree with each other.

**2.11 — Access failures are honest**
This one is hard to trigger deliberately. If at any point during the audit you
are bounced to `/access-denied`, record the exact heading. "We could not verify
your access" (a system fault) and "You do not have permission" (a real denial)
mean different things — note which you got and what you were doing. Do not
force this; just report it if it happens.

**2.12 — Tracking respects consent and stays out of the workspace**
Open a private window, go to https://taasflow.com with devtools Network open.
- Before you touch the cookie banner: **no request to any rb2b domain** may be
  made. Record any that are.
- Click **Reject all**. Reload. Still no rb2b request.
- Now sign in and visit `/admin`, `/client` and `/me`. There must be **no
  cookie banner** and **no tracking requests at all** on these.
- Open the banner's "Manage / details" view with the keyboard only. Focus must
  land on the first control and must not jump back to the top when you change a
  toggle. Every button (Reject all, Save choices, Accept all) must work on the
  first click.

## Phase 3 — Fresh sweep

Now look for defects nobody has reported yet. Spend most of your effort here.
Work as three different people, in three passes:

**As an admin:** Walk every item in the sidebar and every tab within it. On each
screen ask: does every number here agree with the same number elsewhere? Does
every button do what its label says? Does any empty state hide a failure?

**As a client:** Use the org switcher or support view. Go from shortlist →
candidate → compare → request interview → decide. Does the client ever see a
score, a status, or a name that contradicts what admin sees?

**As a candidate:** Sign in to `/me`. Check the profile, applications, CV and
messages. Does anything shown to the candidate contradict the admin record?

Prioritise these four failure shapes — they are where every previous audit
found real defects:

1. **Two surfaces answering the same question differently** — a count, a score,
   a status, a name or a date that disagrees between two screens.
2. **A guard that can never fire** — a warning, limit or confirmation that the
   code can never actually reach.
3. **A claim with no evidence** — a score, a strength or a summary asserted
   without a quote behind it.
4. **Failure rendered as emptiness** — a list that shows "nothing here" when it
   actually failed to load, or was filtered to nothing.

## Output

Produce a report with:

1. **Gate result** — engine version seen, and whether you proceeded.
2. **Re-score result** — the exact final message, failures, and the stale-count
   check (chips vs dashboard number).
3. **Phase 2 table** — one row per item 2.1–2.12: PASS / FAIL / NOT TESTABLE,
   URL, expected, actual.
4. **New findings** — numbered TF8-01 onward. For each: severity
   (blocker / major / minor), the exact URL, reproduction steps, what you saw
   quoted verbatim, and what you expected instead. Include a screenshot
   reference where the defect is visual.
5. **Score** — pass rate as `items passed / items tested`, stated as a
   fraction, not a percentage of an invented total. List separately anything
   you could not test and why.

Do not propose code fixes. Describe the defect precisely and let the
implementation be decided separately.
