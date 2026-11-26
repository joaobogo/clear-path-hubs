/**
 * Runs an admin screen's own server-function handler for a named platform
 * staff member (see /api/public/admin/staff-action).
 *
 * The handlers are the ones the screens call through requireSupabaseAuth; they
 * check access by the caller's user id and write with the privileged client,
 * so the records, audit events and notifications match the screen's. The list
 * is fixed: creating a client and a draft role, saving the role editor, its
 * screening questions and its posting copy, reading the readiness checks, and
 * taking a finished role live the way the admin does (waive payment with a
 * written reason, submit, approve, activate, publish). Each of those runs the
 * platform's own gates: the lifecycle order, the payment gate and the publish
 * gate are enforced by the handlers and the database, not here. Nothing else
 * (pause, close, archive, delete) is on the list.
 *
 * Two scoring-review actions are on it too: recording a reviewer's verdicts
 * on a candidate's requirements, and recomputing a candidate's score. Neither
 * approves, publishes or changes who can see a candidate.
 */
import { ZodError, z } from "zod";
import type { StaffActionContext } from "@/lib/staff-action-context";

export const STAFF_ACTION_OPS = [
  "create_client_workspace",
  "create_position_for_client",
  "save_requisition_meta",
  "save_position_edit",
  "save_screening_questions",
  "save_posting",
  "grant_payment_exemption",
  "set_position_status",
  "publish_position",
  "ensure_role_analysis",
  "get_position_for_edit",
  "get_requisition_quality",
  "check_publishable",
  "record_review",
  "recompute_score",
  "record_answers_on_behalf",
  "acknowledge_recruiter_answers",
  "preview_role_rescore",
  "edit_profile_narrative",
] as const;
export type StaffActionOp = (typeof STAFF_ACTION_OPS)[number];

