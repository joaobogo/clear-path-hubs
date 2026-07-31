import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BOOKING_HORIZON_DAYS,
  generateSlots,
  removeTaken,
  type CallSlot,
} from "@/lib/booking/slots";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Real availability: our working window minus every slot already taken by any
 * client. Bookings from other organisations are invisible under RLS, so the
 * conflict read runs with elevated access and returns nothing but timestamps.
 */
export const listCallSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ slots: CallSlot[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const horizonEnd = new Date(Date.now() + (BOOKING_HORIZON_DAYS + 1) * 86_400_000);
    const { data } = await supabaseAdmin
      .from("sales_calls")
      .select("scheduled_start")
      .eq("status", "booked")
      .gte("scheduled_start", new Date().toISOString())
      .lte("scheduled_start", horizonEnd.toISOString());

    const taken = (data ?? []).map((row) => row.scheduled_start as string);
    return { slots: removeTaken(generateSlots(), taken) };
  });

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

export type BookCallResult =
  | { ok: true; callId: string; scheduledStart: string }
  | { ok: false; reason: "slot_taken" | "invalid_slot" | "not_found" | "failed"; message: string };

/**
 * Books the call and puts the role into "payment pending" — the workspace opens
 * immediately, the role stays unpublished until payment or a staff approval.
 */
export const bookDiscoveryCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { positionId: string; startIso: string; timezone: string; notes?: string }) => {
      if (!isUuid(data.positionId)) throw new Error("Invalid role");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<BookCallResult> => {
    const { supabase, userId } = context;

    const { data: position } = await supabase
      .from("positions")
      .select("id, title, organization_id, payment_status")
      .eq("id", data.positionId)
      .maybeSingle();

    if (!position) {
      return { ok: false, reason: "not_found", message: "We couldn't find that role." };
    }

    const start = new Date(data.startIso);
    if (Number.isNaN(start.getTime())) {
      return { ok: false, reason: "invalid_slot", message: "That time isn't available." };
    }
    const offered = new Set(generateSlots().map((s) => s.start));
    if (!offered.has(start.toISOString())) {
      return {
        ok: false,
        reason: "invalid_slot",
        message: "That time is no longer available. Please pick another.",
      };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const end = new Date(start.getTime() + 30 * 60_000);
    const { data: inserted, error } = await supabase
      .from("sales_calls")
      .insert({
        organization_id: position.organization_id,
        position_id: position.id,
        contact_name: profile?.full_name ?? "Client",
        contact_email: profile?.email ?? "",
        contact_phone: profile?.phone ?? null,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        timezone: data.timezone || "UTC",
        notes: data.notes?.slice(0, 2000) ?? null,
        booked_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          reason: "slot_taken",
          message: "Someone just took that time. Please choose another.",
        };
      }
      return { ok: false, reason: "failed", message: "We couldn't book that call." };
    }

    if (position.payment_status === "unpaid") {
      await supabase
        .from("positions")
        .update({ payment_status: "pending" })
        .eq("id", position.id);
    }

    return { ok: true, callId: inserted.id, scheduledStart: start.toISOString() };
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
