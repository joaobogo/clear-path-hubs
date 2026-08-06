/**
 * Parse failure work queue and its three human resolutions:
 * request a re-upload, paste the text by hand, or mark the document reviewed
 * offline. Nothing is dropped silently and nothing retries forever.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveParseFailure } from "./parse-failure-codes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export const listParseFailures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        include_test: z.boolean().optional(),
        state: z.enum(["all", "failed", "review_required"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let fileQuery = supabaseAdmin
      .from("files")
      .select(
        "id,filename,candidate_profile_id,parse_state,parse_error_code,parse_error,extraction_attempts,ocr_used,created_at,is_test_record",
      )
      .in("parse_state", data.state && data.state !== "all" ? [data.state] : ["failed", "review_required"])
      .order("created_at", { ascending: true })
      .limit(200);
    if (!data.include_test) fileQuery = fileQuery.or("is_test_record.is.null,is_test_record.eq.false");

    const { data: files, error } = await fileQuery;
    if (error) throw new Error(`parse_failures_failed: ${error.message}`);
    const rows = (files ?? []) as Any[];
    if (rows.length === 0) return { rows: [], total: 0 };

    const cpIds = [...new Set(rows.map((f) => f.candidate_profile_id).filter(Boolean))] as string[];
    const [matchRes, profRes] = await Promise.all([
      supabaseAdmin
        .from("candidate_matches")
        .select(
          "id,candidate_profile_id,organization_id,processing_state,processing_updated_at,positions(id,title),organizations(id,name)",
        )
        .in("candidate_profile_id", cpIds.length ? cpIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("candidate_profiles")
        .select("id,full_name")
        .in("id", cpIds.length ? cpIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const matchesByCp = new Map<string, Any[]>();
    for (const m of (matchRes.data ?? []) as Any[]) {
      const list = matchesByCp.get(m.candidate_profile_id) ?? [];
      list.push(m);
      matchesByCp.set(m.candidate_profile_id, list);
    }
    const nameByCp = new Map(((profRes.data ?? []) as Any[]).map((p) => [p.id, p.full_name]));

    type QueueRow = {
      file_id: string;
      filename: string;
      candidate_profile_id: string;
      candidate_name: string | null;
      parse_state: string;
      needs_ocr: boolean;
      attempts: number;
      uploaded_at: string;
      failure: ReturnType<typeof resolveParseFailure>;
      detail: string | null;
      match_id: string | null;
      position_title: string | null;
      client_name: string | null;
      processing_state: string | null;
    };

    const out: QueueRow[] = rows.flatMap((f): QueueRow[] => {
      const failure = resolveParseFailure(f.parse_error_code);
      const matches = matchesByCp.get(f.candidate_profile_id) ?? [];
      const base = {
        file_id: f.id as string,
        filename: f.filename as string,
        candidate_profile_id: f.candidate_profile_id as string,
        candidate_name: (nameByCp.get(f.candidate_profile_id) as string | null) ?? null,
        parse_state: f.parse_state as string,
        needs_ocr: Boolean(failure.ocr),
        attempts: (f.extraction_attempts as number | null) ?? 0,
        uploaded_at: f.created_at as string,
        failure,
        detail: (f.parse_error as string | null) ?? null,
      };
      if (matches.length === 0) {
        return [{ ...base, match_id: null, position_title: null, client_name: null, processing_state: null }];
      }
      return matches.map((m) => ({
        ...base,
        match_id: m.id as string,
        position_title: m.positions?.title ?? null,
        client_name: m.organizations?.name ?? null,
        processing_state: m.processing_state ?? null,
      }));
    });

    return { rows: out, total: out.length };
  });

/** Ask the candidate for a new document, in their language, with no error codes. */
export const requestCvReupload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        matchId: z.string().uuid(),
        message: z.string().min(10).max(1000),
        dueInDays: z.number().int().min(1).max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: match } = await supabaseAdmin
      .from("candidate_matches")
      .select("id,application_id,candidate_profile_id,organization_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Error("match_not_found");

    const dueAt = new Date(
      Date.now() + (data.dueInDays ?? 5) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { error } = await supabaseAdmin.from("candidate_info_requests").insert({
      application_id: (match as Any).application_id,
      candidate_profile_id: (match as Any).candidate_profile_id,
      organization_id: (match as Any).organization_id,
      requested_by: context.userId,
      prompt: data.message,
      status: "open",
      due_at: dueAt,
    });
    if (error) throw new Error(`reupload_request_failed: ${error.message}`);
    return { ok: true, due_at: dueAt };
  });

/**
 * Paste the document text in by hand. The uploaded file is untouched; only the
 * extracted text is supplied, and the source is recorded as manual.
 */
export const pasteCvText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        fileId: z.string().uuid(),
        text: z.string().min(120).max(120000),
        matchId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("files")
      .update({
        extracted_text: data.text,
        parse_state: "parsed",
        parse_error: null,
        parse_error_code: null,
        parser: "manual_paste",
        extraction_completed_at: new Date().toISOString(),
      })
      .eq("id", data.fileId);
    if (error) throw new Error(`paste_text_failed: ${error.message}`);

    if (data.matchId) {
      await supabaseAdmin
        .from("candidate_matches")
        .update({ processing_state: "queued", processing_updated_at: new Date().toISOString() })
        .eq("id", data.matchId);
    }
    return { ok: true };
  });

/**
 * Mark the document as read by a person outside the parser. No profile is
 * fabricated: the state records that a human took responsibility for it.
 */
export const markParseReviewedOffline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        fileId: z.string().uuid(),
        matchId: z.string().uuid().nullable().optional(),
        note: z.string().min(4).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("files")
      .update({
        parse_state: "reviewed_offline",
        parse_error_code: null,
        parse_error: data.note,
      })
      .eq("id", data.fileId);
    if (error) throw new Error(`offline_review_failed: ${error.message}`);

    if (data.matchId) {
      await supabaseAdmin
        .from("candidate_matches")
        .update({
          processing_state: "manual_review_required",
          processing_updated_at: new Date().toISOString(),
        })
        .eq("id", data.matchId);
    }
    return { ok: true };
  });
