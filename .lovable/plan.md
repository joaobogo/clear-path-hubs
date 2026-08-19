# QA fixture purge — scope before execution

Goal: after this runs, `/admin/intake` reads **0 organisations and 0 positions excluded**, and no QA fixture appears in production queues, threads, or delivery health.

That disclosure counts exactly two things: organisations with the test flag set, and positions with the test flag set. So the purge must leave **zero** flagged rows of either kind — every flagged row is either deleted or, where the record is genuinely real, corrected.

## What is actually in the database right now

Two of the organisations named in the report (QA_TESTCO_E2E, QA_OTHERCO_E2E) are **already gone** — the earlier purge helper removed them. What remains:

Flagged organisations (6):
- QA_GATE7_686096 — active
- CB Test Company — archived
- Rehearsal Hotels Ltd — archived
- Rehearsal Hotels 489631 — archived
- taasflow — archived, internal
- TaaSFlow Platform — archived, internal

Flagged positions (13), grouped by intent:
- Delete — QA fixtures: `[QA test — ignore] QA Role Aug 17`, `[QA test — ignore] QA Role Aug 17 v2`, `BROWSER-TEST-R2 Admin Position`, `BROWSER-TEST-R2 Position`, `BROWSER-TEST-R3 Position`, `QA Gate Role 86485` (all Northwind), plus every position belonging to the six organisations above (CB Test, both Rehearsal roles, taasflow, TaaSFlow Platform).
- Delete — unflagged but clearly fixtures: `[QA test — ignore] Audit Role`, `[QA test — ignore] Cert Role` (Northwind). These carry no flag, so they are invisible to the counter but still visible to operators.
- **Keep and correct the flag** — two rows are mislabelled, not fixtures:
  - Northwind `Senior back end` — a real role the report itself lists as real.
  - Acme Startup (Empty Demo) `Senior Full-Stack Engineer` — belongs to a demo org, not a test org.
  Both get the test flag cleared instead of deleted. Without this, the counter can never reach 0 without destroying real/demo content.

Candidates: 17 QA profiles, 13 QA applications. 10 are the `qa.linkedin.*` / `qa.nolinkedin.*` pairs on `qa.*@qa.taasflow.test` attached to the **real** Northwind "Senior Full-Stack Engineer" — these are the rows inflating the Publish blocked list and the UNPROCESSED CVS count. Also removed: Quinn Receipt Tester, QA Mobile Tester, QA Walkthrough Candidate, QA Candidate ×2, QA Priya Raman, QA Applicant SMOKE-*. 13 candidate CV files come with them.

Threads: the 5 named on `/admin/messages` (`History Integrity Test 1786782275114`, `BROWSER-TEST-R2 Position`, `BROWSER-TEST-R3 Position`, `QA Gate Role 86485`, the `[QA test — ignore] client window check v2` thread) plus the two TaaSFlow Platform threads that die with that org.

Delivery: `qa.admin@qa.taasflow.test` has 13 suppressed and 10 failed sends. The suppression table itself is empty — the block is coming from delivery rows, so those rows are what gets removed.

QA seat profiles (`qa.seat.*@qa.taasflow.test`, `Gate Contact`, `Ana Test`, `qa-audit-donotsend@`) lose their memberships when their organisations go; the "QA platform_admin" entry on `/admin/team` is one of these seats and disappears with them.

## How it will be done

One additive, reversible migration, in dependency order, using the existing audited delete helpers rather than raw cascades where they exist:

1. Snapshot every table touched into a timestamped `qa_purge_backup_*` set of tables in the same migration, so the whole operation is reversible by insert-back. Rollback notes go in the migration header.
2. `hard_delete_candidate_match` for each QA candidate match (this already clears score runs, evidence, notes, stage history, decisions, interviews, tasks, shortlist references, notification events, and processing jobs).
3. Delete QA applications, candidate profiles, and their CV file rows.
4. `hard_delete_position` for each fixture position (handles the restrict-on-delete edges: applications, matches, score runs).
5. Delete the QA threads and their messages/reads.
6. Delete the six organisations — the remaining child tables cascade; the restrict edges (positions, matches) are already empty by this point.
7. Delete the `qa.admin@qa.taasflow.test` delivery rows and any notification rows addressed to `*@qa.taasflow.test`.
8. Clear the test flag on the two mislabelled real/demo positions.

Storage objects for the deleted CV files are removed separately after the migration, since a migration cannot touch the storage bucket.

## Verification

- Re-run the count behind the disclosure: flagged organisations = 0, flagged positions = 0, and confirm `/admin/intake` renders no "Test records are hidden" line.
- `/admin/health` UNPROCESSED CVS drops by 10; Publish desk blocked list drops by 10.
- `/admin/messages` shows 7 threads, none QA.
- Delivery health no longer lists `qa.admin@qa.taasflow.test` as a failure source.
- `/admin/team`, `/admin/support`, `/admin/payments`, `/admin/clients` pickers list only real organisations with the toggle in either position.
- Northwind keeps exactly two roles: `Senior Full-Stack Engineer` and `Senior back end`.
- Full test suite plus the smoke journey, since QA specs may reference fixture names; any spec that seeded from the closed endpoint gets pointed at its own per-run fixtures instead.

## Risk

The two "keep and correct" rows are the only judgement call — everything else is named by the report or belongs to a fixture organisation. Nothing in Northwind's real role, its real candidates, Flow Group Ventures, atlasflow, BRPH, Bob law, neuronflow, or the Acme/Northwind demo content is touched.
