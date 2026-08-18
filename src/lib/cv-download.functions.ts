import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_URL_TTL_SECONDS = 300; // short-lived: 5 minutes

/**
 * Returns a short-lived signed URL for a candidate's current CV.
 *
 * Authorization tiers (checked server-side against the caller's own session —
 * never trust a client-supplied role):
 *  - platform staff (platform_admin / operations): always allowed
 *  - client org members: only after the candidate has been approved and
 *    published to that client (client_visibility = visible AND
 *    canonical_state = published_to_client), the candidate's contact details
 *    have been released (contact_released_at), AND the member holds the
 *    view_candidates permission for that organization
 *  - the candidate themselves: their own document, always

 *
 * The signed link expires in 5 minutes; no permanent public URL is ever issued.
 */
export const getCandidateCvDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string; disposition?: "attachment" | "inline" }) => {
    if (!input?.matchId || typeof input.matchId !== "string") {
      throw new Error("matchId required");
    }
    return {
      matchId: input.matchId,
      disposition: input.disposition === "inline" ? ("inline" as const) : ("attachment" as const),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { matchId, disposition } = data;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Read the match with admin so authorization is decided explicitly here,
    // not implicitly by whichever RLS path the caller happens to satisfy.
    const { data: match, error: mErr } = await supabaseAdmin
      .from("candidate_matches")
      .select(
        "id, candidate_profile_id, organization_id, client_visibility, canonical_state, stage, contact_released_at, contact_released_by, contact_release_reason",
      )
      .eq("id", matchId)
      .maybeSingle();
    if (mErr || !match) throw new Error("Not found");

    const orgId = match.organization_id as string | null;


    // 1. Platform staff.
    const { data: staffRow } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("role", ["platform_admin", "operations"])
      .limit(1)
      .maybeSingle();
    let authorized = Boolean(staffRow);
    let audience: "staff" | "client" | "candidate" = "staff";

    // 2. The candidate themselves.
    if (!authorized) {
      const { data: ownProfile } = await supabaseAdmin
        .from("candidate_profiles")
        .select("id")
        .eq("id", match.candidate_profile_id as string)
        .eq("user_id", userId)
        .maybeSingle();
      if (ownProfile) {
        authorized = true;
        audience = "candidate";
      }
    }

    // 3. Client org member — approved + published AND past the consent gate.
    //    Pre-interview candidates are refused here, server-side: hiding the
    //    button is never the protection.
    const redacted = false;
    if (!authorized && orgId) {
      const isVisible =
        match.client_visibility === "visible" &&
        match.canonical_state === "published_to_client";

      if (isVisible) {
        const { data: allowed } = await supabase.rpc("has_client_permission", {
          _user: userId,
          _org: orgId,
          _perm: "view_candidates",
        });

        if (allowed === true) {
          audience = "client";

          const { count: interviewCount } = await supabaseAdmin
            .from("interviews")
            .select("id", { count: "exact", head: true })
            .eq("candidate_match_id", matchId);

          const gate = cvConsentGate({
            stage: match.stage as string,
            contact_released_at: match.contact_released_at as string | null,
            contact_released_by: match.contact_released_by as string | null,
            contact_release_reason: match.contact_release_reason as string | null,
            has_interview: (interviewCount ?? 0) > 0,
          });
          if (!gate.open) throw new Error("Contact details and CV are not yet available for this candidate.");
          authorized = true;
        }
      }
    }


    if (!authorized) throw new Error("Not found");

    // Load the profile's canonical (original) CV file.
    const { data: profile } = await supabaseAdmin
      .from("candidate_profiles")
      .select("current_cv_file_id, full_name")
      .eq("id", match.candidate_profile_id as string)
      .maybeSingle();

    const fileId = profile?.current_cv_file_id as string | undefined;
    if (!fileId) throw new Error("No CV on file");

    const { data: file, error: fErr } = await supabaseAdmin
      .from("files")
      .select("storage_bucket, storage_path, filename, mime_type")
      .eq("id", fileId)
      .maybeSingle();
    if (fErr || !file) throw new Error("File missing");

    // Human-friendly download name. Extension follows the stored file so
    // legacy documents uploaded before the PDF-only rule still open correctly.
    const orig = String(file.filename ?? "");
    const ext = (orig.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? ".pdf").toLowerCase();
    const base =
      String(profile?.full_name ?? "candidate")
        .trim()
        .replace(/[^a-z0-9\-\s]/gi, "")
        .replace(/\s+/g, "_") || "candidate";
    const filename = `${base}_CV${ext}`;

    const bucket = String(file.storage_bucket ?? "cvs");
    const storagePath = String(file.storage_path);

    // For redacted requests, we serve a text-based version with PII stripped.
    if (redacted) {
      const { data: blob, error: bErr } = await supabaseAdmin.storage
        .from(bucket)
        .download(storagePath);
      if (bErr || !blob) throw new Error("File missing");
      
      const { redactCv } = await import("./cv-redactor.server");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const redactedText = await redactCv(bytes, file.mime_type as string, file.filename as string);
      
      // Return the redacted text as a data URL or a signed URL to a temporary redacted file.
      // For simplicity and to avoid storage clutter, we return a data URL for small-ish text.
      // If text is huge, we could serve a specific "redacted" storage path.
      const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(redactedText)}`;
      
      return {
        url: dataUrl,
        filename: `${base}_CV_Redacted.txt`,
        mime: "text/plain",
        disposition: "inline", // Force inline for redacted text
        audience,
        expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
        isRedacted: true
      };
    }

    const signed = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(
        storagePath,
        SIGNED_URL_TTL_SECONDS,
        // `download` sets Content-Disposition: attachment; omit it for inline preview.
        disposition === "attachment" ? { download: filename } : {},
      );
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(signed.error?.message ?? "Could not create download link");
    }

    // Audit trail: who fetched which candidate's CV, when, and from which side.
    // Written after the link is issued so a failed signing never leaves a false record.
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: userId,
      organization_id: orgId,
      entity_type: "candidate_matches",
      entity_id: matchId,
      action: "cv.download",
      after_state: {
        audience,
        disposition: redacted ? "inline" : disposition,
        filename: redacted ? `${base}_CV_Redacted.txt` : filename,
        redacted,
        file_id: fileId,
        candidate_profile_id: match.candidate_profile_id,
        candidate_name: profile?.full_name ?? null,
      },
    });

    return {
      url: signed.data.signedUrl,
      filename,
      mime: (file.mime_type as string) ?? "application/pdf",
      disposition,
      audience,
      expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    };
  });
