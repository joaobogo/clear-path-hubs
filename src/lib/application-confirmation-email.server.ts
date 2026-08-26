import type { SendTemplateEmailResult } from "./email-templates/send-email";
import {
  classifyEmailError,
  isBlockedRecipientCode,
  isHeldEmailCode,
  isSandboxRecipient,
  readEmailConfig,
} from "./notification-email.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type ApplicationConfirmationStatus = "sent" | "failed" | "suppressed" | "already_sent";

export type ApplicationConfirmationResult = {
  ok: boolean;
  status: ApplicationConfirmationStatus;
  reason: string | null;
};

type ApplicationRow = {
  id: string;
  candidate_profile_id: string;
  position_id: string;
  confirmation_email_sent_at?: string | null;
  confirmation_email_attempt_count?: number | null;
};

type CandidateRow = { full_name: string | null; email: string | null };
type PositionRow = { title: string | null; organization_id: string | null };
type OrganizationRow = { name: string | null };

function ref6(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function firstName(name: string | null | undefined): string | null {
  return (name ?? "").trim().split(" ")[0] || null;
}

async function markAttempt(
  admin: Admin,
  applicationId: string,
  attempts: number,
  patch: {
    status: "sent" | "failed" | "suppressed";
    errorCode: string | null;
    errorMessage: string | null;
    sentAt?: string | null;
  },
) {
  const now = new Date().toISOString();
  await admin
    .from("applications")
    .update({
      confirmation_email_status: patch.status,
      confirmation_email_error_code: patch.errorCode,
      confirmation_email_error_message: patch.errorMessage,
      confirmation_email_attempt_count: attempts,
      confirmation_email_last_attempt_at: now,
      ...(patch.sentAt !== undefined ? { confirmation_email_sent_at: patch.sentAt } : {}),
    } as never)
    .eq("id", applicationId);
}

function resultFromTemplateOutcome(outcome: SendTemplateEmailResult): {
  status: "sent" | "suppressed";
  code: string | null;
  message: string | null;
} {
  if (outcome.sent) return { status: "sent", code: null, message: null };
  return {
    status: "suppressed",
    code: outcome.reason,
    message: "Not sent because this recipient is blocked for email delivery.",
  };
}

export async function sendApplicationConfirmationEmail(
  admin: Admin,
  applicationId: string,
  opts: { force?: boolean } = {},
): Promise<ApplicationConfirmationResult> {
  const { data: app, error: appError } = await admin
    .from("applications")
    .select(
      "id,candidate_profile_id,position_id,confirmation_email_sent_at,confirmation_email_attempt_count",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (appError || !app) {
    return { ok: false, status: "failed", reason: appError?.message ?? "application_not_found" };
  }

  const application = app as ApplicationRow;
  if (application.confirmation_email_sent_at && !opts.force) {
    return { ok: true, status: "already_sent", reason: null };
  }

  const attempts = Number(application.confirmation_email_attempt_count ?? 0) + 1;
  const [candidateRes, positionRes] = await Promise.all([
    admin
      .from("candidate_profiles")
      .select("full_name,email")
      .eq("id", application.candidate_profile_id)
      .maybeSingle(),
    admin
      .from("positions")
      .select("title,organization_id")
      .eq("id", application.position_id)
      .maybeSingle(),
  ]);

  const candidate = (candidateRes.data ?? null) as CandidateRow | null;
  const position = (positionRes.data ?? null) as PositionRow | null;
  const recipient = candidate?.email?.trim().toLowerCase() ?? null;

  if (!recipient) {
    await markAttempt(admin, application.id, attempts, {
      status: "failed",
      errorCode: "no_recipient_address",
      errorMessage: "No email address is on file for this applicant.",
    });
    return { ok: false, status: "failed", reason: "no_recipient_address" };
  }

  const sandboxed = await isSandboxRecipient(admin, {
    orgId: position?.organization_id ?? null,
    address: recipient,
  });
  if (sandboxed) {
    await markAttempt(admin, application.id, attempts, {
      status: "suppressed",
      errorCode: "sandboxed_test_recipient",
      errorMessage: "Recorded for a test or demo workspace instead of sending email.",
    });
    return { ok: true, status: "suppressed", reason: "sandboxed_test_recipient" };
  }

  const cfg = readEmailConfig();
  if (!cfg.configured) {
    const reason = cfg.reason ?? "email_not_configured";
    await markAttempt(admin, application.id, attempts, {
      status: "suppressed",
      errorCode: reason,
      errorMessage: "Email sending is not fully configured, so no email was sent.",
    });
    return { ok: true, status: "suppressed", reason };
  }

  const { data: org } = position?.organization_id
    ? await admin.from("organizations").select("name").eq("id", position.organization_id).maybeSingle()
    : { data: null };

  try {
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const outcome = await sendTemplateEmail("application-received", recipient, {
      idempotencyKey: `application-received-${application.id}`,
      templateData: {
        candidateFirstName: firstName(candidate?.full_name),
        positionTitle: position?.title ?? null,
        organizationName: ((org ?? null) as OrganizationRow | null)?.name ?? null,
        reference: ref6(application.id),
        statusUrl: `https://taasflow.com/apply/status?ref=${ref6(application.id)}`,
      },
    });
    const recorded = resultFromTemplateOutcome(outcome);
    await markAttempt(admin, application.id, attempts, {
      status: recorded.status,
      errorCode: recorded.code,
      errorMessage: recorded.message,
      sentAt: recorded.status === "sent" ? new Date().toISOString() : undefined,
    });
    return {
      ok: recorded.status === "sent" || recorded.status === "suppressed",
      status: recorded.status,
      reason: recorded.code,
    };
  } catch (error) {
    const classified = classifyEmailError(error);
    const status =
      isHeldEmailCode(classified.code) || isBlockedRecipientCode(classified.code)
        ? "suppressed"
        : "failed";
    await markAttempt(admin, application.id, attempts, {
      status,
      errorCode: classified.code,
      errorMessage: classified.message,
    });
    return { ok: status === "suppressed", status, reason: classified.code };
  }
}