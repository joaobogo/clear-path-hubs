# Audit queue — 1 Sep 2026

Numbering follows the latest issue of the audit (34 findings). Ten revisions
were delivered; each superseded the last, so only this numbering is current.

**Status key:** `DONE` fixed and pushed · `OPEN` not started · `PARTIAL` fixed
in part, remainder named · `NOT-CODE` real, but not fixable in this repo.

Everything below is unpublished. **Nothing reaches production until a publish,
and the engine changes need a re-score on top of that.**

---

## Blockers — all closed

| # | Finding | Status | Commit |
|---|---|---|---|
| F1 | Role filter emptied the decision queue while the tile counted 2 | DONE | f677d62f |
| F2 | Unreadable CV carried a score and a band (8th surface) | DONE | f677d62f |
| F3 | Negation in a screening answer credited as evidence | DONE | 78d2af8e |
| F4 | Named-product gate not applied to `partial` | DONE | 78d2af8e |

## Majors

| # | Finding | Status | Commit / note |
|---|---|---|---|
| F5 | Client counts drop the unreadable candidate entirely | DONE | f677d62f |
| F6 | Interviewing tile counts a cancelled interview | DONE | f677d62f |
| F7 | Evidence reads 75% on the record, 100% (1/1) on the queue | **OPEN** | needs one shared selector returning quoted-count + requirement-count |
| F8 | Ownership counts the client contact as the role owner | DONE | 78d2af8e |
| F9 | Stale scores lists a candidate with no score, offers Recompute | DONE | 78d2af8e |
| F10 | 150 of 187 work-queue items are one webhook, repeated | **OPEN** | group by (channel, cause); see F15 |
| F11 | Settings desk never loads — permanent skeleton, no error, no retry | **OPEN** | bound the read with `withQueryTimeout`, render `QueryErrorCard` |
| F12 | Intake accepts a protected-characteristic dealbreaker | DONE | 20a4122a — **term list wants a legal read** |
| F13 | "Repair processing" offered on a record whose banner says nothing is broken | **OPEN** | `manual_review_required` carries two meanings; needs its own state or flag |
| F14 | Candidates screened against a pay range R$500 below the advertised one | PARTIAL | 4796cc57 — guard added; **question generation must interpolate, and bf2a3410's stored question still says R$4,500** |
| F15 | Every captured lead has a failed delivery channel (100/100) | **NOT-CODE** | Teams webhook + email delivery outage. Surfacing it is F10; fixing it is an integration job |
| F16 | A TaaSFlow SLA breach shown to the client as their own inaction | DONE | fa54aa9f |
| F17 | Publish desk blocks candidates the record does not block | DONE | 2f6d5253 |
| F18 | Form errors unreachable without sight | PARTIAL | 78cd7202 — apply form done; **/intake still open** |
| F19 | A requirement quoted twice and Met to staff reads "no direct evidence" to the client | DONE | this batch |
| F20 | Client invited to request interviews that already exist | **OPEN** | overlaps F6/TF8-08; re-check after the interview work lands |

## Minors

| # | Finding | Status | Note |
|---|---|---|---|
| F21 | Three evidence percentages measuring three different things | **OPEN** | label each with its denominator |
| F22 | Publish desk repeats one cause eight times, names it zero | **OPEN** | group blocked rows by shared reason |
| F23 | Processing states had no pinned domain | DONE | f677d62f |
| F24 | Role filter has no control on a single-role workspace | **OPEN** | render the select whenever a filter is active |
| F25 | Money falls back to a currency nobody recorded | **OPEN** | product call: default vs "currency not recorded" |
| F26 | Architecture doc marked PASS describes a read path the code does not take | **OPEN** | docs |
| F27 | Work queue claims it includes test records, shows the same numbers | **OPEN** | give it the disclosure Positions has |
| F28 | Delivery health groups the failure; work queue counts it 150 times | **OPEN** | same fix as F10 |
| F29 | Screen naming: two desks unnamed, three title formats, one duplicated route | **OPEN** | |
| F30 | Two calibration views report different denominators | **OPEN** | needs owner verification first |
| F31 | Intake review prints one answer twice under two names | **OPEN** | |
| F32 | Legacy branch could publish compensation without visibility public | DONE | 4796cc57 |
| F33 | 100% rate and average salary from a single data point, uncaveated | **OPEN** | suppress or caveat below n=3 |
| F34 | Unknown admin URL says a record was archived, merged or deleted | **OPEN** | it says a definite thing about a record that may never have existed |

---

## Owner actions — not mine to do

1. **Publish.** 22 commits are unpublished. The build stamp added in 97ff7783
   means the next publish is verifiable at a glance on `/admin/operations`.
2. **Re-score.** Engine is v1.5.3. F3 and F4 change evidence verdicts and reach
   no existing record until a re-score runs. New runs land unapproved.
3. **Fix the Teams webhook / email delivery** (F15). No code change fixes this.
4. **Regenerate the screening question for bf2a3410** (F14).
5. **Legal read of the protected-characteristic term list** in
   `src/lib/deal-breaker-screening.ts`.

## Standing note

Three findings this week were symptoms of a fix applied in one place while a
second reader kept its own copy — F3 (audit #5), F8 (A6-21), F17 (TF7-05).
Every fix since carries a source-level guard for that reason: the prose in the
docstrings did not hold, and the guards have.
