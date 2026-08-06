/**
 * Parse review server functions — thin wrappers only.
 *
 * Staff-only. Clients and candidates never reach these.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** Everything the parse review screen needs: document text, fields, evidence passages. */
export const getParseReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/authz.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildParseFields, summarise } = await import("./parse-review.server");

    const { data: match, error: mErr } = await supabaseAdmin
      .from("candidate_matches")
      .select(
        "id,organization_id,candidate_profile_id,processing_state,candidate_profiles(id,full_name,current_cv_file_id),positions(id,title)",
      )
      .eq("id", data.matchId)
      .maybeSingle();
    if (mErr) throw new Error(`parse_review_match_failed: ${mErr.message}`);
    if (!match) return null;

    const cpId = (match as Any).candidate_profile_id as string;

    const [evidenceRes, fileRes, reviewsRes, itemsRes] = await Promise.all([
      supabaseAdmin
        .from("candidate_evidence")
        .select("id,engine_version,extracted,created_at")
        .eq("candidate_match_id", data.matchId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("files")
        .select(
          "id,filename,storage_bucket,storage_path,mime_type,size,ocr_used,extracted_text,parse_state,parse_error_code,extraction_completed_at",
        )
        .eq("candidate_profile_id", cpId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("parse_field_reviews")
        .select("field_path,human_value,review_state,reviewer_note,reviewed_at,located")
        .eq("candidate_match_id", data.matchId),
      supabaseAdmin
        .from("candidate_evidence_items")
        .select(
          "id,rubric_dimension_key,rubric_criterion_key,normalized_meaning,source_passage,source_location,source_kind,match_type,confidence,result,reviewer_status",
        )
        .eq("candidate_match_id", data.matchId)
        .order("rubric_dimension_key"),
    ]);

    let cvSignedUrl: string | null = null;
    if (fileRes.data?.storage_path) {
      const signed = await supabaseAdmin.storage
        .from(fileRes.data.storage_bucket as string)
        .createSignedUrl(fileRes.data.storage_path as string, 300);
      cvSignedUrl = signed.data?.signedUrl ?? null;
    }

    const cvText = (fileRes.data?.extracted_text as string | null) ?? "";
    const fields = buildParseFields({
      extracted: evidenceRes.data?.extracted ?? null,
      cvText,
      reviews: (reviewsRes.data ?? []) as Any[],
    });

    // Evidence items get the same treatment: a highlighted passage or an
    // explicit unknown-location marker. There is no third state.
    const { locateInText } = await import("./parse-review.server");
    const items = ((itemsRes.data ?? []) as Any[]).map((it) => {
      const hit = locateInText(cvText, it.source_passage ?? null);
      return {
        id: it.id as string,
        dimension: it.rubric_dimension_key as string,
        criterion: it.rubric_criterion_key as string,
        meaning: it.normalized_meaning as string,
        result: (it.result ?? null) as string | null,
        passage: (it.source_passage ?? null) as string | null,
        offset: hit?.offset ?? null,
        located: Boolean(hit),
        sourceKind: (it.source_kind ?? null) as string | null,
        reviewerStatus: (it.reviewer_status ?? null) as string | null,
      };
    });

    return {
      match: {
        id: match.id as string,
        reference_code: null as string | null,
        candidate_name: (match as Any).candidate_profiles?.full_name ?? null,
        position_title: (match as Any).positions?.title ?? null,
        processing_state: (match as Any).processing_state ?? null,
      },
      cv: fileRes.data
        ? {
            id: fileRes.data.id as string,
            filename: fileRes.data.filename as string,
            mime_type: fileRes.data.mime_type as string,
            ocr_used: Boolean(fileRes.data.ocr_used),
            parse_state: (fileRes.data as Any).parse_state ?? null,
            parse_error_code: (fileRes.data as Any).parse_error_code ?? null,
            signed_url: cvSignedUrl,
            text: cvText,
          }
        : null,
      engine_version: (evidenceRes.data?.engine_version ?? null) as string | null,
      fields,
      items,
      summary: summarise(fields),
    };
  });

/**
 * Store a recruiter correction as a separate human value. The machine value is
 * kept untouched so every edit is reversible.
 */
export const saveFieldReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        matchId: z.string().uuid(),
        fieldPath: z.string().min(1).max(120),
        fieldLabel: z.string().max(160).optional(),
        machineValue: z.string().max(4000).nullable().optional(),
        /** Null clears the correction and restores the machine value. */
        humanValue: z.string().max(4000).nullable().optional(),
        located: z.boolean().optional(),
        reviewState: z.enum(["unreviewed", "confirmed", "corrected", "passage_mismatch"]),
        reviewerNote: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/authz.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: match, error: mErr } = await supabaseAdmin
      .from("candidate_matches")
      .select("id,organization_id,candidate_profile_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (mErr || !match) throw new Error("parse_review_match_not_found");

    const { error } = await supabaseAdmin.from("parse_field_reviews").upsert(
      {
        candidate_match_id: data.matchId,
        candidate_profile_id: (match as Any).candidate_profile_id,
        organization_id: (match as Any).organization_id,
        field_path: data.fieldPath,
        field_label: data.fieldLabel ?? null,
        machine_value: data.machineValue ?? null,
        human_value: data.humanValue ?? null,
        located: data.located ?? false,
        review_state: data.reviewState,
        reviewer_note: data.reviewerNote ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "candidate_match_id,field_path" },
    );
    if (error) throw new Error(`parse_field_review_failed: ${error.message}`);
    return { ok: true };
  });

/** Flag a stored evidence passage as not matching the field it supports. */
export const flagPassageMismatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        evidenceItemId: z.string().uuid(),
        note: z.string().min(4).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/authz.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("candidate_evidence_items")
      .update({
        reviewer_status: "rejected",
        reviewer_note: data.note,
        integrity_ok: false,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        last_reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.evidenceItemId);
    if (error) throw new Error(`passage_mismatch_failed: ${error.message}`);
    return { ok: true };
  });
