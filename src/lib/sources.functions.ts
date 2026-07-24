// Source of Hire & channel attribution server functions.
//
// Reads the org-scoped views v_source_attribution / v_source_attribution_rollup.
// Views use security_invoker=on so RLS on applications/positions/matches applies.
// For admin surface, staff can also request `scope: "all"` to see cross-tenant
// rollups (still under RLS — but staff policies grant broad access).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

export type ChannelRow = {
  channel: string;
  kind: string;
  applications: number;
  outreach_sent: number;
  outreach_replied: number;
  shortlisted: number;
  interviewed: number;
  offered: number;
  hired: number;
  total_cost_cents: number;
  reply_rate: number | null;
  shortlist_rate: number | null;
  hire_rate: number | null;
  cost_per_hire_cents: number | null;
  first_applied_at: string | null;
  last_applied_at: string | null;
};

function withRates(r: AnyRow): ChannelRow {
  const apps = Number(r.applications ?? 0);
  const sent = Number(r.outreach_sent ?? 0);
  const replied = Number(r.outreach_replied ?? 0);
  const shortlisted = Number(r.shortlisted ?? 0);
  const hired = Number(r.hired ?? 0);
  const cost = Number(r.total_cost_cents ?? 0);
  return {
    channel: r.channel ?? "unknown",
    kind: r.kind ?? "inbound",
    applications: apps,
    outreach_sent: sent,
    outreach_replied: replied,
    shortlisted,
    interviewed: Number(r.interviewed ?? 0),
    offered: Number(r.offered ?? 0),
    hired,
    total_cost_cents: cost,
    reply_rate: sent > 0 ? replied / sent : null,
    shortlist_rate: apps > 0 ? shortlisted / apps : null,
    hire_rate: apps > 0 ? hired / apps : null,
    cost_per_hire_cents: hired > 0 && cost > 0 ? Math.round(cost / hired) : null,
    first_applied_at: r.first_applied_at ?? null,
    last_applied_at: r.last_applied_at ?? null,
  };
}

// ─── getSourceAttribution ──────────────────────────────────────────────────
// Returns rollup rows scoped either to a single org (client workspace) or
// aggregated across all orgs the caller can see (admin surface).
export const getSourceAttribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId?: string; scope?: "org" | "all" }) =>
    z
      .object({
        orgId: z.string().uuid().optional(),
        scope: z.enum(["org", "all"]).default("org"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("v_source_attribution_rollup")
      .select(
        "organization_id, channel, kind, applications, outreach_sent, outreach_replied, shortlisted, interviewed, offered, hired, total_cost_cents, first_applied_at, last_applied_at",
      );
    if (data.scope === "org") {
      if (!data.orgId) throw new Error("orgId required for org scope");
      q = q.eq("organization_id", data.orgId);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Optional aggregation for admin "all" scope: sum across orgs by (channel,kind).
    const acc = new Map<string, AnyRow>();
    for (const r of (rows ?? []) as AnyRow[]) {
      const key = `${r.channel}::${r.kind}`;
      const prev = acc.get(key);
      if (!prev) {
        acc.set(key, { ...r });
      } else {
        prev.applications = Number(prev.applications) + Number(r.applications);
        prev.outreach_sent = Number(prev.outreach_sent) + Number(r.outreach_sent);
        prev.outreach_replied = Number(prev.outreach_replied) + Number(r.outreach_replied);
        prev.shortlisted = Number(prev.shortlisted) + Number(r.shortlisted);
        prev.interviewed = Number(prev.interviewed) + Number(r.interviewed);
        prev.offered = Number(prev.offered) + Number(r.offered);
        prev.hired = Number(prev.hired) + Number(r.hired);
        prev.total_cost_cents = Number(prev.total_cost_cents) + Number(r.total_cost_cents);
        if (
          !prev.first_applied_at ||
          (r.first_applied_at && r.first_applied_at < prev.first_applied_at)
        ) {
          prev.first_applied_at = r.first_applied_at;
        }
        if (
          !prev.last_applied_at ||
          (r.last_applied_at && r.last_applied_at > prev.last_applied_at)
        ) {
          prev.last_applied_at = r.last_applied_at;
        }
      }
    }

    const channels = Array.from(acc.values())
      .map(withRates)
      .sort((a, b) => b.hired - a.hired || b.applications - a.applications);

    // Totals across all rows.
    const totals = channels.reduce(
      (acc2, r) => {
        acc2.applications += r.applications;
        acc2.outreach_sent += r.outreach_sent;
        acc2.outreach_replied += r.outreach_replied;
        acc2.shortlisted += r.shortlisted;
        acc2.interviewed += r.interviewed;
        acc2.offered += r.offered;
        acc2.hired += r.hired;
        acc2.total_cost_cents += r.total_cost_cents;
        return acc2;
      },
      {
        applications: 0,
        outreach_sent: 0,
        outreach_replied: 0,
        shortlisted: 0,
        interviewed: 0,
        offered: 0,
        hired: 0,
        total_cost_cents: 0,
      },
    );

    // Sourced vs inbound split, by application count.
    const split = channels.reduce(
      (acc2, r) => {
        const bucket =
          r.kind === "inbound"
            ? "inbound"
            : r.kind === "referral"
              ? "referral"
              : "sourced";
        acc2[bucket] = (acc2[bucket] ?? 0) + r.applications;
        acc2.hires[bucket] = (acc2.hires[bucket] ?? 0) + r.hired;
        return acc2;
      },
      { inbound: 0, sourced: 0, referral: 0, hires: {} as Record<string, number> } as AnyRow,
    );

    return { channels, totals, split };
  });
