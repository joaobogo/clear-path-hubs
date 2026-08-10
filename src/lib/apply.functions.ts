// Public candidate application submission.
// Fully server-side; uses supabaseAdmin (loaded inside handler) to bypass RLS
// because applicants are unauthenticated at this point.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { applySchema, composeLocation, type ApplyInput } from "./apply-schema";
import { normalizeCompletionSeconds } from "./jobs/apply-effort";
import type { ExistingApplicationSummary } from "./candidate/existing-application.server";
import { throttlePublicFn } from "@/lib/public-api/server-fn-guard";


export type SubmitApplicationResult =
  | {
      ok: true;
      application_id: string;
      reference: string; // short human-friendly ref
      tracking_path: string; // route to send the candidate to
      deduped: boolean;
      /**
       * Present when deduped: the candidate's own earlier application for this
       * posting — its date, plain-English status and reference. Applying twice
       * is not an error, so we tell them the truth about the first one.
       */
      existing?: ExistingApplicationSummary | null;
      /** True when an earlier withdrawn/rejected application allowed a fresh submission. */
      prior_closed?: boolean;
      // Account outcome for an unauthenticated applicant:
      //  created  → we just made their candidate account with the password given
      //  existing → an account already existed for this email; they should sign in
      //  none     → no password supplied, no account created
      account: "created" | "existing" | "none";
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
    throttlePublicFn("apply_submit");
    const trace_id = crypto.randomUUID();
    // Set the moment the candidate's document is stored. Its presence in the
    // catch below is what separates "nothing reached us" from "we have their CV
    // and lost the rest", which are two completely different things to say.
    let orphanUpload: {
      fileId: string;
      candidateProfileId: string;
      filename: string;
      email: string;
      fullName: string;
    } | null = null;
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

      // 3b. Candidate account. An applicant who is not signed in may set a
      // password here so they can track this application in their portal.
      // Never overwrite an existing account's password.
      let accountOutcome: "created" | "existing" | "none" = "none";
      let authUserId: string | null = existingCp?.user_id ?? null;

      if (!authUserId) {
        // Someone may already have an auth account with this email even if the
        // candidate profile is not linked yet — reuse it instead of creating.
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("auth_user_id")
          .ilike("email", emailLower)
          .maybeSingle();
        if (existingProfile?.auth_user_id) {
          authUserId = existingProfile.auth_user_id as string;
          accountOutcome = "existing";
        }
      } else {
        accountOutcome = "existing";
      }

      if (!authUserId && data.password) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: emailLower,
          password: data.password,
          // Confirmed on creation: the candidate proved control of the flow and
          // must be able to sign in immediately to follow their application.
          email_confirm: true,
          user_metadata: { full_name: data.full_name, role: "candidate" },
        });
        if (createErr) {
          // Most likely the address is already registered — find and reuse it.
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const found = list?.users?.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (u: any) => (u.email ?? "").toLowerCase() === emailLower,
          );
          if (found) {
            authUserId = found.id as string;
            accountOutcome = "existing";
          } else {
            console.error("[submitApplication] account create failed", trace_id, createErr);
          }
        } else if (created?.user?.id) {
          authUserId = created.user.id as string;
          accountOutcome = "created";
        }
      }

      if (authUserId) {
        // Link the candidate profile and make sure a platform profile row exists.
        await supabaseAdmin
          .from("candidate_profiles")
          .update({ user_id: authUserId })
          .eq("id", candidateProfileId)
          .is("user_id", null);
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("auth_user_id", authUserId)
          .maybeSingle();
        if (!prof) {
          await supabaseAdmin.from("profiles").insert({
            auth_user_id: authUserId,
            email: emailLower,
            full_name: data.full_name,
            status: "active",
          });
        }
      }


      // 4. Idempotency short-circuit: an existing non-withdrawn application for this
      // (candidate, position) IS this submission. Rapid double taps, a retried request
      // or a reload all resolve to the original reference — never an error, and never a
      // second confirmation email (we return before any notification is emitted).
      // A withdrawn, rejected or archived earlier application is closed: it does
      // not block a fresh submission, and we say so on the confirmation.
      const CLOSED_STATUSES = ["withdrawn", "rejected", "archived"] as const;
      const { data: allPrior, error: appFindErr } = await supabaseAdmin
        .from("applications")
        .select("id,created_at,status")
        .eq("candidate_profile_id", candidateProfileId)
        .eq("position_id", data.position_id)
        .order("created_at", { ascending: true });
      if (appFindErr) throw appFindErr;
      const existingApp = (allPrior ?? []).find(
        (a) => !CLOSED_STATUSES.includes(a.status as (typeof CLOSED_STATUSES)[number]),
      );
      const priorClosed = (allPrior ?? []).some((a) =>
        CLOSED_STATUSES.includes(a.status as (typeof CLOSED_STATUSES)[number]),
      );

      if (existingApp) {
        const { loadExistingApplicationSummary } = await import(
          "./candidate/existing-application.server"
        );
        const existing = await loadExistingApplicationSummary(existingApp.id);
        return {
          ok: true,
          application_id: existingApp.id,
          reference: ref6(existingApp.id),
          tracking_path: `/apply/received/${existingApp.id}`,
          deduped: true,
          existing,
          account: accountOutcome,
        };
      }


      // 5. Upload CV to private storage. The storage key is fully server-generated;
      //    the sanitised original name is only a trailing, path-free label.
      //
      //    Before uploading, look for a document this same candidate already sent
      //    that never got attached to an application. That is the signature of an
      //    earlier submit that failed after the upload: without this check, every
      //    retry stores another copy of the identical file and the person shows up
      //    as several evidence-less uploads instead of one person trying twice.
      const { sanitizeFilename } = await import("./cv-validation");
      const cleanName = sanitizeFilename(data.cv.filename);

      let reusedFileId: string | null = null;
      if (v.sha256) {
        const { data: priorUpload } = await supabaseAdmin
          .from("files")
          .select("id")
          .eq("candidate_profile_id", candidateProfileId)
          .eq("checksum", v.sha256)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (priorUpload?.id) {
          const { data: attached } = await supabaseAdmin
            .from("applications")
            .select("id")
            .eq("cv_file_id", priorUpload.id)
            .limit(1)
            .maybeSingle();
          if (!attached) reusedFileId = priorUpload.id as string;
        }
      }

      let fileId: string;
      if (reusedFileId) {
        fileId = reusedFileId;
      } else {
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
            owner_user_id: authUserId,
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
        fileId = fileRow.id as string;
      }
      // From here on the candidate's document is in our hands. If anything below
      // fails, the catch must say so honestly rather than implying nothing arrived.
      orphanUpload = { fileId, candidateProfileId, filename: cleanName, email: emailLower, fullName: data.full_name };
      const fileRow = { id: fileId };



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
          // Pin the exact CV version submitted with this application so a later
          // CV replacement never rewrites this application's history.
          cv_file_id: fileRow.id,
          source: `${data.source}:${data.idempotency_key}`,

          source_channel: data.source,
          status: "submitted",
          // Honest input for the "how long does this take" line on the job
          // page. Out-of-range values are dropped, not clamped into the median.
          completion_seconds: normalizeCompletionSeconds(data.elapsed_seconds),

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
        // Unique-index race → the concurrent request won; return its reference.
        const { data: raceRows } = await supabaseAdmin
          .from("applications")
          .select("id,created_at")
          .eq("candidate_profile_id", candidateProfileId)
          .eq("position_id", data.position_id)
          .not("status", "in", "(withdrawn,rejected,archived)")
          .order("created_at", { ascending: true })
          .limit(1);
        const race = raceRows?.[0];
        if (race) {
          const { loadExistingApplicationSummary } = await import(
            "./candidate/existing-application.server"
          );
          return {
            ok: true,
            application_id: race.id,
            reference: ref6(race.id),
            tracking_path: `/apply/received/${race.id}`,
            deduped: true,
            existing: await loadExistingApplicationSummary(race.id),
            account: accountOutcome,
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

      // Unified lead notification: Teams + internal email + delivery record.
      // Candidate contact details stay inside the internal channel only.
      try {
        const { processLeadEvent } = await import("./leads/lead-pipeline.server");
        await processLeadEvent({
          leadType: "candidate_application",
          sourceId: appRow.id,
          source: "job_board_application",
          sourcePage: `/jobs/${data.position_id}/apply`,
          fullName: data.full_name,
          email: data.email ?? null,
          facts: [
            { label: "Role", value: pos.title },
            { label: "Reference", value: ref6(appRow.id) },
          ],
          recordTable: "applications",
          recordId: appRow.id,
          organizationId: pos.organization_id,
          positionId: data.position_id,
          linkPath: "/admin/candidates",
        });
      } catch (notifyErr) {
        console.error("[submitApplication] lead notification failed", trace_id, notifyErr);
      }

      // Candidate confirmation — the reference, the status link, and an honest
      // line about when they hear back. Non-critical: a mail failure must never
      // cost the applicant their submission.
      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        const reference = ref6(appRow.id);
        // The confirmation names the employer, so the email must too.
        const { data: orgRow } = await supabaseAdmin
          .from("organizations")
          .select("name")
          .eq("id", pos.organization_id)
          .maybeSingle();
        const result = await sendTemplateEmail("application-received", data.email, {
          idempotencyKey: `application-received-${appRow.id}`,
          templateData: {
            candidateFirstName: (data.full_name ?? "").trim().split(" ")[0] || null,
            positionTitle: pos.title,
            organizationName: orgRow?.name ?? null,
            reference,
            statusUrl: `https://taasflow.com/apply/status?ref=${reference}`,
          },
        });
        if (result?.sent) {
          const { error: stampErr } = await supabaseAdmin
            .from("applications")
            .update({ confirmation_email_sent_at: new Date().toISOString() })
            .eq("id", appRow.id);
          // The send is what the candidate sees; the stamp is our record of it.
          // Losing the stamp silently is how an application ends up looking
          // un-notified when it was in fact emailed — so it is logged loudly.
          if (stampErr) {
            console.error(
              "[submitApplication] confirmation sent but stamp failed",
              trace_id,
              appRow.id,
              stampErr.message,
            );
          }
        } else {
          console.warn(
            "[submitApplication] confirmation not sent",
            trace_id,
            appRow.id,
            result?.reason ?? "unknown",
          );
        }
      } catch (mailErr) {
        console.error("[submitApplication] confirmation email failed", trace_id, mailErr);
      }




      return {
        ok: true,
        application_id: appRow.id,
        reference: ref6(appRow.id),
        tracking_path: `/apply/received/${appRow.id}`,
        deduped: false,
        prior_closed: priorClosed,
        account: accountOutcome,
      };
    } catch (err) {
      console.error("[submitApplication]", trace_id, err);

      // The document is already stored but the application is not. Telling this
      // person "network error, try again" is false: retrying re-sends a file we
      // already hold and produces another candidate with no evidence. Raise it
      // with us instead, and say plainly what we have.
      if (orphanUpload) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("processing_jobs").insert({
            entity_type: "file",
            entity_id: orphanUpload.fileId,
            job_type: "parse",
            status: "queued",
            trace_id,
          });
        } catch (jobErr) {
          console.error("[submitApplication] orphan parse enqueue failed", trace_id, jobErr);
        }
        try {
          const { processLeadEvent } = await import("./leads/lead-pipeline.server");
          await processLeadEvent({
            leadType: "candidate_application",
            sourceId: orphanUpload.fileId,
            source: "application_submit_incomplete",
            sourcePage: `/jobs/${data.position_id}/apply`,
            fullName: orphanUpload.fullName,
            email: orphanUpload.email,
            facts: [
              { label: "What happened", value: "CV stored, application record not created" },
              { label: "Document", value: orphanUpload.filename },
              { label: "Trace", value: trace_id },
            ],
            recordTable: "files",
            recordId: orphanUpload.fileId,
            positionId: data.position_id,
            linkPath: "/admin/evidence-gaps",
            priority: "high",
          });
        } catch (notifyErr) {
          console.error("[submitApplication] orphan alert failed", trace_id, notifyErr);
        }
        return {
          ok: false,
          trace_id,
          code: "submit_incomplete",
          message:
            "Your CV reached us, but we could not finish creating your application. Our team has been alerted and will pick it up — you do not need to upload it again. If you would rather not wait, email hello@taasflow.com and quote " +
            trace_id.slice(0, 8).toUpperCase() +
            ".",
        };
      }

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
    throttlePublicFn("apply_lookup");
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
