/**
 * A CV that reached the team by email, entered as an application (staff only).
 *
 * The platform already treats these as applications — source_channel
 * 'direct_email' is on the screening-link allowlist, so the candidate is
 * emailed the role's questions once, like any applicant who skipped the form —
 * but nothing created one. This does, with the same records the apply form
 * writes: a candidate profile (or the existing one, filled blanks only), the
 * PDF in the private `cvs` bucket, the files row queued for parsing, the
 * application pinned to that CV, a hidden pending match queued for the
 * pipeline, the processing job and the admin "application received" event.
 *
 * It never approves, publishes, answers a screening question or writes a
 * score: parsing and scoring are the pipeline's, as for every applicant.
 * Called only from the secret-gated internal route
 * /api/public/candidate/emailed-cv.
 */
import { composeLocation } from "@/lib/apply-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type EmailedCvInput = {
  position_id: string;
  /** The staff member entering the CV; recorded on the application and audit. */
  actor_user_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  linkedin_url?: string | null;
  /** When the email with the CV arrived, if known (ISO). */
  received_at?: string | null;
  cv: { filename: string; mime: string; base64: string };
};

export type EmailedCvResult =
  | {
      ok: true;
      candidate_profile_id: string;
      application_id: string;
      match_id: string;
      file_id: string;
      profile_existed: boolean;
    }
  | { ok: false; code: string; message: string };

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",", 2)[1]! : b64;
  const bin = atob(clean.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const CLOSED_APPLICATION_STATUSES = ["withdrawn", "rejected", "archived"];

export async function enterEmailedCv(s: Admin, input: EmailedCvInput): Promise<EmailedCvResult> {
  const trace_id = `emailed-cv-${crypto.randomUUID()}`;
  const email = input.email.trim().toLowerCase();
  const fullName = input.full_name.trim().replace(/\s+/g, " ");

  // The staff member must be platform staff.
  const { data: staff } = await s
    .from("profiles")
    .select("id")
    .eq("auth_user_id", input.actor_user_id)
    .maybeSingle();
  const { data: isStaff } = await s.rpc("is_platform_staff", { _user: input.actor_user_id });
  if (!staff || isStaff !== true) {
    return {
      ok: false,
      code: "actor_not_staff",
      message: "The entering user is not platform staff.",
    };
  }

  // The role must be open for applications, as on the apply form.
  const { data: pos, error: posErr } = await s
    .from("positions")
    .select("id,organization_id,title,status")
    .eq("id", input.position_id)
    .maybeSingle();
  if (posErr) throw posErr;
  if (!pos || pos.status !== "active") {
    return {
      ok: false,
      code: "position_unavailable",
      message: "The role is not open for applications.",
    };
  }

  const bytes = b64ToBytes(input.cv.base64);
  const { validateCv, sanitizeFilename } = await import("@/lib/cv-validation");
  const v = await validateCv(bytes, input.cv.filename, input.cv.mime);
  if (!v.ok)
    return { ok: false, code: v.code ?? "invalid_cv", message: v.message ?? "Invalid CV." };

  const { assertNoQaContamination } = await import("@/lib/qa-guard");
  const qa = await assertNoQaContamination(s, pos.organization_id, [fullName, email]);
  if (!qa.ok)
    return { ok: false, code: "qa_fixture_blocked", message: qa.reason ?? "Invalid input" };

  const locationText = composeLocation({
    city: input.city ?? "",
    region: input.region ?? "",
    country: input.country ?? "",
  });
  const details: Record<string, unknown> = {
    full_name: fullName,
    phone: input.phone?.trim() || null,
    location: locationText || null,
    city: input.city?.trim() || null,
    region: input.region?.trim() || null,
    country: input.country?.trim() || null,
    linkedin_url: input.linkedin_url?.trim() || null,
  };

  // Profile: an existing one is never overwritten, only its blanks filled.
  const { data: existing, error: findErr } = await s
    .from("candidate_profiles")
    .select("id,current_cv_file_id,full_name,phone,location,city,region,country,linkedin_url")
    .ilike("email", email)
    .maybeSingle();
  if (findErr) throw findErr;
  let profileId: string;
  if (existing) {
    profileId = existing.id as string;
    const patch: Record<string, unknown> = {};
    for (const [k, value] of Object.entries(details)) {
      const current = (existing as Record<string, unknown>)[k];
      const blank = current == null || (typeof current === "string" && current.trim() === "");
      if (blank && value != null && value !== "") patch[k] = value;
    }
    if (Object.keys(patch).length)
      await s.from("candidate_profiles").update(patch).eq("id", profileId);
  } else {
    const { data: created, error: cpErr } = await s
      .from("candidate_profiles")
      .insert({
        ...details,
        email,
        consent: {
          // No terms were accepted on a form: the CV came by email.
          source: "direct_email",
          network_opt_in: false,
          created_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();
    if (cpErr) throw cpErr;
    profileId = created.id as string;
  }

  // One open application per person and role, as on the form.
  const { data: prior, error: priorErr } = await s
    .from("applications")
    .select("id,status")
    .eq("candidate_profile_id", profileId)
    .eq("position_id", pos.id);
  if (priorErr) throw priorErr;
  if (
    (prior ?? []).some((a: { status: string }) => !CLOSED_APPLICATION_STATUSES.includes(a.status))
  ) {
    return {
      ok: false,
      code: "already_applied",
      message: "This person already has an open application for the role.",
    };
  }

  // The PDF, stored exactly as the apply form stores it.
  const cleanName = sanitizeFilename(input.cv.filename);
  const storagePath = `candidate/${profileId}/${crypto.randomUUID()}-${cleanName}`;
  const upload = await s.storage.from("cvs").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error) throw upload.error;
  const { data: fileRow, error: fileErr } = await s
    .from("files")
    .insert({
      owner_user_id: null,
      candidate_profile_id: profileId,
      storage_bucket: "cvs",
      storage_path: storagePath,
      filename: cleanName,
      mime_type: "application/pdf",
      size: bytes.length,
      checksum: v.sha256 ?? null,
      file_status: "ready",
      parse_state: "queued",
      page_count: v.page_count ?? null,
      upload_source: "candidate_application",
    })
    .select("id")
    .single();
  if (fileErr) throw fileErr;
  const fileId = fileRow.id as string;

  // An image-only PDF is flagged for review now, as on the form.
  const { extractCvText } = await import("@/lib/cv-extractor.server");
  const ext = await extractCvText(bytes, "application/pdf", cleanName);
  if (ext.needs_ocr) {
    await s
      .from("files")
      .update({
        parse_state: "review_required",
        parse_error_code:
          ext.reason === "cv_unreadable" || ext.chars === 0
            ? "cv_unreadable"
            : "text_layer_missing",
        parse_error: ext.reason ?? "Unreadable CV — OCR needed.",
        extracted_text: ext.text || null,
      })
      .eq("id", fileId);
  }
  if (!existing || !existing.current_cv_file_id) {
    await s.from("candidate_profiles").update({ current_cv_file_id: fileId }).eq("id", profileId);
  }

  const receivedAt = input.received_at ?? new Date().toISOString();
  const { data: app, error: appErr } = await s
    .from("applications")
    .insert({
      candidate_profile_id: profileId,
      position_id: pos.id,
      cv_file_id: fileId,
      source: "staff_entry:direct_email",
      source_channel: "direct_email",
      status: "submitted",
      // No question_version: the form never showed this person the questions,
      // so the screening link may ask them (screening-invite.ts).
      consent: {
        source: "direct_email",
        entered_by: input.actor_user_id,
        received_at: receivedAt,
      },
    })
    .select("id")
    .single();
  if (appErr) throw appErr;

  const { data: match, error: cmErr } = await s
    .from("candidate_matches")
    .insert({
      application_id: app.id,
      candidate_profile_id: profileId,
      position_id: pos.id,
      organization_id: pos.organization_id,
      stage: "new",
      admin_status: "pending",
      client_visibility: "hidden",
      eligibility_status: "eligible",
      processing_state: "queued",
    })
    .select("id")
    .single();
  if (cmErr) throw cmErr;

  await s.from("processing_jobs").insert({
    entity_type: "application",
    entity_id: app.id,
    job_type: "parse_and_score",
    status: "queued",
    trace_id,
  });

  await s.from("audit_events").insert({
    actor_user_id: input.actor_user_id,
    organization_id: pos.organization_id,
    entity_type: "candidate_match",
    entity_id: match.id,
    action: "application_entered_from_email",
    before_state: null,
    after_state: {
      application_id: app.id,
      candidate_profile_id: profileId,
      file_id: fileId,
      source_channel: "direct_email",
      profile_existed: !!existing,
    },
    trace_id,
  });

  try {
    const { emitEventFromServer } = await import("@/lib/notifications.functions");
    await emitEventFromServer({
      event: "application_received",
      scope: app.id,
      organization_id: pos.organization_id,
      position_id: pos.id,
      application_id: app.id,
      candidate_profile_id: profileId,
      link_path: `/admin/candidates`,
    });
  } catch (e) {
    console.error("[emailed-cv] event failed", trace_id, (e as Error)?.message);
  }

  return {
    ok: true,
    candidate_profile_id: profileId,
    application_id: app.id as string,
    match_id: match.id as string,
    file_id: fileId,
    profile_existed: !!existing,
  };
}
