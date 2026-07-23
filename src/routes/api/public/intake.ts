import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// ---------- Canonical intake payload contract ----------
const workModel = z.enum(["remote", "hybrid", "onsite"]);
const employmentType = z
  .enum(["full_time", "part_time", "contract", "temporary", "internship"])
  .optional()
  .or(z.literal(""));

const screeningQuestionSchema = z.object({
  question: z.string().trim().min(3).max(500),
  answer_type: z.enum(["text", "boolean", "number", "single_choice", "multi_choice"]).default("text"),
  required: z.boolean().default(false),
  dealbreaker: z.boolean().default(false),
});

const intakePayloadSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(128),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    workEmail: z.string().trim().toLowerCase().email().max(255),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    companyName: z.string().trim().min(1).max(160),
    companyWebsite: z.string().trim().max(255).optional().or(z.literal("")),
    industry: z.string().trim().max(120).optional().or(z.literal("")),
    companySize: z.string().trim().max(40).optional().or(z.literal("")),
    headquarters: z.string().trim().max(160).optional().or(z.literal("")),
    roleTitle: z.string().trim().min(1).max(160),
    department: z.string().trim().max(120).optional().or(z.literal("")),
    location: z.string().trim().max(160).optional().or(z.literal("")),
    workModel,
    employmentType,
    seniority: z.string().trim().max(80).optional().or(z.literal("")),
    headcount: z.number().int().min(1).max(999).optional().nullable(),
    jobDescription: z.string().trim().max(20000).optional().or(z.literal("")),
    responsibilities: z.string().trim().max(6000).optional().or(z.literal("")),
    mustHaveSkills: z.array(z.string().trim().min(1).max(120)).default([]),
    preferredRequirements: z.string().trim().max(4000).optional().or(z.literal("")),
    experience: z.string().trim().max(200).optional().or(z.literal("")),
    education: z.string().trim().max(400).optional().or(z.literal("")),
    certifications: z.string().trim().max(400).optional().or(z.literal("")),
    languages: z.string().trim().max(400).optional().or(z.literal("")),
    industryExperience: z.string().trim().max(400).optional().or(z.literal("")),
    dealbreakers: z.string().trim().max(2000).optional().or(z.literal("")),
    compensation: z.string().trim().max(200).optional().or(z.literal("")),
    hiringUrgency: z.string().trim().max(80).optional().or(z.literal("")),
    hiringTimeline: z.string().trim().max(200).optional().or(z.literal("")),
    targetCountries: z.array(z.string().trim().min(1).max(80)).default([]),
    workAuthorization: z.string().trim().max(160).optional().or(z.literal("")),
    targetTitles: z.array(z.string().trim().min(1).max(160)).default([]),
    timezoneRequirements: z.string().trim().max(160).optional().or(z.literal("")),
    reasonForHiring: z.enum(["replacement", "growth", "backfill", "new_team"]).optional().or(z.literal("")),
    hiringChallenges: z.string().trim().max(2000).optional().or(z.literal("")),
    interviewProcess: z.string().trim().max(2000).optional().or(z.literal("")),
    decisionMakers: z.string().trim().max(400).optional().or(z.literal("")),
    additionalContext: z.string().trim().max(4000).optional().or(z.literal("")),
    screeningQuestions: z.array(screeningQuestionSchema).max(20).default([]),
    consent: z.literal(true),
    password: z.string().min(8).max(128).optional(),
    source: z.string().trim().max(80).default("public_form"),
    submittedAt: z.string().datetime().optional(),
  })
  .refine(
    (v) => {
      const uniqueSkills = new Set(v.mustHaveSkills.map((s) => s.trim().toLowerCase()).filter(Boolean));
      const descLen = (v.jobDescription ?? "").trim().length;
      return uniqueSkills.size >= 3 || descLen >= 40;
    },
    {
      path: ["mustHaveSkills"],
      message: "Provide at least 3 must-have skills or a job description of at least 40 characters",
    },
  );

const normalizeCompany = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");
const emailDomain = (email: string) => {
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
};

