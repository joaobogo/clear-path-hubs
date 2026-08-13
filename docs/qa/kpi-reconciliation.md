# KPI reconciliation — admin overview, client overview, candidate home

Every tile below names the code that produces it, the filters it applies, and a
direct database count run on the same filters. A mismatch is treated as a query
bug; displays were not adjusted to hide differences.

Demo workspace: Northwind Talent (Demo). Test-flagged organizations are excluded
from all admin queues.

## Client overview — `getClientOverview` → `computeKpis` (`src/lib/client-kpi.server.ts`)

All tiles filter the same row set: `candidate_matches` for the workspace with
`client_visibility = 'visible'`.

| Tile | Filters | Rendered | Direct count | Verdict |
| --- | --- | --- | --- | --- |
| Candidates delivered | distinct candidate per visible match | 10 | 10 | PASS |
| Strongest candidates | approved band/label in top group | 2 | 2 | PASS |
| Waiting on your decision | `stage = 'delivered'`, delivered, no `client_decisions` row | 1 | 1 | PASS (was 0 — fixed) |
| Shortlisted | `stage = 'shortlisted'` | 4 | 4 | PASS |
| Interviewing | `stage = 'interview_process'` | 2 | 2 | PASS |
| Hires | `stage = 'hired'` | 1 | 1 | PASS |

**Bug fixed.** "Waiting on your decision" was keyed off the internal
`recommendation` column. That column holds *our* recommendation, not the
client's answer, so any candidate we had already recommended dropped out of the
queue and the tile read 0 while the "Your open items" strip listed one. The rule
is now one definition — delivered, still at `delivered`, no `client_decisions`
row — shared by the tile, the per-role roll-up and the open-items strip.

## Admin overview — `getAdminWorkQueues` (`src/lib/admin-ops.server.ts`)

| Queue | Filters | Rendered | Direct count | Verdict |
| --- | --- | --- | --- | --- |
| Awaiting payment | positions unpaid/pending, not closed/filled/archived | 7 | 7 | PASS |
| Needs setup | positions submitted/needs_clarification and paid | 2 | 2 | PASS |
| Needs review | matches `admin_status = 'pending'`, scored | 2 | 2 | PASS |
| Client decisions overdue | visible matches in delivered/shortlisted/reviewing, untouched 3+ days, no decision | 0 | 0 | PASS (count no longer capped — fixed) |
| Interviews | requested, or scheduled within 48h | 0 | 0 | PASS |
| Pipeline blocked | processing failed/blocked/ocr/manual review | 1 | 1 | PASS |
| Aging intakes | submitted, unconverted, 3+ days | 0 | 0 | PASS |

**Bug fixed.** The overdue-decisions count was derived from a 20-row page, so
the tile silently capped at 20 regardless of the real backlog. The page is now
read wide enough that the filtered total is the true total.

## Candidate home — `getMyDashboard` (`src/lib/candidate.functions.ts`)

| Tile | Filters | Verdict |
| --- | --- | --- |
| Open information requests | `candidate_info_requests.status = 'open'` for my profile | PASS |
| Unread messages | my thread, not sent by me, `read_at` null | PASS (was permanently 0 — fixed) |

**Bug fixed.** The unread count filtered on
`recipient_context->>candidate_user_id`, a key no writer ever sets, so the tile
read 0 even with unread replies visible on the messages page. Both the tile and
the message list now use the thread key the sender actually writes.

## Follow-ups (not bugs)

- Admin queues exclude test-flagged *organizations*, matching the desks they
  link to. Test-flagged positions inside real organizations are not excluded
  anywhere, which is consistent between count and list.
