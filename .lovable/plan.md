# Where the confirmed-hire figure is computed

No code changes made. Here is the map.

## Two definitions exist

**A. Stage-based** — a candidate whose match stage is `hired`.

- `src/lib/client-kpi.server.ts:371` — `computeKpis()` returns `hires`. This is what the
  Candidates snapshot, Roles/Positions list and per-role rollups, and the Account role
  panel read.
- `src/lib/client-kpi.server.ts:198` — `loadKpiRows()` tags the row array with
  `_canonical_hires` taken from the `client_dashboard_kpis` database view and that value
  wins over the stage count.
- `src/lib/client/candidate-kpi.ts:41` — a second, client-side stage count used by the
  Candidates snapshot on some paths.
- `src/lib/executive.functions.ts:380-390` — Insights 30/90/YTD hires, stage-based,
  windowed on `stage_entered_at`, and it does **not** use the view value.
- `src/lib/client-shared.server.ts:150` — pipeline language `hires: counts.hired`.

The view itself (confirmed against the database) is:

```text
client_dashboard_kpis.hires = count(*) FILTER (WHERE stage = 'hired')
```

It has no `client_visibility = 'visible'` and no `is_test_record = false` filter, unlike
every client-side query that feeds `loadKpiRows`.

**B. Offer-record based** — `hire_records.status = 'hire_confirmed'`.

- `src/lib/hires/confirmed.ts:14-24` — `selectConfirmedHires` / `countConfirmedHires`.
- `src/lib/offer-hire.ts:125,220` — `qualifiesAsHire` and `summarise().hires_confirmed`;
  this is the only path that stays offer-record based end to end (admin offer/hire panel).
- `src/lib/account.functions.ts:136-163` — reads `hire_records` directly for
  `this_period`, `last_90_days` and `upcoming_starts`.

**The file that reads the offer records is `src/lib/hires.functions.ts`** (plus
`src/lib/offer-hire.server.ts` and `src/lib/account.functions.ts`). But its own total is
then overwritten by the stage view at `src/lib/hires.functions.ts:858`:
`hires_confirmed: kpi?.hires ?? hires.length` — and the fallback counts **all**
`hire_records` rows, not just confirmed ones.

## What the data says

For the org with activity there is exactly one confirmed hire, and both definitions agree
on it: one match at stage `hired` (visible, not a test record) and one `hire_record` with
`status = 'hire_confirmed'`, `hired_at` set 22 Aug. So the "1" surfaces are correct.

The two zeros are the interesting part:

- Account tile `Hires closed` (`src/routes/_authenticated/client.account.tsx:264-272`)
  prints `hires.total` (1) with a note beneath it. That org has no
  `billing_period_start`, so the note falls back to `last_90_days`. Any "0" seen on this
  tile is the note, not the value — `this_period` is structurally 0 whenever the billing
  period is unset because `inPeriod()` returns false without a period start
  (`src/lib/account.functions.ts:169-176`).
- Offers page (`src/routes/_authenticated/client.offers.tsx:172`) requests the report
  with `sinceDays: 180`; when the report is pending or errors, the tile falls back to
  `countConfirmedHires(hires)` over the `listHires` result. A 0 here means either the
  report call failed or `listHires` returned no confirmed row for the active org — which
  needs one live check to confirm before any code moves.

## Proposed fix, once you want it

1. Confirm the live 0 on Offers: capture the `hires` / `hires-report` responses for the
   active org, so the cause is proven rather than assumed.
2. Pick one definition. Recommendation: the offer record (`status = 'hire_confirmed'`) is
   the auditable one — it carries start date, comp and guarantee.
3. Single-source it: one server helper that counts confirmed hires from `hire_records`,
   org-scoped and test-record filtered. `computeKpis`, `getTimeToHireReport`,
   `account.functions`, `executive.functions` and the Offers tile all call it.
4. Remove the `_canonical_hires` injection and the `kpi?.hires ??` override, and stop the
   `hires.length` fallback that counts unconfirmed offers.
5. Fix the view so `hires` respects `client_visibility` and `is_test_record`, or drop the
   column so nothing can read it again.
6. Make the Account note honest when there is no billing period, and reconcile Insights
   windows on `hired_at` rather than `stage_entered_at`.
7. Extend `src/lib/client/hire-count-consistency.test.ts` so every surface asserts against
   the single helper.
