# Audit queue — TaaSFlow MVP

Numbering follows **audit rev 17** (1 Sep 2026, 41 findings). Rev 17 inserted two new
findings (F23, F24), so everything from old-F23 onward shifted up by two.

**Status key** — `DONE` fixed + guard test + committed · `OPEN` not started ·
`WIP` in progress · `OWNER` not an engineering call · `VERIFY` needs a data check first

---

## Blockers

| # | Finding | Status | Where |
|---|---------|--------|-------|
| F1 | Role filter says "Nothing needs you today" while candidates wait | DONE | `client-kpi.server.ts` — filter applied to the empty-state test |
| F2 | Unreadable CV carries a score and a band | DONE | `scoring/published-score.ts` — void moved inside the resolver; 9 surfaces swept |
| F3 | Negation credited as evidence under the version claiming to fix it | **DONE** | Engine **v1.5.4** `4330d3abf` — guard reached the sibling branch |
| F4 | Named-product requirement credited from quotes that never mention it | DONE | Engine v1.5.3 — gate now rejects at any status, promotes only for a single named product |

## Major

| # | Finding | Status | Where |
|---|---------|--------|-------|
| F5 | Client counts silently drop the unreadable candidate | DONE | counted as unscored rather than omitted |
| F6 | Interviewing count includes a cancelled interview | DONE | `client-pipeline-lane.ts` — `laneFor` exception |
| F7 | Evidence figure reads 75% on the record, 100% on the queue | DONE | one resolver, `score-resolved-in-one-place.test.ts` |
| F8 | Positions says every role has an owner; Team says none do | DONE | single owner read |
| F9 | Stale-scores queue lists a candidate with no score, offers to recompute | DONE | `Number(null)` is 0 — explicit null check |
| F10 | 150 of 187 "items waiting" are one broken webhook | DONE | `delivery-failures-grouped.test.ts` — grouped on the work queue |
| F11 | Settings desk never loads | DONE | `route-pending.tsx` 12s bound — covered 15 routes at once |
| F12 | Intake accepts a protected-characteristic dealbreaker | DONE | `deal-breaker-screening.ts` — **needs a legal read of the term list** |
| F13 | "Repair processing" offered where the banner says nothing is broken | DONE | one processing-state enum |
| F14 | Screening quotes a pay range R$500 below the advertised one | DONE | `jobs/screening-pay-drift.ts`, blocking publish gap |
| F15 | Every captured lead has a failed delivery channel | **OWNER** | Teams webhook is down — infra, not code |
| F16 | A TaaSFlow SLA breach shown to the client as their own inaction | DONE | owner attributed from the breach record |
| F17 | Publish desk blocks candidates the record does not block | DONE | `current_run` embed never selected `evidence` |
| F18 | Form errors name the field but are unreachable without sight | DONE | errors associated + announced |
| F19 | Requirement Met to staff reads "no direct evidence" to the client | DONE | filter refines presentation, never overturns the run |
| F20 | Client invited to request interviews that exist / offer to people never met | DONE | `interviews-to-confirm.ts` three shared predicates |
| F21 | Six agents "On and working"; two have never run | DONE | `agents/registry.ts` — three states, sourced from last action |
| F22 | "Your data advantage" reports zero evidence; provenance shows a query limit as a count | DONE | counter reads score_runs.evidence; scripts/backfill-evidence-items.mjs populates the table too |
| F23 | Public /case-studies metrics the platform cannot support | DONE (needs your text) | provenance required, unattributed figures withheld — **6 source lines to write** |

## Minor

| # | Finding | Status | Where |
|---|---------|--------|-------|
| F24 | Three evidence percentages on one page, measuring three things | DONE | `evidence-graph.ts` — verified now means settled; double count removed |
| F25 | Publish desk repeats one cause eight times, names it zero times | DONE | `Readiness` type was missing `pendingReasons` |
| F26 | Processing states have no pinned domain; label map drifted | DONE | `processing-state-enum.test.ts` |
| F27 | Role filter hidden on a single-role workspace, URL param still applies | DONE | already fixed under its old id |
| F28 | Money falls back to EUR nobody recorded | **OWNER** | `money.ts` `DEFAULT_CURRENCY` — product call |
| F29 | Architecture doc marked PASS describes a read path the code does not take | DONE | **none of the 9 views has a reader** — status now DRIFT, guarded |
| F30 | Work queue says it includes test records, then shows the same numbers | DONE | inclusion side now discloses like the hidden side |
| F31 | Delivery health groups the systemic failure; work queue counts it 150× | DONE | same fix as F10 |
| F32 | Screen naming: two desks unnamed, three title formats, one duplicated route | DONE | one format, guarded structurally; nav labels match headings |
| F33 | Two calibration views report different denominators | **VERIFY** | needs owner confirmation of intent |
| F34 | Intake review prints one answer twice under two names | DONE | already fixed under its old id |
| F35 | Legacy branch can publish compensation without `compensation_visibility` public | DONE | already fixed under its old id |
| F36 | 100% acceptance and an average salary, both from n=1, uncaveated | DONE | sample floor already in; headline now says (hired) vs (offered) |
| F37 | Unknown admin URL says a record was archived, merged or deleted | DONE | already fixed under its old id |
| F38 | Some candidates described to the client as "Candidate" | DONE | `candidateLineFor` — one resolver, placeholder nouns rejected |
| F39 | Staff see "Setup complete"; client sees 29 minutes left | DONE | `onboarding-wizard.tsx` `ddb2f9a89` |
| F40 | Notification feed gives one interview a fourth account; repeats an unnamed failure | DONE | reconciler conditions are a list; staff rows name the subject |
| F41 | Published retention promises with no job that enforces them | DONE | disclosed — no machinery exists; **owner: implement or leave disclosed** |

