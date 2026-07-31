/**
 * Personalised dashboards — everything the workspace calls.
 *
 * The commercial boundary is enforced here: every read of block data, every
 * save, and every delivery checks the entitlement server-side first. The
 * browser can ask; it cannot decide.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type DashboardEntitlement,
  loadBlocks,
  resolveDashboardEntitlement,
} from "@/lib/dashboards/blocks.server";
import {
  type BlockId,
  type BlockResult,
  BLOCK_IDS,
  DEFAULT_LAYOUT,
  isBlockId,
} from "@/lib/dashboards/blocks";

const orgSchema = z.object({ orgId: z.string().uuid() });
const blockIdSchema = z.enum(BLOCK_IDS);

type AnySupabase = {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

async function assertMember(ctx: { supabase: any; userId: string }, orgId: string) {
  const { data: member } = await ctx.supabase.rpc("is_org_member", {
    _user: ctx.userId,
    _org: orgId,
  });
  const { data: staff } = await ctx.supabase.rpc("is_platform_staff", { _user: ctx.userId });
  if (member !== true && staff !== true) throw new Error("forbidden");
  return { isStaff: staff === true };
}

async function assertEditor(ctx: { supabase: any; userId: string }, orgId: string) {
  const { data: editor } = await ctx.supabase.rpc("is_org_editor", {
    _user: ctx.userId,
    _org: orgId,
  });
  const { data: staff } = await ctx.supabase.rpc("is_platform_staff", { _user: ctx.userId });
  if (editor !== true && staff !== true) throw new Error("forbidden");
  return { isStaff: staff === true };
}

// ─── What the client can see ────────────────────────────────────────────────

export type DashboardSummary = {
  id: string;
  name: string;
  blocks: BlockId[];
  isDefault: boolean;
  updatedAt: string;
};

export type DashboardWorkspace = {
  entitlement: DashboardEntitlement;
  canEdit: boolean;
  dashboards: DashboardSummary[];
  openRequest: {
    id: string;
    status: string;
    description: string;
    quoteAmountCents: number | null;
    quoteCurrency: string;
    quoteNote: string | null;
    createdAt: string;
  } | null;
};

function toSummary(row: Record<string, any>): DashboardSummary {
  const blocks = Array.isArray(row.blocks) ? row.blocks.filter(isBlockId) : [];
  return {
    id: row.id,
    name: row.name,
    blocks,
    isDefault: !!row.is_default,
    updatedAt: row.updated_at,
  };
}

export const getDashboardWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => orgSchema.parse(raw))
  .handler(async ({ data, context }): Promise<DashboardWorkspace> => {
    const { isStaff } = await assertMember(context as any, data.orgId);
    const supabase = context.supabase as unknown as AnySupabase;

    const entitlement = await resolveDashboardEntitlement(supabase, data.orgId);

    const { data: editor } = await supabase.rpc("is_org_editor", {
      _user: context.userId,
      _org: data.orgId,
    });

    const [{ data: rows }, { data: request }] = await Promise.all([
      supabase
        .from("dashboards")
        .select("id, name, blocks, is_default, updated_at")
        .eq("organization_id", data.orgId)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false }),
      supabase
        .from("dashboard_requests")
        .select("id, status, description, quote_amount_cents, quote_currency, quote_note, created_at")
        .eq("organization_id", data.orgId)
        .in("status", ["new", "quoted", "agreed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      entitlement,
      canEdit: editor === true || isStaff,
      dashboards: ((rows ?? []) as Array<Record<string, any>>).map(toSummary),
      openRequest: request
        ? {
            id: request.id,
            status: request.status,
            description: request.description,
            quoteAmountCents: request.quote_amount_cents,
            quoteCurrency: request.quote_currency,
            quoteNote: request.quote_note,
            createdAt: request.created_at,
          }
        : null,
    };
  });

export const getDashboardBlocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    orgSchema.extend({ blocks: z.array(blockIdSchema).max(12) }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ results: BlockResult[] }> => {
    await assertMember(context as any, data.orgId);
    const supabase = context.supabase as unknown as AnySupabase;
    const entitlement = await resolveDashboardEntitlement(supabase, data.orgId);
    if (!entitlement.allowed) throw new Error("Personalised dashboards are not on this account.");
    const results = await loadBlocks(supabase, data.orgId, data.blocks);
    return { results };
  });

// ─── Composing dashboards ───────────────────────────────────────────────────

export const saveDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    orgSchema
      .extend({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        blocks: z.array(blockIdSchema).min(1).max(12),
        isDefault: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ id: string } | { error: string }> => {
    await assertEditor(context as any, data.orgId);
    const supabase = context.supabase as unknown as AnySupabase;
    const entitlement = await resolveDashboardEntitlement(supabase, data.orgId);
    if (!entitlement.allowed) {
      return { error: "Personalised dashboards are not on this account yet." };
    }

    if (data.isDefault) {
      await supabase
        .from("dashboards")
        .update({ is_default: false })
        .eq("organization_id", data.orgId)
        .eq("is_default", true);
    }

    if (data.id) {
      const { error } = await supabase
        .from("dashboards")
        .update({
          name: data.name,
          blocks: data.blocks,
          ...(data.isDefault === undefined ? {} : { is_default: data.isDefault }),
        })
        .eq("id", data.id)
        .eq("organization_id", data.orgId);
      if (error) return { error: error.message };
      return { id: data.id };
    }

    const { data: created, error } = await supabase
      .from("dashboards")
      .insert({
        organization_id: data.orgId,
        name: data.name,
        blocks: data.blocks,
        is_default: data.isDefault ?? false,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: created.id };
  });

export const deleteDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => orgSchema.extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    await assertEditor(context as any, data.orgId);
    const supabase = context.supabase as unknown as AnySupabase;
    const { error } = await supabase
      .from("dashboards")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) return { error: error.message };
    return { ok: true };
  });

/** The layout anyone new sees when nobody has arranged one yet. */
export const DEFAULT_DASHBOARD_BLOCKS: BlockId[] = DEFAULT_LAYOUT;

