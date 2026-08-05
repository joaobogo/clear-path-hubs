/**
 * First-run onboarding — server side.
 *
 * Everything here writes to the same canonical records the rest of the product
 * reads (organizations, positions, intake_drafts). Onboarding is a guided path
 * through existing configuration, never a parallel store of truth.
 *
 * Nothing here relaxes billing, legal or data controls: the payment gate trigger
 * on positions still decides publication, candidate release still requires
 * review, and contact release remains a separate permission.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  ONBOARDING_STEP_IDS,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps";
import {
  DEFAULT_WEIGHTS,
  WEIGHT_DIMENSIONS,
  balanceWeights,
  normalizeWeights,
  weightsSchema,
  type EvaluationWeights,
} from "@/lib/requisition-schema";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const DRAFT_NAMESPACE = "onboarding_v1";

type DraftShape = {
  current_step?: OnboardingStepId;
  position_id?: string | null;
  confirmed?: Partial<Record<OnboardingStepId, string>>;
  notes?: Record<string, unknown>;
};

async function assertMember(supabase: Db, userId: string, org: string) {
  await assertWorkspaceAccess(supabase, userId, org);
}

async function canConfigure(supabase: Db, userId: string, org: string) {
  const { data: editor } = await supabase.rpc("is_org_editor", { _user: userId, _org: org });
  if (editor === true) return true;
  const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
  return staff === true;
}

async function assertCanConfigure(supabase: Db, userId: string, org: string) {
  if (!(await canConfigure(supabase, userId, org))) {
    throw new Error(
      "Your seat can review this setup but not change it. Ask a workspace admin for edit access.",
    );
  }
}

async function assertOrgAdmin(supabase: Db, userId: string, org: string) {
  const { data: admin } = await supabase.rpc("is_org_admin", { _user: userId, _org: org });
  if (admin === true) return;
  const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (staff !== true) {
    throw new Error("Only a workspace admin can change workspace details.");
  }
}

/* ------------------------------------------------------------------ */
/* Draft persistence — namespaced inside the existing intake draft row */
/* ------------------------------------------------------------------ */

async function readDraft(
  supabase: Db,
  userId: string,
): Promise<{ payload: Record<string, unknown>; draft: DraftShape; updatedAt: string | null }> {
  const { data } = await supabase
    .from("intake_drafts")
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  const payload = (data?.payload ?? {}) as Record<string, unknown>;
  const draft = (payload[DRAFT_NAMESPACE] ?? {}) as DraftShape;
  return { payload, draft, updatedAt: (data?.updated_at ?? null) as string | null };
}

