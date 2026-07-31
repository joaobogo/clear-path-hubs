# TaaSFlow Payments Runbook

Five things that go wrong with money, and exactly what to do about each.
Written against the system as built — where something has to happen in Stripe
rather than in TaaSFlow, it says so.

---

## 1. Refund a client

There is no refund button inside TaaSFlow. Refunds are issued in Stripe; the
app learns about them through the webhook.

1. Open the Payments tab in your Lovable project and find the transaction
   (search by client email or the position title in the charge description).
2. Issue the refund in Stripe — full or partial.
3. Within a few seconds the webhook at `/api/public/payments/webhook` fires
   `charge.refunded`, and `apply_payment_webhook_event` writes the outcome to
   `public.payments` and flips the linked position's `payment_status`.
4. Confirm in **Admin → Payments**: the row should now show `refunded`, and
   the role should show as unpaid.

**What happens to the role.** A refunded role does not silently stay live. The
payment gate trigger blocks it from being set back to active until it is paid
again or explicitly exempted (step 2 below).

**If the app doesn't reflect the refund within a minute**, the webhook did not
land — go to step 4.

---

## 2. Exempt a role from payment

Use this for a genuinely free role: a goodwill re-run, a pilot you agreed to
comp, a role that was paid outside the system.

1. **Admin → Positions → [the role]**.
2. Use the payment exemption control. **A reason is required** — it is written
   into the audit trail with your user id, and it is the only record of why
   this role went live without money.
3. The role can now be activated normally.

Under the hood this calls `admin_set_position_payment_exempt`, which is
platform-staff only. Client admins cannot exempt their own roles.

**Do not** use exemption to work around a failed payment you expect to collect.
Fix the payment instead — an exemption looks identical to "we decided this was
free" six months later.

---

## 3. Pause an account

There is no single "pause org" switch, because pausing means different things.
Pick the one you actually need.

**Stop new work but keep the workspace readable** (the usual case):
Set the organisation's status to `paused` in **Admin → Organisations**. Roles
stay visible, the team keeps read access, nothing is deleted.

**Take a specific role off the board:**
**Admin → Positions → [the role] → Pause.** It disappears from the public job
board immediately. Candidates who already applied keep their status page and
their reference ID.

**Cut off a specific person's access:**
Suspend their membership from the client Account page or **Admin → Members**.
This is per-person, not per-org — suspending one admin does not lock the
workspace.

**Non-payment** is not an automatic pause. If a client hasn't paid, their roles
simply never go live; existing live roles keep running until you pause them
deliberately.

---

## 4. Retry a failed webhook

Stripe retries a failed delivery on its own for up to three days, so most
failures resolve without you. Act when **Admin → Health** shows webhook
failures that are not clearing.

1. **Admin → Health** — the webhook section lists failed deliveries with the
   event type and the error.
2. If the failure was transient (a deploy, a timeout), resend the event from
   the Payments tab in your Lovable project. Find the event, click resend.
3. Resending is safe. `apply_payment_webhook_event` is idempotent on the Stripe
   event ID — a replayed event that was already applied is recorded and
   ignored, it does not double-charge, double-refund, or double-activate.
4. If the same event fails repeatedly, the payload is hitting a real bug. Do
   not keep resending. Capture the event ID and the error from Admin → Health
   and escalate (step 5).

**Signature failures are different.** `Invalid webhook signature` means the
signing secret is wrong for that environment, not that the event is bad.
Resending will fail the same way every time. That is an escalation, not a
retry.

---

## 5. Who to contact when payments break

Work down this list; most incidents stop at the first or second line.

**First — is it Stripe or is it us?**
Check [status.stripe.com](https://status.stripe.com). If Stripe is degraded,
checkout failures and missing webhooks are expected and will self-resolve.
Tell affected clients it is upstream and give them a time to check back.

**Card declines, disputes, chargebacks, payout questions** — Stripe support,
through the Stripe dashboard. Have the Stripe account ID ready:

```
Sandbox: acct_1Tz5nM9JsllHKG4A
Live:    (assigned when go-live completes)
```

**Checkout won't open, webhooks don't arrive, a paid role won't go live** —
this is application-side. Capture, in this order:

- the Stripe event ID or checkout session ID
- the position ID and organisation
- the exact error text from Admin → Health
- whether it reproduces in preview

Then escalate to whoever owns the codebase.

**A client is out of pocket and waiting** — refund first (step 1), diagnose
second. A refund is always reversible by taking payment again; a client waiting
three days for an answer is not.

---

## Quick reference

| Situation | Where | Reversible? |
|---|---|---|
| Refund a client | Stripe → Payments tab | Yes — charge again |
| Free role | Admin → Positions → exempt (reason required) | Yes — remove exemption |
| Pause an account | Admin → Organisations → status `paused` | Yes |
| Pause one role | Admin → Positions → Pause | Yes |
| Retry a webhook | Payments tab → resend event | Safe to repeat |
| Stripe is down | status.stripe.com | Wait |

---

*Last reviewed: July 2026. Payments are in test mode — the live account ID
above is blank until go-live completes.*
