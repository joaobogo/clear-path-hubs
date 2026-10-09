// Shared wizard-based position editor. Auth: platform staff OR client_editor
// on the position's organization. Mirrors the public intake wizard 1:1 so
// admins and clients edit positions with the same questions candidates and
// clients answered during intake.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  SCREENING_MAX_QUESTIONS,
  SCREENING_MAX_REQUIRED,
  screeningTopicIssue,
} from "@/lib/screening-limits";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

import { assertWorkspaceAccess, assertWorkspaceWrite } from "@/lib/authz/workspace-access";
import { normalizeTravelExpectation } from "@/lib/requisition-schema";
import { positionShapeFor } from "@/lib/positions/field-registry";
import {
  analysisInputsChanged,
  editFormToPositionPatch,
  positionToEditForm,
  roleIntakeAnswersShape,
  roleRequiredness,
  type RoleSaveData,
  type ScreeningInput,
} from "@/lib/positions/role-form";
import { analysisDecision } from "@/lib/blueprint-trigger";
import { sanitizeInlineMarkup, stripInlineMarkup } from "@/lib/marketing/inline-format";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function loadPosition(positionId: string) {
  const s = await getAdmin();
  const { data: pos } = await s
    .from("positions")
    // The audit trail diffs before_state against after_state, and after_state is
    // the full row (select("*")). A four-column before made every other column
    // look newly set — ~75 bogus "field changes" on every brief save, which is
    // what the "…and N more field changes" tail was counting.
    .select("*")
    .eq("id", positionId)
    .maybeSingle();
  if (!pos) throw new Error("position_not_found");
  return pos as AnyRow;
}

/** Read access: any workspace member (including viewers) or platform staff. */
async function assertCanView(userId: string, positionId: string) {
  const pos = await loadPosition(positionId);
  const s = await getAdmin();
  await assertWorkspaceAccess(s, userId, pos.organization_id as string);
  return pos;
}

/**
 * Write access: editors/admins/staff — read-only viewers are refused.
 * Platform staff working the role from the admin console are acting in their
 * own console, not impersonating a client seat, so they may write here.
 */
async function assertCanEdit(userId: string, positionId: string) {
  const pos = await loadPosition(positionId);
  const s = await getAdmin();
  const access = await assertWorkspaceAccess(s, userId, pos.organization_id as string);
  if (!access.isStaff) {
    await assertWorkspaceWrite(s, userId, pos.organization_id as string);
  }
  return pos;
}


async function writeAudit(opts: {
  actor: string;
  action: string;
  entity_id: string;
  organization_id: string;
  before?: unknown;
  after?: unknown;
  trace_id: string;
}) {
  const s = await getAdmin();
  await s.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: "position",
    entity_id: opts.entity_id,
    organization_id: opts.organization_id,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
    trace_id: opts.trace_id,
  });
}

