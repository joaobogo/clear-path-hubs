/**
 * Emails a candidate the link to answer the role's screening questions.
 *
 * Two triggers, one delivery path:
 *  - runScreeningInvites — the pipeline drain's sweep. Sends ONCE, only to an
 *    application created after migration 0012 (screening_invite_status still
 *    NULL; every older row reads 'predates_feature'), that arrived without the
 *    apply form, has zero answers while its role has questions, and is open.
 *    A row is claimed (NULL -> 'sending') before the send, so two overlapping
 *    sweeps cannot both send; the Lovable idempotency key backs that up.
 *  - sendScreeningInviteByStaff — the "Send screening questions" action on the
 *    admin candidate page. Works on any open application with questions left
 *    to answer, including ones that predate the feature.
 *
 * Uses the registered 'screening-questions' template through send-email, so the
 * candidate's reply goes to the direct inbox. Never approves, publishes, or
 * touches stage, review status or client visibility.
 */
import {
  SCREENING_INVITE_GRACE_MS,
  SCREENING_INVITE_WINDOW_MS,
  applicationReference,
  decideAutomaticInvite,
  decideStaffInvite,
  type ScreeningQuestionRow,
} from "./screening-invite";
import { publicOrgName } from "@/lib/org/public-org-name";
import { canonicalUrl } from "@/lib/canonical-origin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type ScreeningInviteDelivery = "sent" | "suppressed" | "failed";

export type ScreeningInviteOutcome = {
  ok: boolean;
  status: ScreeningInviteDelivery | "not_needed";
  reason: string | null;
  message: string;
};

export type ScreeningInviteSweep = {
  considered: number;
  sent: number;
  suppressed: number;
  failed: number;
  skipped: number;
  waiting: number;
};

const APP_SELECT =
  "id,created_at,status,withdrawn_at,is_test_record,source,source_channel,consent,position_id,screening_invite_status," +
  "candidate_profiles(full_name,email)," +
  "positions(title,status,organization_id,organizations(name))";