export const Route = createFileRoute("/api/public/intake")({
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

        const parsed = intakePayloadSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              ok: false,
              trace_id: traceId,
              error: "validation_failed",
              issues: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }
        const data = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // ---------- Idempotency ----------
        const { data: existing, error: existingErr } = await supabaseAdmin
          .from("intake_submissions")
          .select("id, organization_id, position_id, primary_user_id, workspace_status, requisition_pending, status")
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
            userId: existing.primary_user_id,
            positionId: existing.position_id,
            status: existing.status,
            workspaceStatus: existing.workspace_status,
            requisitionPending: existing.requisition_pending,
          });
        }

        // ---------- Organization: resolve or create ----------
        const companyNorm = normalizeCompany(data.companyName);
        const domain = emailDomain(data.workEmail);
        let organizationId: string | null = null;
        {
          const { data: byName } = await supabaseAdmin
            .from("organizations")
            .select("id")
            .eq("name_normalized", companyNorm)
            .maybeSingle();
          if (byName) organizationId = byName.id;
        }
        if (!organizationId && domain && !isGenericDomain(domain)) {
          const { data: byDomain } = await supabaseAdmin
            .from("organizations")
            .select("id")
            .eq("domain", domain)
            .maybeSingle();
          if (byDomain) organizationId = byDomain.id;
        }
        if (!organizationId) {
          const { data: newOrg, error: orgErr } = await supabaseAdmin
            .from("organizations")
            .insert({
              name: data.companyName.trim(),
              website: data.companyWebsite || null,
              domain: domain && !isGenericDomain(domain) ? domain : null,
              industry: data.industry || null,
              headquarters: data.headquarters || null,
              status: "prospect",
            })
            .select("id")
            .single();
          if (orgErr) {
            return Response.json(
              { ok: false, trace_id: traceId, error: "org_create_failed", message: orgErr.message },
              { status: 500 },
            );
          }
          organizationId = newOrg.id;
        }

        // ---------- Auth user: resolve or create ----------
        let authUserId: string | null = null;
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const admin = supabaseAdmin as any;
          const chosenPassword = data.password && data.password.length >= 8 ? data.password : cryptoRandomPassword(20);
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email: data.workEmail,
            password: chosenPassword,
            email_confirm: true,
            user_metadata: { full_name: `${data.firstName} ${data.lastName}`.trim() },
          });
          if (createErr) {
            const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
            const found = list?.users?.find(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (u: any) => (u.email ?? "").toLowerCase() === data.workEmail,
            );
            if (!found) {
              return Response.json(
                { ok: false, trace_id: traceId, error: "auth_user_failed", message: createErr.message },
                { status: 500 },
              );
            }
            authUserId = found.id;
            // Update password for the existing user so they can sign in with what they just chose.
            if (data.password && data.password.length >= 8) {
              await admin.auth.admin.updateUserById(found.id, { password: data.password });
            }
          } else {
            authUserId = created?.user?.id ?? null;
          }
        }
        if (!authUserId) {
          return Response.json({ ok: false, trace_id: traceId, error: "auth_user_missing" }, { status: 500 });
        }

        // ---------- Profile upsert ----------
        {
          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("auth_user_id", authUserId)
            .maybeSingle();
          if (!existingProfile) {
            const { error: profErr } = await supabaseAdmin.from("profiles").insert({
              auth_user_id: authUserId,
              email: data.workEmail,
              full_name: `${data.firstName} ${data.lastName}`.trim(),
              status: "active",
            });
            if (profErr) {
              return Response.json(
                { ok: false, trace_id: traceId, error: "profile_failed", message: profErr.message },
                { status: 500 },
              );
            }
          }
        }

        // ---------- Membership: client_admin ----------
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: memErr } = await (supabaseAdmin as any)
          .from("memberships")
          .upsert(
            {
              user_id: authUserId,
              organization_id: organizationId,
              role: "client_admin",
              status: "active",
            },
            { onConflict: "user_id,organization_id,role", ignoreDuplicates: true },
          );
        if (memErr && !/duplicate|conflict/i.test(memErr.message)) {
          return Response.json(
            { ok: false, trace_id: traceId, error: "membership_failed", message: memErr.message },
            { status: 500 },
          );
        }

        // ---------- Position create (non-critical for intake persistence) ----------
        let positionId: string | null = null;
        let requisitionPending = false;
        let workspaceStatus: "ready" | "preparing" = "ready";
        try {
          const empType =
            data.employmentType && data.employmentType.length > 0
              ? (data.employmentType as "full_time" | "part_time" | "contract" | "temporary" | "internship")
              : null;
          const uniqueSkills = Array.from(
            new Map(
              data.mustHaveSkills
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => [s.toLowerCase(), s]),
            ).values(),
          );
          const requirements = uniqueSkills.map((s) => ({ label: s, kind: "skill", weight: 1 }));
          const preferred = (data.preferredRequirements || "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((label) => ({ label }));
          const dealbreakers = (data.dealbreakers || "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((label) => ({ label }));

          const { data: pos, error: posErr } = await supabaseAdmin
            .from("positions")
            .insert({
              organization_id: organizationId,
              title: data.roleTitle.trim(),
              department: data.department || null,
              location: data.location || null,
              work_model: data.workModel,
              employment_type: empType,
              seniority: data.seniority || null,
              description: data.jobDescription || null,
              requirements,
              preferred_requirements: preferred,
              dealbreakers,
              compensation: data.compensation ? { note: data.compensation } : {},
              work_authorization: data.workAuthorization
                ? { note: data.workAuthorization, countries: data.targetCountries, target_titles: data.targetTitles }
                : { countries: data.targetCountries, target_titles: data.targetTitles },
              intake_context: {
                responsibilities: data.responsibilities || "",
                experience: data.experience || "",
                education: data.education || "",
                certifications: data.certifications || "",
                languages: data.languages || "",
                industry_experience: data.industryExperience || "",
                hiring_timeline: data.hiringTimeline || "",
                timezone_requirements: data.timezoneRequirements || "",
                reason_for_hiring: data.reasonForHiring || "",
                hiring_challenges: data.hiringChallenges || "",
                interview_process: data.interviewProcess || "",
                decision_makers: data.decisionMakers || "",
                additional_context: data.additionalContext || "",
              },
              status: "submitted",
              visibility: "private",
              created_by: authUserId,
              submitted_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (posErr) throw posErr;
          positionId = pos.id;


          if (data.screeningQuestions.length > 0) {
            const rows = data.screeningQuestions.map((q, i) => ({
              position_id: positionId!,
              question: q.question,
              answer_type: q.answer_type,
              required: q.required,
              dealbreaker: q.dealbreaker,
              display_order: i,
            }));
            const { error: sqErr } = await supabaseAdmin.from("screening_questions").insert(rows);
            if (sqErr) throw sqErr;
          }
        } catch (err) {
          console.error("[intake] position creation failed", { traceId, err });
          requisitionPending = true;
          workspaceStatus = "preparing";
        }

        // ---------- Insert intake record ----------
        const { data: intakeRow, error: intakeErr } = await supabaseAdmin
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
            workspace_status: workspaceStatus,
            requisition_pending: requisitionPending,
            trace_id: traceId,
            payload: (() => { const { password: _pw, ...rest } = data; return rest; })(),
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

        // ---------- Audit event ----------
        await supabaseAdmin.from("audit_events").insert({
          actor_user_id: authUserId,
          organization_id: organizationId,
          entity_type: "intake_submissions",
          entity_id: intakeId,
          action: "intake.submitted",
          after_state: {
            company: data.companyName,
            role: data.roleTitle,
            position_id: positionId,
            requisition_pending: requisitionPending,
          },
          trace_id: traceId,
        });

        // ---------- Admin notification (non-critical) ----------
        try {
          const { data: evt } = await supabaseAdmin
            .from("notification_events")
            .insert({
              event_type: "intake_submitted",
              idempotency_key: `intake:${intakeId}`,
              organization_id: organizationId,
              position_id: positionId,
              actor_user_id: authUserId,
              payload: {
                company: data.companyName,
                role: data.roleTitle,
                intake_id: intakeId,
                requisition_pending: requisitionPending,
                trace_id: traceId,
              },
            })
            .select("id")
            .single();
          if (evt) {
            // fan out to platform staff (platform_admin + operations)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: staff } = await (supabaseAdmin as any)
              .from("memberships")
              .select("user_id")
              .in("role", ["platform_admin", "operations"])
              .eq("status", "active");
            const uniqueRecipients = Array.from(
              new Set((staff ?? []).map((m: { user_id: string }) => m.user_id)),
            );
            if (uniqueRecipients.length > 0) {
              const notifRows = uniqueRecipients.map((uid) => ({
                event_id: evt.id,
                recipient_user_id: uid as string,
                audience: "admin" as const,
                organization_id: organizationId,
                event_type: "intake_submitted" as const,
                title: `New intake — ${data.companyName}`,
                body: `${data.firstName} ${data.lastName} · ${data.roleTitle}${requisitionPending ? " (workspace preparing)" : ""}`,
                link_path: `/admin/clients/${organizationId}`,
              }));
              await supabaseAdmin.from("notifications").insert(notifRows);
            }
          }
        } catch (err) {
          console.error("[intake] notification failed (non-critical)", { traceId, err });
        }

        return Response.json({
          ok: true,
          trace_id: traceId,
          intakeId,
          organizationId,
          userId: authUserId,
          positionId,
          status: "submitted",
          workspaceStatus,
          requisitionPending,
        });
      },
    },
  },
});

function isGenericDomain(domain: string): boolean {
  const generic = new Set([
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
  ]);
  return generic.has(domain);
}

function cryptoRandomPassword(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}
