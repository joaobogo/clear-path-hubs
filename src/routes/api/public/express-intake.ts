import { createFileRoute } from "@tanstack/react-router";
import {
  expressIntakeSchema,
  ALLOWED_JD_EXT,
  ALLOWED_JD_MIME,
  MAX_JD_BYTES,
  UNREADABLE_JD_EXT,
  briefCompleteness,
  jdFileExt,
  splitLines,
  type RequirementTag,
} from "@/lib/express-intake-schema";


/**
 * Express onboarding.
 *
 * Creates the account, organization, membership and role in one call, stores
 * the job description securely, then hands the heavy work (reading the JD,
 * reviewing public company information, generating the Role Blueprint) to
 * /api/public/blueprint-run so the client is never left waiting on a form.
 */

const normalizeCompany = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");

const emailDomain = (email: string) => {
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
};

function isGenericDomain(domain: string): boolean {
  return new Set([
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "protonmail.com",
    "aol.com",
    "live.com",
    "me.com",
    "msn.com",
  ]).has(domain);
}

function sanitizeJdName(name: string, ext: string): string {
  const base = (name ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[._-]+/, "")
    .replace(/_{2,}/g, "_")
    .replace(/\.[^.]*$/, "")
    .slice(0, 100);
  return `${base || "job-description"}.${ext}`;
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function signatureOk(bytes: Uint8Array, ext: string): boolean {
  const at = (i: number) => (i < bytes.length ? bytes[i] : -1);
  if (ext === "pdf") return at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46;
  if (ext === "docx") return at(0) === 0x50 && at(1) === 0x4b && at(2) === 0x03 && at(3) === 0x04;
  // {\rtf
  if (ext === "rtf")
    return at(0) === 0x7b && at(1) === 0x5c && at(2) === 0x72 && at(3) === 0x74 && at(4) === 0x66;
  return true; // txt
}


/**
 * Resolve an existing auth user by email without paging the whole directory.
 * profiles mirrors auth.users, so it is the cheap and complete lookup.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lookupUserIdByEmail(admin: any, email: string): Promise<string | null> {
  const { data: prof } = await admin
    .from("profiles")
    .select("auth_user_id")
    .ilike("email", email)
    .maybeSingle();
  if (prof?.auth_user_id) return prof.auth_user_id as string;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  return found?.id ?? null;
}

export const Route = createFileRoute("/api/public/express-intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = crypto.randomUUID();
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, trace_id: traceId, error: "invalid_json" }, { status: 400 });
        }

        const parsed = expressIntakeSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { ok: false, trace_id: traceId, error: "validation_failed", issues: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const data = parsed.data;

        // Silent spam trap.
        if ((data.companyFax ?? "").trim() !== "") {
          return Response.json({ ok: true, trace_id: traceId, intakeId: null, skipped: true });
        }

        // ---------- Job description file checks ----------
        let jdBytes: Uint8Array | null = null;
        let jdExt = "";
        if (data.jobDescriptionFile) {
          jdExt = jdFileExt(data.jobDescriptionFile.filename);
          if (UNREADABLE_JD_EXT.has(jdExt)) {
            return Response.json(
              {
                ok: false,
                trace_id: traceId,
                error: "jd_legacy_doc",
                message: "Legacy .doc files can't be read. Save it as PDF or DOCX and upload again.",
              },
              { status: 400 },
            );
          }
          if (!ALLOWED_JD_EXT.has(jdExt)) {
            return Response.json(
              {
                ok: false,
                trace_id: traceId,
                error: "jd_bad_extension",
                message: "Upload a PDF, DOCX, TXT or RTF file.",
              },
              { status: 400 },
            );
          }

          const mime = data.jobDescriptionFile.mime.toLowerCase();
          if (mime && !ALLOWED_JD_MIME.has(mime) && mime !== "application/octet-stream") {
            return Response.json(
              { ok: false, trace_id: traceId, error: "jd_bad_mime", message: "That file type is not accepted." },
              { status: 400 },
            );
          }
          try {
            jdBytes = decodeBase64(data.jobDescriptionFile.base64);
          } catch {
            return Response.json({ ok: false, trace_id: traceId, error: "jd_decode_failed" }, { status: 400 });
          }
          if (jdBytes.length === 0 || jdBytes.length > MAX_JD_BYTES) {
            return Response.json(
              { ok: false, trace_id: traceId, error: "jd_bad_size", message: "The file must be between 1 byte and 10 MB." },
              { status: 400 },
            );
          }
          if (!signatureOk(jdBytes, jdExt)) {
            return Response.json(
              { ok: false, trace_id: traceId, error: "jd_bad_signature", message: "That file does not match its extension." },
              { status: 400 },
            );
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        // ---------- Idempotency ----------
        const { data: existing, error: existingErr } = await admin
          .from("intake_submissions")
          .select("id, organization_id, position_id, primary_user_id, workspace_status")
          .eq("idempotency_key", data.idempotencyKey)
          .maybeSingle();
        if (existingErr) {
          return Response.json(
            { ok: false, trace_id: traceId, error: "idempotency_lookup_failed", message: existingErr.message },
            { status: 500 },
          );
        }
        if (existing) {
          return Response.json({
            ok: true,
            trace_id: traceId,
            replay: true,
            intakeId: existing.id,
            organizationId: existing.organization_id,
            positionId: existing.position_id,
            userId: existing.primary_user_id,
          });
        }

        // ---------- Caller identity (optional bearer from a signed-in client) ----------
        let callerUserId: string | null = null;
        {
          const bearer = /^bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? null;
          if (bearer) {
            const { data: u } = await admin.auth.getUser(bearer);
            callerUserId = u?.user?.id ?? null;
          }
        }

        // ---------- Organization ----------
        // Joining an EXISTING organization is a privilege. Neither a matching
        // company name nor a matching email domain proves identity — the work
        // email is never verified at this point — so an existing tenant is only
        // ever joined by someone who is already an active member of it.
        const companyNorm = normalizeCompany(data.companyName);
        const domain = emailDomain(data.workEmail);
        const corporateDomain = domain && !isGenericDomain(domain) ? domain : null;
        let organizationId: string | null = null;
        let claimedExistingOrgId: string | null = null;
        {
          let candidate: string | null = null;
          if (corporateDomain) {
            const { data: byDomain } = await admin
              .from("organizations")
              .select("id")
              .eq("domain", corporateDomain)
              .maybeSingle();
            if (byDomain) candidate = byDomain.id as string;
          }
          if (!candidate) {
            const { data: byName } = await admin
              .from("organizations")
              .select("id")
              .eq("name_normalized", companyNorm)
              .maybeSingle();
            if (byName) candidate = byName.id as string;
          }
          if (candidate) {
            claimedExistingOrgId = candidate;
            if (callerUserId) {
              const { data: mem } = await admin
                .from("memberships")
                .select("id")
                .eq("user_id", callerUserId)
                .eq("organization_id", candidate)
                .eq("status", "active")
                .maybeSingle();
              if (mem) organizationId = candidate;
            }
          }
        }
        if (!organizationId && claimedExistingOrgId) {
          return Response.json(
            {
              ok: false,
              trace_id: traceId,
              error: "organization_exists",
              message:
                "Your company already has a TaaSFlow workspace. Sign in, or ask a workspace admin to invite you, then launch your role.",
            },
            { status: 409 },
          );
        }

        // NOTE: the organization is deliberately NOT created yet. Creating it
        // before the account is resolved leaves an orphan "prospect" org behind
        // whenever the account step rejects the request — and that orphan then
        // matches the domain/name lookup above, permanently 409-ing the real
        // user out of their own company. Account first, tenant second.



        // ---------- Auth user ----------
        let authUserId: string | null = null;
        let accountCreated = false;
        {
          // No password supplied → the caller must PROVE they own that account
          // with a valid bearer token. Otherwise anyone knowing a client's
          // email could create roles inside their workspace.
          if (!data.password) {
            const existingId = callerUserId ? await lookupUserIdByEmail(admin, data.workEmail) : null;
            if (!callerUserId || !existingId || existingId !== callerUserId) {
              return Response.json(
                {
                  ok: false,
                  trace_id: traceId,
                  error: "password_required",
                  message: "Choose a password to create your TaaSFlow account.",
                },
                { status: 400 },
              );
            }
            authUserId = existingId;
          }
          const { data: created, error: createErr } = authUserId
            ? { data: null, error: null as { message: string } | null }
            : await admin.auth.admin.createUser({
                email: data.workEmail,
                password: data.password,
                email_confirm: true,
                user_metadata: { full_name: `${data.firstName} ${data.lastName}`.trim() },
              });
          if (authUserId) {
            // already resolved above
          } else if (createErr) {
            const found = await lookupUserIdByEmail(admin, data.workEmail);
            if (!found) {
              return Response.json(
                { ok: false, trace_id: traceId, error: "auth_user_failed", message: createErr.message },
                { status: 500 },
              );
            }
            // Existing account. Never silently reset the password from a public
            // form, and never create work inside their workspace unless the
            // request actually comes from them.
            if (callerUserId !== found) {
              return Response.json(
                {
                  ok: false,
                  trace_id: traceId,
                  error: "account_exists",
                  message: "An account already uses that email. Sign in first, then launch your role.",
                },
                { status: 409 },
              );
            }
            authUserId = found;

          } else {
            authUserId = created?.user?.id ?? null;
            accountCreated = true;
          }
        }
        if (!authUserId) {
          return Response.json({ ok: false, trace_id: traceId, error: "auth_user_missing" }, { status: 500 });
        }

        // ---------- Organization (created only once the account is real) ----------
        if (!organizationId) {
          const { data: newOrg, error: orgErr } = await admin
            .from("organizations")
            .insert({
              name: data.companyName.trim(),
              website: data.companyWebsite || null,
              domain: corporateDomain,
              status: "prospect",
              primary_contact_name: `${data.firstName} ${data.lastName}`.trim(),
              primary_contact_email: data.workEmail,
            })
            .select("id")
            .single();
          if (orgErr) {
            return Response.json(
              { ok: false, trace_id: traceId, error: "org_create_failed", message: orgErr.message },
              { status: 500 },
            );
          }
          organizationId = newOrg.id as string;
        } else if (data.companyWebsite) {
          const { data: org } = await admin
            .from("organizations")
            .select("website")
            .eq("id", organizationId)
            .maybeSingle();
          if (!org?.website) {
            await admin.from("organizations").update({ website: data.companyWebsite }).eq("id", organizationId);
          }
        }



        // ---------- Profile ----------
        {
          const { data: prof } = await admin.from("profiles").select("id").eq("auth_user_id", authUserId).maybeSingle();
          if (!prof) {
            await admin.from("profiles").insert({
              auth_user_id: authUserId,
              email: data.workEmail,
              full_name: `${data.firstName} ${data.lastName}`.trim(),
              status: "active",
            });
          }
        }

        // ---------- Membership ----------
        {
          const { error: memErr } = await admin.from("memberships").upsert(
            { user_id: authUserId, organization_id: organizationId, role: "client_admin", status: "active" },
            { onConflict: "user_id,organization_id,role", ignoreDuplicates: true },
          );
          if (memErr && !/duplicate|conflict/i.test(memErr.message)) {
            return Response.json(
              { ok: false, trace_id: traceId, error: "membership_failed", message: memErr.message },
              { status: 500 },
            );
          }
        }

        // ---------- Position ----------
        // Steps 3 and 4 of the intake are optional. Anything the client left
        // blank is stored as null — never as an invented default — and the
        // brief is labelled incomplete until they finish it.
        // The tagged list is the source of truth when the client sent one: it
        // carries the order they chose and the tag that decides how each item is
        // used. Older payloads only had the three strings, so fall back to those.
        const tagged = (data.requirements ?? []).filter((r) => r.text.trim().length > 0);
        const pickTagged = (tag: RequirementTag) =>
          tagged.filter((r) => r.tag === tag).map((r) => r.text.trim());
        const mustHaves = tagged.length > 0 ? pickTagged("must_have") : splitLines(data.mustHaves);
        const trainable = tagged.length > 0 ? pickTagged("trainable") : splitLines(data.trainable);
        const niceToHaves =
          tagged.length > 0 ? pickTagged("nice_to_have") : splitLines(data.niceToHaves);
        const dealBreakersText = (data.dealBreakers ?? "").trim();
        const dealbreakerLines = splitLines(dealBreakersText);
        const locationText = (data.location ?? "").trim();
        const interviewProcessText = (data.interviewProcess ?? "").trim();
        const decisionMakerText = (data.decisionMaker ?? "").trim();
        const hasComp = typeof data.salaryMin === "number" && typeof data.salaryMax === "number";
        const compUndecided = data.compensationUndecided === true;
        /**
         * Compensation is stored as what the client said: a range, or an
         * explicit "undecided". Never a zero standing in for "we don't know".
         */
        const compensationRecord =
          hasComp || compUndecided || data.compensationFlexible || data.equity || data.bonusStructure
            ? {
                undecided: compUndecided,
                currency: hasComp ? data.currency : null,
                period: hasComp ? data.compensationPeriod : null,
                min: hasComp ? data.salaryMin : null,
                max: hasComp ? data.salaryMax : null,
                bonus: (data.bonusStructure ?? "").trim() || null,
                equity: data.equity || null,
                flexible: data.compensationFlexible === true,
                wide_range_confirmed: data.wideRangeConfirmed === true,
                note: (data.compensationNote ?? "").trim() || null,
                source: "client_intake",
              }
            : null;
        const brief = briefCompleteness({
          location: locationText,
          workModel: data.workModel ?? "",
          remoteTimezones: data.remoteTimezones ?? [],
          remoteAnywhereInCountry: data.remoteAnywhereInCountry === true,
          salaryMin: data.salaryMin ?? 0,
          workAuthorization: data.workAuthorization ?? "",
          interviewProcess: interviewProcessText,
          decisionMaker: decisionMakerText,
          dealBreakers: dealBreakersText,
        });
        const { data: pos, error: posErr } = await admin
          .from("positions")
          .insert({
            organization_id: organizationId,
            title: data.roleTitle.trim(),
            work_model: data.workModel || null,
            location: locationText || null,
            description: (data.jobDescriptionText ?? "").trim() || null,
            // Must-haves filter the shortlist and drive the evidence bullets the
            // client reads. Nice-to-haves order it. Trainable items are stored
            // as explicitly non-filtering so nothing downstream can screen on them.
            requirements: mustHaves.map((label, i) => ({
              label,
              kind: "must_have",
              rank: i + 1,
              filters: true,
              source: tagged.length > 0 ? "client_tagged" : "client_intake",
            })),
            preferred_requirements: [
              ...niceToHaves.map((label, i) => ({
                label,
                kind: "nice_to_have",
                rank: i + 1,
                filters: false,
                orders: true,
                source: tagged.length > 0 ? "client_tagged" : "client_intake",
              })),
              ...trainable.map((label, i) => ({
                label,
                kind: "trainable",
                rank: i + 1,
                filters: false,
                orders: false,
                source: tagged.length > 0 ? "client_tagged" : "client_intake",
              })),
            ],
            dealbreakers: dealbreakerLines.map((label) => ({ label })),
            compensation: compensationRecord,
            compensation_collected: hasComp,
            compensation_visibility: "internal",
            work_authorization: {
              // Sponsorship is always answered, so it is always recorded.
              sponsorship_available: data.sponsorshipAvailable === "yes",
              ...(data.workAuthorization
                ? {
                    rule: data.workAuthorization,
                    note: (data.workAuthorizationNote ?? "").trim() || null,
                  }
                : {}),
            },
            target_start_date: (data.targetStartDate ?? "").trim() || null,
            intake_context: {
              why_open: data.whyOpen.trim(),
              team: (data.team ?? "").trim() || null,
              deal_breakers: dealBreakersText || null,
              interview_process: interviewProcessText || null,
              decision_maker: decisionMakerText || null,
              onsite_days: data.onsiteDays ?? null,
              remote_timezones: data.remoteTimezones ?? [],
              remote_anywhere_in_country: data.remoteAnywhereInCountry === true,
              sponsorship_available: data.sponsorshipAvailable,
              brief_complete: brief.complete,
              brief_missing: brief.missing,
              collected_at: new Date().toISOString(),
              collected_via: "express_intake",
            },
            jd_source: data.jobDescriptionFile ? "file" : "pasted",
            blueprint_status: "queued",
            status: "submitted",
            visibility: "private",
            created_by: authUserId,
            owner_user_id: authUserId,
            submitted_at: new Date().toISOString(),
          })
          .select("id")
          .single();


        if (posErr) {
          return Response.json(
            { ok: false, trace_id: traceId, error: "position_create_failed", message: posErr.message },
            { status: 500 },
          );
        }
        const positionId = pos.id as string;

        // ---------- Store the job description file ----------
        let jdPath: string | null = null;
        if (jdBytes && data.jobDescriptionFile) {
          const safeName = sanitizeJdName(data.jobDescriptionFile.filename, jdExt);
          const path = `${organizationId}/${positionId}/${safeName}`;
          const contentType =
            jdExt === "pdf"
              ? "application/pdf"
              : jdExt === "docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : jdExt === "rtf"
                  ? "application/rtf"
                  : "text/plain";
          const { error: upErr } = await admin.storage
            .from("job-descriptions")
            .upload(path, jdBytes, { contentType, upsert: true });
          if (upErr) {
            console.error("[express-intake] jd upload failed", { traceId, message: upErr.message });
          } else {
            jdPath = path;
            await admin
              .from("positions")
              .update({ jd_file_path: path, jd_file_name: safeName, jd_file_size: jdBytes.length })
              .eq("id", positionId);
          }
        }

        // ---------- Pilot eligibility (one introductory pilot per company) ----------
        // Never blocks onboarding: an ineligible company still gets its workspace,
        // role and blueprint — it just isn't granted a second pilot.
        let pilotEligible = true;
        let pilotReason: string | null = null;
        try {
          const { data: org } = await admin
            .from("organizations")
            .select("pilot_status, pilot_used, pilot_admin_override, pilot_position_id")
            .eq("id", organizationId)
            .maybeSingle();
          const alreadyUsed = Boolean(org?.pilot_used) || (org?.pilot_status && org.pilot_status !== "none");
          if (alreadyUsed && !org?.pilot_admin_override) {
            pilotEligible = false;
            pilotReason = "pilot_already_used";
          } else {
            await admin
              .from("organizations")
              .update({
                // The 14-day clock starts when the search goes live, not now.
                pilot_status: "reserved",
                pilot_used: true,
                pilot_position_id: positionId,
              })
              .eq("id", organizationId);
          }
        } catch (err) {
          console.error("[express-intake] pilot state failed (non-critical)", err);
        }


        // ---------- Intake record ----------
        const { data: intakeRow, error: intakeErr } = await admin
          .from("intake_submissions")
          .insert({
            idempotency_key: data.idempotencyKey,
            organization_id: organizationId,
            position_id: positionId,
            primary_user_id: authUserId,
            primary_email: data.workEmail,
            company_name: data.companyName.trim(),
            role_title: data.roleTitle.trim(),
            source: data.source,
            status: "submitted",
            intake_mode: "express",
            workspace_status: "preparing",
            requisition_pending: true,
            trace_id: traceId,
            payload: {
              firstName: data.firstName,
              lastName: data.lastName,
              contactTitle: data.contactTitle,
              workEmail: data.workEmail,
              phone: data.phone,
              contactLinkedin: data.contactLinkedin ?? "",
              companyName: data.companyName,
              companyWebsite: data.companyWebsite,
              companyLinkedin: data.companyLinkedin ?? "",
              roleTitle: data.roleTitle,
              researchConsent: data.researchConsent,
              pilotAcknowledgement: data.pilotAcknowledgement,
              pilotEligible,
              pilotReason,
              jobDescriptionChars: (data.jobDescriptionText ?? "").length,
              brief: {
                whyOpen: data.whyOpen,
                team: (data.team ?? "").trim(),
                mustHaves,
                niceToHaves,
                trainable,
                requirements: tagged,
                manyMustHavesConfirmed: data.manyMustHavesConfirmed ?? false,
                dealBreakers: dealBreakersText,
                location: locationText,
                workModel: data.workModel || "",
                onsiteDays: data.onsiteDays ?? null,
                remoteTimezones: data.remoteTimezones ?? [],
                remoteAnywhereInCountry: data.remoteAnywhereInCountry === true,
                sponsorshipAvailable: data.sponsorshipAvailable,
                compensation: compensationRecord,
                workAuthorization: data.workAuthorization || "",
                workAuthorizationNote: data.workAuthorizationNote ?? "",
                interviewProcess: interviewProcessText,
                decisionMaker: decisionMakerText,
                targetStartDate: data.targetStartDate ?? "",
                complete: brief.complete,
                missing: brief.missing,
              },


              jobDescriptionFile: jdPath,
              source: data.source,
            },

          })
          .select("id")
          .single();
        if (intakeErr) {
          return Response.json(
            { ok: false, trace_id: traceId, error: "intake_persist_failed", message: intakeErr.message },
            { status: 500 },
          );
        }
        const intakeId = intakeRow.id as string;

        // ---------- Audit ----------
        try {
          await admin.from("audit_events").insert({
            actor_user_id: authUserId,
            organization_id: organizationId,
            entity_type: "intake_submissions",
            entity_id: intakeId,
            action: "intake.submitted",
            metadata: { mode: "express", position_id: positionId, trace_id: traceId, account_created: accountCreated },
          });
        } catch (err) {
          console.error("[express-intake] audit failed (non-critical)", err);
        }

        // ---------- Notify platform staff ----------
        try {
          const { data: staff } = await admin
            .from("memberships")
            .select("user_id")
            .in("role", ["platform_admin", "operations"])
            .eq("status", "active");
          const recipients = Array.from(new Set((staff ?? []).map((m: { user_id: string }) => m.user_id)));
          const rows = recipients.map((uid) => ({
            recipient_user_id: uid as string,
            audience: "admin" as const,
            organization_id: organizationId,
            event_type: "intake_submitted" as const,
            title: `New express onboarding — ${data.companyName.trim()}`,
            body: `${data.firstName} ${data.lastName} · ${data.roleTitle.trim()} (blueprint preparing)`,
            link_path: `/admin/positions/${positionId}`,
          }));
          if (rows.length > 0) await admin.from("notifications").insert(rows);
        } catch (err) {
          console.error("[express-intake] notify failed (non-critical)", err);
        }

        // ---------- Unified lead notification (Teams + email + ledger) ----------
        try {
          const { processLeadEvent } = await import("@/lib/leads/lead-pipeline.server");
          await processLeadEvent({
            leadType: "express_intake",
            sourceId: intakeId,
            source: "express_intake",
            sourcePage: "/intake",
            fullName: `${data.firstName} ${data.lastName}`.trim(),
            email: data.workEmail,
            company: data.companyName.trim(),
            facts: [
              { label: "Role", value: data.roleTitle.trim() },
              { label: "Job description", value: data.jobDescriptionFile ? "uploaded file" : "pasted text" },
              { label: "Account", value: accountCreated ? "created" : "existing" },
            ],
            recordTable: "intake_submissions",
            recordId: intakeId,
            organizationId,
            positionId,
            linkPath: `/admin/positions/${positionId}`,
          });
        } catch (err) {
          console.error("[express-intake] lead notification failed (non-critical)", err);
        }

        // ---------- Confirmation email ----------
        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const { absoluteUrl } = await import("@/lib/blueprint-pipeline.server");
          const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          await sendTemplateEmail("intake-confirmation", data.workEmail, {
            idempotencyKey: `intake-confirmation-${intakeId}`,
            templateData: {
              contactName: data.firstName,
              companyName: data.companyName.trim(),
              roleTitle: data.roleTitle.trim(),
              nextStep:
                "Complete payment in your workspace to publish the role and start the 14-day pilot.",
              dueDate: due,
              workspaceUrl: absoluteUrl(`/client/positions/${positionId}`),
            },
          });
        } catch (err) {
          console.error("[express-intake] confirmation email failed (non-critical)", err);
        }

        return Response.json({
          ok: true,
          trace_id: traceId,
          intakeId,
          organizationId,
          positionId,
          jdStored: Boolean(jdPath),
          userId: authUserId,
          accountCreated,
          pilotEligible,
          pilotReason,
          blueprintStatus: "queued",
        });

      },
    },
  },
});
