/**
 * Staff side of personalised dashboards: granting the entitlement for a
 * negotiated deal, and pricing custom dashboard requests as a revenue line.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AnySupabase = {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

async function assertStaff(ctx: { supabase: any; userId: string }) {
  const { data: staff } = await ctx.supabase.rpc("is_platform_staff", { _user: ctx.userId });
  if (staff !== true) throw new Error("forbidden");
}

export type StaffDashboardRequest = {
  id: string;
  organizationId: string;
  organizationName: string;
  description: string;
  status: string;
  quoteAmountCents: number | null;
  quoteCurrency: string;
  quoteNote: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

export type StaffDashboardGrant = {
  id: string;
  organizationId: string;
  organizationName: string;
  source: string;
  note: string | null;
  status: string;
  expiresAt: string | null;
  createdAt: string;
};

export const getStaffDashboardDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      requests: StaffDashboardRequest[];
      grants: StaffDashboardGrant[];
      revenue: { quotedCents: number; deliveredCents: number; currency: string };
    }> => {
      await assertStaff(context as any);
      const supabase = context.supabase as unknown as AnySupabase;

      const [{ data: requests }, { data: grants }] = await Promise.all([
        supabase
          .from("dashboard_requests")
          .select(
            "id, organization_id, description, status, quote_amount_cents, quote_currency, quote_note, created_at, delivered_at, organizations:organization_id(name)",
          )
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("dashboard_grants")
          .select(
            "id, organization_id, source, note, status, expires_at, created_at, organizations:organization_id(name)",
          )
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const reqRows = (requests ?? []) as Array<Record<string, any>>;
      const quotedCents = reqRows
        .filter((r) => ["quoted", "agreed"].includes(r.status))
        .reduce((s, r) => s + Number(r.quote_amount_cents ?? 0), 0);
      const deliveredCents = reqRows
        .filter((r) => r.status === "delivered")
        .reduce((s, r) => s + Number(r.quote_amount_cents ?? 0), 0);

      return {
        requests: reqRows.map((r) => ({
          id: r.id,
          organizationId: r.organization_id,
          organizationName: r.organizations?.name ?? "Unknown account",
          description: r.description,
          status: r.status,
          quoteAmountCents: r.quote_amount_cents,
          quoteCurrency: r.quote_currency,
          quoteNote: r.quote_note,
          createdAt: r.created_at,
          deliveredAt: r.delivered_at,
        })),
        grants: ((grants ?? []) as Array<Record<string, any>>).map((g) => ({
          id: g.id,
          organizationId: g.organization_id,
          organizationName: g.organizations?.name ?? "Unknown account",
          source: g.source,
          note: g.note,
          status: g.status,
          expiresAt: g.expires_at,
          createdAt: g.created_at,
        })),
        revenue: { quotedCents, deliveredCents, currency: "gbp" },
      };
    },
  );

export const grantDashboardAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        source: z.enum(["staff", "addon"]),
        note: z.string().trim().max(300).optional(),
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    await assertStaff(context as any);
    const supabase = context.supabase as unknown as AnySupabase;
    await supabase
      .from("dashboard_grants")
      .update({ status: "revoked" })
      .eq("organization_id", data.organizationId)
      .eq("status", "active");
    const { error } = await supabase.from("dashboard_grants").insert({
      organization_id: data.organizationId,
      source: data.source,
      note: data.note ?? null,
      expires_at: data.expiresAt ?? null,
      granted_by: context.userId,
    });
    if (error) return { error: error.message };
    return { ok: true };
  });

export const revokeDashboardAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    await assertStaff(context as any);
    const supabase = context.supabase as unknown as AnySupabase;
    const { error } = await supabase
      .from("dashboard_grants")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) return { error: error.message };
    return { ok: true };
  });

export const setDashboardRequestOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["quoted", "agreed", "delivered", "declined"]),
        quoteAmountCents: z.number().int().min(0).max(100_000_00).optional(),
        quoteNote: z.string().trim().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    await assertStaff(context as any);
    const supabase = context.supabase as unknown as AnySupabase;
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "quoted") {
      if (data.quoteAmountCents === undefined) return { error: "A quote needs an amount." };
      patch.quote_amount_cents = data.quoteAmountCents;
      patch.quote_note = data.quoteNote ?? null;
      patch.quoted_by = context.userId;
      patch.quoted_at = new Date().toISOString();
    }
    if (data.status === "delivered") patch.delivered_at = new Date().toISOString();

    const { error } = await supabase.from("dashboard_requests").update(patch).eq("id", data.id);
    if (error) return { error: error.message };

    // Agreeing to a scoped dashboard turns the entitlement on for that account.
    if (data.status === "agreed" || data.status === "delivered") {
      const { data: row } = await supabase
        .from("dashboard_requests")
        .select("organization_id")
        .eq("id", data.id)
        .maybeSingle();
      if (row?.organization_id) {
        const { data: existing } = await supabase
          .from("dashboard_grants")
          .select("id")
          .eq("organization_id", row.organization_id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (!existing) {
          await supabase.from("dashboard_grants").insert({
            organization_id: row.organization_id,
            source: "addon",
            note: "Scoped dashboard agreed",
            granted_by: context.userId,
          });
        }
      }
    }
    return { ok: true };
  });
