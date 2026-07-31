import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook, createStripeClient } from "@/lib/stripe.server";
import { POSITION_PUBLISH_PRICE_ID } from "@/lib/payments-catalog";

type Outcome = "paid" | "refunded" | "pending" | "unpaid";

async function applyEvent(args: {
  eventId: string;
  eventType: string;
  env: StripeEnv;
  session: any;
  outcome: Outcome;
}) {
  const { session, env, eventId, eventType, outcome } = args;
  const organizationId = session.metadata?.organization_id ?? null;
  const positionId = session.metadata?.position_id ?? null;

  if (!organizationId) {
    console.error("payments webhook: session without organization metadata", session.id, eventType);
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Everything (payment row, payment_status, publish/pause, notify, audit)
  // happens inside one database transaction, idempotent on the event id.
  const { data, error } = await supabaseAdmin.rpc("apply_payment_webhook_event", {
    _event_id: eventId,
    _event_type: eventType,
    _environment: env,
    _provider_reference: session.id,
    _organization_id: organizationId,
    _position_id: positionId,
    _price_id: POSITION_PUBLISH_PRICE_ID,
    _amount_cents: session.amount_total ?? 0,
    _currency: session.currency ?? "usd",
    _customer_id:
      typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
    _outcome: outcome,
    _raw: { event_id: eventId, event_type: eventType, session_id: session.id },
  });

  if (error) throw error;
  console.log("payments webhook applied", eventType, eventId, data);

  // Receipt — only on a real payment, deduped on the Stripe event id.
  if (outcome === "paid") {
    try {
      const recipient =
        session.customer_details?.email ?? session.customer_email ?? null;
      if (recipient) {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const { absoluteUrl } = await import("@/lib/blueprint-pipeline.server");
        let roleTitle: string | null = null;
        if (positionId) {
          const { data: pos } = await supabaseAdmin
            .from("positions")
            .select("title")
            .eq("id", positionId)
            .maybeSingle();
          roleTitle = pos?.title ?? null;
        }
        const amountCents = session.amount_total ?? 0;
        const currency = String(session.currency ?? "usd").toUpperCase();
        const paidOn = new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        await sendTemplateEmail("payment-receipt", recipient, {
          idempotencyKey: `payment-receipt-${eventId}`,
          templateData: {
            contactName: session.customer_details?.name ?? undefined,
            roleTitle: roleTitle ?? "your role",
            amount: `${currency} ${(amountCents / 100).toFixed(2)}`,
            paidOn,
            reference: session.id,
            nextStep: "We confirm the search plan and begin sourcing candidates.",
            dueDate: due,
            workspaceUrl: positionId
              ? absoluteUrl(`/client/positions/${positionId}`)
              : absoluteUrl("/client"),
          },
        });
      }
    } catch (err) {
      console.error("payments webhook: receipt email failed (non-critical)", err);
    }
  }
}

/** Refund and dispute events arrive on the charge, not the session. */
async function sessionForCharge(charge: any, env: StripeEnv) {
  const paymentIntent =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return null;
  const stripe = createStripeClient(env);
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
  return sessions.data[0] ?? null;
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const object = event.data.object;
  const base = { eventId: event.id, eventType: event.type, env };

  switch (event.type) {
    case "checkout.session.completed":
      await applyEvent({
        ...base,
        session: object,
        outcome: object.payment_status === "unpaid" ? "pending" : "paid",
      });
      break;

    case "checkout.session.async_payment_succeeded":
      await applyEvent({ ...base, session: object, outcome: "paid" });
      break;

    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await applyEvent({ ...base, session: object, outcome: "unpaid" });
      break;

    // Refunds and chargebacks: mark refunded, pause the role, notify admins.
    case "charge.refunded":
    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const charge = event.type.startsWith("charge.dispute")
        ? { payment_intent: object.payment_intent, id: object.charge }
        : object;
      if (event.type === "charge.dispute.closed" && object.status === "won") {
        console.log("dispute won — leaving payment as paid", event.id);
        break;
      }
      const session = await sessionForCharge(charge, env);
      if (!session) {
        console.error("payments webhook: no checkout session for charge", event.id);
        break;
      }
      await applyEvent({ ...base, session, outcome: "refunded" });
      break;
    }

    default:
      console.log("Unhandled payments event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("payments webhook: invalid env", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("payments webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
