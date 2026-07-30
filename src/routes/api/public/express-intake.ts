import { createFileRoute } from "@tanstack/react-router";
import { expressIntakeSchema, ALLOWED_JD_EXT, ALLOWED_JD_MIME, MAX_JD_BYTES, jdFileExt } from "@/lib/express-intake-schema";

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
  return true; // txt
}

function randomPassword(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
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
          if (!ALLOWED_JD_EXT.has(jdExt)) {
            return Response.json(
              { ok: false, trace_id: traceId, error: "jd_bad_extension", message: "Upload a PDF, DOCX or TXT file." },
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

        // ---------- Organization ----------
        const companyNorm = normalizeCompany(data.companyName);
        const domain = emailDomain(data.workEmail);
        let organizationId: string | null = null;
        {
          const { data: byName } = await admin
            .from("organizations")
            .select("id")
            .eq("name_normalized", companyNorm)
            .maybeSingle();
          if (byName) organizationId = byName.id;
        }
        if (!organizationId && domain && !isGenericDomain(domain)) {
          const { data: byDomain } = await admin.from("organizations").select("id").eq("domain", domain).maybeSingle();
          if (byDomain) organizationId = byDomain.id;
        }
        if (!organizationId) {
          const { data: newOrg, error: orgErr } = await admin
            .from("organizations")
            .insert({
              name: data.companyName.trim(),
              website: data.companyWebsite || null,
              domain: domain && !isGenericDomain(domain) ? domain : null,
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
          const { data: org } = await admin.from("organizations").select("website").eq("id", organizationId).maybeSingle();
          if (!org?.website) await admin.from("organizations").update({ website: data.companyWebsite }).eq("id", organizationId);
        }

        // ---------- Auth user ----------
        let authUserId: string | null = null;
        let accountCreated = false;
        {
          // No password supplied → this must already be an account (an
          // authenticated client re-submitting). Never create one blind.
          if (!data.password) {
            const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const found = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === data.workEmail);
            if (!found) {
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
            authUserId = found.id;
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
            const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const found = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === data.workEmail);
            if (!found) {
              return Response.json(
                { ok: false, trace_id: traceId, error: "auth_user_failed", message: createErr.message },
                { status: 500 },
              );
            }
            authUserId = found.id;
            // Existing account: never silently reset their password from a public form.
          } else {
            authUserId = created?.user?.id ?? null;
            accountCreated = true;
          }
        }
        if (!authUserId) {
          return Response.json({ ok: false, trace_id: traceId, error: "auth_user_missing" }, { status: 500 });
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
        const { data: pos, error: posErr } = await admin
          .from("positions")
          .insert({
            organization_id: organizationId,
            title: data.roleTitle.trim(),
            work_model: "remote",
            description: (data.jobDescriptionText ?? "").trim() || null,
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

        // ---------- Teams ----------
        try {
          const { notifyTeamsSafe } = await import("@/lib/teams-notify.server");
          notifyTeamsSafe({
            title: "New express onboarding",
            subtitle: `${data.companyName.trim()} · ${data.roleTitle.trim()}`,
            facts: [
              { label: "Contact", value: `${data.firstName} ${data.lastName}` },
              { label: "Email", value: data.workEmail },
              { label: "Job description", value: data.jobDescriptionFile ? "uploaded file" : "pasted text" },
            ],
            linkPath: `/admin/positions/${positionId}`,
            linkLabel: "Open role",
          });
        } catch (err) {
          console.error("[express-intake] teams failed (non-critical)", err);
        }

        // ---------- Welcome email ----------
        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const { absoluteUrl } = await import("@/lib/blueprint-pipeline.server");
          await sendTemplateEmail("express-welcome", data.workEmail, {
            idempotencyKey: `express-welcome-${intakeId}`,
            templateData: {
              contactName: data.firstName,
              companyName: data.companyName.trim(),
              roleTitle: data.roleTitle.trim(),
              workspaceUrl: absoluteUrl(`/client/positions/${positionId}`),
            },
          });
        } catch (err) {
          console.error("[express-intake] welcome email failed (non-critical)", err);
        }

        return Response.json({
          ok: true,
          trace_id: traceId,
          intakeId,
          organizationId,
          positionId,
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
