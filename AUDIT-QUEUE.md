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
| F22 | "Your data advantage" reports zero evidence; provenance shows a query limit as a count | PARTIAL | provenance fixed; **evidence-items counter still reads empty for the demo workspace** |
| F23 | Public /case-studies metrics the platform cannot support | **OWNER** | see below — highest business risk on this list |

## Minor

| # | Finding | Status | Where |
|---|---------|--------|-------|
| F24 | Three evidence percentages on one page, measuring three things | OPEN | `?tab=evidence` — 97% / 88% / "3 of 7" |
| F25 | Publish desk repeats one cause eight times, names it zero times | OPEN | `/admin/publish` |
| F26 | Processing states have no pinned domain; label map drifted | DONE | `processing-state-enum.test.ts` |
| F27 | Role filter hidden on a single-role workspace, URL param still applies | OPEN | `client.index.tsx` |
| F28 | Money falls back to EUR nobody recorded | **OWNER** | `money.ts` `DEFAULT_CURRENCY` — product call |
| F29 | Architecture doc marked PASS describes a read path the code does not take | OPEN | `docs/architecture/dashboard-read-models.md` |
| F30 | Work queue says it includes test records, then shows the same numbers | OPEN | `/admin` |
| F31 | Delivery health groups the systemic failure; work queue counts it 150× | DONE | same fix as F10 |
| F32 | Screen naming: two desks unnamed, three title formats, one duplicated route | OPEN | multiple admin routes |
| F33 | Two calibration views report different denominators | **VERIFY** | needs owner confirmation of intent |
| F34 | Intake review prints one answer twice under two names | OPEN | visa sponsorship = work authorisation |
| F35 | Legacy branch can publish compensation without `compensation_visibility` public | OPEN | `jobs/public-facts.ts` |
| F36 | 100% acceptance and an average salary, both from n=1, uncaveated | OPEN | `/client/offers`, `/client/executive` |
| F37 | Unknown admin URL says a record was archived, merged or deleted | OPEN | unmatched `/admin/*` |
| F38 | Some candidates described to the client as "Candidate" | OPEN | headline falls back to a non-title |
| F39 | Staff see "Setup complete"; client sees 29 minutes left | DONE | `onboarding-wizard.tsx` `ddb2f9a89` |
| F40 | Notification feed gives one interview a fourth account; repeats an unnamed failure | WIP | see analysis below |
| F41 | Published retention promises with no job that enforces them | **VERIFY** | then implement or disclose |

---

## Owner actions — not engineering calls

1. **F23 — /case-studies.** The page publishes `POSITIONS DELIVERED 175+`,
   `12-MONTH RETENTION 92%`, `OFFER ACCEPTANCE 86%`, `CLIENT SHORTLIST RATING 9.1/10`,
   none sourced. The platform holds **one confirmed hire, starting 25 Sep 2026** — a
   future date, so no twelve-month retention figure can exist from platform data, and
   the Calibration desk itself says only 9 candidates have any recorded outcome.
   The same domain's Trust Center runs the opposite standard ("stated only where we can
   prove it", with a "What we do not claim" section). Two public pages, two standards.
   Some figures may come from recruiting predating the platform — that is exactly the
   point: nothing says so. **Decision needed: source each figure, or scope the page to
   what the platform can evidence.** I have not touched the numbers.
2. **Publish.** ~30 commits are unpublished. Git push ≠ deploy.
3. **Re-score** under v1.5.4 — F3 and F4 only take effect on new runs.
4. **Teams webhook** (F15/F31) — the integration is down, not miswired.
5. **Regenerate bf2a3410's screening question** — the drift guard blocks it going forward
   but does not rewrite the existing text.
6. **Legal read of the protected-characteristic term list** in `deal-breaker-screening.ts`.
7. **F28** — what currency should an amount with no recorded currency display as?
   Current answer is a silent EUR.

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

## Standing note

Four defect classes recur: two surfaces answering one question differently; a guard that
can never fire; a claim with no evidence; failure rendered as emptiness. The dominant root
cause is a module whose docstring declares it the single source of truth while callers keep
their own copy. Prose has not held. Every fix now ships a source-reading guard test.