async function writeDraft(supabase: Db, userId: string, next: DraftShape) {
  const { payload } = await readDraft(supabase, userId);
  const merged = { ...payload, [DRAFT_NAMESPACE]: next };
  const { error } = await supabase.from("intake_drafts").upsert(
    { user_id: userId, payload: merged, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export type OnboardingPositionState = {
  id: string;
  title: string;
  status: string;
  description: string;
  location: string;
  work_model: string;
  employment_type: string;
  seniority: string;
  must_haves: string[];
  nice_to_haves: string[];
  dealbreakers: string[];
  success_criteria: string;
  weights: EvaluationWeights;
  weights_set: boolean;
  intensity: string;
  blueprint_status: string;
  blueprint_error: string | null;
  blueprint_generated_at: string | null;
  blueprint_confirmed_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blueprint: Record<string, any> | null;
  oversight: Record<string, boolean>;
  payment_status: string;
  search_live_at: string | null;
};

export type OnboardingState = {
  organization_id: string | null;
  organization_name: string;
  can_configure: boolean;
  is_admin: boolean;
  workspace: {
    name: string;
    website: string;
    industry: string;
    headquarters: string;
    onboarding_status: string;
    plan_name: string | null;
    pilot_status: string | null;
  } | null;
  billing: {
    role_paid: boolean;
    payment_status: string;
    plan_name: string | null;
    entitlement_available: boolean;
  };
  positions: Array<{ id: string; title: string; status: string }>;
  position: OnboardingPositionState | null;
  integrations: Array<{ id: string; status: string; checked_at: string | null }>;
  complete: OnboardingStepId[];
  current_step: OnboardingStepId;
  draft_saved_at: string | null;
};

function labels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) =>
      typeof v === "string"
        ? v
        : v && typeof v === "object" && "label" in (v as Record<string, unknown>)
          ? String((v as Record<string, unknown>).label ?? "")
          : "",
    )
    .filter(Boolean);
}

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ organization_id: z.string().uuid().optional() }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<OnboardingState> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };

    // Which workspace? The named one, else the caller's first client membership.
    let org = data.organization_id ?? null;
    if (!org) {
      const { data: m } = await supabase
        .from("memberships")
        .select("organization_id, role")
        .eq("user_id", userId)
        .eq("status", "active")
        .in("role", ["client_admin", "client_editor", "client_viewer"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      org = (m as { organization_id?: string } | null)?.organization_id ?? null;
    }

    const { draft, updatedAt } = await readDraft(supabase, userId);

    if (!org) {
      return {
        organization_id: null,
        organization_name: "",
        can_configure: false,
        is_admin: false,
        workspace: null,
        billing: {
          role_paid: false,
          payment_status: "unpaid",
          plan_name: null,
          entitlement_available: false,
        },
        positions: [],
        position: null,
        integrations: [],
        complete: [],
        current_step: "workspace",
        draft_saved_at: updatedAt,
      };
    }

    await assertMember(supabase, userId, org);
    const configure = await canConfigure(supabase, userId, org);
    const { data: adminFlag } = await supabase.rpc("is_org_admin", {
      _user: userId,
      _org: org,
    });

    const [orgRes, posRes, entRes, healthRes] = await Promise.all([
      supabase
        .from("organizations")
        .select(
          "id, name, website, industry, headquarters, onboarding_status, plan_name, pilot_status, pilot_position_id",
        )
        .eq("id", org)
        .maybeSingle(),
      supabase
        .from("positions")
        .select(
          "id, title, status, description, location, work_model, employment_type, seniority, requirements, preferred_requirements, dealbreakers, evaluation_weights, intensity, blueprint, blueprint_status, blueprint_error, blueprint_generated_at, blueprint_confirmed_at, intake_context, payment_status, search_live_at, created_at",
        )
        .eq("organization_id", org)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("plan_entitlements")
        .select("id, roles_total, roles_used, expires_at")
        .eq("organization_id", org)
        .limit(10),
      supabase
        .from("integration_health_checks")
        .select("integration_id, status, checked_at")
        .order("checked_at", { ascending: false })
        .limit(40),
    ]);

    const orgRow = (orgRes.data ?? null) as Db;
    const rows = (posRes.data ?? []) as Db[];
    const preferredId = draft.position_id ?? orgRow?.pilot_position_id ?? null;
    const row = rows.find((r) => r.id === preferredId) ?? rows[0] ?? null;

    let position: OnboardingPositionState | null = null;
    if (row) {
      const ctx = (row.intake_context ?? {}) as Record<string, unknown>;
      const weightsRaw = (row.evaluation_weights ?? {}) as Record<string, unknown>;
      const weightsSet = WEIGHT_DIMENSIONS.some(
        (d) => typeof weightsRaw[d.key] === "number",
      );
      position = {
        id: row.id,
        title: row.title ?? "",
        status: row.status ?? "draft",
        description: row.description ?? "",
        location: row.location ?? "",
        work_model: row.work_model ?? "",
        employment_type: row.employment_type ?? "",
        seniority: row.seniority ?? "",
        must_haves: labels(row.requirements),
        nice_to_haves: labels(row.preferred_requirements),
        dealbreakers: labels(row.dealbreakers),
        success_criteria:
          typeof ctx.success_criteria === "string" ? ctx.success_criteria : "",
        weights: weightsSet ? normalizeWeights(weightsRaw) : { ...DEFAULT_WEIGHTS },
        weights_set: weightsSet,
        intensity: row.intensity ?? "standard",
        blueprint_status: row.blueprint_status ?? "not_started",
        blueprint_error: row.blueprint_error ?? null,
        blueprint_generated_at: row.blueprint_generated_at ?? null,
        blueprint_confirmed_at: row.blueprint_confirmed_at ?? null,
        blueprint:
          row.blueprint && typeof row.blueprint === "object"
            ? (row.blueprint as Record<string, unknown>)
            : null,
        oversight:
          ctx.oversight && typeof ctx.oversight === "object"
            ? (ctx.oversight as Record<string, boolean>)
            : {},
        payment_status: row.payment_status ?? "unpaid",
        search_live_at: row.search_live_at ?? null,
      };
    }

    const entitlements = (entRes.data ?? []) as Db[];
    const entitlementAvailable = entitlements.some(
      (e) =>
        (e.roles_total ?? 0) > (e.roles_used ?? 0) &&
        (!e.expires_at || new Date(e.expires_at).getTime() > Date.now()),
    );

    // Health rows are keyed by integration; keep the newest per integration.
    const integrations: Array<{ id: string; status: string; checked_at: string | null }> = [];
    for (const h of (healthRes.data ?? []) as Db[]) {
      if (integrations.some((i) => i.id === h.integration_id)) continue;
      integrations.push({
        id: h.integration_id,
        status: h.status ?? "not_configured",
        checked_at: h.checked_at ?? null,
      });
    }

    const confirmed = draft.confirmed ?? {};
    const complete: OnboardingStepId[] = [];
    const paid = ["paid", "exempt"].includes(position?.payment_status ?? "unpaid");

    if (orgRow?.name && confirmed.workspace) complete.push("workspace");
    if (position && position.title.trim().length > 1) complete.push("role");
    if (position && position.must_haves.length >= 3) complete.push("requirements");
    if (position?.blueprint_confirmed_at) complete.push("blueprint");
    if (position?.weights_set) complete.push("weights");
    if (confirmed.agents) complete.push("agents");
    if (position && Object.keys(position.oversight).length > 0) complete.push("oversight");
    if (confirmed.systems) complete.push("systems");
    if (
      position &&
      (position.search_live_at ||
        ["generated", "ready", "confirmed", "analyzing_jd", "researching", "compiling"].includes(
          position.blueprint_status,
        ))
    ) {
      complete.push("run");
    }
    if (confirmed.workspace_entry) complete.push("workspace_entry");

    const nextIncomplete =
      ONBOARDING_STEP_IDS.find((id) => !complete.includes(id)) ?? "workspace_entry";
    const current =
      draft.current_step && ONBOARDING_STEP_IDS.includes(draft.current_step)
        ? draft.current_step
        : nextIncomplete;

    return {
      organization_id: org,
      organization_name: orgRow?.name ?? "",
      can_configure: configure,
      is_admin: adminFlag === true,
      workspace: orgRow
        ? {
            name: orgRow.name ?? "",
            website: orgRow.website ?? "",
            industry: orgRow.industry ?? "",
            headquarters: orgRow.headquarters ?? "",
            onboarding_status: orgRow.onboarding_status ?? "pending",
            plan_name: orgRow.plan_name ?? null,
            pilot_status: orgRow.pilot_status ?? null,
          }
        : null,
      billing: {
        role_paid: paid,
        payment_status: position?.payment_status ?? "unpaid",
        plan_name: orgRow?.plan_name ?? null,
        entitlement_available: entitlementAvailable,
      },
      positions: rows.map((r) => ({ id: r.id, title: r.title, status: r.status })),
      position,
      integrations,
      complete,
      current_step: current,
      draft_saved_at: updatedAt,
    };
  });

