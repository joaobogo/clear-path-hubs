/**
 * Vertical proof block — Part 7, prompt 46.
 *
 * Reads our own delivery data for a vertical: roles filled, median days to
 * first shortlist, and offer acceptance rate — each with the sample size it
 * was computed from. Where we do not have enough data, the function says so
 * and the page shows what we *do* have instead of inventing a figure.
 *
 * Public (no auth): only aggregates leave the server, never a client name,
 * a candidate, or any row-level detail. Samples below MIN_SAMPLE are
 * withheld entirely so no single client is identifiable.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MIN_SAMPLE = 5;

export type ProofMetric = {
  label: string;
  value: string;
  sample: number;
  note: string;
};

export type VerticalProof = {
  verticalSlug: string;
  metrics: ProofMetric[];
  /** True when we have nothing publishable yet for this vertical. */
  thin: boolean;
  fallbackNote: string;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const getVerticalProof = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({ verticalSlug: z.string().trim().min(1).max(80), verticalName: z.string().trim().max(120).optional() }).parse(raw),
  )
  .handler(async ({ data }): Promise<VerticalProof> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const name = data.verticalName ?? data.verticalSlug;
    const metrics: ProofMetric[] = [];

    // Organizations in this vertical. `organizations.industry` holds the raw
    // client-declared string, so match loosely on the slug words.
    const needle = data.verticalSlug.replace(/-/g, " ");
    const { data: orgs } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .or(`industry.ilike.%${needle}%,industry.ilike.%${data.verticalSlug}%`)
      .limit(500);

    const orgIds = (orgs ?? []).map((o) => o.id as string);
    if (orgIds.length === 0) {
      return {
        verticalSlug: data.verticalSlug,
        metrics: [],
        thin: true,
        fallbackNote: `We have not yet published enough completed ${name.toLowerCase()} searches to quote a number here. What we can show you is the method: the rubric we would score against, the evidence we extract, and the shortlist format you would receive.`,
      };
    }

    const [{ data: hires }, { data: positions }] = await Promise.all([
      supabaseAdmin
        .from("hire_records")
        .select("id, status, accepted_at, declined_at, sent_at")
        .in("organization_id", orgIds)
        .limit(2000),
      supabaseAdmin
        .from("positions")
        .select("id, created_at")
        .in("organization_id", orgIds)
        .limit(2000),
    ]);

    // 1) Roles filled.
    const filled = (hires ?? []).filter((h) => h.status === "hired" || h.accepted_at);
    if (filled.length >= MIN_SAMPLE) {
      metrics.push({
        label: "Roles filled in this sector",
        value: String(filled.length),
        sample: filled.length,
        note: "Counted from accepted offers recorded in the platform.",
      });
    }

    // 2) Offer acceptance rate.
    const decided = (hires ?? []).filter((h) => h.accepted_at || h.declined_at);
    if (decided.length >= MIN_SAMPLE) {
      const accepted = decided.filter((h) => h.accepted_at).length;
      metrics.push({
        label: "Offer acceptance rate",
        value: `${Math.round((accepted / decided.length) * 100)}%`,
        sample: decided.length,
        note: `Offers accepted out of ${decided.length} offers that reached a decision.`,
      });
    }

    // 3) Median days from role opening to first shortlisted candidate.
    const positionIds = (positions ?? []).map((p) => p.id as string);
    if (positionIds.length > 0) {
      const openedAt = new Map(
        (positions ?? []).map((p) => [p.id as string, new Date(p.created_at as string).getTime()]),
      );
      const { data: matches } = await supabaseAdmin
        .from("candidate_matches")
        .select("position_id, delivered_at")
        .in("position_id", positionIds)
        .not("delivered_at", "is", null)
        .limit(5000);

      const firstDelivery = new Map<string, number>();
      for (const m of matches ?? []) {
        const pid = m.position_id as string;
        const t = new Date(m.delivered_at as string).getTime();
        const cur = firstDelivery.get(pid);
        if (cur === undefined || t < cur) firstDelivery.set(pid, t);
      }
      const days: number[] = [];
      for (const [pid, t] of firstDelivery) {
        const start = openedAt.get(pid);
        if (start === undefined) continue;
        const d = (t - start) / 86_400_000;
        if (d >= 0 && d < 365) days.push(d);
      }
      const med = median(days);
      if (med !== null && days.length >= MIN_SAMPLE) {
        metrics.push({
          label: "Median time to first shortlist",
          value: `${med.toFixed(1)} days`,
          sample: days.length,
          note: `Measured from the role opening to the first candidate delivered, across ${days.length} roles.`,
        });
      }
    }

    return {
      verticalSlug: data.verticalSlug,
      metrics,
      thin: metrics.length === 0,
      fallbackNote:
        metrics.length === 0
          ? `We do not yet have a large enough sample of completed ${name.toLowerCase()} searches to publish a number we would defend. Rather than invent one, here is what we do have: the rubric, the evidence extraction, and the shortlist you would receive.`
          : `Figures are drawn from live TaaSFlow delivery data for ${name.toLowerCase()} clients, with the sample size shown next to each. Anything below ${MIN_SAMPLE} results is withheld rather than rounded up.`,
    };
  });
