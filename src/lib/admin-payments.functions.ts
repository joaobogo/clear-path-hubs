import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminPaymentRow = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  positionId: string | null;
  positionTitle: string | null;
  amountCents: number;
  currency: string;
  status: string;
  environment: string;
  provider: string;
  providerReference: string | null;
  paidAt: string | null;
  createdAt: string;
};

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (error || !data) throw new Error("Only platform staff can view payments.");
}

/** Read-only ledger. Payment records are never edited from the app. */
export const listAdminPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { filter?: "all" | "failed" | "refunded" | "paid" }) => data)
  .handler(async ({ data, context }): Promise<{ rows: AdminPaymentRow[] }> => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);

    let query = supabase
      .from("payments")
      .select(
        "id, organization_id, position_id, amount_cents, currency, status, provider, provider_environment, provider_reference, paid_at, created_at, organizations(name), positions(title)",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.filter === "refunded") query = query.eq("status", "refunded");
    else if (data.filter === "paid") query = query.eq("status", "paid");
    else if (data.filter === "failed") query = query.in("status", ["unpaid", "pending"]);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return {
      rows: (rows ?? []).map((r: any) => ({
        id: r.id,
        organizationId: r.organization_id,
        organizationName: r.organizations?.name ?? null,
        positionId: r.position_id,
        positionTitle: r.positions?.title ?? null,
        amountCents: r.amount_cents,
        currency: r.currency,
        status: r.status,
        environment: r.provider_environment,
        provider: r.provider,
        providerReference: r.provider_reference,
        paidAt: r.paid_at,
        createdAt: r.created_at,
      })),
    };
  });

/**
 * Admin-only payment exemption — the honest way to run a free pilot role
 * without faking a payment. Requires a written reason and is audited.
 */
export const grantPositionPaymentExemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { positionId: string; reason: string }) => {
    if (data.reason.trim().length < 10) {
      throw new Error("Give a written reason of at least 10 characters.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_set_position_payment_exempt", {
      _position_id: data.positionId,
      _actor_user_id: userId,
      _reason: data.reason.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
