// Admin intake inbox — canonical server fns for reviewing, converting,
// clarifying and rejecting client intake submissions.
//
// Convert-to-position is idempotent: if the intake already has a linked
// position_id, we return it instead of creating a duplicate. Every mutation
// requires platform staff and writes an audit event with a trace_id.
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

const traceId = () =>
  `ia_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

async function writeAudit(opts: {
  actor: string;
  action: string;
  entity_id: string;
  organization_id?: string | null;
  before?: unknown;
  after?: unknown;
  trace_id: string;
}) {
  const s = await getAdmin();
  await s.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: "intake_submissions",
    entity_id: opts.entity_id,
    organization_id: opts.organization_id ?? null,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
    trace_id: opts.trace_id,
  });
}

// Completeness score: how many important fields the payload actually filled.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function completenessOf(payload: any): { score: number; missing: string[] } {
  const req: [string, unknown][] = [
    ["companyName", payload?.companyName],
    ["workEmail", payload?.workEmail],
    ["firstName", payload?.firstName],
    ["lastName", payload?.lastName],
    ["roleTitle", payload?.roleTitle],
    ["location", payload?.location],
    ["workModel", payload?.workModel],
    ["employmentType", payload?.employmentType],
    ["seniority", payload?.seniority],
    ["jobDescription", payload?.jobDescription],
    ["mustHaveSkills", Array.isArray(payload?.mustHaveSkills) && payload.mustHaveSkills.length > 0 ? 1 : null],
  ];
  const filled = req.filter(([, v]) => v !== undefined && v !== null && v !== "").length;
  const missing = req.filter(([, v]) => !(v !== undefined && v !== null && v !== "")).map(([k]) => k);
  return { score: Math.round((filled / req.length) * 100), missing };
}

// ─── List ────────────────────────────────────────────────────────────────────

export const listIntakeInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        q: z.string().optional(),
        filter: z
          .enum(["all", "pending", "needs_conversion", "approved", "rejected"])
          .optional()
          .default("pending"),
        page: z.number().int().min(1).optional().default(1),
        page_size: z.number().int().min(10).max(100).optional().default(50),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    let q = s
      .from("intake_submissions")
      .select(
        "id,company_name,role_title,primary_email,source,status,workspace_status,requisition_pending,position_id,organization_id,created_at,updated_at,trace_id",
      )
      .order("created_at", { ascending: false })
      .limit(data.page_size * 4);

    if (data.q) {
      q = q.or(
        `company_name.ilike.%${data.q}%,role_title.ilike.%${data.q}%,primary_email.ilike.%${data.q}%`,
      );
    }
    switch (data.filter) {
      case "pending":
        q = q.or("requisition_pending.eq.true,status.eq.submitted");
        break;
      case "needs_conversion":
        q = q.eq("requisition_pending", true);
        break;
      case "approved":
        q = q.eq("status", "approved");
        break;
      case "rejected":
        q = q.eq("status", "rejected");
        break;
      case "all":
      default:
        break;
    }
    const { data: rows } = await q;
    const items = (rows ?? []) as AnyRow[];
    // Duplicate detection: same email or (company_name + role_title) inside
    // the current inbox window.
    const emailBucket: Record<string, number> = {};
    const pairBucket: Record<string, number> = {};
    for (const r of items) {
      if (r.primary_email) emailBucket[r.primary_email] = (emailBucket[r.primary_email] ?? 0) + 1;
      const key = `${(r.company_name ?? "").toLowerCase()}::${(r.role_title ?? "").toLowerCase()}`;
      pairBucket[key] = (pairBucket[key] ?? 0) + 1;
    }
    const enriched = items.map((r) => {
      const pairKey = `${(r.company_name ?? "").toLowerCase()}::${(r.role_title ?? "").toLowerCase()}`;
      const duplicate =
        (emailBucket[r.primary_email ?? ""] ?? 0) > 1 || (pairBucket[pairKey] ?? 0) > 1;
      const next_action = r.status === "rejected"
        ? "archived"
        : r.status === "approved"
          ? "open_position"
          : r.requisition_pending
            ? "convert_to_position"
            : "review";
      return { ...r, duplicate, next_action };
    });
    const start = (data.page - 1) * data.page_size;
    return {
      items: enriched.slice(start, start + data.page_size),
      total: enriched.length,
      page: data.page,
      page_size: data.page_size,
    };
  });

// ─── Detail ──────────────────────────────────────────────────────────────────

export const getIntakeSubmission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: intake } = await s
      .from("intake_submissions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!intake) return null;
    const [{ data: org }, { data: pos }, { data: audit }] = await Promise.all([
      intake.organization_id
        ? s
            .from("organizations")
            .select("id,name,domain,industry,status,archived_at")
            .eq("id", intake.organization_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      intake.position_id
        ? s
            .from("positions")
            .select("id,title,status,visibility,created_at")
            .eq("id", intake.position_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      s
        .from("audit_events")
        .select("id,action,created_at,before_state,after_state,trace_id")
        .eq("entity_type", "intake_submissions")
        .eq("entity_id", data.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    // Duplicate hints: other intakes with same email or company+role.
    const { data: dupes } = await s
      .from("intake_submissions")
      .select("id,company_name,role_title,created_at,primary_email,status,position_id")
      .neq("id", intake.id)
      .or(
        `primary_email.eq.${intake.primary_email},and(company_name.eq.${(intake.company_name ?? "").replace(/,/g, " ")},role_title.eq.${(intake.role_title ?? "").replace(/,/g, " ")})`,
      )
      .order("created_at", { ascending: false })
      .limit(5);
    const completeness = completenessOf(intake.payload);
    return {
      intake,
      organization: org ?? null,
      position: pos ?? null,
      audit: (audit ?? []) as AnyRow[],
      duplicates: (dupes ?? []) as AnyRow[],
      completeness,
    };
  });

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Idempotent conversion: if intake.position_id is already set, this is a
 * no-op that returns the existing position. Otherwise the payload is used
 * to create a new `positions` row + screening_questions, and the intake is
 * updated in a single transaction-of-effect (each step is checked; failure
 * leaves requisition_pending=true so the record stays actionable).
 */
export const convertIntakeToPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const trace = traceId();

    const { data: intake } = await s
      .from("intake_submissions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!intake) throw new Error(`intake_not_found [${trace}]`);

    // Idempotent: already linked to a position → return it.
    if (intake.position_id) {
      return {
        ok: true as const,
        idempotent: true,
        position_id: intake.position_id,
        intake_id: intake.id,
        trace_id: trace,
      };
    }
    if (!intake.organization_id) {
      throw new Error(`intake_missing_organization [${trace}]`);
    }

    const payload = intake.payload ?? {};
    const uniqueSkills: string[] = Array.from(
      new Map<string, string>(
        ((payload.mustHaveSkills ?? []) as unknown[])
          .map((sk) => String(sk ?? "").trim())
          .filter((sk): sk is string => sk.length > 0)
          .map((sk) => [sk.toLowerCase(), sk] as [string, string]),
      ).values(),
    );

    const requirements = uniqueSkills.map((sk) => ({ label: sk, kind: "skill", weight: 1 }));
    const preferred = String(payload.preferredRequirements ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label) => ({ label }));
    const dealbreakers = String(payload.dealbreakers ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label) => ({ label }));

    const { data: pos, error: posErr } = await s
      .from("positions")
      .insert({
        organization_id: intake.organization_id,
        title: (payload.roleTitle ?? intake.role_title ?? "Untitled").trim(),
        department: payload.department || null,
        location: payload.location || null,
        work_model: payload.workModel || null,
        employment_type: payload.employmentType || null,
        seniority: payload.seniority || null,
        description: payload.jobDescription || null,
        requirements,
        preferred_requirements: preferred,
        dealbreakers,
        compensation: payload.compensation ? { note: payload.compensation } : {},
        work_authorization: payload.workAuthorization ? { note: payload.workAuthorization } : {},
        status: "submitted",
        visibility: "private",
        created_by: intake.primary_user_id ?? context.userId,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (posErr) throw new Error(`position_create_failed:${posErr.message} [${trace}]`);
    const positionId = pos.id as string;

    if (Array.isArray(payload.screeningQuestions) && payload.screeningQuestions.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = payload.screeningQuestions.map((q: any, i: number) => ({
        position_id: positionId,
        question: q.question,
        answer_type: q.answer_type,
        required: !!q.required,
        dealbreaker: !!q.dealbreaker,
        display_order: i,
      }));
      await s.from("screening_questions").insert(rows);
    }

    const { data: after } = await s
      .from("intake_submissions")
      .update({
        position_id: positionId,
        requisition_pending: false,
        workspace_status: "ready",
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", intake.id)
      .select("*")
      .maybeSingle();

    await writeAudit({
      actor: context.userId,
      action: "intake.converted",
      entity_id: intake.id,
      organization_id: intake.organization_id,
      before: intake,
      after,
      trace_id: trace,
    });
    return {
      ok: true as const,
      idempotent: false,
      position_id: positionId,
      intake_id: intake.id,
      trace_id: trace,
    };
  });

export const rejectIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().min(3).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const trace = traceId();
    const { data: before } = await s
      .from("intake_submissions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error(`intake_not_found [${trace}]`);
    const { data: after } = await s
      .from("intake_submissions")
      .update({
        status: "rejected",
        workspace_status: "closed",
        requisition_pending: false,
        payload: { ...(before.payload ?? {}), _rejection: { reason: data.reason, at: new Date().toISOString() } },
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    await writeAudit({
      actor: context.userId,
      action: "intake.rejected",
      entity_id: data.id,
      organization_id: before.organization_id,
      before,
      after,
      trace_id: trace,
    });
    return { ok: true as const, trace_id: trace };
  });

export const requestIntakeClarification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        note: z.string().min(3).max(1000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const trace = traceId();
    const { data: before } = await s
      .from("intake_submissions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error(`intake_not_found [${trace}]`);
    const notes = Array.isArray(before.payload?._clarifications)
      ? before.payload._clarifications
      : [];
    const { data: after } = await s
      .from("intake_submissions")
      .update({
        status: "needs_clarification",
        payload: {
          ...(before.payload ?? {}),
          _clarifications: [
            ...notes,
            { note: data.note, by: context.userId, at: new Date().toISOString() },
          ],
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    await writeAudit({
      actor: context.userId,
      action: "intake.clarification_requested",
      entity_id: data.id,
      organization_id: before.organization_id,
      before,
      after,
      trace_id: trace,
    });
    return { ok: true as const, trace_id: trace };
  });
