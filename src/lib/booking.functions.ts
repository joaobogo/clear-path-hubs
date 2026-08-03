import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export type BookingState = {
  position: {
    id: string;
    title: string;
    paymentStatus: string;
    status: string;
  } | null;
  call: {
    id: string;
    scheduledStart: string;
    scheduledEnd: string;
    timezone: string;
    status: string;
  } | null;
};

/** What the client is looking at: the role, and any call already in the diary. */
export const getBookingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { positionId?: string }) => data)
  .handler(async ({ data, context }): Promise<BookingState> => {
    const { supabase } = context;

    let position: BookingState["position"] = null;
    if (data.positionId && isUuid(data.positionId)) {
      const { data: row } = await supabase
        .from("positions")
        .select("id, title, payment_status, status")
        .eq("id", data.positionId)
        .maybeSingle();
      if (row) {
        position = {
          id: row.id,
          title: row.title,
          paymentStatus: String(row.payment_status),
          status: String(row.status),
        };
      }
    }

    let query = supabase
      .from("sales_calls")
      .select("id, scheduled_start, scheduled_end, timezone, status")
      .eq("status", "booked")
      .gte("scheduled_end", new Date().toISOString())
      .order("scheduled_start", { ascending: true })
      .limit(1);
    if (position) query = query.eq("position_id", position.id);

    const { data: call } = await query.maybeSingle();

    return {
      position,
      call: call
        ? {
            id: call.id,
            scheduledStart: call.scheduled_start,
            scheduledEnd: call.scheduled_end,
            timezone: call.timezone,
            status: call.status,
          }
        : null,
    };
  });

export const cancelDiscoveryCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { callId: string }) => {
    if (!isUuid(data.callId)) throw new Error("Invalid call");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sales_calls")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", data.callId);
    return { ok: !error };
  });

export type PendingPaymentRole = {
  positionId: string;
  title: string;
  paymentStatus: string;
  callStart: string | null;
};

/** Roles the client has created that can't publish yet, with any call attached. */
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
    const positions = rows ?? [];
    if (positions.length === 0) return { roles: [] };

    const { data: calls } = await supabase
      .from("sales_calls")
      .select("position_id, scheduled_start")
      .eq("status", "booked")
      .in(
        "position_id",
        positions.map((p) => p.id),
      );

    const callByPosition = new Map(
      (calls ?? []).map((c) => [c.position_id as string, c.scheduled_start as string]),
    );

    return {
      roles: positions.map((p) => ({
        positionId: p.id,
        title: p.title,
        paymentStatus: String(p.payment_status),
        callStart: callByPosition.get(p.id) ?? null,
      })),
    };
  });
