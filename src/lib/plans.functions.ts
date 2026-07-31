/**
 * Buying and managing a plan.
 *
 * Business rules, decided with the operator:
 *  - Buying a package or subscription grants a role allowance and notifies ops
 *    so a human confirms the brief the same day.
 *  - Cancelling keeps access until the paid period ends; live roles are paused
 *    only when the period actually expires (the provider tells us).
 *  - Upgrades apply immediately and are pro-rated; downgrades wait for renewal
 *    so nobody loses allowance in the middle of a search.
 *
 * Prices are always resolved provider-side from a lookup key. The browser can
 * name a plan, never an amount.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import { PLAN_CATALOGUE, findPlan, allowanceSentence } from "@/lib/payments-catalog";

type AnySupabase = {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** The org this user can buy for — an admin of exactly this organisation. */
async function requireOrgAdmin(supabase: AnySupabase, userId: string, orgId: string) {
  const { data } = await supabase
    .from("memberships")
    .select("organization_id, role, status")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  if (!role || !["client_admin", "platform_admin", "operations"].includes(role)) {
    return false;
  }
  return true;
}

async function resolveCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  opts: { userId: string; email?: string },
) {
  if (!/^[a-zA-Z0-9_-]+$/.test(opts.userId)) throw new Error("Invalid user");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${opts.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;
  if (opts.email) {
    const existing = await stripe.customers.list({ email: opts.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (customer.metadata?.userId !== opts.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: opts.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(opts.email ? { email: opts.email } : {}),
    metadata: { userId: opts.userId },
  });
  return created.id;
}

// ─── What the client currently has ──────────────────────────────────────────

export type PlanState = {
  subscription: {
    priceId: string;
    label: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    pendingPriceId: string | null;
    pendingLabel: string | null;
    pendingEffectiveAt: string | null;
  } | null;
  allowance: {
    label: string;
    rolesTotal: number | null;
    rolesUsed: number;
    rolesRemaining: number | null;
    expiresAt: string | null;
    source: "package" | "subscription";
  } | null;
};

export const getPlanState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => {
    if (!isUuid(data.organizationId)) throw new Error("Invalid organisation");
    return data;
  })
  .handler(async ({ data, context }): Promise<PlanState> => {
    const supabase = context.supabase as unknown as AnySupabase;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select(
        "price_id, plan_label, status, current_period_end, cancel_at_period_end, pending_price_id, pending_effective_at",
      )
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: ent } = await supabase
      .from("plan_entitlements")
      .select("plan_label, roles_total, roles_used, expires_at, source")
      .eq("organization_id", data.organizationId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      subscription: sub
        ? {
            priceId: sub.price_id,
            label: sub.plan_label ?? findPlan(sub.price_id)?.label ?? sub.price_id,
            status: sub.status,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            pendingPriceId: sub.pending_price_id,
            pendingLabel: sub.pending_price_id
              ? (findPlan(sub.pending_price_id)?.label ?? sub.pending_price_id)
              : null,
            pendingEffectiveAt: sub.pending_effective_at,
          }
        : null,
      allowance: ent
        ? {
            label: ent.plan_label,
            rolesTotal: ent.roles_total,
            rolesUsed: ent.roles_used,
            rolesRemaining:
              ent.roles_total === null ? null : Math.max(0, ent.roles_total - ent.roles_used),
            expiresAt: ent.expires_at,
            source: ent.source,
          }
        : null,
    };
  });

// ─── Buying a plan ──────────────────────────────────────────────────────────

type CheckoutResult = { clientSecret: string } | { error: string };

export const createPlanCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      priceId: string;
      organizationId: string;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid plan");
      if (!isUuid(data.organizationId)) throw new Error("Invalid organisation");
      if (!findPlan(data.priceId)) throw new Error("Unknown plan");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { userId } = context;
    const supabase = context.supabase as unknown as AnySupabase;
    const plan = findPlan(data.priceId)!;

    if (!(await requireOrgAdmin(supabase, userId, data.organizationId))) {
      return { error: "Only an account admin can change the plan." };
    }

    // One live subscription per organisation — otherwise allowances collide.
    if (plan.kind === "subscription") {
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("organization_id", data.organizationId)
        .in("status", ["active", "trialing", "past_due"])
        .limit(1)
        .maybeSingle();
      if (existing) {
        return {
          error:
            "You already have a subscription. Use change plan instead of buying a second one.",
        };
      }
    }

    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) return { error: "We couldn't find that plan. Please try again." };
      const price = prices.data[0];
      const isRecurring = price.type === "recurring";

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      const email = (profile as { email?: string } | null)?.email;
      const customerId = await resolveCustomer(stripe, { userId, email });

      const productId = typeof price.product === "string" ? price.product : price.product.id;
      const product = await stripe.products.retrieve(productId);

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        automatic_tax: { enabled: true },
        ...(isRecurring
          ? {
              subscription_data: {
                metadata: {
                  userId,
                  organization_id: data.organizationId,
                  price_id: data.priceId,
                },
              },
            }
          : { payment_intent_data: { description: product.name } }),
        metadata: {
          userId,
          organization_id: data.organizationId,
          price_id: data.priceId,
          purchase_kind: plan.kind,
          managed_payments: "false",
        },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (err) {
      return { error: getStripeErrorMessage(err) };
    }
  });