/* ------------------------------------------------------------------ */
/* Save & continue later / navigate                                    */
/* ------------------------------------------------------------------ */

export const saveOnboardingPlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        current_step: z.enum(ONBOARDING_STEP_IDS as unknown as [string, ...string[]]),
        position_id: z.string().uuid().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const { draft } = await readDraft(supabase, userId);
    const savedAt = await writeDraft(supabase, userId, {
      ...draft,
      current_step: data.current_step as OnboardingStepId,
      position_id: data.position_id ?? draft.position_id ?? null,
    });
    return { savedAt };
  });

export const confirmOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        step: z.enum(ONBOARDING_STEP_IDS as unknown as [string, ...string[]]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertMember(supabase, userId, data.organization_id);
    const { draft } = await readDraft(supabase, userId);
    const step = data.step as OnboardingStepId;
    const savedAt = await writeDraft(supabase, userId, {
      ...draft,
      confirmed: { ...(draft.confirmed ?? {}), [step]: new Date().toISOString() },
    });

    // Finishing the sequence flips the workspace out of first-run, but only
    // when an admin does it and only if it is still pending.
    if (step === "workspace_entry") {
      const { data: admin } = await supabase.rpc("is_org_admin", {
        _user: userId,
        _org: data.organization_id,
      });
      if (admin === true) {
        await supabase
          .from("organizations")
          .update({ onboarding_status: "active" })
          .eq("id", data.organization_id)
          .eq("onboarding_status", "pending");
      }
    }
    return { savedAt };
  });

/* ------------------------------------------------------------------ */
/* Step commits                                                        */
/* ------------------------------------------------------------------ */

export const saveOnboardingWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        website: z.string().trim().max(200).default(""),
        industry: z.string().trim().max(120).default(""),
        headquarters: z.string().trim().max(160).default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertOrgAdmin(supabase, userId, data.organization_id);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: data.name,
        website: data.website || null,
        industry: data.industry || null,
        headquarters: data.headquarters || null,
      })
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);
    const { draft } = await readDraft(supabase, userId);
    await writeDraft(supabase, userId, {
      ...draft,
      confirmed: { ...(draft.confirmed ?? {}), workspace: new Date().toISOString() },
    });
    return { ok: true as const };
  });

