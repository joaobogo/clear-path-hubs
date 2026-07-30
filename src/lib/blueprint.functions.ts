import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const input = z.object({ positionId: z.string().uuid() });

/**
 * Deliberate re-run of the Role Blueprint for one position.
 *
 * Authorization is done with the caller's own client first (RLS decides whether
 * this person may see the position at all); only then do we use the admin client
 * to re-drive the pipeline. Re-entrancy is guarded by the same status claim the
 * background runner uses, so a double click cannot start two runs.
 */
export const retryBlueprintAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: visible, error } = await context.supabase
      .from("positions")
      .select("id, organization_id, title, description, blueprint_status")
      .eq("id", data.positionId)
      .maybeSingle();
    if (error || !visible) return { ok: false as const, reason: "not_found" };

    const status = (visible as { blueprint_status?: string }).blueprint_status ?? "none";
    if (!["failed", "queued", "not_started", "none"].includes(status)) {
      return { ok: false as const, reason: "already_running" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: intake } = await admin
      .from("intake_submissions")
      .select("id, organization_id, position_id, primary_email, company_name, role_title, payload")
      .eq("position_id", data.positionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!intake) return { ok: false as const, reason: "no_intake" };

    const { data: claimed } = await admin
      .from("positions")
      .update({ blueprint_status: "analyzing_jd", blueprint_error: null })
      .eq("id", data.positionId)
      .in("blueprint_status", ["queued", "failed", "not_started"])
      .select("id");
    if (!claimed || claimed.length === 0) return { ok: false as const, reason: "already_running" };

    const { data: position } = await admin
      .from("positions")
      .select("id, title, description, jd_file_path, jd_file_name")
      .eq("id", data.positionId)
      .maybeSingle();

    let jdFile: { bytes: Uint8Array; mime: string; filename: string } | null = null;
    if (position?.jd_file_path) {
      const { data: blob, error: dlErr } = await admin.storage
        .from("job-descriptions")
        .download(position.jd_file_path);
      if (!dlErr && blob) {
        jdFile = {
          bytes: new Uint8Array(await blob.arrayBuffer()),
          mime: blob.type || "application/pdf",
          filename: position.jd_file_name || "job-description.pdf",
        };
      }
    }

    const payload = (intake.payload ?? {}) as Record<string, unknown>;
    const { runBlueprintPipeline } = await import("@/lib/blueprint-pipeline.server");
    const result = await runBlueprintPipeline({
      positionId: data.positionId,
      organizationId: intake.organization_id,
      intakeId: intake.id,
      roleTitle: position?.title ?? intake.role_title,
      companyName: intake.company_name,
      companyWebsite: typeof payload.companyWebsite === "string" ? payload.companyWebsite : "",
      contactEmail: intake.primary_email,
      contactName: typeof payload.firstName === "string" ? payload.firstName : "",
      researchConsent: payload.researchConsent !== false,
      jdFile,
      jdPastedText: position?.description ?? "",
    });

    return { ok: result.ok, reason: result.reason ?? null };
  });
