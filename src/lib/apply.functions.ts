// Public candidate application submission.
// Thin server-function wrapper: the write path itself lives in ./apply.server so
// the seeder can run the identical logic without going through HTTP.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { applySchema, type ApplyInput } from "./apply-schema";
import { throttlePublicFn } from "@/lib/public-api/server-fn-guard";
import type { SubmitApplicationResult } from "./apply-types";

export type { SubmitApplicationResult };

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): ApplyInput => applySchema.parse(input))
  .handler(async ({ data }): Promise<SubmitApplicationResult> => {
    throttlePublicFn("apply_submit");
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
    const firstName = (cp?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    return {
      id: app.id,
      reference: ref6(app.id),
      applied_at: app.applied_at,
      position_title: pos?.title ?? null,
      organization_name: pos?.organizations?.name ?? null,
      candidate_first_name: firstName || null,
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
