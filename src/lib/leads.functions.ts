/**
 * Staff lead queue — Part 7, prompt 50.
 *
 * Every enquiry from the marketing site with an SLA clock on it. Nothing is
 * allowed to sit unanswered without showing as late.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LeadPriority } from "@/lib/marketing/lead-routing";

type StaffCheckClient = {
  rpc: (fn: "is_platform_staff", args: { _user: string }) => PromiseLike<{ data: unknown }>;
};

async function requireStaff(supabase: StaffCheckClient, userId: string) {
  const { data } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

export type QueuedLead = {
  id: string;
  createdAt: string;
  kind: string;
  name: string;
  email: string;
  company: string | null;
  roleTitle: string | null;
  verticalSlug: string | null;
  sourcePath: string | null;
  message: string | null;
  seniority: string | null;
  volume: string | null;
  urgency: string | null;
  score: number | null;
  priority: LeadPriority | null;
  ownerDesk: string | null;
  dueAt: string | null;
  respondedAt: string | null;
  minutesRemaining: number | null;
  late: boolean;
  suggestedFirstMessage: string | null;
};

export const listLeadQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ includeAnswered: z.boolean().optional() })
      .optional()
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ leads: QueuedLead[]; openCount: number; lateCount: number }> => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("marketing_inquiries")
      .select(
        "id, created_at, kind, name, email, company, role_title, vertical_slug, industry_slug, source_path, message, seniority, volume, urgency, lead_score, priority, owner_desk, first_response_due_at, first_responded_at, suggested_first_message",
      )
      .order("first_response_due_at", { ascending: true, nullsFirst: false })
      .limit(200);

    if (!data?.includeAnswered) query = query.is("first_responded_at", null);

    const { data: rows, error } = await query;
    if (error) throw new Error("Could not load the lead queue.");

    const now = Date.now();
    const leads: QueuedLead[] = (rows ?? []).map((r) => {
      const due = (r.first_response_due_at as string | null) ?? null;
      const responded = (r.first_responded_at as string | null) ?? null;
      const minutesRemaining = due && !responded
        ? Math.round((new Date(due).getTime() - now) / 60_000)
        : null;
      return {
        id: r.id as string,
        createdAt: r.created_at as string,
        kind: r.kind as string,
        name: r.name as string,
        email: r.email as string,
        company: (r.company as string | null) ?? null,
        roleTitle: (r.role_title as string | null) ?? null,
        verticalSlug: (r.vertical_slug as string | null) ?? (r.industry_slug as string | null) ?? null,
        sourcePath: (r.source_path as string | null) ?? null,
        message: (r.message as string | null) ?? null,
        seniority: (r.seniority as string | null) ?? null,
        volume: (r.volume as string | null) ?? null,
        urgency: (r.urgency as string | null) ?? null,
        score: (r.lead_score as number | null) ?? null,
        priority: (r.priority as LeadPriority | null) ?? null,
        ownerDesk: (r.owner_desk as string | null) ?? null,
        dueAt: due,
        respondedAt: responded,
        minutesRemaining,
        late: minutesRemaining !== null && minutesRemaining < 0,
      suggestedFirstMessage: (r.suggested_first_message as string | null) ?? null,
      };
    });

    return {
      leads,
      openCount: leads.filter((l) => !l.respondedAt).length,
      lateCount: leads.filter((l) => l.late).length,
    };
  });

/** Stops the clock: a human has replied. */
export const markLeadResponded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("marketing_inquiries")
      .update({
        first_responded_at: new Date().toISOString(),
        responded_by: context.userId,
        status: "responded",
      })
      .eq("id", data.id)
      .is("first_responded_at", null);
    if (error) throw new Error("Could not record the reply.");
    return { ok: true };
  });

/** Takes ownership so two people never answer the same enquiry. */
export const claimLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("marketing_inquiries")
      .update({ assigned_to: context.userId })
      .eq("id", data.id);
    if (error) throw new Error("Could not claim this lead.");
    return { ok: true };
  });
