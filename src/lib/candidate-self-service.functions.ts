/**
 * Candidate self-service: correct your own details, replace your CV, and ask
 * for deletion — all with reference + email, no account required.
 *
 * Access is verified on every call (reference must match the application id
 * prefix AND the email on file). Nothing internal is ever returned.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { statusLookupSchema } from "./apply-status.functions";

const POSITION_OPEN_STATUSES = ["active", "approved", "paused"];

type VerifiedApplication = {
  id: string;
  candidate_profile_id: string;
  position_id: string;
  organization_id: string | null;
  status: string;
  withdrawn_at: string | null;
  position_status: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  location: string | null;
  cv_filename: string | null;
};

async function verifyApplication(
  reference: string,
  email: string,
): Promise<VerifiedApplication | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const prefix = reference.toLowerCase();
  const { data: rows, error } = await supabaseAdmin
    .from("applications")
    .select(
      "id,status,withdrawn_at,position_id,candidate_profile_id,cv_file_id,positions(status,organization_id),candidate_profiles!inner(id,full_name,email,phone,location),files:cv_file_id(filename)",
    )
    .ilike("candidate_profiles.email", email)
    .limit(50);
  if (error || !rows) return null;

  const app = rows.find(
    (r) => String(r.id).replace(/-/g, "").slice(0, 6).toLowerCase() === prefix,
  );
  if (!app) return null;

  const cp = app.candidate_profiles as unknown as {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
  } | null;
  if ((cp?.email ?? "").trim().toLowerCase() !== email) return null;
  const pos = app.positions as unknown as {
    status?: string | null;
    organization_id?: string | null;
  } | null;
  const file = app.files as unknown as { filename?: string | null } | null;

  return {
    id: app.id as string,
    candidate_profile_id: app.candidate_profile_id as string,
    position_id: app.position_id as string,
    organization_id: pos?.organization_id ?? null,
    status: app.status as string,
    withdrawn_at: (app.withdrawn_at as string | null) ?? null,
    position_status: pos?.status ?? null,
    full_name: cp?.full_name ?? null,
    email: (cp?.email ?? "").trim().toLowerCase(),
    phone: cp?.phone ?? null,
    location: cp?.location ?? null,
    cv_filename: file?.filename ?? null,
  };
}

function isEditable(app: VerifiedApplication): boolean {
  return (
    !app.withdrawn_at &&
    !["withdrawn", "rejected", "archived"].includes(app.status) &&
    POSITION_OPEN_STATUSES.includes(app.position_status ?? "")
  );
}

export type CandidateEditableDetails = {
  editable: boolean;
  reason: string | null;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  cv_filename: string | null;
};

/** What the candidate is allowed to change right now. */
export const getMyApplicationDetails = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusLookupSchema.parse(input))
  .handler(async ({ data }): Promise<CandidateEditableDetails | null> => {
    const app = await verifyApplication(data.reference, data.email);
    if (!app) return null;
    const editable = isEditable(app);
    return {
      editable,
      reason: editable
        ? null
        : "This role has closed, so your application can no longer be changed.",
      full_name: app.full_name,
      phone: app.phone,
      location: app.location,
      cv_filename: app.cv_filename,
    };
  });

export const candidateUpdateSchema = statusLookupSchema.extend({
  full_name: z.string().trim().min(2, "Enter your full name").max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  location: z.string().trim().max(160).optional(),
  cv: z
    .object({
      filename: z.string().trim().min(1).max(255),
      mime: z.string().trim().max(120),
      base64: z.string().min(1),
    })
    .optional(),
});