// ─── Asking for a custom dashboard ──────────────────────────────────────────

export const requestCustomDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    orgSchema.extend({ description: z.string().trim().min(20).max(2000) }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ id: string } | { error: string }> => {
    await assertEditor(context as any, data.orgId);
    const supabase = context.supabase as unknown as AnySupabase;

    const { data: open } = await supabase
      .from("dashboard_requests")
      .select("id")
      .eq("organization_id", data.orgId)
      .in("status", ["new", "quoted", "agreed"])
      .limit(1)
      .maybeSingle();
    if (open) {
      return { error: "You already have a dashboard request open with us." };
    }

    const { data: created, error } = await supabase
      .from("dashboard_requests")
      .insert({
        organization_id: data.orgId,
        requested_by: context.userId,
        description: data.description,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: created.id };
  });

// ─── Export and scheduled delivery ──────────────────────────────────────────

export type DeliverySummary = {
  id: string;
  dashboardId: string;
  format: "pdf" | "csv";
  cadence: "on_demand" | "weekly";
  recipients: string[];
  active: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
};

export const listDashboardDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => orgSchema.parse(raw))
  .handler(async ({ data, context }): Promise<{ deliveries: DeliverySummary[] }> => {
    await assertMember(context as any, data.orgId);
    const supabase = context.supabase as unknown as AnySupabase;
    const { data: rows } = await supabase
      .from("dashboard_deliveries")
      .select("id, dashboard_id, format, cadence, recipients, active, next_run_at, last_run_at")
      .eq("organization_id", data.orgId)
      .order("created_at", { ascending: false });
    return {
      deliveries: ((rows ?? []) as Array<Record<string, any>>).map((r) => ({
        id: r.id,
        dashboardId: r.dashboard_id,
        format: r.format,
        cadence: r.cadence,
        recipients: r.recipients ?? [],
        active: r.active,
        nextRunAt: r.next_run_at,
        lastRunAt: r.last_run_at,
      })),
    };
  });

function nextMondayMorning(from = new Date()): string {
  const d = new Date(from);
  d.setUTCHours(7, 0, 0, 0);
  const daysAhead = (8 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString();
}

export const saveDashboardDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    orgSchema
      .extend({
        dashboardId: z.string().uuid(),
        format: z.enum(["pdf", "csv"]),
        cadence: z.enum(["on_demand", "weekly"]),
        recipients: z.array(z.string().email()).min(1).max(20),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ id: string } | { error: string }> => {
    await assertEditor(context as any, data.orgId);
    const supabase = context.supabase as unknown as AnySupabase;
    const entitlement = await resolveDashboardEntitlement(supabase, data.orgId);
    if (!entitlement.allowed) {
      return { error: "Personalised dashboards are not on this account yet." };
    }
    const { data: created, error } = await supabase
      .from("dashboard_deliveries")
      .insert({
        organization_id: data.orgId,
        dashboard_id: data.dashboardId,
        format: data.format,
        cadence: data.cadence,
        recipients: data.recipients,
        created_by: context.userId,
        next_run_at: data.cadence === "weekly" ? nextMondayMorning() : null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: created.id };
  });

export const stopDashboardDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => orgSchema.extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    await assertEditor(context as any, data.orgId);
    const supabase = context.supabase as unknown as AnySupabase;
    const { error } = await supabase
      .from("dashboard_deliveries")
      .update({ active: false, next_run_at: null })
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) return { error: error.message };
    return { ok: true };
  });

/** A dashboard as rows of plain text — what the CSV export writes. */
export const exportDashboardRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    orgSchema.extend({ blocks: z.array(blockIdSchema).min(1).max(12) }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ rows: string[][] }> => {
    await assertMember(context as any, data.orgId);
    const supabase = context.supabase as unknown as AnySupabase;
    const entitlement = await resolveDashboardEntitlement(supabase, data.orgId);
    if (!entitlement.allowed) throw new Error("Personalised dashboards are not on this account.");
    const results = await loadBlocks(supabase, data.orgId, data.blocks);
    const rows: string[][] = [["Block", "Item", "Value", "Note"]];
    for (const r of results) {
      const d = r.data;
      if (!d) {
        rows.push([r.id, "", "no data yet", r.unavailable ?? ""]);
        continue;
      }
      if (d.kind === "series") {
        for (const p of d.points) rows.push([r.id, p.label, String(p.value), ""]);
      } else if (d.kind === "stat") {
        rows.push([r.id, d.caption, d.value, d.sub ?? ""]);
      } else {
        for (const row of d.rows) rows.push([r.id, row.label, row.value, row.note ?? ""]);
      }
    }
    return { rows };
  });
