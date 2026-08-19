# One delivery-failure number, and no self-feeding failure queue

## What's wrong today

Five surfaces each compute the number themselves:

| Surface | Where it comes from | Why it disagrees |
| --- | --- | --- |
| `/admin` tile "Delivery failures to retry (7d)" = 13 | `admin-ops.server.ts` filters the ledger to `retryable` only, inside a queue payload that is cached separately | counts a different subset than the page it links to |
| `/admin/operations` "Delivery failures (7d)" = 86 | `listDeliveryFailures` in `notifications.functions.ts`, `items.length` | counts every failed / bounced / suppressed row |
| `/admin/health` "FAILED EMAILS" = 0 | `admin-health.server.ts` counts `issues.filter(i => ["failed",...].includes(i.detail.split(" ")[0]))` | `detail` was changed to a human sentence, so the first word is never a status word — the filter always matches nothing. That is the hard zero above 80 rows. |
| `/admin/notifications` banner "68 of 86" | same `listDeliveryFailures`, plus a second query behind `DeliveryFailuresPanel` (`listDeliveryFailureQueue`) | two round-trips, two cache keys, drift between banner and rows |
| `/admin/integrations` "no send has been recorded yet" | `integration-health.server.ts` only asks the mail provider's last-100-events API | reports provider history, never our own ledger, so it says "nothing sent" while 80 sends are recorded |

The growth loop: a suppressed address still gets a row per notification.
`lead-pipeline.server.ts` records a suppressed recipient as `email_status: "failed"`
(a *retryable* failure), and `dispatchEmails` writes a `suppressed` delivery row that
`loadDeliveryFailures` still counts in `summary.total`. So logging a decision and
sending a nudge manufactured five new "failures" nobody can drain.

## 1. One count, one source

`src/lib/notification-failures.server.ts` stays the only place that reads the ledger and
keeps its 7-day `WINDOW_DAYS`. It gains an explicit metric contract on the summary:

```
windowDays: 7
retryable        // failures a retry can clear  <- THE headline number
blockedNotSent   // suppressed / bounced addresses, never retryable
total            // retryable + blockedNotSent, for reconciliation copy only
```

`loadDeliveryFailures` filters the window on `lastAttemptAt` itself (today `/admin`
re-filters after the fact, which is where "13 vs 86" comes from), and stops counting
`recipient_suppressed` rows as failures — they become `blockedNotSent`.

One server function, in `notification-failures.functions.ts`:

- `getDeliveryFailureMetric` — staff-gated, returns items + summary + volume + email config.
- It absorbs everything `listDeliveryFailures` (in `notifications.functions.ts`) returned,
  so that function is **deleted** along with its import in the two routes.
- `listDeliveryFailureQueue` becomes a thin re-export of the same handler so the panel and
  the page share one payload.

Every surface then reads one shared query key (`["admin","delivery-failures","7d"]`) via a
small `useDeliveryFailures()` hook, so all five read the same cache entry within a minute:

- `/admin` tile: `summary.retryable` (and the existing blocked-addresses badge from
  `summary.blockedNotSent`) — no local filtering in `admin-ops.server.ts`.
- `/admin/operations`: `summary.retryable`, tab label included.
- `/admin/health`: the broken `detail.split(" ")` filter is removed; the email bucket takes
  `summary.retryable` from the canonical loader, and the list under it renders the same items.
- `/admin/notifications`: keeps today's tiles and the diagnostic banner copy verbatim —
  "Every further notification to them fails on send, so retrying will not clear the list —
  release the address first, or the count keeps growing."
- `/admin/integrations`: the email check keeps the provider probe for reachability, but when
  the provider returns no history it reports our own ledger instead of "no send has been
  recorded yet" — "N sends recorded in the last 7 days; provider history is empty."

## 2. Break the loop

Check suppression **before** manufacturing a retryable row:

- `dispatchEmails` (`notification-email.server.ts`) already resolves the address and calls
  `isSuppressed`. That check moves ahead of the sandbox/config branches, and the row it
  writes is explicitly `status: "suppressed"`, `error_code: "recipient_suppressed"` —
  counted as `blockedNotSent`, never `retryable`.
- `lead-pipeline.server.ts` currently pushes suppressed recipients into `failures`, which
  makes `email_status = "failed"`. It will instead drop them from the send list and, when
  every recipient is suppressed, record `email_status: "suppressed"` with
  `email_detail: "recipient_suppressed"`.
- `delivery-reasons.ts` renders that state as **"Not sent — recipient suppressed"** with the
  existing release-the-address sentence, and `retryable: false`.

Result: sending a nudge to a suppressed address adds a "not sent" row, not a retry task.

## Verification

1. Playwright pass over `/admin`, `/admin/operations`, `/admin/health`,
   `/admin/notifications`, `/admin/integrations` in one run — assert the same number on all five.
2. Log a client decision + send one nudge, re-read all five — the retryable count must not move.
3. `bunx vitest run` for the notification/delivery suites.

## Technical notes

- Files edited: `src/lib/notification-failures.server.ts`,
  `src/lib/notification-failures.functions.ts`, `src/lib/notifications.functions.ts`
  (delete `listDeliveryFailures`), `src/lib/admin-ops.server.ts`,
  `src/lib/admin-health.server.ts`, `src/lib/integration-health.server.ts`,
  `src/lib/notification-email.server.ts`, `src/lib/leads/lead-pipeline.server.ts`,
  `src/lib/notifications/delivery-reasons.ts`, the three admin routes and
  `src/components/admin/delivery-failures-panel.tsx`.
- New: `src/lib/admin/use-delivery-failures.ts` (shared query key + hook).
- No migration, no schema change, no data rewrite — existing suppressed rows simply
  reclassify from "failure" to "not sent" on read.