const WORK_MODELS = ["", "remote", "hybrid", "onsite"] as const;
const EMPLOYMENT = [
  "",
  "full_time",
  "part_time",
  "contract",
  "temporary",
  "internship",
] as const;

export const saveOnboardingRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        position_id: z.string().uuid().nullable().optional(),
        title: z.string().trim().min(2).max(160),
        location: z.string().trim().max(160).default(""),
        work_model: z.enum(WORK_MODELS).default(""),
        employment_type: z.enum(EMPLOYMENT).default(""),
        seniority: z.string().trim().max(80).default(""),
        description: z.string().max(20000).default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertCanConfigure(supabase, userId, data.organization_id);

    const patch = {
      title: data.title,
      location: data.location || null,
      work_model: data.work_model || null,
      employment_type: data.employment_type || null,
      seniority: data.seniority || null,
      description: data.description || null,
    };

    let positionId = data.position_id ?? null;
    if (positionId) {
      const { error } = await supabase
        .from("positions")
        .update(patch)
        .eq("id", positionId)
        .eq("organization_id", data.organization_id);
      if (error) throw new Error(error.message);
    } else {
      // New roles start as drafts. Publication stays behind the payment gate.
      const { data: created, error } = await supabase
        .from("positions")
        .insert({
          organization_id: data.organization_id,
          status: "draft",
          created_by: userId,
          owner_user_id: userId,
          ...patch,
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      positionId = (created as { id: string }).id;
    }

    const { draft } = await readDraft(supabase, userId);
    await writeDraft(supabase, userId, { ...draft, position_id: positionId });
    return { position_id: positionId };
  });

const listInput = z.array(z.string().trim().min(2).max(160)).max(40);

export const saveOnboardingRequirements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        position_id: z.string().uuid(),
        must_haves: listInput,
        nice_to_haves: listInput.default([]),
        dealbreakers: listInput.default([]),
        success_criteria: z.string().trim().max(4000).default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertCanConfigure(supabase, userId, data.organization_id);
    if (data.must_haves.length < 3) {
      throw new Error("Add at least three must-have requirements so scoring has something to prove.");
    }

    const { data: current } = await supabase
      .from("positions")
      .select("intake_context")
      .eq("id", data.position_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    const ctx = ((current as Db)?.intake_context ?? {}) as Record<string, unknown>;

    const { error } = await supabase
      .from("positions")
      .update({
        requirements: data.must_haves.map((label) => ({ label, kind: "must_have" })),
        preferred_requirements: data.nice_to_haves.map((label) => ({ label })),
        dealbreakers: data.dealbreakers.map((label) => ({ label })),
        intake_context: { ...ctx, success_criteria: data.success_criteria },
      })
      .eq("id", data.position_id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const confirmOnboardingBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ organization_id: z.string().uuid(), position_id: z.string().uuid() })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertCanConfigure(supabase, userId, data.organization_id);
    const { data: pos } = await supabase
      .from("positions")
      .select("blueprint_status")
      .eq("id", data.position_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    const status = (pos as { blueprint_status?: string } | null)?.blueprint_status ?? "not_started";
    if (!["generated", "ready", "confirmed"].includes(status)) {
      return { ok: false as const, reason: status };
    }
    const { error } = await supabase
      .from("positions")
      .update({ blueprint_confirmed_at: new Date().toISOString() })
      .eq("id", data.position_id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true as const, reason: null };
  });

export const saveOnboardingWeights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        position_id: z.string().uuid(),
        weights: weightsSchema,
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertCanConfigure(supabase, userId, data.organization_id);
    const weights = balanceWeights(normalizeWeights(data.weights));
    const { error } = await supabase
      .from("positions")
      .update({ evaluation_weights: weights, rescore_requested_at: new Date().toISOString() })
      .eq("id", data.position_id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { weights };
  });

export const saveOnboardingOversight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        position_id: z.string().uuid(),
        gates: z.record(z.string(), z.boolean()),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertCanConfigure(supabase, userId, data.organization_id);

    const { data: current } = await supabase
      .from("positions")
      .select("intake_context")
      .eq("id", data.position_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    const ctx = ((current as Db)?.intake_context ?? {}) as Record<string, unknown>;

    // The two policy gates are recorded as always-on; they are enforced by RLS
    // and review flow, not by this setting.
    const gates = {
      ...data.gates,
      candidate_release: true,
      contact_release: true,
      configured_at: new Date().toISOString(),
    } as Record<string, unknown>;

    const { error } = await supabase
      .from("positions")
      .update({ intake_context: { ...ctx, oversight: gates } })
      .eq("id", data.position_id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
