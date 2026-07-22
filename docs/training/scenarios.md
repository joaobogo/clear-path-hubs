# Scenario-Based Training

Complete each scenario against a seeded fixture; check off the outcome, then paste the resulting `trace_id`s into the training log.

## Prerequisites

- Fixture reset: `bunx tsx scripts/seed-training.ts` (BLOCKED — depends on BG-SCALE-01).
- Two-tab setup: Admin + Client (or Admin + Candidate as noted).

## Scenarios

1. **Create first client**
   - As candidate email `demo@example.com`, complete `/intake`.
   - As Admin, approve in `/admin/intakes`; position becomes `active`.
   - Expected: 1 `organizations`, 1 `positions`, 1 `memberships('client_admin')`.

2. **Activate a position**
   - As client_admin, create a position through the wizard.
   - Admin approves; view on `/jobs`.
   - Expected: row appears on public job board within 30 s.

3. **Review and publish a candidate**
   - Apply as candidate; wait for `scored`.
   - As Admin, open `/admin/publish/<positionId>`, review evidence, publish.
   - As Client, see the candidate on Kanban at `Delivered`.
   - Expected: `notification_events('match.delivered')`; client email received.

4. **Handle a failed CV**
   - Upload a scanned PDF (no text layer) → `ocr_pending`.
   - As Admin, run OCR (runbook 03).
   - Expected: state advances to `parsed`.

5. **Respond to client feedback**
   - As Client, move candidate to `Rejected` with a note.
   - As Admin, see it in the queue; message client via thread.
   - Expected: `client_decisions` + message thread updated.

6. **Coordinate an interview**
   - As Client, schedule; as Candidate, receive email + see in `/me/applications`.
   - Record outcome; state advances.

7. **Resolve an access issue**
   - Client user locked → `unlockAccount` from `/admin/support/users/$id`.
   - Expected: user signs in; `support_actions` row present.

8. **Handle provider outage**
   - Simulate: `setProviderCircuitBreaker('lovable_ai', 'open', 'training')`.
   - Confirm banner in `/admin`; new applications queue.
   - Close breaker after 5 min; jobs drain.

## Result reporting

For each scenario the trainee submits:
- `trace_id`s produced
- screenshots of before/after
- any deviation from the runbook

## Certification

A trainee is certified when they complete scenarios 1–7 without developer help. Scenario 8 is required for on-call rotation only.

**Status today: NOT EXECUTED — depends on Phase 17 P1/P3/BG-02 + BG-SCALE-01.**