export type StaffActionResult =
  | { ok: true; op: StaffActionOp; result: unknown }
  | { ok: false; op: StaffActionOp; status: number; error: string; detail?: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/** The status steps that take a role live; no other transition runs here. */
export const GO_LIVE_ACTIONS = ["submit", "approve", "activate"] as const;
const goLiveStatusInput = z.object({
  id: z.string().uuid(),
  action: z.enum(GO_LIVE_ACTIONS),
  reason: z.string().max(500).optional(),
});
const exemptionInput = z.object({
  positionId: z.string().uuid(),
  reason: z.string().trim().min(10).max(500),
});
/** A role is published to the job board only; "private" belongs to the editor. */
const publishInput = z.object({ visibility: z.enum(["public", "confidential"]) }).passthrough();

/** The actor must be active platform staff, as requireStaff and the screens require. */
async function actorIsStaff(s: Admin, actor: string): Promise<boolean> {
  const { data } = await s.rpc("is_platform_staff", { _user: actor });
  return data === true;
}

export async function runStaffAction(
  req: { actor_user_id: string; op: StaffActionOp; input: unknown },
  deps: { admin?: Admin } = {},
): Promise<StaffActionResult> {
  const { op, actor_user_id: actor } = req;
  const s: Admin =
    deps.admin ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  if (!(await actorIsStaff(s, actor))) {
    return { ok: false, op, status: 403, error: "actor_not_staff" };
  }
  // The same context requireSupabaseAuth hands a handler: the caller's id and a
  // database client. The handlers read access by id through the privileged
  // client; createClientWorkspace's platform-admin check reads the actor's
  // own profile and memberships, which this client returns as theirs would.
  const context: StaffActionContext = { supabase: s, userId: actor, claims: { sub: actor } };

  try {
    switch (op) {
      case "create_client_workspace": {
        const m = await import("@/lib/auth.functions");
        const data = m.createClientWorkspaceValidate(req.input);
        return { ok: true, op, result: await m.createClientWorkspaceHandler({ data, context }) };
      }
      case "create_position_for_client": {
        const m = await import("@/lib/admin.functions");
        const data = m.createPositionForClientValidate(req.input);
        return { ok: true, op, result: await m.createPositionForClientHandler({ data, context }) };
      }
      case "save_requisition_meta": {
        const m = await import("@/lib/requisition.functions");
        const data = m.saveRequisitionMetaValidate(req.input);
        return { ok: true, op, result: await m.saveRequisitionMetaHandler({ data, context }) };
      }
      case "save_position_edit": {
        const m = await import("@/lib/position-edit.functions");
        const data = m.savePositionEditValidate(req.input);
        return { ok: true, op, result: await m.savePositionEditHandler({ data, context }) };
      }
      case "save_screening_questions": {
        const m = await import("@/lib/admin.functions");
        const data = m.saveScreeningQuestionsValidate(req.input);
        return { ok: true, op, result: await m.saveScreeningQuestionsHandler({ data, context }) };
      }
      case "save_posting": {
        const m = await import("@/lib/position-edit.functions");
        const data = m.publishPositionValidate(req.input);
        // Posting copy only: a visibility here would take the role live.
        if ((data as { visibility?: unknown }).visibility) {
          return { ok: false, op, status: 400, error: "visibility_not_allowed" };
        }
        return { ok: true, op, result: await m.publishPositionHandler({ data, context }) };
      }
      case "grant_payment_exemption": {
        const m = await import("@/lib/admin-payments.functions");
        const data = m.grantPositionPaymentExemptionValidate(exemptionInput.parse(req.input));
        return {
          ok: true,
          op,
          result: await m.grantPositionPaymentExemptionHandler({ data, context }),
        };
      }
      case "set_position_status": {
        const m = await import("@/lib/admin.functions");
        const data = m.setPositionStatusValidate(goLiveStatusInput.parse(req.input));
        return { ok: true, op, result: await m.setPositionStatusHandler({ data, context }) };
      }
      case "publish_position": {
        const m = await import("@/lib/position-edit.functions");
        publishInput.parse(req.input);
        const data = m.publishPositionValidate(req.input);
        return { ok: true, op, result: await m.publishPositionHandler({ data, context }) };
      }
      case "ensure_role_analysis": {
        const m = await import("@/lib/blueprint.functions");
        const data = m.ensureRoleAnalysisValidate(req.input);
        return { ok: true, op, result: await m.ensureRoleAnalysisHandler({ data, context }) };
      }
      case "get_position_for_edit": {
        const m = await import("@/lib/position-edit.functions");
        const data = m.getPositionForEditValidate(req.input);
        return { ok: true, op, result: await m.getPositionForEditHandler({ data, context }) };
      }
      case "get_requisition_quality": {
        const m = await import("@/lib/requisition.functions");
        const data = m.getRequisitionQualityValidate(req.input);
        return { ok: true, op, result: await m.getRequisitionQualityHandler({ data, context }) };
      }
      case "record_review": {
        const m = await import("@/lib/scoring-review.functions");
        const data = m.submitHumanAdjustmentValidate(req.input);
        return { ok: true, op, result: await m.submitHumanAdjustmentHandler({ data, context }) };
      }
      case "recompute_score": {
        const m = await import("@/lib/scoring-review.functions");
        const data = m.recomputeScoreValidate(req.input);
        return { ok: true, op, result: await m.recomputeScoreHandler({ data, context }) };
      }
      case "record_answers_on_behalf": {
        const m = await import("@/lib/candidate/answers-on-behalf.functions");
        const data = m.recordAnswersOnBehalfValidate(req.input);
        return { ok: true, op, result: await m.recordAnswersOnBehalfHandler({ data, context }) };
      }
      case "acknowledge_recruiter_answers": {
        const m = await import("@/lib/candidate/answers-on-behalf.functions");
        const data = m.acknowledgeRecruiterAnswersValidate(req.input);
        return {
          ok: true,
          op,
          result: await m.acknowledgeRecruiterAnswersHandler({ data, context }),
        };
      }
      case "preview_role_rescore": {
        const m = await import("@/lib/scoring/rescore-preview.functions");
        const data = m.previewRoleRescoreValidate(req.input);
        return { ok: true, op, result: await m.previewRoleRescoreHandler({ data, context }) };
      }
      case "edit_profile_narrative": {
        const m = await import("@/lib/admin/profile-narrative.functions");
        const data = m.editProfileNarrativeValidate(req.input);
        return { ok: true, op, result: await m.editProfileNarrativeHandler({ data, context }) };
      }
      case "check_publishable": {
        const id = String((req.input as { id?: unknown } | null)?.id ?? "");
        const { assertPositionPublishable } = await import("@/lib/publish-gate.server");
        try {
          await assertPositionPublishable(s, id);
          return { ok: true, op, result: { publishable: true } };
        } catch (e) {
          return { ok: true, op, result: { publishable: false, reason: (e as Error).message } };
        }
      }
    }
  } catch (e) {
    if (e instanceof ZodError) {
      return { ok: false, op, status: 400, error: "invalid_input", detail: e.flatten() };
    }
    return { ok: false, op, status: 422, error: (e as Error)?.message ?? "failed" };
  }
}
