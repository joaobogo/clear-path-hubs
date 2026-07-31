import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import { POSITION_PUBLISH_PRICE_ID } from "@/lib/payments-catalog";

type CheckoutResult = { clientSecret: string } | { error: string };

export type CheckoutStatus =
  | {
      state: "paid";
      positionId: string | null;
      positionTitle: string | null;
      reference: string;
      amountCents: number | null;
      currency: string | null;
    }
  | { state: "processing"; positionId: string | null; reference: string }
  | { state: "open"; positionId: string | null; reference: string }
  | { state: "expired" | "failed"; positionId: string | null; reference: string; message: string }
  | { state: "error"; message: string };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** What the client is about to pay for — read from real records, server-side. */
export const getPositionCheckoutContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { positionId: string }) => {
    if (!isUuid(data.positionId)) throw new Error("Invalid position");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: position, error } = await supabase
      .from("positions")
      .select("id, title, status, payment_status, organization_id")
      .eq("id", data.positionId)
      .maybeSingle();

    if (error || !position) return { ok: false as const, error: "not_found" };

    return {
      ok: true as const,
      position: {
        id: position.id,
        title: position.title,
        status: position.status,
        paymentStatus: position.payment_status,
      },
    };
  });

/**
 * Creates the Stripe checkout session for publishing a role.
 * Price and product are resolved server-side from the catalogue — nothing the
 * browser sends about price is trusted. Organisation and position ids are put
 * on the session metadata so the webhook can match the payment to the role.
 */
export const createPositionCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { positionId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!isUuid(data.positionId)) throw new Error("Invalid position");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabase, userId } = context;

    const { data: position, error } = await supabase
      .from("positions")
      .select("id, title, organization_id, payment_status")
      .eq("id", data.positionId)
      .maybeSingle();

    if (error || !position) return { error: "We couldn't find that role in your workspace." };
    if (position.payment_status === "paid" || position.payment_status === "exempt") {
      return { error: "This role is already paid for." };
    }

    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [POSITION_PUBLISH_PRICE_ID] });
      if (!prices.data.length) return { error: "Price not found" };
      const price = prices.data[0];

      const productId = typeof price.product === "string" ? price.product : price.product.id;
      const product = await stripe.products.retrieve(productId);

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      const email = (profile as { email?: string } | null)?.email;

      let customerId: string | undefined;
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 1,
      });
      if (found.data.length) customerId = found.data[0].id;
      else if (email) {
        const existing = await stripe.customers.list({ email, limit: 1 });
        if (existing.data.length) {
          customerId = existing.data[0].id;
          if (existing.data[0].metadata?.userId !== userId) {
            await stripe.customers.update(customerId, {
              metadata: { ...existing.data[0].metadata, userId },
            });
          }
        }
      }
      if (!customerId) {
        const created = await stripe.customers.create({
          ...(email ? { email } : {}),
          metadata: { userId },
        });
        customerId = created.id;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        automatic_tax: { enabled: true },
        payment_intent_data: { description: `${product.name} — ${position.title}` },
        metadata: {
          userId,
          organization_id: position.organization_id,
          position_id: position.id,
          managed_payments: "false",
        },
      });

      // Mark the role as awaiting payment; it stays a draft either way.
      await supabase
        .from("positions")
        .update({ payment_status: "pending" })
        .eq("id", position.id)
        .in("payment_status", ["unpaid", "pending"]);

      return { clientSecret: session.client_secret ?? "" };
    } catch (err) {
      return { error: getStripeErrorMessage(err) };
    }
  });

/**
 * Verifies a checkout session with Stripe before anything claims success, and
 * records the payment idempotently. Never trusts the browser's word for it.
 */
export const getCheckoutSessionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_[a-zA-Z0-9_]+$/.test(data.sessionId)) throw new Error("Invalid session");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutStatus> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      const positionId = (session.metadata?.position_id as string | undefined) ?? null;
      const organizationId = (session.metadata?.organization_id as string | undefined) ?? null;
      const reference = session.id;

      if (session.metadata?.userId && session.metadata.userId !== context.userId) {
        return { state: "error", message: "This payment belongs to another account." };
      }

      if (session.status === "expired") {
        return {
          state: "expired",
          positionId,
          reference,
          message: "This checkout link expired before payment completed.",
        };
      }

      if (session.payment_status === "unpaid" && session.status === "open") {
        return { state: "open", positionId, reference };
      }

      if (session.payment_status === "unpaid") {
        return { state: "processing", positionId, reference };
      }

      // paid or no_payment_required — record it, then report success.
      if (positionId && organizationId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: existing } = await supabaseAdmin
          .from("payments")
          .select("id")
          .eq("provider_reference", reference)
          .maybeSingle();

        const row = {
          organization_id: organizationId,
          position_id: positionId,
          provider: "stripe",
          provider_environment: data.environment,
          provider_reference: reference,
          provider_customer_id:
            typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
          price_id: POSITION_PUBLISH_PRICE_ID,
          amount_cents: session.amount_total ?? null,
          currency: session.currency ?? null,
          status: "paid" as const,
          paid_at: new Date().toISOString(),
        };

        if (existing) await supabaseAdmin.from("payments").update(row).eq("id", existing.id);
        else await supabaseAdmin.from("payments").insert(row);

        await supabaseAdmin
          .from("positions")
          .update({ payment_status: "paid" })
          .eq("id", positionId)
          .neq("payment_status", "exempt");
      }

      const { data: position } = positionId
        ? await context.supabase.from("positions").select("title").eq("id", positionId).maybeSingle()
        : { data: null };

      return {
        state: "paid",
        positionId,
        positionTitle: (position as { title?: string } | null)?.title ?? null,
        reference,
        amountCents: session.amount_total ?? null,
        currency: session.currency ?? null,
      };
    } catch (err) {
      return { state: "error", message: getStripeErrorMessage(err) };
    }
  });
