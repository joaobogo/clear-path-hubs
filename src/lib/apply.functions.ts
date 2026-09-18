// Public candidate application submission.
// Thin server-function wrapper: the write path itself lives in ./apply.server so
// the seeder can run the identical logic without going through HTTP.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { applySchema, type ApplyInput } from "./apply-schema";
import { throttlePublicFn } from "@/lib/public-api/server-fn-guard";
import { greetingName } from "@/lib/candidate/display-name";
import type { SubmitApplicationResult } from "./apply-types";
import { publicOrgName } from "@/lib/org/public-org-name";

export type { SubmitApplicationResult };

function ref6(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}


export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): ApplyInput => applySchema.parse(input))
  .handler(async ({ data }): Promise<SubmitApplicationResult> => {
    throttlePublicFn("apply_submit");
    // A role the public board would not show is a role the public may not
    // apply to. This endpoint had no organisation gate of any kind, so a demo
    // tenant's listing accepted real applications from real candidates who
    // would never hear back (audit 17 Sep, item 5).
    //
    // The check sits in the wrapper, not in submitApplicationImpl: the demo
    // seeder calls the impl directly to create its own fixture applications.
    const { isPubliclyApplyable } = await import("@/lib/jobs/public-applyable.server");
    if (!(await isPubliclyApplyable(data.position_id))) {
      return {
        ok: false,
        trace_id: `ap_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
        code: "position_unavailable",
        message: "This role is no longer accepting applications.",
      };
    }
    const { submitApplicationImpl } = await import("./apply.server");
    return await submitApplicationImpl(data);
  });

// Public confirmation lookup — no PII beyond what the candidate just submitted.
export const getApplicationReceipt = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    return z.object({ id: z.string().uuid() }).parse(input);
  })
  .handler(async ({ data }) => {
    throttlePublicFn("apply_lookup");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Anonymous lookup keyed only by the application UUID — never return
    // contact PII here. First name only, for the greeting line.
    const { data: app, error } = await supabaseAdmin
      .from("applications")
      .select(
        "id,applied_at,positions(title,organizations(name)),candidate_profiles(full_name)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error || !app) return null;
    const pos = app.positions as unknown as {
      title: string;
      organizations: { name: string } | null;
    } | null;
    const cp = app.candidate_profiles as unknown as {
      full_name: string;
    } | null;
    return {
      id: app.id,
      reference: ref6(app.id),
      applied_at: app.applied_at,
      position_title: pos?.title ?? null,
      organization_name: publicOrgName(pos?.organizations?.name) || null,
      candidate_first_name: greetingName(cp?.full_name),
    };
  });

// Replace the CV on the candidate's OWN existing application (verified by the
// email on that application). Used by the returning-applicant outcome screen
// instead of a dead-end duplicate error.
export const replaceApplicationCv = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        application_id: z.string().uuid(),
        email: z.string().email(),
        filename: z.string().min(1).max(300),
        mime: z.string().min(1).max(200),
        base64: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    throttlePublicFn("apply_cv_replace");
    try {
      const { replaceCvForApplication } = await import("./candidate/cv-replace.server");
      return await replaceCvForApplication(data);
    } catch (err) {
      console.error("[replaceApplicationCv]", err);
      return {
        ok: false as const,
        message:
          "Something went wrong on our end. Your existing application is unaffected — email hello@taasflow.com if this keeps happening.",
      };
    }
  });
