/**
 * Staff-only reads and retries for the lead notification ledger.
 * Thin wrappers — all logic lives in lead-pipeline.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("is_platform_staff", { _user: context.userId });
  if (data !== true) throw new Error("Forbidden");
}

export type LeadNotificationRow = {
  id: string;
  createdAt: string;
  leadType: string;
  source: string;
  sourcePage: string | null;
  priority: string;
  fullName: string | null;
  email: string | null;
  company: string | null;
  ownerEmail: string | null;
  linkPath: string | null;
  teamsStatus: string;
  teamsDetail: string | null;
  emailStatus: string;
  emailDetail: string | null;
  emailRecipients: string[];
  crmStatus: string;
  attempts: number;
  lastAttemptAt: string | null;
};

export const listLeadNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ onlyFailed: z.boolean().optional(), limit: z.number().int().min(1).max(200).optional() })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("lead_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);

    if (data.onlyFailed) {
      query = query.or("teams_status.eq.failed,email_status.eq.failed");
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const items: LeadNotificationRow[] = (rows ?? []).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      leadType: r.lead_type,
      source: r.source,
      sourcePage: r.source_page,
      priority: r.priority,
      fullName: r.full_name,
      email: r.email,
      company: r.company,
      ownerEmail: r.owner_email,
      linkPath: ((r.payload ?? {}) as { link_path?: string }).link_path ?? null,
      teamsStatus: r.teams_status,
      teamsDetail: r.teams_detail,
      emailStatus: r.email_status,
      emailDetail: r.email_detail,
      emailRecipients: (r.email_recipients as string[] | null) ?? [],
      crmStatus: r.crm_status,
      attempts: r.attempts ?? 0,
      lastAttemptAt: r.last_attempt_at,
    }));

    const failed = items.filter(
      (i) => i.teamsStatus === "failed" || i.emailStatus === "failed",
    ).length;

    return { items, failed };
  });

export const retryLeadNotificationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    await assertStaff(context as never);
    const { retryLeadNotification } = await import("./lead-pipeline.server");
    return retryLeadNotification(data.id);
  });

/** Sends a test lead through the real pipeline so staff can verify delivery. */
export const sendLeadNotificationTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as never);
    const { processLeadEvent } = await import("./lead-pipeline.server");
    const res = await processLeadEvent({
      leadType: "contact_message",
      sourceId: `delivery-test-${crypto.randomUUID()}`,
      source: "delivery_test",
      sourcePage: "/admin/lead-delivery",
      fullName: "Delivery test",
      email: "delivery-test@taasflow.com",
      company: "TaaSFlow internal",
      message: "Delivery test triggered from the admin lead delivery panel.",
      linkPath: "/admin/lead-delivery",
      priority: "standard",
    });
    return { teams: res.teams, email: res.email };
  });
