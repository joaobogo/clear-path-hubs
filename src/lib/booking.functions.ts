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
      .in("status", ["requested", "booked"])
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
      .in("status", ["requested", "booked"])
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

export type CallRequestResult =
  | { ok: true; callId: string | null }
  | { ok: false; message: string };

/**
 * Single booking path: the client picks a real time in Calendly. This records
 * the intent first — a `sales_calls` row plus a `marketing_inquiries` lead —
 * so the lead survives even if the visitor abandons the scheduler.
 */
export const requestDiscoveryCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { positionId?: string; timezone?: string; notes?: string }) => data)
  .handler(async ({ data, context }): Promise<CallRequestResult> => {
    const { supabase, userId } = context;

    let position: { id: string; title: string; organization_id: string; payment_status: string } | null =
      null;
    if (data.positionId && isUuid(data.positionId)) {
      const { data: row } = await supabase
        .from("positions")
        .select("id, title, organization_id, payment_status")
        .eq("id", data.positionId)
        .maybeSingle();
      if (row) {
        position = {
          id: row.id,
          title: row.title,
          organization_id: row.organization_id,
          payment_status: String(row.payment_status),
        };
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone, organization_id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const organizationId = position?.organization_id ?? profile?.organization_id ?? null;
    if (!organizationId) {
      return { ok: false, message: "We couldn't find your workspace. Please try again." };
    }

    const now = new Date();
    const notes = data.notes?.slice(0, 2000) ?? null;
    const { data: inserted, error } = await supabase
      .from("sales_calls")
      .insert({
        organization_id: organizationId,
        position_id: position?.id ?? null,
        contact_name: profile?.full_name ?? "Client",
        contact_email: profile?.email ?? "",
        contact_phone: profile?.phone ?? null,
        scheduled_start: now.toISOString(),
        scheduled_end: new Date(now.getTime() + 30 * 60_000).toISOString(),
        timezone: data.timezone || "UTC",
        status: "requested",
        notes,
        booked_by: userId,
      })
      .select("id")
      .single();

    // Lead backstop — never blocks the scheduler.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("marketing_inquiries").insert({
        kind: "call",
        name: profile?.full_name ?? "Client",
        email: profile?.email ?? "",
        role_title: position?.title ?? null,
        message: notes,
        source_path: "/book-call",
        details: { position_id: position?.id ?? null, in_app: true },
      });
    } catch {
      // ignore
    }

    if (position && position.payment_status === "unpaid") {
      await supabase.from("positions").update({ payment_status: "pending" }).eq("id", position.id);
    }

    if (error) return { ok: false, message: "We couldn't save your request. Please try again." };
    return { ok: true, callId: inserted?.id ?? null };
  });
