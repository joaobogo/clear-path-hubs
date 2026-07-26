// Public candidate application submission.
// Fully server-side; uses supabaseAdmin (loaded inside handler) to bypass RLS
// because applicants are unauthenticated at this point.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { applySchema, composeLocation, type ApplyInput } from "./apply-schema";

export type SubmitApplicationResult =
  | {
      ok: true;
      application_id: string;
      reference: string; // short human-friendly ref
      tracking_path: string; // route to send the candidate to
      deduped: boolean;
    }
  | {
      ok: false;
      trace_id: string;
      code: string;
      message: string;
    };

function b64ToBytes(b64: string): Uint8Array {
  // Strip data-url prefix if present.
  const clean = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}



function ref6(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): ApplyInput => applySchema.parse(input))
  .handler(async ({ data }): Promise<SubmitApplicationResult> => {
    const trace_id = crypto.randomUUID();
    try {
      // Validate CV bytes first — cheap fail-fast.
      const bytes = b64ToBytes(data.cv.base64);
      const { validateCv, CV_MESSAGES } = await import("./cv-validation");
      const v = await validateCv(bytes, data.cv.filename, data.cv.mime);
      if (!v.ok) {
        return {
          ok: false,
          trace_id,
          code: v.code ?? "unknown",
          message: v.message ?? CV_MESSAGES.unknown,
        };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Confirm the position is still public + active + complete.
      const { data: pos, error: posErr } = await supabaseAdmin
        .from("positions")
        .select("id,organization_id,title,status,visibility,description,requirements")
        .eq("id", data.position_id)
        .maybeSingle();
      if (posErr) throw posErr;
      if (
        !pos ||
        pos.status !== "active" ||
        pos.visibility !== "public" ||
        (pos.description ?? "").trim().length < 40 ||
        !Array.isArray(pos.requirements) ||
        (pos.requirements as unknown[]).length === 0
      ) {
        return {
          ok: false,
          trace_id,
          code: "position_unavailable",
          message: "This role is no longer accepting applications.",
        };
      }

      // 2. Validate screening answers reference this position's questions and cover all required.
      const { data: questions, error: qErr } = await supabaseAdmin
        .from("screening_questions")
        .select("id,required,answer_type,updated_at")
        .eq("position_id", data.position_id);
      if (qErr) throw qErr;
      // Stamp which revision of the question set the candidate actually answered.
      const questionVersion = Math.max(
        1,
        ...(questions ?? []).map((q) =>
          Math.floor(new Date(q.updated_at as string).getTime() / 1000),
        ),
      );
      const qMap = new Map((questions ?? []).map((q) => [q.id, q]));
      for (const q of questions ?? []) {
        if (!q.required) continue;
        const a = data.answers.find((x) => x.question_id === q.id);
        const empty =
          a == null ||
          a.value == null ||
          (typeof a.value === "string" && a.value.trim() === "") ||
          (Array.isArray(a.value) && a.value.length === 0);
        if (empty) {
          return {
            ok: false,
            trace_id,
            code: "answer_required",
            message: "Please answer the required screening questions.",
          };
        }
      }
      // Drop answers that don't match a question on this position.
      const cleanAnswers = data.answers.filter((a) => qMap.has(a.question_id));

      // 3. Find or create candidate profile by lower(email).
      const emailLower = data.email.trim().toLowerCase();
      const { data: existingCp, error: cpFindErr } = await supabaseAdmin
        .from("candidate_profiles")
        .select("id,current_cv_file_id,user_id")
        .ilike("email", emailLower)
        .maybeSingle();
      if (cpFindErr) throw cpFindErr;

      const locationText = composeLocation({
        city: data.city,
        region: data.region,
        country: data.country,
      });
      const locationFields = {
        location: locationText || null,
        country: data.country || null,
        region: data.region || null,
        city: data.city || null,
        linkedin_url: data.linkedin_url || null,
        portfolio_url: data.portfolio_url || null,
        website_url: data.website_url || null,
      };

      let candidateProfileId: string;
      if (existingCp) {
        candidateProfileId = existingCp.id;
        // Update returning-candidate fields we now have.
        await supabaseAdmin
          .from("candidate_profiles")
          .update({
            full_name: data.full_name,
            phone: data.phone || null,
            ...locationFields,
            consent: {
              terms: true,
              network_opt_in: data.network_opt_in,
              updated_at: new Date().toISOString(),
            },
          })
          .eq("id", candidateProfileId);
      } else {
        const { data: cpNew, error: cpErr } = await supabaseAdmin
          .from("candidate_profiles")
          .insert({
            full_name: data.full_name,
            email: emailLower,
            phone: data.phone || null,
            ...locationFields,
            consent: {
              terms: true,
              network_opt_in: data.network_opt_in,
              created_at: new Date().toISOString(),
            },
          })
          .select("id")
          .single();
        if (cpErr) throw cpErr;
        candidateProfileId = cpNew.id;
      }


      // 4. Idempotency short-circuit: if a matching application already exists for this
      // (candidate, position) that is not withdrawn/rejected/archived, treat as duplicate.
      const { data: existingApp, error: appFindErr } = await supabaseAdmin
        .from("applications")
        .select("id,source")
        .eq("candidate_profile_id", candidateProfileId)
        .eq("position_id", data.position_id)
        .not("status", "in", "(withdrawn,rejected,archived)")
        .maybeSingle();
      if (appFindErr) throw appFindErr;

      if (existingApp) {
        // Same idempotency key? just return the existing.
        return {
          ok: true,
          application_id: existingApp.id,
          reference: ref6(existingApp.id),
          tracking_path: `/apply/received/${existingApp.id}`,
          deduped: true,
        };
      }

      // 5. Upload CV to private storage. The storage key is fully server-generated;
      //    the sanitised original name is only a trailing, path-free label.
      const { sanitizeFilename } = await import("./cv-validation");
      const cleanName = sanitizeFilename(data.cv.filename);
      const storagePath = `candidate/${candidateProfileId}/${crypto.randomUUID()}-${cleanName}`;
      const upload = await supabaseAdmin.storage
        .from("cvs")
        .upload(storagePath, bytes, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upload.error) throw upload.error;

      // 6. Insert files row — canonical original PDF, queued for parsing.
      const { data: fileRow, error: fileErr } = await supabaseAdmin
        .from("files")
        .insert({
          owner_user_id: existingCp?.user_id ?? null,
          candidate_profile_id: candidateProfileId,
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


      // Point candidate profile at latest CV.
      await supabaseAdmin
        .from("candidate_profiles")
        .update({ current_cv_file_id: fileRow.id })
        .eq("id", candidateProfileId);

      // 7. Create application (unique active constraint protects against races).
      const { data: appRow, error: appErr } = await supabaseAdmin
        .from("applications")
        .insert({
          candidate_profile_id: candidateProfileId,
          position_id: data.position_id,
          source: `${data.source}:${data.idempotency_key}`,
          source_channel: data.source,
          status: "submitted",
          cover_letter: data.cover_letter || null,
          portfolio_url: data.portfolio_url || null,
          accommodation_request: data.accommodation_request || null,
          question_version: questionVersion,
          consent: {
            terms: true,
            network_opt_in: data.network_opt_in,
            source: data.source,
            question_version: questionVersion,
            accepted_at: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (appErr) {
        // Unique-index race → fetch existing and dedupe.
        const { data: race } = await supabaseAdmin
          .from("applications")
          .select("id")
          .eq("candidate_profile_id", candidateProfileId)
          .eq("position_id", data.position_id)
          .not("status", "in", "(withdrawn,rejected,archived)")
          .maybeSingle();
        if (race) {
          return {
            ok: true,
            application_id: race.id,
            reference: ref6(race.id),
            tracking_path: `/apply/received/${race.id}`,
            deduped: true,
          };
        }
        throw appErr;
      }

      // 8. Store screening answers (idempotent by unique (application_id, question_id)).
      if (cleanAnswers.length > 0) {
        const rows = cleanAnswers.map((a) => ({
          application_id: appRow.id,
          question_id: a.question_id,
          answer: { value: a.value },
        }));
        const { error: aaErr } = await supabaseAdmin
          .from("application_answers")
          .upsert(rows, { onConflict: "application_id,question_id" });
        if (aaErr) throw aaErr;
      }

      // 9. Create candidate_match (unique on application_id).
      const { data: matchRow, error: cmErr } = await supabaseAdmin
        .from("candidate_matches")
        .insert({
          application_id: appRow.id,
          candidate_profile_id: candidateProfileId,
          position_id: data.position_id,
          organization_id: pos.organization_id,
          stage: "new",
          admin_status: "pending",
          client_visibility: "hidden",
          processing_state: "queued",
        })
        .select("id")
        .maybeSingle();
      if (cmErr && !String(cmErr.message).toLowerCase().includes("duplicate")) throw cmErr;
      let matchId = matchRow?.id as string | undefined;
      if (!matchId) {
        const { data: existingMatch } = await supabaseAdmin
          .from("candidate_matches")
          .select("id")
          .eq("application_id", appRow.id)
          .maybeSingle();
        matchId = existingMatch?.id;
      }

      // 10. Enqueue processing job (drain fallback).
      await supabaseAdmin.from("processing_jobs").insert({
        entity_type: "application",
        entity_id: appRow.id,
        job_type: "parse_and_score",
        status: "queued",
        trace_id,
      });

      // 10b. Automatic pipeline — fire-and-forget. Do NOT await; the applicant
      // must not wait for LLM hydration. If the runner is interrupted, the
      // pg_cron drain endpoint picks up the queued/stuck row within minutes.
      if (matchId) {
        try {
          const { runPipelineForMatch } = await import("./pipeline-runner.server");
          void runPipelineForMatch(matchId).catch((e) => {
            console.error("[submitApplication] pipeline error", trace_id, e);
          });
        } catch (kickErr) {
          console.error("[submitApplication] pipeline kick failed", trace_id, kickErr);
        }
      }


      // Emit canonical lifecycle events (idempotent).
      try {
        const { emitEventFromServer } = await import("./notifications.functions");
        // 1) admin queue: new application received
        await emitEventFromServer({
          event: "application_received",
          scope: appRow.id,
          organization_id: pos.organization_id,
          position_id: data.position_id,
          application_id: appRow.id,
          candidate_profile_id: candidateProfileId,
          link_path: `/admin/candidates`,
        });
        // 2) candidate confirmation (only if this candidate is signed in / has an auth user)
        const { data: cp } = await supabaseAdmin
          .from("candidate_profiles")
          .select("user_id")
          .eq("id", candidateProfileId)
          .maybeSingle();
        if (cp?.user_id) {
          await emitEventFromServer({
            event: "application_received",
            scope: `candidate:${appRow.id}`,
            application_id: appRow.id,
            candidate_profile_id: candidateProfileId,
            recipients: [{ user_id: cp.user_id, audience: "candidate", link_path: `/me/applications/${appRow.id}` }],
          });
        }
      } catch (emitErr) {
        console.error("[submitApplication] emit failed", trace_id, emitErr);
      }

      return {
        ok: true,
        application_id: appRow.id,
        reference: ref6(appRow.id),
        tracking_path: `/apply/received/${appRow.id}`,
        deduped: false,
      };
    } catch (err) {
      console.error("[submitApplication]", trace_id, err);
      return {
        ok: false,
        trace_id,
        code: "internal_error",
        message: "Something went wrong on our end. Please try again in a moment.",
      };
    }
  });

// Public confirmation lookup — no PII beyond what the candidate just submitted.
export const getApplicationReceipt = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    return z.object({ id: z.string().uuid() }).parse(input);
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app, error } = await supabaseAdmin
      .from("applications")
      .select(
        "id,applied_at,positions(title,organizations(name)),candidate_profiles(full_name,email)",
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
      email: string;
    } | null;
    return {
      id: app.id,
      reference: ref6(app.id),
      applied_at: app.applied_at,
      position_title: pos?.title ?? null,
      organization_name: pos?.organizations?.name ?? null,
      candidate_name: cp?.full_name ?? null,
      candidate_email: cp?.email ?? null,
    };
  });
