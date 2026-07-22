# Admin Guide

You are TaaSFlow platform staff. You review intakes, publish candidates, and support users.

## Daily routine

1. **Overview** (`/admin`) — attention-needed KPIs. Anything red first.
   ![TODO screenshot — /admin]()
2. **Intake queue** (`/admin/intakes`) — approve/edit fresh intakes; activate positions.
   ![TODO screenshot — /admin/intakes]()
3. **Processing** — anything in `failed` state → runbook 02/03/04/05.
4. **Publish desk** (`/admin/publish`) — compare candidates per position, publish the strongest.
   ![TODO screenshot — /admin/publish]()
5. **Support** (`/admin/support`) — resolve access tickets using canonical actions.
6. **Operations** (`/admin/operations`) — cost + failure spikes.

## Never

- Never write to Supabase directly. Use the canonical action button.
- Never share a password. Use `resendInvitation` or `sendRecoveryLink`.
- Never publish a candidate below threshold without a documented reason.
