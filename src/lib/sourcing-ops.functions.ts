// Sourcing operations service — the admin-managed record behind every role's
// sourcing story. Staff own the writes; clients only ever read derived state
// through the client workspace, never these mutations.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function requireStaff(userId: string) {
  const s = await getAdmin();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

async function writeAudit(opts: {
  actor: string;
  action: string;
  entity_id: string;
  organization_id?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const s = await getAdmin();
  await s.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: "sourcing_ops",
    entity_id: opts.entity_id,
    organization_id: opts.organization_id ?? null,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
  });
}

export const STRATEGY_STATUSES = [
  "not_started",
  "analysing",
  "ready",
  "active",
  "paused",
  "complete",
] as const;
export const JOB_BOARD_STATUSES = [
  "not_started",
  "preparing",
  "distributed",
  "paused",
  "ended",
] as const;
export const SPONSORED_STATUSES = [
  "not_started",
  "requested",
  "running",
  "paused",
  "ended",
] as const;
export const CAMPAIGN_CHANNELS = [
  "linkedin",
  "email",
  "phone",
  "sms",
  "referral",
  "event",
  "other",
] as const;
export const CAMPAIGN_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
] as const;

const nullableText = z.string().trim().max(2000).nullish();
const nullableInt = z.number().int().min(0).max(1_000_000).nullish();

// ─── Read ────────────────────────────────────────────────────────────────────

export const getSourcingOps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { positionId: string }) =>
    z.object({ positionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();

    const { data: position, error: pErr } = await s
      .from("positions")
      .select(
        "id, title, status, visibility, organization_id, published_at, approved_at, created_at",
      )
      .eq("id", data.positionId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!position) throw new Error("not_found");

    const [{ data: plan }, { data: campaigns }] = await Promise.all([
      s
        .from("position_sourcing_plans")
        .select("*")
        .eq("position_id", data.positionId)
        .maybeSingle(),
      s
        .from("outreach_campaigns")
        .select("*")
        .eq("position_id", data.positionId)
        .order("created_at", { ascending: true }),
    ]);

    const campaignRows = (campaigns ?? []) as AnyRow[];
    const ids = campaignRows.map((c) => c.id);
    let touches: AnyRow[] = [];
    if (ids.length) {
      const { data: t } = await s
        .from("outreach_touches")
        .select(
          "id, campaign_id, candidate_profile_id, state, engagement_state, sent_at, delivered_at, replied_at, error, is_test_record",
        )
        .in("campaign_id", ids);
      touches = (t ?? []) as AnyRow[];
    }

    const [{ count: applicationCount }, { count: matchCount }] = await Promise.all([
      s
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("position_id", data.positionId),
      s
        .from("candidate_matches")
        .select("id", { count: "exact", head: true })
        .eq("position_id", data.positionId),
    ]);

    const perCampaign = campaignRows.map((c) => {
      const rows = touches.filter((t) => t.campaign_id === c.id && !t.is_test_record);
      return {
        ...c,
        verified: {
          identified: new Set(
            rows.map((t) => t.candidate_profile_id).filter(Boolean),
          ).size,
          contacted: rows.filter((t) => Boolean(t.sent_at)).length,
          engaged: rows.filter((t) => Boolean(t.engagement_state) || Boolean(t.delivered_at))
            .length,
          replied: rows.filter((t) => Boolean(t.replied_at)).length,
          failed: rows.filter((t) => t.state === "failed" || t.state === "bounced").length,
        },
      };
    });

    const totals = perCampaign.reduce(
      (acc, c) => ({
        identified: acc.identified + (c.manual_identified ?? c.verified.identified),
        contacted: acc.contacted + (c.manual_contacted ?? c.verified.contacted),
        engaged: acc.engaged + (c.manual_engaged ?? c.verified.engaged),
        replied: acc.replied + (c.manual_replied ?? c.verified.replied),
        failed: acc.failed + c.verified.failed,
      }),
      { identified: 0, contacted: 0, engaged: 0, replied: 0, failed: 0 },
    );

    return {
      position,
      plan: plan ?? null,
      campaigns: perCampaign,
      totals,
      applicationCount: applicationCount ?? 0,
      matchCount: matchCount ?? 0,
    };
  });

// ─── Plan ────────────────────────────────────────────────────────────────────

