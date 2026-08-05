/**
 * Replace the CV on a candidate's own existing application.
 * Verified by application id + the email on that application — only the
 * candidate's own record can ever be touched. The new PDF becomes the
 * application's CV and is re-queued for reading.
 */
export type ReplaceCvOutcome =
  | { ok: true; filename: string }
  | { ok: false; message: string };

export async function replaceCvForApplication(input: {
  application_id: string;
  email: string;
  filename: string;
  mime: string;
  base64: string;
}): Promise<ReplaceCvOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { validateCv, sanitizeFilename, CV_MESSAGES } = await import("../cv-validation");

  const emailLower = input.email.trim().toLowerCase();
  const { data: app } = await supabaseAdmin
    .from("applications")
    .select("id,status,withdrawn_at,candidate_profile_id,candidate_profiles(email)")
    .eq("id", input.application_id)
    .maybeSingle();
  if (!app) {
    return {
      ok: false,
      message:
        "We couldn't find that application. Email hello@taasflow.com and we'll sort it out with you.",
    };
  }
  const cp = app.candidate_profiles as unknown as { email?: string | null } | null;
  if ((cp?.email ?? "").trim().toLowerCase() !== emailLower) {
    return {
      ok: false,
      message:
        "That email doesn't match the one on this application. Email hello@taasflow.com and we'll help.",
    };
  }
  if (app.withdrawn_at || app.status === "rejected" || app.status === "archived") {
    return {
      ok: false,
      message: "This application is closed, so a new CV wouldn't be reviewed. You can apply again instead.",
    };
  }

  // Decode + validate before anything is written.
  const clean = input.base64.includes(",") ? input.base64.split(",", 2)[1] : input.base64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const v = await validateCv(bytes, input.filename, input.mime);
  if (!v.ok) return { ok: false, message: v.message ?? CV_MESSAGES.unknown };

  const cleanName = sanitizeFilename(input.filename);
  const storagePath = `candidate/${app.candidate_profile_id}/${crypto.randomUUID()}-${cleanName}`;
  const upload = await supabaseAdmin.storage.from("cvs").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error) {
    return {
      ok: false,
      message: "We couldn't save that file just now. Please try again in a moment.",
    };
  }

  const { data: fileRow, error: fileErr } = await supabaseAdmin
    .from("files")
    .insert({
      candidate_profile_id: app.candidate_profile_id,
      storage_bucket: "cvs",
      storage_path: storagePath,
      filename: cleanName,
      mime_type: "application/pdf",
      size: bytes.length,
      checksum: v.sha256 ?? null,
      file_status: "ready",
      parse_state: "queued",
      page_count: v.page_count ?? null,
      upload_source: "candidate_cv_replacement",
    })
    .select("id")
    .single();
  if (fileErr || !fileRow) {
    return {
      ok: false,
      message: "We couldn't save that file just now. Please try again in a moment.",
    };
  }

  await supabaseAdmin
    .from("applications")
    .update({ cv_file_id: fileRow.id })
    .eq("id", app.id);
  await supabaseAdmin
    .from("candidate_profiles")
    .update({ current_cv_file_id: fileRow.id })
    .eq("id", app.candidate_profile_id);

  await supabaseAdmin.from("processing_jobs").insert({
    entity_type: "application",
    entity_id: app.id,
    job_type: "parse_and_score",
    status: "queued",
    trace_id: crypto.randomUUID(),
  });

  return { ok: true, filename: cleanName };
}