type AppRow = {
  id: string;
  created_at: string;
  status: string | null;
  withdrawn_at: string | null;
  is_test_record: boolean | null;
  source: string | null;
  source_channel: string | null;
  consent: unknown;
  position_id: string;
  screening_invite_status: string | null;
  candidate_profiles: { full_name?: string | null; email?: string | null } | null;
  positions: {
    title?: string | null;
    status?: string | null;
    organization_id?: string | null;
    organizations?: { name?: string | null } | null;
  } | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

function recipientOf(app: AppRow): string | null {
  const email = one(app.candidate_profiles)?.email?.trim().toLowerCase();
  return email || null;
}

async function questionsAndAnswers(admin: Admin, app: AppRow) {
  const [{ data: questions, error: qErr }, { data: answers, error: aErr }] = await Promise.all([
    admin
      .from("screening_questions")
      .select("id,question,answer_type,required,display_order")
      .eq("position_id", app.position_id),
    admin.from("application_answers").select("question_id").eq("application_id", app.id),
  ]);
  if (qErr || aErr) throw new Error((qErr ?? aErr)?.message ?? "screening_lookup_failed");
  return {
    questions: (questions ?? []) as ScreeningQuestionRow[],
    answeredIds: ((answers ?? []) as Array<{ question_id: string }>).map((a) => a.question_id),
  };
}

async function deliver(
  admin: Admin,
  app: AppRow,
  recipient: string,
  questionCount: number,
  idempotencyKey: string,
): Promise<{ status: ScreeningInviteDelivery; reason: string | null }> {
  const {
    classifyEmailError,
    isBlockedRecipientCode,
    isHeldEmailCode,
    isSandboxRecipient,
    readEmailConfig,
  } = await import("../notification-email.server");
  const pos = one(app.positions);
  if (app.is_test_record) return { status: "suppressed", reason: "test_record" };
  if (
    await isSandboxRecipient(admin, { orgId: pos?.organization_id ?? null, address: recipient })
  ) {
    return { status: "suppressed", reason: "sandboxed_test_recipient" };
  }
  const cfg = readEmailConfig();
  if (!cfg.configured)
    return { status: "suppressed", reason: cfg.reason ?? "email_not_configured" };

  const reference = applicationReference(app.id);
  try {
    const { sendTemplateEmail } = await import("../email-templates/send-email");
    const outcome = await sendTemplateEmail("screening-questions", recipient, {
      idempotencyKey,
      templateData: {
        candidateFirstName:
          (one(app.candidate_profiles)?.full_name ?? "").trim().split(/\s+/)[0] || null,
        positionTitle: pos?.title ?? null,
        organizationName: publicOrgName(one(pos?.organizations ?? null)?.name) || null,
        reference,
        questionCount,
        statusUrl: canonicalUrl(`/apply/status?ref=${reference}`),
      },
    });
    return outcome.sent
      ? { status: "sent", reason: null }
      : { status: "suppressed", reason: outcome.reason };
  } catch (error) {
    const c = classifyEmailError(error);
    const held = isHeldEmailCode(c.code) || isBlockedRecipientCode(c.code);
    return { status: held ? "suppressed" : "failed", reason: c.code };
  }
}

/** Records the outcome on the application (the idempotency marker). */
async function record(
  admin: Admin,
  applicationId: string,
  status: string,
  reason: string | null,
  only?: { whenStatus: string | null },
) {
  let q = admin
    .from("applications")
    .update({
      screening_invite_status: status,
      screening_invite_error_code: reason,
      ...(status === "sent" ? { screening_invite_sent_at: new Date().toISOString() } : {}),
    } as never)
    .eq("id", applicationId);
  if (only)
    q =
      only.whenStatus === null
        ? q.is("screening_invite_status", null)
        : q.eq("screening_invite_status", only.whenStatus);
  const { error } = await q;
  if (error) console.error("[screening-invite] record failed", applicationId, error.message);
}

/** Automatic, once-only invitations for new applications that skipped the form. */
export async function runScreeningInvites(
  admin: Admin,
  opts: { limit?: number; now?: Date } = {},
): Promise<ScreeningInviteSweep> {
  const now = opts.now ?? new Date();
  const result: ScreeningInviteSweep = {
    considered: 0,
    sent: 0,
    suppressed: 0,
    failed: 0,
    skipped: 0,
    waiting: 0,
  };
  const { data, error } = await admin
    .from("applications")
    .select(APP_SELECT)
    .is("screening_invite_status", null)
    .eq("is_test_record", false)
    // Form applications are never candidates; NULL channel is a staff path.
    .or("source_channel.is.null,source_channel.neq.public_job_board")
    .gte("created_at", new Date(now.getTime() - SCREENING_INVITE_WINDOW_MS).toISOString())
    .lte("created_at", new Date(now.getTime() - SCREENING_INVITE_GRACE_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(opts.limit ?? 10, 1), 25));
  if (error) {
    // Before migration 0012 the column does not exist: fail closed, send nothing.
    console.error("[screening-invite] sweep query failed", error.message);
    return result;
  }

  for (const app of (data ?? []) as AppRow[]) {
    result.considered += 1;
    let claimed = false;
    try {
      const recipient = recipientOf(app);
      const { questions, answeredIds } = await questionsAndAnswers(admin, app);
      const decision = decideAutomaticInvite({
        app,
        questionCount: questions.length,
        answerCount: answeredIds.length,
        hasEmail: !!recipient,
        now,
      });
      if (decision.action === "wait") {
        result.waiting += 1;
        continue;
      }
      if (decision.action === "skip") {
        result.skipped += 1;
        if (decision.reason !== "predates_feature" && decision.reason !== "already_decided") {
          await record(admin, app.id, "not_needed", decision.reason, { whenStatus: null });
        }
        continue;
      }

      // Claim before sending: only the worker that moves NULL -> 'sending' sends.
      const { data: claim } = await admin
        .from("applications")
        .update({ screening_invite_status: "sending" } as never)
        .eq("id", app.id)
        .is("screening_invite_status", null)
        .select("id")
        .maybeSingle();
      if (!claim) {
        result.skipped += 1;
        continue;
      }
      claimed = true;
      const out = await deliver(
        admin,
        app,
        recipient as string,
        questions.length,
        `screening-invite-${app.id}`,
      );
      await record(admin, app.id, out.status, out.reason, { whenStatus: "sending" });
      result[out.status] += 1;
    } catch (err) {
      console.error("[screening-invite] sweep row failed", app.id, (err as Error)?.message);
      // A claimed row is closed as failed, never left 'sending'; staff can resend.
      if (claimed) await record(admin, app.id, "failed", "worker_error", { whenStatus: "sending" });
      result.failed += 1;
    }
  }
  return result;
}

/** The staff "Send screening questions" action. */
export async function sendScreeningInviteByStaff(
  admin: Admin,
  args: { applicationId: string; actorUserId: string | null; now?: Date },
): Promise<ScreeningInviteOutcome> {
  const { data, error } = await admin
    .from("applications")
    .select(APP_SELECT)
    .eq("id", args.applicationId)
    .maybeSingle();
  if (error || !data) {
    return {
      ok: false,
      status: "not_needed",
      reason: "application_not_found",
      message: "Application not found.",
    };
  }
  const app = data as AppRow;
  const recipient = recipientOf(app);
  const { questions, answeredIds } = await questionsAndAnswers(admin, app);
  const decision = decideStaffInvite({
    app,
    positionStatus: one(app.positions)?.status ?? null,
    questions,
    answeredIds,
    hasEmail: !!recipient,
  });
  if (!decision.ok)
    return { ok: false, status: "not_needed", reason: "refused", message: decision.message };

  // One key per minute: a double click is one email, a deliberate resend later is another.
  const bucket = Math.floor((args.now ?? new Date()).getTime() / 60_000);
  const out = await deliver(
    admin,
    app,
    recipient as string,
    questions.length,
    `screening-invite-${app.id}-staff-${bucket}`,
  );
  await record(admin, app.id, out.status, out.reason);
  await admin.from("audit_events").insert({
    actor_user_id: args.actorUserId,
    entity_type: "applications",
    entity_id: app.id,
    action: "screening_invite_sent_by_staff",
    after_state: { status: out.status, reason: out.reason },
  });
  const message =
    out.status === "sent"
      ? "Screening questions sent to the candidate."
      : out.status === "suppressed"
        ? `Not emailed (${out.reason ?? "suppressed"}) — the address is blocked, a test record, or email is not configured.`
        : `The email could not be sent (${out.reason ?? "error"}). Try again shortly.`;
  return { ok: out.status !== "failed", status: out.status, reason: out.reason, message };
}
