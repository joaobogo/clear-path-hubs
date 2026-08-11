import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

type StaffCheckClient = {
  rpc: (fn: "is_platform_staff", args: { _user: string }) => PromiseLike<{ data: unknown }>;
};

async function requireStaff(supabase: StaffCheckClient, userId: string) {
  const { data } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

export type PendingLead = {
  positionId: string;
  positionTitle: string;
  organizationId: string;
  organizationName: string;
  paymentStatus: string;
  positionStatus: string;
  createdAt: string;
  waitingDays: number;
  contactName: string | null;
  contactEmail: string | null;
  call: { id: string; start: string; status: string } | null;
};

/** Everyone who came through the door but hasn't paid yet. Nobody gets lost. */
export const listPendingLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ leads: PendingLead[] }> => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: positions } = await supabaseAdmin
      .from("positions")
      .select("id, title, status, payment_status, created_at, organization_id")
      .in("payment_status", ["pending", "unpaid"])
      .order("created_at", { ascending: true })
      .limit(200);

    const rows = positions ?? [];
    if (rows.length === 0) return { leads: [] };

    const orgIds = [...new Set(rows.map((r) => r.organization_id))];
    const positionIds = rows.map((r) => r.id);

    const [{ data: orgs }, { data: calls }, { data: submissions }] = await Promise.all([
      supabaseAdmin.from("organizations").select("id, name").in("id", orgIds),
      supabaseAdmin
        .from("sales_calls")
        .select("id, position_id, scheduled_start, status, contact_name, contact_email")
        .in("position_id", positionIds)
        .order("scheduled_start", { ascending: true }),
      supabaseAdmin
        .from("intake_submissions")
        .select("position_id, primary_email, payload")
        .in("position_id", positionIds),
    ]);

    const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name as string]));
    const callByPosition = new Map<string, { id: string; start: string; status: string; name: string | null; email: string | null }>();
    for (const c of calls ?? []) {
      if (!c.position_id || callByPosition.has(c.position_id)) continue;
      callByPosition.set(c.position_id, {
        id: c.id,
        start: c.scheduled_start,
        status: c.status,
        name: c.contact_name,
        email: c.contact_email,
      });
    }
    const emailByPosition = new Map(
      (submissions ?? []).map((s) => [s.position_id as string, s.primary_email as string]),
    );

    const now = Date.now();
    const leads: PendingLead[] = rows.map((r) => {
      const call = callByPosition.get(r.id) ?? null;
      return {
        positionId: r.id,
        positionTitle: r.title,
        organizationId: r.organization_id,
        organizationName: orgName.get(r.organization_id) ?? "Unknown organisation",
        paymentStatus: String(r.payment_status),
        positionStatus: String(r.status),
        createdAt: r.created_at,
        waitingDays: Math.max(0, Math.floor((now - new Date(r.created_at).getTime()) / 86_400_000)),
        contactName: call?.name ?? null,
        contactEmail: call?.email ?? emailByPosition.get(r.id) ?? null,
        call: call ? { id: call.id, start: call.start, status: call.status } : null,
      };
    });

    return { leads };
  });

/** A staff member can start work before money lands — but it's recorded, with a reason. */
export const approveStartWithoutPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { positionId: string; reason: string }) => {
    if (!isUuid(data.positionId)) throw new Error("Invalid role");
    if (!data.reason || data.reason.trim().length < 5) throw new Error("A reason is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("positions")
      .update({
        // `exempt`, not `covered`: this is a staff goodwill start, not a role
        // paid for by a plan allowance. `covered` roles are paused when the
        // subscription ends, which must never happen to a goodwill start.
        payment_status: "exempt",

        start_approved_by: context.userId,
        start_approved_at: new Date().toISOString(),
        start_approval_reason: data.reason.trim().slice(0, 500),
      })
      .eq("id", data.positionId);

    if (error) return { ok: false as const, message: "We couldn't approve that start." };
    return { ok: true as const };
  });

/** Explicitly close a lead that went nowhere, so the queue stays honest. */
export const closePendingLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { positionId: string; reason: string }) => {
    if (!isUuid(data.positionId)) throw new Error("Invalid role");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("intake_submissions")
      .update({
        lead_status: "closed",
        lead_closed_at: new Date().toISOString(),
        lead_closed_by: context.userId,
        lead_close_reason: data.reason?.slice(0, 500) ?? null,
      })
      .eq("position_id", data.positionId);

    await supabaseAdmin
      .from("sales_calls")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("position_id", data.positionId)
      .eq("status", "booked");

    return { ok: true as const };
  });

export const markCallOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { callId: string; outcome: "completed" | "no_show" | "cancelled" }) => {
    if (!isUuid(data.callId)) throw new Error("Invalid call");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("sales_calls")
      .update({
        status: data.outcome,
        cancelled_at: data.outcome === "cancelled" ? new Date().toISOString() : null,
      })
      .eq("id", data.callId);
    return { ok: true as const };
  });
