// Offer & hire lifecycle server functions.
//
// Every mutation is org-scoped through RLS + assertEditor, writes an audit
// event, and relies on DB triggers (tg_hire_records_lifecycle) to enforce the
// state machine and stamp lifecycle timestamps.
import { attachMemberProfiles } from "@/lib/membership-profiles.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const traceId = () =>
  `hr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

// ─── Types ──────────────────────────────────────────────────────────────────

export type HireStatus =
  | "offer_drafted"
  | "offer_sent"
  | "offer_negotiating"
  | "offer_accepted"
  | "offer_declined"
  | "hire_confirmed"
  | "closed_lost";

export type HireCloseReason =
  | "candidate_declined"
  | "counter_offer"
  | "other_offer_accepted"
  | "compensation_mismatch"
  | "role_paused"
  | "budget"
  | "timing"
  | "culture_fit"
  | "background_check"
  | "position_cancelled"
  | "other";

export const HIRE_STATUSES: HireStatus[] = [
  "offer_drafted",
  "offer_sent",
  "offer_negotiating",
  "offer_accepted",
  "offer_declined",
  "hire_confirmed",
  "closed_lost",
];

export const HIRE_STATUS_LABEL: Record<HireStatus, string> = {
  offer_drafted: "Offer drafted",
  offer_sent: "Offer sent",
  offer_negotiating: "Negotiating",
  offer_accepted: "Offer accepted",
  offer_declined: "Offer declined",
  hire_confirmed: "Hire confirmed",
  closed_lost: "Closed lost",
};

export const CLOSE_REASON_LABEL: Record<HireCloseReason, string> = {
  candidate_declined: "Candidate declined",
  counter_offer: "Counter-offer at current employer",
  other_offer_accepted: "Accepted another offer",
  compensation_mismatch: "Compensation mismatch",
  role_paused: "Role paused / on hold",
  budget: "Budget change",
  timing: "Timing / start date",
  culture_fit: "Culture / team fit",
  background_check: "Background / reference check",
  position_cancelled: "Position cancelled",
  other: "Other",
};

export interface HireRecordDTO {
  id: string;
  candidate_match_id: string;
  organization_id: string;
  position_id: string;
  candidate_profile_id: string;
  application_id: string | null;
  status: HireStatus;
  owner_user_id: string | null;
  owner_name: string | null;
  candidate_name: string;
  position_title: string;
  salary_amount: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  bonus_notes: string | null;
  equity_notes: string | null;
  start_date: string | null;
  employment_type: string | null;
  work_model: string | null;
  location: string | null;
  offer_notes: string | null;
  guarantee_days: number | null;
  guarantee_starts_on: string | null;
  guarantee_terms: string | null;
  guarantee_visible_to_client: boolean;
  drafted_at: string | null;
  sent_at: string | null;
  negotiating_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  hired_at: string | null;
  closed_at: string | null;
  close_reason: HireCloseReason | null;
  close_reason_notes: string | null;
  last_nudged_at: string | null;
  nudge_count: number;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
  /** Agreed response date. Null means none was agreed — never inferred. */
  expected_response_date: string | null;
  expected_response_set_at: string | null;
}

export interface TimeToHireReport {
  totals: {
    open_offers: number;
    hires_confirmed: number;
    closed_lost: number;
    acceptance_rate: number | null;
    avg_days_to_hire: number | null;
    avg_days_offer_to_accept: number | null;
    median_days_to_hire: number | null;
  };
  by_owner: Array<{
    owner_user_id: string | null;
    owner_name: string;
    hires: number;
    avg_days_to_hire: number | null;
  }>;
  by_position: Array<{
    position_id: string;
    position_title: string;
    hires: number;
    open_offers: number;
    avg_days_to_hire: number | null;
  }>;
  close_reasons: Array<{ reason: HireCloseReason; count: number }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function assertEditor(supabase: AnyRow, userId: string, orgId: string) {
  const { data: interactive } = await supabase
    .from("support_sessions")
    .select("id")
    .eq("target_user_id", userId)
    .eq("scope_org_id", orgId)
    .eq("mode", "interactive")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  // Absence of an active support session means the caller is the user themselves,
  // which is fine. Presence of a read-only session should be blocked.
  const { data: readonly } = await supabase
    .from("support_sessions")
    .select("id")
    .eq("target_user_id", userId)
    .eq("scope_org_id", orgId)
    .eq("mode", "read_only")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (readonly && !interactive) throw new Error("SUPPORT_VIEW_READ_ONLY");
}

async function writeAudit(
  supabase: AnyRow,
  opts: {
    actor: string;
    action: string;
    entity_type: string;
    entity_id: string;
    organization_id: string;
    before?: unknown;
    after?: unknown;
    trace_id: string;
  },
) {
  await supabase.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    organization_id: opts.organization_id,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
    trace_id: opts.trace_id,
  });
}

async function loadMatchForHire(supabase: AnyRow, orgId: string, matchId: string) {
  const { data, error } = await supabase
    .from("candidate_matches")
    .select(
      "id, organization_id, position_id, application_id, candidate_profile_id, client_visibility",
    )
    .eq("id", matchId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("match_not_found");
  if (data.client_visibility !== "visible") throw new Error("match_not_visible");
  return data as AnyRow;
}

function toDTO(row: AnyRow): HireRecordDTO {
  return {
    id: row.id,
    candidate_match_id: row.candidate_match_id,
    organization_id: row.organization_id,
    position_id: row.position_id,
    candidate_profile_id: row.candidate_profile_id,
    application_id: row.application_id ?? null,
    status: row.status,
    owner_user_id: row.owner_user_id ?? null,
    owner_name: row.owner_name ?? null,
    candidate_name: row.candidate_name ?? row._candidate_name ?? "Candidate",
    position_title: row.position_title ?? row._position_title ?? "Role",
    salary_amount: row.salary_amount ?? null,
    salary_currency: row.salary_currency ?? null,
    salary_period: row.salary_period ?? null,
    bonus_notes: row.bonus_notes ?? null,
    equity_notes: row.equity_notes ?? null,
    start_date: row.start_date ?? null,
    employment_type: row.employment_type ?? null,
    work_model: row.work_model ?? null,
    location: row.location ?? null,
    offer_notes: row.offer_notes ?? null,
    guarantee_days: row.guarantee_days ?? null,
    guarantee_starts_on: row.guarantee_starts_on ?? null,
    guarantee_terms: row.guarantee_terms ?? null,
    guarantee_visible_to_client: row.guarantee_visible_to_client ?? true,
    drafted_at: row.drafted_at ?? null,
    sent_at: row.sent_at ?? null,
    negotiating_at: row.negotiating_at ?? null,
    accepted_at: row.accepted_at ?? null,
    declined_at: row.declined_at ?? null,
    hired_at: row.hired_at ?? null,
    closed_at: row.closed_at ?? null,
    close_reason: row.close_reason ?? null,
    close_reason_notes: row.close_reason_notes ?? null,
    last_nudged_at: row.last_nudged_at ?? null,
    nudge_count: row.nudge_count ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    applied_at: row.applied_at ?? null,
    expected_response_date: row.expected_response_date ?? null,
    expected_response_set_at: row.expected_response_set_at ?? null,
  };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export const listHires = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; positionId?: string; status?: HireStatus }) =>
      z
        .object({
          orgId: z.string().uuid(),
          positionId: z.string().uuid().optional(),
          status: z.enum(HIRE_STATUSES as [HireStatus, ...HireStatus[]]).optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sel = (s: string): string => s;
    let q = context.supabase
      .from("hire_records")
      .select(
        sel(
          "*, positions:position_id(title), candidate_profiles:candidate_profile_id(full_name), applications:application_id(applied_at)",
        ),
      )
      .eq("organization_id", data.orgId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (data.positionId) q = q.eq("position_id", data.positionId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Enrich owner names in one round-trip
    const ownerIds = Array.from(
      new Set((rows ?? []).map((r: AnyRow) => r.owner_user_id).filter(Boolean)),
    ) as string[];
    let ownerMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("auth_user_id, full_name, email")
        .in("auth_user_id", ownerIds);
      ownerMap = Object.fromEntries(
        (profs ?? []).map((p: AnyRow) => [
          p.auth_user_id,
          p.full_name || p.email || "Unassigned",
        ]),
      );
    }

    const hires: HireRecordDTO[] = (rows ?? []).map((r: AnyRow) =>
      toDTO({
        ...r,
        position_title: r.positions?.title ?? "Role",
        candidate_name: r.candidate_profiles?.full_name ?? "Candidate",
        applied_at: r.applications?.applied_at ?? null,
        owner_name: r.owner_user_id ? ownerMap[r.owner_user_id] ?? null : null,
      }),
    );
    return { hires };
  });

export const getHireByMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string }) =>
    z
      .object({ orgId: z.string().uuid(), matchId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sel = (s: string): string => s;
    const { data: row, error } = await context.supabase
      .from("hire_records")
      .select(
        sel(
          "*, positions:position_id(title), candidate_profiles:candidate_profile_id(full_name), applications:application_id(applied_at)",
        ),
      )
      .eq("organization_id", data.orgId)
      .eq("candidate_match_id", data.matchId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { hire: null as HireRecordDTO | null };
    const r = row as AnyRow;
    let owner_name: string | null = null;
    if (r.owner_user_id) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("full_name, email")
        .eq("auth_user_id", r.owner_user_id)
        .maybeSingle();
      const p = prof as AnyRow | null;
      owner_name = p?.full_name || p?.email || null;
    }
    return {
      hire: toDTO({
        ...r,
        position_title: r.positions?.title ?? "Role",
        candidate_name: r.candidate_profiles?.full_name ?? "Candidate",
        applied_at: r.applications?.applied_at ?? null,
        owner_name,
      }),
    };
  });

// ─── Mutations ──────────────────────────────────────────────────────────────

const OfferTermsSchema = z.object({
  owner_user_id: z.string().uuid().nullable().optional(),
  salary_amount: z.number().nonnegative().nullable().optional(),
  salary_currency: z.string().max(8).nullable().optional(),
  salary_period: z.enum(["year", "month", "hour"]).nullable().optional(),
  bonus_notes: z.string().max(2000).nullable().optional(),
  equity_notes: z.string().max(2000).nullable().optional(),
  start_date: z.string().nullable().optional(),
  employment_type: z.string().max(80).nullable().optional(),
  work_model: z.string().max(40).nullable().optional(),
  location: z.string().max(160).nullable().optional(),
  offer_notes: z.string().max(4000).nullable().optional(),
  // Guarantee terms — visible to the client by default so the promise is on record.
  guarantee_days: z.number().int().min(0).max(365).nullable().optional(),
  guarantee_starts_on: z.string().nullable().optional(),
  guarantee_terms: z.string().max(2000).nullable().optional(),
  guarantee_visible_to_client: z.boolean().optional(),
});
type OfferTerms = z.infer<typeof OfferTermsSchema>;

function pickTerms(t: OfferTerms | undefined): Record<string, unknown> {
  if (!t) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(t)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export const upsertOfferDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; matchId: string; terms?: OfferTerms }) =>
      z
        .object({
          orgId: z.string().uuid(),
          matchId: z.string().uuid(),
          terms: OfferTermsSchema.optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const match = await loadMatchForHire(context.supabase, data.orgId, data.matchId);

    const { data: existing } = await context.supabase
      .from("hire_records")
      .select("id, status")
      .eq("candidate_match_id", data.matchId)
      .maybeSingle();

    const patch = pickTerms(data.terms);
    if (existing) {
      const { error } = await context.supabase
        .from("hire_records")
        .update(patch as never)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      await writeAudit(context.supabase, {
        actor: context.userId,
        action: "hire.offer_updated",
        entity_type: "hire_records",
        entity_id: existing.id,
        organization_id: data.orgId,
        after: patch,
        trace_id: trace,
      });
      return { ok: true, id: existing.id, trace_id: trace };
    }

    const insertRow: Record<string, unknown> = {
      candidate_match_id: data.matchId,
      organization_id: data.orgId,
      position_id: match.position_id,
      candidate_profile_id: match.candidate_profile_id,
      application_id: match.application_id ?? null,
      status: "offer_drafted",
      created_by: context.userId,
      ...patch,
    };
    // Default the owner to the acting user if unassigned
    if (!("owner_user_id" in insertRow) || insertRow.owner_user_id == null) {
      insertRow.owner_user_id = context.userId;
    }
    const { data: created, error } = await context.supabase
      .from("hire_records")
      .insert(insertRow as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "hire.offer_drafted",
      entity_type: "hire_records",
      entity_id: created.id,
      organization_id: data.orgId,
      after: insertRow,
      trace_id: trace,
    });
    return { ok: true, id: created.id, trace_id: trace };
  });

export const transitionHire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      id: string;
      to: HireStatus;
      close_reason?: HireCloseReason;
      close_reason_notes?: string;
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
          to: z.enum(HIRE_STATUSES as [HireStatus, ...HireStatus[]]),
          close_reason: z
            .enum(Object.keys(CLOSE_REASON_LABEL) as [HireCloseReason, ...HireCloseReason[]])
            .optional(),
          close_reason_notes: z.string().max(2000).optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);

    const { data: current, error: cErr } = await context.supabase
      .from("hire_records")
      .select("id, status, candidate_match_id")
      .eq("id", data.id)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!current) throw new Error("hire_not_found");

    const patch: Record<string, unknown> = { status: data.to };
    if (data.to === "offer_declined" || data.to === "closed_lost") {
      if (!data.close_reason) throw new Error("close_reason_required");
      patch.close_reason = data.close_reason;
      patch.close_reason_notes = data.close_reason_notes ?? null;
    }

    const { error } = await context.supabase
      .from("hire_records")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: `hire.${data.to}`,
      entity_type: "hire_records",
      entity_id: data.id,
      organization_id: data.orgId,
      before: { status: current.status },
      after: patch,
      trace_id: trace,
    });
    return { ok: true, trace_id: trace };
  });

export const assignHireOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; id: string; owner_user_id: string | null }) =>
      z
        .object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
          owner_user_id: z.string().uuid().nullable(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase
      .from("hire_records")
      .update({ owner_user_id: data.owner_user_id })
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "hire.owner_assigned",
      entity_type: "hire_records",
      entity_id: data.id,
      organization_id: data.orgId,
      after: { owner_user_id: data.owner_user_id },
      trace_id: trace,
    });
    return { ok: true, trace_id: trace };
  });

// ─── Reporting ──────────────────────────────────────────────────────────────

export const getTimeToHireReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; sinceDays?: number }) =>
    z
      .object({
        orgId: z.string().uuid(),
        sinceDays: z.number().int().min(1).max(3650).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sel = (s: string): string => s;
    const { data: rows, error } = await context.supabase
      .from("v_time_to_hire")
      .select(sel("*"))
      .eq("organization_id", data.orgId)
      .limit(2000);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as AnyRow[];
    const cutoff = data.sinceDays
      ? Date.now() - data.sinceDays * 86400_000
      : null;
    const inWindow = (r: AnyRow) => {
      if (!cutoff) return true;
      const t = r.hired_at || r.offer_sent_at || r.offer_accepted_at;
      return t ? new Date(t).getTime() >= cutoff : true;
    };
    const scoped = list.filter(inWindow);

    const openOffers = scoped.filter((r) =>
      ["offer_drafted", "offer_sent", "offer_negotiating", "offer_accepted"].includes(
        r.status,
      ),
    ).length;
    const hires = scoped.filter((r) => r.status === "hire_confirmed");
    const declined = scoped.filter((r) => r.status === "offer_declined");
    const closedLost = scoped.filter((r) => r.status === "closed_lost").length;
    const decidedOffers = hires.length + declined.length;
    const acceptanceRate =
      decidedOffers > 0 ? hires.length / decidedOffers : null;

    const daysHired = hires
      .map((r) => (r.days_to_hire == null ? null : Number(r.days_to_hire)))
      .filter((n): n is number => n != null && Number.isFinite(n));
    const avg = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    const median = (xs: number[]) => {
      if (!xs.length) return null;
      const s = [...xs].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const daysAccept = hires
      .map((r) =>
        r.days_offer_to_accept == null ? null : Number(r.days_offer_to_accept),
      )
      .filter((n): n is number => n != null && Number.isFinite(n));

    // by owner
    const ownerAgg = new Map<
      string,
      { hires: number; days: number[]; ownerId: string | null }
    >();
    for (const r of hires) {
      const key = r.owner_user_id ?? "__unassigned__";
      const entry = ownerAgg.get(key) ?? {
        hires: 0,
        days: [] as number[],
        ownerId: r.owner_user_id ?? null,
      };
      entry.hires += 1;
      if (r.days_to_hire != null) entry.days.push(Number(r.days_to_hire));
      ownerAgg.set(key, entry);
    }
    const ownerIds = Array.from(ownerAgg.values())
      .map((e) => e.ownerId)
      .filter(Boolean) as string[];
    let ownerNames: Record<string, string> = {};
    if (ownerIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("auth_user_id, full_name, email")
        .in("auth_user_id", ownerIds);
      ownerNames = Object.fromEntries(
        (profs ?? []).map((p: AnyRow) => [
          p.auth_user_id,
          p.full_name || p.email || "Team member",
        ]),
      );
    }
    const byOwner = Array.from(ownerAgg.entries()).map(([, v]) => ({
      owner_user_id: v.ownerId,
      owner_name: v.ownerId ? ownerNames[v.ownerId] ?? "Team member" : "Unassigned",
      hires: v.hires,
      avg_days_to_hire: avg(v.days),
    }));

    // by position
    const posAgg = new Map<
      string,
      { title: string; hires: number; open: number; days: number[] }
    >();
    for (const r of scoped) {
      const entry = posAgg.get(r.position_id) ?? {
        title: r.position_title ?? "Role",
        hires: 0,
        open: 0,
        days: [] as number[],
      };
      if (r.status === "hire_confirmed") {
        entry.hires += 1;
        if (r.days_to_hire != null) entry.days.push(Number(r.days_to_hire));
      } else if (
        ["offer_drafted", "offer_sent", "offer_negotiating", "offer_accepted"].includes(
          r.status,
        )
      ) {
        entry.open += 1;
      }
      posAgg.set(r.position_id, entry);
    }
    const byPosition = Array.from(posAgg.entries()).map(([id, v]) => ({
      position_id: id,
      position_title: v.title,
      hires: v.hires,
      open_offers: v.open,
      avg_days_to_hire: avg(v.days),
    }));

    // close reasons
    const reasonAgg = new Map<HireCloseReason, number>();
    for (const r of scoped) {
      if (r.close_reason) {
        reasonAgg.set(
          r.close_reason as HireCloseReason,
          (reasonAgg.get(r.close_reason as HireCloseReason) ?? 0) + 1,
        );
      }
    }
    const closeReasons = Array.from(reasonAgg.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const report: TimeToHireReport = {
      totals: {
        open_offers: openOffers,
        hires_confirmed: hires.length,
        closed_lost: closedLost,
        acceptance_rate: acceptanceRate,
        avg_days_to_hire: avg(daysHired),
        avg_days_offer_to_accept: avg(daysAccept),
        median_days_to_hire: median(daysHired),
      },
      by_owner: byOwner.sort((a, b) => b.hires - a.hires),
      by_position: byPosition.sort((a, b) => b.hires - a.hires),
      close_reasons: closeReasons,
    };
    return report;
  });

// List teammates who can be assigned as owners (active org members)
export const listOfferOwners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: members, error } = await context.supabase
      .from("memberships")
      .select("user_id, role")
      .eq("organization_id", data.orgId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    const withProfiles = await attachMemberProfiles(context.supabase, (members ?? []) as AnyRow[]);
    const owners = withProfiles.map((m: AnyRow) => ({
      user_id: m.user_id as string,
      role: m.role as string,
      name:
        (m.profiles?.full_name as string | null) ||
        (m.profiles?.email as string | null) ||
        "Team member",
    }));
    return { owners };
  });

// ─── Stalled-offer nudge ────────────────────────────────────────────────────

/**
 * Records a nudge on a stalled offer: stamps last_nudged_at, increments the
 * counter, notifies the offer owner, and writes an audit event. Idempotency is
 * intentionally soft — a nudge is a human action, repeat nudges are meaningful.
 */
export const nudgeOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; id: string; note?: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);

    const { data: current, error: cErr } = await context.supabase
      .from("hire_records")
      .select(
        "id, status, owner_user_id, nudge_count, position_id, candidate_profile_id, candidate_match_id",
      )
      .eq("id", data.id)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!current) throw new Error("hire_not_found");

    const row = current as AnyRow;
    const nowIso = new Date().toISOString();
    const { error } = await context.supabase
      .from("hire_records")
      .update({
        last_nudged_at: nowIso,
        nudge_count: (row.nudge_count ?? 0) + 1,
      } as never)
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);

    // Best-effort in-app notification to the owner; never blocks the nudge.
    if (row.owner_user_id) {
      try {
        await context.supabase.from("notifications").insert({
          recipient_user_id: row.owner_user_id,
          audience: "client",
          organization_id: data.orgId,
          event_type: "candidate_stage_changed",
          title: "Offer needs a push",
          body:
            data.note?.trim() ||
            "This offer has had no movement for more than 48 hours. Chase the candidate or update the record.",
          link_path: "/client/offers",
        } as never);
      } catch {
        // notification failure must not fail the nudge
      }
    }

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "hire.nudged",
      entity_type: "hire_records",
      entity_id: data.id,
      organization_id: data.orgId,
      before: { status: row.status, nudge_count: row.nudge_count ?? 0 },
      after: { last_nudged_at: nowIso, note: data.note ?? null },
      trace_id: trace,
    });

    return { ok: true, last_nudged_at: nowIso, trace_id: trace };
  });

/**
 * Records the date by which a response to the offer is expected.
 *
 * The date is only ever what a human agreed — passing null clears it, and the
 * offer row then reads "No response date agreed" rather than showing a guess.
 */
export const setOfferResponseDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; id: string; date: string | null }) =>
    z
      .object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date")
          .nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);

    const { data: before, error: readErr } = await context.supabase
      .from("hire_records")
      .select("id, organization_id, expected_response_date")
      .eq("id", data.id)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!before) throw new Error("offer_not_found");

    const { error } = await context.supabase
      .from("hire_records")
      .update({
        expected_response_date: data.date,
        expected_response_set_at: data.date ? new Date().toISOString() : null,
        expected_response_set_by: data.date ? context.userId : null,
      } as never)
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "hire.response_date_set",
      entity_type: "hire_records",
      entity_id: data.id,
      organization_id: data.orgId,
      before: { expected_response_date: (before as AnyRow).expected_response_date ?? null },
      after: { expected_response_date: data.date },
      trace_id: trace,
    });

    return { ok: true, expected_response_date: data.date, trace_id: trace };
  });
