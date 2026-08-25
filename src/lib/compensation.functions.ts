// Compensation decision-support data.
//
// Reads only what is on record: the range captured at intake, the candidate's
// stated expectation, and real offers this organisation has made for the role.
// No modelling, no market estimates.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { buildCompensationSignal, type CompensationSignal } from "@/lib/compensation-signal";
import { isLiveOffer } from "@/lib/offer-hire";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export const getCompensationSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string }) =>
    z.object({ orgId: z.string().uuid(), matchId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<CompensationSignal | null> => {
    const sel = (s: string): string => s;

    const { data: match } = await context.supabase
      .from("candidate_matches")
      .select(
        sel(
          "id, organization_id, position_id, candidate_profiles:candidate_profile_id(compensation_preferences, location), positions:position_id(compensation, location)",
        ),
      )
      .eq("id", data.matchId)
      .eq("organization_id", data.orgId)
      .maybeSingle();

    if (!match) return null;
    const m = match as AnyRow;
    const position = m.positions ?? null;

    let location: string | null = position?.location ?? null;
    if (m.position_id) {
      const { data: locs } = await context.supabase
        .from("position_locations")
        .select(sel("city, region, country, is_primary, display_order"))
        .eq("position_id", m.position_id)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
        .limit(1);
      const l = (locs as AnyRow[] | null)?.[0];
      if (l) {
        const parts = [l.city, l.region, l.country].filter(Boolean);
        const unique = parts.filter((p, i) =>
          i === 0 || String(p).trim().toLowerCase() !== String(parts[i - 1]).trim().toLowerCase()
        );
        location = unique.join(", ") || location;
      }
    }

    let offerAmounts: Array<{ amount: number; currency: string | null; period: string | null }> = [];
    let totalOfferCount = 0;
    if (m.position_id) {
      const { data: hires } = await context.supabase
        .from("hire_records")
        .select(sel("status, salary_amount, salary_currency, salary_period"))
        .eq("organization_id", data.orgId)
        .eq("position_id", m.position_id)
        .not("salary_amount", "is", null);
      const liveOffers = ((hires as AnyRow[] | null) ?? []).filter((h) =>
        isLiveOffer(String(h.status ?? "")),
      );
      offerAmounts = liveOffers
        .map((h) => ({
          amount: Number(h.salary_amount),
          currency: h.salary_currency ?? null,
          period: h.salary_period ?? null,
        }))
        .filter((h) => Number.isFinite(h.amount) && h.amount > 0);

      const { count } = await context.supabase
        .from("hire_records")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", data.orgId)
        .eq("position_id", m.position_id)
        .not("status", "in", `("offer_declined","closed_lost")`);
      totalOfferCount = count ?? 0;
    }

    return buildCompensationSignal({
      roleCompensation: position?.compensation ?? null,
      candidateCompensation: m.candidate_profiles?.compensation_preferences ?? null,
      location,
      offerAmounts,
      totalOfferCount,
    });
  });