// ─── Changing a plan ────────────────────────────────────────────────────────

type ChangeResult =
  | { ok: true; effect: "immediate" | "at_renewal"; effectiveAt: string | null; label: string }
  | { ok: false; error: string };

export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { organizationId: string; priceId: string; environment: StripeEnv }) => {
      if (!isUuid(data.organizationId)) throw new Error("Invalid organisation");
      if (!findPlan(data.priceId)) throw new Error("Unknown plan");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<ChangeResult> => {
    const { userId } = context;
    const supabase = context.supabase as unknown as AnySupabase;
    const target = findPlan(data.priceId)!;

    if (target.kind !== "subscription") {
      return { ok: false, error: "That plan is a one-off package, not a subscription." };
    }
    if (!(await requireOrgAdmin(supabase, userId, data.organizationId))) {
      return { ok: false, error: "Only an account admin can change the plan." };
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, provider_subscription_id, price_id, current_period_start, current_period_end")
      .eq("organization_id", data.organizationId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return { ok: false, error: "There's no active subscription to change." };
    if (sub.price_id === data.priceId) {
      return { ok: false, error: "You're already on that plan." };
    }

    const current = findPlan(sub.price_id);
    const isUpgrade = (current?.tier ?? 0) < target.tier;

    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) return { ok: false, error: "We couldn't find that plan." };
      const newPrice = prices.data[0];

      const stripeSub = await stripe.subscriptions.retrieve(sub.provider_subscription_id);
      const item = stripeSub.items.data[0];

      if (isUpgrade) {
        // Bigger plan now, pro-rated. The webhook writes the new allowance.
        await stripe.subscriptions.update(sub.provider_subscription_id, {
          items: [{ id: item.id, price: newPrice.id }],
          proration_behavior: "create_prorations",
          metadata: {
            ...stripeSub.metadata,
            organization_id: data.organizationId,
            price_id: data.priceId,
          },
        });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("subscriptions")
          .update({ pending_price_id: null, pending_effective_at: null })
          .eq("id", sub.id);

        return { ok: true, effect: "immediate", effectiveAt: null, label: target.label };
      }

      // Downgrade: schedule it for the renewal date so nobody loses allowance
      // mid-search. Stripe keeps the current phase, then switches.
      const periodEnd = item.current_period_end ?? (stripeSub as any).current_period_end;
      const periodStart = item.current_period_start ?? (stripeSub as any).current_period_start;

      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: sub.provider_subscription_id,
      });
      await stripe.subscriptionSchedules.update(schedule.id, {
        phases: [
          {
            items: [{ price: item.price.id, quantity: 1 }],
            start_date: periodStart,
            end_date: periodEnd,
          },
          { items: [{ price: newPrice.id, quantity: 1 }] },
        ],
      });

      const effectiveAt = new Date(periodEnd * 1000).toISOString();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("subscriptions")
        .update({ pending_price_id: data.priceId, pending_effective_at: effectiveAt })
        .eq("id", sub.id);

      return { ok: true, effect: "at_renewal", effectiveAt, label: target.label };
    } catch (err) {
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });

// ─── Cancelling and resuming ────────────────────────────────────────────────

type CancelResult = { ok: true; accessUntil: string | null } | { ok: false; error: string };

export const cancelPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; environment: StripeEnv }) => {
    if (!isUuid(data.organizationId)) throw new Error("Invalid organisation");
    return data;
  })
  .handler(async ({ data, context }): Promise<CancelResult> => {
    const { userId } = context;
    const supabase = context.supabase as unknown as AnySupabase;

    if (!(await requireOrgAdmin(supabase, userId, data.organizationId))) {
      return { ok: false, error: "Only an account admin can cancel the plan." };
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, provider_subscription_id, current_period_end")
      .eq("organization_id", data.organizationId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return { ok: false, error: "There's no active subscription to cancel." };

    try {
      const stripe = createStripeClient(data.environment);
      // Access runs to the end of the paid period — roles stay live until then.
      await stripe.subscriptions.update(sub.provider_subscription_id, {
        cancel_at_period_end: true,
      });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("id", sub.id);

      return { ok: true, accessUntil: sub.current_period_end ?? null };
    } catch (err) {
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });

export const resumePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; environment: StripeEnv }) => {
    if (!isUuid(data.organizationId)) throw new Error("Invalid organisation");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { userId } = context;
    const supabase = context.supabase as unknown as AnySupabase;

    if (!(await requireOrgAdmin(supabase, userId, data.organizationId))) {
      return { ok: false, error: "Only an account admin can change the plan." };
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, provider_subscription_id")
      .eq("organization_id", data.organizationId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return { ok: false, error: "There's no subscription to resume." };

    try {
      const stripe = createStripeClient(data.environment);
      await stripe.subscriptions.update(sub.provider_subscription_id, {
        cancel_at_period_end: false,
      });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("subscriptions")
        .update({ cancel_at_period_end: false })
        .eq("id", sub.id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });

// ─── Publishing a role against an allowance ─────────────────────────────────

export const useAllowanceForPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { positionId: string }) => {
    if (!isUuid(data.positionId)) throw new Error("Invalid role");
    return data;
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<
      { ok: true; rolesRemaining: number | null; planLabel: string } | { ok: false; reason: string }
    > => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: result, error } = await supabaseAdmin.rpc("consume_role_allowance", {
        _position_id: data.positionId,
        _actor_user_id: context.userId,
      });
      if (error) return { ok: false, reason: "error" };
      const r = result as {
        ok: boolean;
        reason?: string;
        roles_remaining?: number | null;
        plan_label?: string;
      };
      if (!r?.ok) return { ok: false, reason: r?.reason ?? "no_allowance" };
      return {
        ok: true,
        rolesRemaining: r.roles_remaining ?? null,
        planLabel: r.plan_label ?? "your plan",
      };
    },
  );

/** Plans a client can see on the plan picker, newest-friendly order. */
export const listPlans = createServerFn({ method: "GET" }).handler(async () =>
  PLAN_CATALOGUE.map((p) => ({
    priceId: p.priceId,
    label: p.label,
    kind: p.kind,
    interval: p.interval ?? null,
    amountUsd: p.amountUsd,
    rolesTotal: p.rolesTotal,
    tier: p.tier,
    summary: p.summary,
    allowance: allowanceSentence(p),
  })),
);