export type CandidateUpdateResult =
  | { ok: true; cv_replaced: boolean }
  | { ok: false; code: string; message: string };

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Correct your details and/or replace your CV, until the role closes. */
export const updateMyApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => candidateUpdateSchema.parse(input))
  .handler(async ({ data }): Promise<CandidateUpdateResult> => {
    const app = await verifyApplication(data.reference, data.email);
    if (!app) return { ok: false, code: "not_found", message: "We couldn't match that reference and email." };
    if (!isEditable(app))
      return {
        ok: false,
        code: "closed",
        message: "This role has closed, so your application can no longer be changed.",
      };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = {
      full_name: app.full_name,
      phone: app.phone,
      location: app.location,
      cv_filename: app.cv_filename,
    };

    const profilePatch: Record<string, unknown> = {};
    if (data.full_name && data.full_name !== app.full_name) profilePatch.full_name = data.full_name;
    if (data.phone !== undefined && (data.phone || null) !== app.phone)
      profilePatch.phone = data.phone || null;
    if (data.location !== undefined && (data.location || null) !== app.location)
      profilePatch.location = data.location || null;

    let cvReplaced = false;
    if (data.cv) {
      const bytes = b64ToBytes(data.cv.base64);
      const { validateCv, CV_MESSAGES, sanitizeFilename } = await import("./cv-validation");
      const v = await validateCv(bytes, data.cv.filename, data.cv.mime);
      if (!v.ok)
        return {
          ok: false,
          code: v.code ?? "unknown",
          message: v.message ?? CV_MESSAGES.unknown,
        };

      const cleanName = sanitizeFilename(data.cv.filename);
      const storagePath = `candidate/${app.candidate_profile_id}/${crypto.randomUUID()}-${cleanName}`;
      const upload = await supabaseAdmin.storage
        .from("cvs")
        .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
      if (upload.error)
        return {
          ok: false,
          code: "upload_failed",
          message: "We couldn't store that file. Please try again in a moment.",
        };

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
          upload_source: "candidate_self_update",
        })
        .select("id")
        .single();
      if (fileErr || !fileRow)
        return {
          ok: false,
          code: "upload_failed",
          message: "We couldn't store that file. Please try again in a moment.",
        };

      profilePatch.current_cv_file_id = fileRow.id;
      await supabaseAdmin
        .from("applications")
        .update({ cv_file_id: fileRow.id })
        .eq("id", app.id);
      cvReplaced = true;
    }

    if (Object.keys(profilePatch).length > 0) {
      await supabaseAdmin
        .from("candidate_profiles")
        .update(profilePatch as never)
        .eq("id", app.candidate_profile_id);
    }

    await supabaseAdmin
      .from("applications")
      .update({ last_candidate_edit_at: new Date().toISOString() })
      .eq("id", app.id);

    // The change is recorded, not silent — reviewers see what moved and when.
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: null,
      action: "application.candidate_self_update",
      entity_type: "applications",
      entity_id: app.id,
      organization_id: app.organization_id,
      before_state: before as never,
      after_state: {
        full_name: data.full_name ?? app.full_name,
        phone: data.phone ?? app.phone,
        location: data.location ?? app.location,
        cv_replaced: cvReplaced,
      } as never,
    });

    return { ok: true, cv_replaced: cvReplaced };
  });

export const deletionRequestSchema = statusLookupSchema.extend({
  note: z.string().trim().max(1000).optional(),
});

/** Ask us to delete your data. Creates a real, tracked request. */
export const requestMyDataDeletion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deletionRequestSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ ok: boolean; already_open?: boolean; message: string }> => {
      const app = await verifyApplication(data.reference, data.email);
      if (!app)
        return { ok: false, message: "We couldn't match that reference and email." };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: existing } = await supabaseAdmin
        .from("data_subject_requests")
        .select("id,status")
        .eq("subject_email", app.email)
        .eq("request_type", "deletion")
        .in("status", ["received", "in_progress"])
        .maybeSingle();
      if (existing)
        return {
          ok: true,
          already_open: true,
          message:
            "You already have a deletion request open with us. We'll confirm by email when it's done.",
        };

      const { error } = await supabaseAdmin.from("data_subject_requests").insert({
        request_type: "deletion",
        subject_email: app.email,
        candidate_profile_id: app.candidate_profile_id,
        status: "received",
        details: {
          reference: data.reference,
          application_id: app.id,
          note: data.note || null,
          channel: "status_page",
        } as never,
      });
      if (error) {
        console.error("[requestMyDataDeletion]", error.message);
        return {
          ok: false,
          message:
            "We couldn't log that request. Please email hello@taasflow.com and we'll handle it by hand.",
        };
      }

      await supabaseAdmin.from("audit_events").insert({
        actor_user_id: null,
        action: "data_subject_request.created",
        entity_type: "applications",
        entity_id: app.id,
        organization_id: app.organization_id,
        after_state: { request_type: "deletion", channel: "status_page" } as never,
      });

      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        await sendTemplateEmail("new-application-alert", "john.kasprzak@taasflow.com", {
          idempotencyKey: `deletion-request-${app.id}`,
          templateData: {
            candidateName: app.full_name ?? app.email,
            positionTitle: "Data deletion request",
            reference: data.reference,
            receivedAt: new Date().toISOString(),
            reviewUrl: "https://taasflow.com/admin",
          },
        });
      } catch (err) {
        console.error("[requestMyDataDeletion] alert failed", (err as Error)?.message);
      }

      return {
        ok: true,
        message:
          "Request received. We'll delete your data and confirm by email within 30 days, and sooner where we can.",
      };
    },
  );