---

## Owner actions — not engineering calls

1. **F23 — write six provenance lines.** Mechanism shipped: provenance is a required
   field and an unattributed figure does not render, so the strip is hidden right now.
   Fill in `src/config/case-study-metrics.ts` — one sentence each and the figure
   publishes. Shape: "Across 11 years of recruiting delivery, including engagements
   predating this platform."

   | Figure | Needs |
   |---|---|
   | Positions delivered 175+ | a source line |
   | Cities engaged 18 | a source line |
   | Median time to shortlist 7d | a source line |
   | Client shortlist rating 9.1/10 | a source line, and where the ratings were collected |
   | **12-month retention 92%** | **a decision, not a sentence** — it cannot be sourced to this platform at all: the only confirmed hire starts 25 Sep 2026 |
   | Offer acceptance 86% | a source line |

   I have not invented any attribution. The guard also rejects "internal data",
   "various sources" and "representative data" — a provenance line exists so a reader
   can check the number, and those let nobody check anything.
2. **Publish.** ~40 commits are unpublished. Git push ≠ deploy. The build stamp added
   in 97ff7783 takes effect from the next publish, so nothing observed today reflects
   any of this work.
3. **Re-score** under v1.5.4 — F3 and F4 only take effect on NEW runs. Sequence:
   confirm v1.5.4 is deployed → re-score → review the new numbers against what
   OmniFlow has already seen → approve. New runs land unapproved, so published
   scores hold until someone approves them. MPO (5afc1b56) carries both corrected
   cases and his 79 should fall. OmniFlow has had these ten candidates since 10:40
   on 1 Sep, so decide whether they see the corrected numbers before or after they
   start reviewing.
4. **Teams webhook** (F15/F31) — the integration is down, not miswired.
5. **Regenerate bf2a3410's screening question** — the drift guard blocks it going forward
   but does not rewrite the existing text.
6. **Legal read of the protected-characteristic term list** in `deal-breaker-screening.ts`.
7. **F28** — what currency should an amount with no recorded currency display as?
   Current answer is a silent EUR.

8. **F41 — retention.** The /security page now discloses that the four published
   deletion timelines are honoured on request rather than enforced by a job. That
   makes the page true today. Implementing the job (90-day CV purge, two-year profile
   anonymisation, 12-month log retention) is yours to schedule — it deletes customer
   data, so I have not shipped it unasked.

## Still open

| # | What is left | Why it is not done |
|---|---|---|
| F33 | Two calibration views report different denominators | The audit itself files this as needing owner verification — the two desks may be measuring different things on purpose. |

## F40 — notification feed, analysis

Two defects, different causes.

- **Defect 1 (Rui Almeida described four ways).** The no-show sweep writes an
  `approval_needed` staff notification saying "Nobody marked it complete or cancelled."
  `listMyNotifications` already reconciles open actionables — but only for
  `candidate_match` entities with a recorded `client_decision`. Nothing retires this one
  when the interview later gets an outcome, so a resolved condition stays on the feed.
  Compounding it: `recordInterviewOutcome` stores a no-show as `status: "cancelled"` with
  `cancel_reason: "candidate_no_show: …"`, so the client is told "Interview cancelled"
  for an interview nobody called off, and Operations counts it under cancelled.
- **Defect 2 (three identical unnamed failures).** Idempotency is per match
  (`pipeline:<match>:cv_parse_failed`), so three items really are three candidates —
  the operator cannot tell because `affects` is the static class string "One application
  document" and the body never names anyone. `cv_parse_failed` is already withheld from
  client audiences, so naming the candidate on the admin feed is safe.

## Security findings (2 Sep 2026 — reported by owner, then swept)

Not from the rev-17 audit. F42 and F43 were reported directly; F44–F47 were found by
sweeping the same defect classes across the schema. All six are fixed with guard tests.

| # | Finding | Status | Where |
|---|---------|--------|-------|
| F42 | Public job application could rewrite another person's candidate profile | DONE | `apply.server.ts` — claimed profiles read-only; unclaimed fill blanks only |
| F43 | Client editors could write every column on a published match | DONE | migration `20260901120000` — `GRANT UPDATE (stage)`; `canonical_state` pinned in WITH CHECK |
| F44 | A column-level SELECT grant was silently reverted by a later broad GRANT | DONE | same migration — five internal columns withheld again |
| F45 | A suspended user could reactivate themselves | DONE | migration `20260901140000` — `profiles.status` no longer self-writable |
| F46 | A workspace admin could write their own seats, plan, billing and pilot terms | DONE | same migration — `organizations` narrowed to presentation columns |
| F47 | `candidate_profiles` narrowed to the self-service editor's columns | DONE | same migration — `email` withheld (account-linking key) |

**Cleared on inspection, recorded so they are not re-audited:** `memberships` (role pinned
to client-only values in both USING and WITH CHECK, plus an INSERT/UPDATE/DELETE trigger);
the public `qa-seed` route (gated on `import.meta.env.DEV`, so the enabling branch is dead
code in any production build); `intake.ts` and `express-intake.ts` (both refuse with a
conflict unless `callerUserId` matches the account found by email — the guard `apply.server`
was missing).

**Not applied.** Both migrations are committed but not run. They are privilege changes
against live data: applying them starts refusing any user-scoped write not in the grant.
The guards say there are none, and they scan `src` whole-file with patch-identifier
resolution — but they cannot see an edge function or a raw PostgREST call from outside this
repo. Diff against staging first.

## Standing note

Four defect classes recur: two surfaces answering one question differently; a guard that
can never fire; a claim with no evidence; failure rendered as emptiness. The dominant root
cause is a module whose docstring declares it the single source of truth while callers keep
their own copy. Prose has not held. Every fix now ships a source-reading guard test.
