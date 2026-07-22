import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns a short-lived signed URL for a candidate's current CV, plus filename
 * and mime. Authorized for:
 *  - platform_admin / staff (has_role check)
 *  - members of the organization that owns the candidate_match's position
 * The Storage download URL is scoped and expires in 5 minutes.
 */
export const getCandidateCvDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => {
    if (!input?.matchId || typeof input.matchId !== "string") {
      throw new Error("matchId required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { matchId } = data;

    const { data: match, error: mErr } = await supabase
      .from("candidate_matches")
      .select("id, candidate_profile_id, position_id, positions(organization_id)")
      .eq("id", matchId)
      .maybeSingle();
    if (mErr || !match) throw new Error("Match not found");

    const orgId = (match as any).positions?.organization_id as string | undefined;

    // Authorization: admin/staff role OR org member.
    const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "platform_admin" as any }),
      supabase.rpc("has_role", { _user_id: userId, _role: "platform_staff" as any }),
    ]);
    let authorized = Boolean(isAdmin) || Boolean(isStaff);
    if (!authorized && orgId) {
      const { data: mem } = await supabase
        .from("memberships")
        .select("id")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      authorized = Boolean(mem);
    }
    if (!authorized) throw new Error("Forbidden");

    // Load the profile's current CV file.
    const { data: profile } = await supabase
      .from("candidate_profiles")
      .select("current_cv_file_id, full_name")
      .eq("id", (match as any).candidate_profile_id)
      .maybeSingle();

    const fileId = (profile as any)?.current_cv_file_id as string | undefined;
    if (!fileId) throw new Error("No CV on file");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error: fErr } = await supabaseAdmin
      .from("files")
      .select("storage_bucket, storage_path, filename, mime_type")
      .eq("id", fileId)
      .maybeSingle();
    if (fErr || !file) throw new Error("File missing");

    // Nicer default filename (candidate name + original extension).
    const orig = (file as any).filename as string;
    const ext = (orig.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? "").toLowerCase();
    const safeName = ((profile as any)?.full_name ?? "candidate")
      .toString()
      .trim()
      .replace(/[^a-z0-9\-\s]/gi, "")
      .replace(/\s+/g, "_") || "candidate";
    const filename = `${safeName}_CV${ext}`;

    const signed = await supabaseAdmin.storage
      .from((file as any).storage_bucket)
      .createSignedUrl((file as any).storage_path, 300, {
        download: filename, // forces Content-Disposition: attachment; filename=…
      });
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(signed.error?.message ?? "Could not create download link");
    }

    return {
      url: signed.data.signedUrl,
      filename,
      mime: (file as any).mime_type as string,
    };
  });
