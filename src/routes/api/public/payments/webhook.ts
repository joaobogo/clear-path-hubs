import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function recordPayment(
  session: any,
  env: StripeEnv,
  eventId: string,
  status: "paid" | "pending" | "unpaid",
) {
  const positionId = session.metadata?.position_id ?? null;
  const organizationId = session.metadata?.organization_id ?? null;
  if (!positionId || !organizationId) {
    console.error("payments webhook: session without position/organization metadata", session.id);
    return;
  }

  const db = await admin();

  // Idempotency: one row per checkout session, one apply per webhook event.
  const { data: existing } = await db
    .from("payments")
    .select("id, webhook_event_id, status")
    .eq("provider_reference", session.id)
    .maybeSingle();

  if (existing?.webhook_event_id === eventId) return;

  const row = {
    organization_id: organizationId,
    position_id: positionId,
    provider: "stripe",
    provider_environment: env,
    provider_reference: session.id,
    provider_customer_id:
      typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
    price_id: "pilot_onetime",
    amount_cents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    status,
    paid_at: status === "paid" ? new Date().toISOString() : null,
    webhook_event_id: eventId,
    raw_event: { id: eventId, type: session.object, session_id: session.id },
    updated_at: new Date().toISOString(),
  };

  if (existing) await db.from("payments").update(row).eq("id", existing.id);
  else await db.from("payments").insert(row);

  if (status === "paid") {
    await db
      .from("positions")
      .update({ payment_status: "paid" })
      .eq("id", positionId)
      .neq("payment_status", "exempt");
  } else if (status === "pending") {
    await db
      .from("positions")
      .update({ payment_status: "pending" })
      .eq("id", positionId)
      .in("payment_status", ["unpaid", "pending"]);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const object = event.data.object;

  switch (event.type) {
    case "checkout.session.completed":
      if (object.payment_status !== "unpaid") await recordPayment(object, env, event.id, "paid");
      else await recordPayment(object, env, event.id, "pending");
      break;
    case "checkout.session.async_payment_succeeded":
      await recordPayment(object, env, event.id, "paid");
      break;
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await recordPayment(object, env, event.id, "unpaid");
      break;
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