const traceId = () =>
  `pe_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

// The edit form and its mappings live in role-form.ts, shared with the
// intake handler, so an intake answer is always read back from where it was
// written (role-form-roundtrip.test.ts).
export type { ScreeningInput, PositionEditInitial } from "@/lib/positions/role-form";

export const getPositionForEdit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertCanView(context.userId, data.id);
    const s = await getAdmin();
    const [posRes, screeningRes] = await Promise.all([
      s
        .from("positions")
        .select("*,organizations(id,name)")
        .eq("id", data.id)
        .maybeSingle(),
      s
        .from("screening_questions")
        .select("id,question,answer_type,required,dealbreaker,display_order,must_have,why_asked")
        .eq("position_id", data.id)
        .order("display_order", { ascending: true }),
    ]);
    const p = posRes.data as AnyRow;
    if (!p) throw new Error("position_not_found");
    return positionToEditForm(p, (screeningRes.data ?? []) as AnyRow[]);
  });

/**
 * Field rules are not restated here: every position field's type, limits and
 * enum values come from the shared registry, so the intake wizard, the client
 * editor and the admin editor validate identically.
 */
type SaveInputData = RoleSaveData & { screening_questions: ScreeningInput[] };

const saveInput = z.object({
  id: z.string().uuid(),
  ...positionShapeFor("admin"),
  // The intake's own answers (time zones, sponsorship, stages, …), so every
  // intake answer can be edited and saved, not only the registry fields.
  ...roleIntakeAnswersShape,

  screening_questions: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        question: z.string().trim().min(3).max(500),
        answer_type: z.enum(["text", "boolean", "number"]).default("text"),
        required: z.boolean().default(false),
        dealbreaker: z.boolean().default(false),
        must_have: z.string().trim().max(160).default(""),
        why_asked: z.string().trim().max(200).default(""),
      }),
    )
    .max(SCREENING_MAX_QUESTIONS, {
      message: `Keep it to ${SCREENING_MAX_QUESTIONS} screening questions or fewer.`,
    })
    .superRefine((qs, ctx) => {
      for (const q of qs) {
        const topic = screeningTopicIssue(q.question);
        if (topic) ctx.addIssue({ code: "custom", message: topic });
      }
    })
    .refine((qs) => qs.filter((q) => q.required).length <= SCREENING_MAX_REQUIRED, {

      message: `At most ${SCREENING_MAX_REQUIRED} screening questions can be mandatory — make the rest optional.`,
    })
    .default([]),
});

export const savePositionEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => saveInput.parse(i) as unknown as SaveInputData)
  .handler(async ({ data, context }) => {
    const before = await assertCanEdit(context.userId, data.id);
    const trace_id = traceId();
    const s = await getAdmin();

    // Formatting tags are not content: length is measured on the words only.
    const description = sanitizeInlineMarkup(data.description);
    // One rule set with the edit screen: only what sourcing cannot start
    // without can refuse a save. Time zone, city, work model, seniority… are
    // hints ("Brief incomplete"), never errors.
    const required = roleRequiredness({ ...data, description: stripInlineMarkup(description) });
    const firstError = Object.values(required.errors)[0];
    if (firstError) throw new Error(firstError);

    // Preserve unknown intake_context/compensation/work_authorization fields
    const { data: existing } = await s
      .from("positions")
      .select(
        "intake_context,compensation,work_authorization,requirements,preferred_requirements,dealbreakers,location,work_model,description,blueprint_status,blueprint_attempts,updated_at,blueprint_error",
      )
      .eq("id", data.id)
      .maybeSingle();

    const patch: AnyRow = {
      ...editFormToPositionPatch(data, existing as AnyRow, { sanitizedDescription: description }),
      travel_expectation: normalizeTravelExpectation(data.travel) || null,
    };

    // A saved role is analysed without anyone pressing anything: a role whose
    // analysis never ran (or died) is queued again, and so is one whose job
    // description or must-haves just changed. The run itself happens in the
    // request the role page opens for it (ensureRoleAnalysis) — see
    // blueprint-trigger.ts for why it is not started inside this request.
    const decision = analysisDecision((existing ?? {}) as AnyRow);
    const inputsChanged = analysisInputsChanged(existing ?? {}, {
      description: patch.description as string | null,
      requirements: patch.requirements,
    });
    let analysis: "queued" | "running" | "ready" = decision.state === "running" ? "running" : "ready";
    if (decision.state !== "running" && (decision.state !== "ready" || inputsChanged)) {
      patch.blueprint_status = "queued";
      patch.blueprint_error = null;
      // A person's edit is a fresh start for the automatic retry budget.
      patch.blueprint_attempts = 0;
      analysis = "queued";
    }

    const { data: after, error } = await s
      .from("positions")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Sync screening questions: delete removed, upsert kept/new, keep order
    const { data: existingSQ } = await s
      .from("screening_questions")
      .select("id")
      .eq("position_id", data.id);
    const existingIds = new Set(((existingSQ ?? []) as AnyRow[]).map((r) => r.id));
    const keepIds = new Set(
      data.screening_questions.map((q) => q.id).filter((v): v is string => !!v),
    );
    const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      const { error: dErr } = await s
        .from("screening_questions")
        .delete()
        .in("id", toDelete);
      if (dErr) throw new Error(dErr.message);
    }
    for (let i = 0; i < data.screening_questions.length; i++) {
      const q = data.screening_questions[i];
      const row = {
        position_id: data.id,
        question: q.question,
        answer_type: q.answer_type,
        required: q.required,
        dealbreaker: q.dealbreaker,
        must_have: q.must_have || null,
        why_asked: q.why_asked || null,
        display_order: i,
      };

      if (q.id && existingIds.has(q.id)) {
        const { error: uErr } = await s
          .from("screening_questions")
          .update(row)
          .eq("id", q.id);
        if (uErr) throw new Error(uErr.message);
      } else {
        const { error: iErr } = await s.from("screening_questions").insert(row);
        if (iErr) throw new Error(iErr.message);
      }
    }

    await writeAudit({
      actor: context.userId,
      action: "position.edit_wizard",
      entity_id: data.id,
      organization_id: before.organization_id,
      before,
      after,
      trace_id,
    });

    return { ok: true as const, trace_id, position: after, analysis, brief_missing: required.missing };
  });

const publishInput = z.object({
  id: z.string().uuid(),
  company_intro: z.string().max(4000).default(""),
  benefits: z.string().max(4000).default(""),
  languages: z.string().max(500).default(""),
  travel: z.string().max(300).default(""),
  work_authorization_note: z.string().max(600).default(""),
  accessibility_note: z.string().max(1500).default(""),
  eeo_statement: z.string().max(3000).default(""),
  brand_tone: z.string().max(60).default(""),
  application_deadline: z.string().max(40).default(""),
  confidentiality: z.enum(["public", "confidential", ""]).default("public"),
  visibility: z.enum(["public", "private", "confidential"]).optional(),
});

/** Save job-post copy and optionally publish the role in one action. */
export const publishPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => publishInput.parse(i))
  .handler(async ({ data, context }) => {
    const before = await assertCanEdit(context.userId, data.id);
    const trace_id = traceId();
    const s = await getAdmin();

    const { data: existing } = await s
      .from("positions")
      .select("intake_context")
      .eq("id", data.id)
      .maybeSingle();
    const priorCtx = (existing?.intake_context ?? {}) as AnyRow;

    const patch: AnyRow = {
      intake_context: {
        ...priorCtx,
        posting: {
          ...((priorCtx.posting ?? {}) as AnyRow),
          company_intro: data.company_intro || "",
          benefits: data.benefits || "",
          languages: data.languages || "",
          travel: data.travel || "",
          work_authorization_note: data.work_authorization_note || "",
          accessibility_note: data.accessibility_note || "",
          eeo_statement: data.eeo_statement || "",
          brand_tone: data.brand_tone || "",
          application_deadline: data.application_deadline || "",
          confidentiality: data.confidentiality || "public",
        },
      },
      travel_expectation: normalizeTravelExpectation(data.travel) || null,
      updated_at: new Date().toISOString(),
    };
    if (data.visibility) {
      // Going live runs the same gate as every other publish path, so the
      // job-post screen can't talk its way past payment or missing fields.
      if (data.visibility === "public" || data.visibility === "confidential") {
        const { assertPositionPublishable } = await import("./publish-gate.server");
        await assertPositionPublishable(s, data.id);
      }
      patch.visibility = data.visibility;
    }

    const { data: after, error } = await s
      .from("positions")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await writeAudit({
      actor: context.userId,
      action: data.visibility ? "position.publish" : "position.publish_draft",
      entity_id: data.id,
      organization_id: before.organization_id,
      before,
      after,
      trace_id,
    });

    return { ok: true as const, trace_id, position: after };
  });