export const saveSourcingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        positionId: z.string().uuid(),
        strategy_status: z.enum(STRATEGY_STATUSES),
        job_board_status: z.enum(JOB_BOARD_STATUSES),
        sponsored_status: z.enum(SPONSORED_STATUSES),
        strategy_notes: nullableText,
        next_action: nullableText,
        next_action_at: z.string().nullish(),
        exceptions: nullableText,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();

    const { data: position, error: pErr } = await s
      .from("positions")
      .select("id, organization_id")
      .eq("id", data.positionId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!position) throw new Error("not_found");

    const { data: before } = await s
      .from("position_sourcing_plans")
      .select("*")
      .eq("position_id", data.positionId)
      .maybeSingle();

    const payload = {
      position_id: data.positionId,
      organization_id: position.organization_id,
      strategy_status: data.strategy_status,
      job_board_status: data.job_board_status,
      sponsored_status: data.sponsored_status,
      strategy_notes: data.strategy_notes || null,
      next_action: data.next_action || null,
      next_action_at: data.next_action_at || null,
      exceptions: data.exceptions || null,
      owner_user_id: context.userId,
      last_reviewed_at: new Date().toISOString(),
    };

    const { data: after, error } = await s
      .from("position_sourcing_plans")
      .upsert(payload, { onConflict: "position_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await writeAudit({
      actor: context.userId,
      action: "sourcing_plan.save",
      entity_id: data.positionId,
      organization_id: position.organization_id,
      before,
      after,
    });
    return after;
  });

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const saveSourcingCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        positionId: z.string().uuid(),
        name: z.string().trim().min(2).max(160),
        channel: z.enum(CAMPAIGN_CHANNELS),
        status: z.enum(CAMPAIGN_STATUSES),
        target_count: nullableInt,
        external_ref: z.string().trim().max(200).nullish(),
        notes: nullableText,
        next_action: nullableText,
        next_action_at: z.string().nullish(),
        manual_identified: nullableInt,
        manual_contacted: nullableInt,
        manual_engaged: nullableInt,
        manual_replied: nullableInt,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();

    const { data: position, error: pErr } = await s
      .from("positions")
      .select("id, organization_id")
      .eq("id", data.positionId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!position) throw new Error("not_found");

    const row = {
      organization_id: position.organization_id,
      position_id: data.positionId,
      name: data.name,
      channel: data.channel,
      status: data.status,
      target_count: data.target_count ?? null,
      external_ref: data.external_ref || null,
      notes: data.notes || null,
      next_action: data.next_action || null,
      next_action_at: data.next_action_at || null,
      manual_identified: data.manual_identified ?? null,
      manual_contacted: data.manual_contacted ?? null,
      manual_engaged: data.manual_engaged ?? null,
      manual_replied: data.manual_replied ?? null,
      started_at:
        data.status === "active" ? new Date().toISOString() : undefined,
      ended_at:
        data.status === "completed" || data.status === "archived"
          ? new Date().toISOString()
          : undefined,
      owner_user_id: context.userId,
    };

    let before: AnyRow = null;
    let after: AnyRow = null;
    if (data.id) {
      const { data: prev } = await s
        .from("outreach_campaigns")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      before = prev;
      const patch = { ...row };
      if (prev?.started_at) delete (patch as AnyRow).started_at;
      const { data: updated, error } = await s
        .from("outreach_campaigns")
        .update(patch)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      after = updated;
    } else {
      const { data: created, error } = await s
        .from("outreach_campaigns")
        .insert(row)
        .select()
        .single();
      if (error) throw new Error(error.message);
      after = created;
    }

    await writeAudit({
      actor: context.userId,
      action: data.id ? "sourcing_campaign.update" : "sourcing_campaign.create",
      entity_id: after.id,
      organization_id: position.organization_id,
      before,
      after,
    });
    return after;
  });

export const deleteSourcingCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), reason: z.string().trim().min(3).max(500) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();

    const { data: before } = await s
      .from("outreach_campaigns")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("not_found");

    await s.from("outreach_touches").delete().eq("campaign_id", data.id);
    const { error } = await s.from("outreach_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await writeAudit({
      actor: context.userId,
      action: "sourcing_campaign.delete",
      entity_id: data.id,
      organization_id: before.organization_id,
      before,
      after: { reason: data.reason },
    });
    return { ok: true };
  });
