// Account overview — the whole-account numbers in one place.
//
// Everything here is computed from real records. Anything the system does not
// hold (plan, invoice period, renewal) comes back as null so the UI can say
// "not on file" instead of inventing a number.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeSeatCount } from "@/lib/client-seats";
import { countClientRoles } from "@/lib/client/role-counts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type AccountSubscription = {
  plan_name: string | null;
  billing_interval: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  renewal_date: string | null;
  days_to_renewal: number | null;
  pilot_status: string | null;
  pilot_ends_at: string | null;
};

export type AccountSeats = {
  limit: number;
  active: number;
  invited: number;
  remaining: number;
};

export type AccountHires = {
  total: number;
  this_period: number;
  last_90_days: number;
  upcoming_starts: Array<{
    id: string;
    position_title: string | null;
    start_date: string;
  }>;
};

export type AccountOverview = {
  organization: {
    id: string;
    name: string;
    industry: string | null;
    created_at: string | null;
  };
  subscription: AccountSubscription;
  seats: AccountSeats;
  hires: AccountHires;
  roles_open: number;
  roles_total: number;
  generated_at: string;
};

const DAY_MS = 86_400_000;

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS,
  );
}

export const getAccountOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    const ORG_COLUMNS =
      "id, name, industry, created_at, client_seat_limit, plan_name, billing_interval, billing_period_start, billing_period_end, renewal_date, pilot_status, pilot_ends_at";

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select(ORG_COLUMNS)
      .eq("id", data.orgId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);

    let resolved = org as AnyRow | null;

    // The workspace can be readable through membership even when the
    // organization row itself is filtered out (for example an archived
    // workspace). A member should still see their own account numbers rather
    // than a load-failure card, so re-read as the platform after confirming
    // the caller is genuinely a member of this workspace.
    if (!resolved) {
      const { data: membership } = await supabase
        .from("memberships")
        .select("organization_id, status")
        .eq("organization_id", data.orgId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if ((membership as AnyRow | null)?.status === "active") {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data: asPlatform } = await supabaseAdmin
          .from("organizations")
          .select(ORG_COLUMNS)
          .eq("id", data.orgId)
          .maybeSingle();
        resolved = (asPlatform as AnyRow | null) ?? null;
      }
    }

    if (!resolved) throw new Error("not_found");
    const o = resolved as AnyRow;


    const [{ data: members }, { data: positions }, { data: hires }] =
      await Promise.all([
        supabase
          .from("memberships")
          .select("user_id, role, status, profiles:user_id(email)")
          .eq("organization_id", data.orgId),
        supabase
          .from("positions")
          .select("id, status, title, is_test_record")
          .eq("organization_id", data.orgId),
        supabase
          .from("hire_records")
          .select("id, status, hired_at, start_date, position_id, positions:position_id(title)")
          .eq("organization_id", data.orgId),
      ]);

    const memberRows = (members as AnyRow[]) ?? [];
    // Shared seat derivation: seat-holding roles only, owner seat included, so
    // Account and Team & roles can never print different seat totals.
    const seatCount = computeSeatCount(memberRows, o.client_seat_limit as number | null);
    const activeSeats = seatCount.activeMembers;
    const invitedSeats = seatCount.pendingInvites;
    const limit = seatCount.seatLimit;

    // Same rule as the Roles page and the "Roles and where they are" panel:
    // drafts, archived roles and test records are not part of the account.
    const positionRows = countClientRoles((positions as AnyRow[]) ?? []);
    const rolesOpen = positionRows.open;

    const hireRows = ((hires as AnyRow[]) ?? []).filter(
      (h) =>
        (h.status === "hire_confirmed" || Boolean(h.hired_at)) &&
        !["closed_lost", "offer_declined", "declined", "withdrawn"].includes(String(h.status)),
    );
    const now = new Date();
    const nowIso = now.toISOString();
    const periodStart = o.billing_period_start as string | null;
    const periodEnd = o.billing_period_end as string | null;

    const inPeriod = (iso: string | null) => {
      if (!iso || !periodStart) return false;
      const t = new Date(iso).getTime();
      const from = new Date(periodStart).getTime();
      const to = periodEnd ? new Date(periodEnd).getTime() : now.getTime();
      return t >= from && t <= to;
    };

    const upcoming = hireRows
      .filter((h) => h.start_date && new Date(h.start_date).getTime() >= now.getTime() - DAY_MS)
      .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
      .slice(0, 5)
      .map((h) => ({
        id: String(h.id),
        position_title: (h.positions?.title as string | null) ?? null,
        start_date: String(h.start_date),
      }));

    const overview: AccountOverview = {
      organization: {
        id: String(o.id),
        name: String(o.name),
        industry: (o.industry as string | null) ?? null,
        created_at: (o.created_at as string | null) ?? null,
      },
      subscription: {
        plan_name: (o.plan_name as string | null) ?? null,
        billing_interval: (o.billing_interval as string | null) ?? null,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        renewal_date: (o.renewal_date as string | null) ?? null,
        days_to_renewal: o.renewal_date
          ? daysBetween(nowIso, String(o.renewal_date))
          : null,
        pilot_status: (o.pilot_status as string | null) ?? null,
        pilot_ends_at: (o.pilot_ends_at as string | null) ?? null,
      },
      seats: {
        limit,
        active: activeSeats,
        invited: invitedSeats,
        remaining: seatCount.seatsLeft,
      },
      hires: {
        total: hireRows.length,
        this_period: hireRows.filter((h) => inPeriod(h.hired_at as string | null)).length,
        last_90_days: hireRows.filter(
          (h) =>
            h.hired_at &&
            new Date(h.hired_at).getTime() >= now.getTime() - 90 * DAY_MS,
        ).length,
        upcoming_starts: upcoming,
      },
      roles_open: rolesOpen,
      roles_total: positionRows.total,
      generated_at: nowIso,
    };

    return overview;
  });
