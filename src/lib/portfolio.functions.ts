/**
 * Portfolio (multi-BU) server functions.
 *
 * Enterprise clients can group multiple business units under a parent
 * organization. This module exposes:
 *
 *   • getPortfolioRollup — parent + child aggregate counts by BU/region.
 *   • getPortfolioUnits  — flat list of child orgs for filters/drill-through.
 *
 * All reads use `requireSupabaseAuth`. RLS on `organizations`, `positions`,
 * and `candidate_matches` (inherited by `v_portfolio_rollup`) enforces
 * tenant isolation — the view is `security_invoker`, so a member of the
 * parent org sees the parent's own rows but not sibling parents.
 *
 * A child org is currently NOT auto-visible to parent-org members unless
 * they also hold a membership on that child. Follow-up work: add a helper
 * `is_portfolio_member(user, org)` that walks the parent chain and use it
 * inside the organizations SELECT policy. Documented in-place, not shipped
 * with this migration to keep the RLS surface auditable.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  orgId: z.string().uuid(),
});

export type PortfolioRollupRow = {
  portfolio_org_id: string;
  organization_id: string;
  organization_name: string;
  business_unit: string;
  region: string;
  open_positions: number;
  filled_positions: number;
  candidates_in_flight: number;
  hires: number;
};

export type PortfolioSummary = {
  parent: {
    id: string;
    name: string;
    is_parent: boolean;
  };
  units: readonly {
    id: string;
    name: string;
    is_self: boolean;
  }[];
  regions: readonly string[];
  business_units: readonly string[];
  totals: {
    open_positions: number;
    filled_positions: number;
    candidates_in_flight: number;
    hires: number;
  };
  rows: readonly PortfolioRollupRow[];
};

export const getPortfolioRollup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ context, data }): Promise<PortfolioSummary> => {
    // Establish the parent scope. If the requested org has a parent, roll
    // up starting at that parent; otherwise the org IS the portfolio root.
    const { data: org, error: orgErr } = await context.supabase
      .from("organizations")
      .select("id, name, parent_organization_id")
      .eq("id", data.orgId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("Organization not found or not accessible");

    const rootId = org.parent_organization_id ?? org.id;

    // Fetch every org visible to the caller in this portfolio tree.
    const { data: units, error: unitsErr } = await context.supabase
      .from("organizations")
      .select("id, name, parent_organization_id")
      .or(`id.eq.${rootId},parent_organization_id.eq.${rootId}`);
    if (unitsErr) throw new Error(unitsErr.message);

    const unitList = (units ?? []) as Array<{ id: string; name: string; parent_organization_id: string | null }>;
    const rootRow = unitList.find((u) => u.id === rootId);
    const parentName = rootRow?.name ?? org.name;

    // Rollup via the view — RLS on base tables filters unreadable rows.
    const { data: rows, error: rowsErr } = await context.supabase
      .from("v_portfolio_rollup")
      .select("*")
      .in("organization_id", unitList.map((u) => u.id));
    if (rowsErr) throw new Error(rowsErr.message);

    const list = (rows ?? []) as PortfolioRollupRow[];

    const regions = Array.from(
      new Set(list.map((r) => r.region).filter((r) => r && r !== "Unassigned")),
    ).sort();
    const businessUnits = Array.from(
      new Set(list.map((r) => r.business_unit).filter((b) => b && b !== "Unassigned")),
    ).sort();

    const totals = list.reduce(
      (acc, r) => ({
        open_positions: acc.open_positions + Number(r.open_positions ?? 0),
        filled_positions: acc.filled_positions + Number(r.filled_positions ?? 0),
        candidates_in_flight: acc.candidates_in_flight + Number(r.candidates_in_flight ?? 0),
        hires: acc.hires + Number(r.hires ?? 0),
      }),
      { open_positions: 0, filled_positions: 0, candidates_in_flight: 0, hires: 0 },
    );

    return {
      parent: {
        id: rootId,
        name: parentName,
        is_parent: unitList.length > 1,
      },
      units: unitList.map((u) => ({
        id: u.id,
        name: u.name,
        is_self: u.id === data.orgId,
      })),
      regions,
      business_units: businessUnits,
      totals,
      rows: list,
    };
  });
