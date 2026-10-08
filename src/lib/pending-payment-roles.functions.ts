import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type PendingPaymentRole = {
  positionId: string;
  title: string;
  paymentStatus: string;
};

/** Roles the client has created that can't publish yet. */
export const listPendingPaymentRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId?: string }) => data)
  .handler(async ({ data, context }): Promise<{ roles: PendingPaymentRole[] }> => {
    const { supabase } = context;
    let query = supabase
      .from("positions")
      .select("id, title, payment_status")
      .in("payment_status", ["unpaid", "pending"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (data.orgId && isUuid(data.orgId)) query = query.eq("organization_id", data.orgId);

    const { data: rows } = await query;
    return {
      roles: (rows ?? []).map((p) => ({
        positionId: p.id,
        title: p.title,
        paymentStatus: String(p.payment_status),
      })),
    };
  });
