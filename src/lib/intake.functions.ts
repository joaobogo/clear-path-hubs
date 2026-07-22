import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { intakeSchema, normalizeCompanyName, emailDomain } from "./intake-schema";

const inputSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  payload: intakeSchema,
});

export type SubmitIntakeResult = {
  ok: true;
  intakeId: string;
  orgId: string;
  positionId: string;
  status: "created" | "already_processed" | "preparation";
  traceId: string;
};

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<SubmitIntakeResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const traceId = crypto.randomUUID();
    const { idempotencyKey, payload } = data;

    // 1) Idempotency check: same key returns the same result
    {
      const { data: existing } = await supabaseAdmin
        .from("client_intakes")
        .select("id, org_id, position_id, status, trace_id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing?.org_id && existing.position_id) {
        return {
          ok: true,
          intakeId: existing.id,
          orgId: existing.org_id,
          positionId: existing.position_id,
          status: "already_processed",
          traceId: existing.trace_id,
        };
      }
      if (existing && (!existing.org_id || !existing.position_id)) {
        // Retry preparation
        return await runPreparation(existing.id, existing.trace_id, payload);
      }
    }

    // 2) Insert intake row (source of truth for the request)
    const { data: intake, error: intakeErr } = await supabaseAdmin
      .from("client_intakes")
      .insert({
        idempotency_key: idempotencyKey,
        submitter_email: payload.workEmail,
        payload: payload as any,
        trace_id: traceId,
        status: "received",
      })
      .select("id")
      .single();
    if (intakeErr || !intake) {
      // Race on idempotency_key -> re-read
      const { data: again } = await supabaseAdmin
        .from("client_intakes")
        .select("id, org_id, position_id, trace_id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (again?.org_id && again.position_id) {
        return {
          ok: true,
          intakeId: again.id,
          orgId: again.org_id,
          positionId: again.position_id,
          status: "already_processed",
          traceId: again.trace_id,
        };
      }
      throw new Error(intakeErr?.message ?? "Failed to record intake");
    }

    return await runPreparation(intake.id, traceId, payload);
  });

async function runPreparation(
  intakeId: string,
  traceId: string,
  payload: z.infer<typeof intakeSchema>,
): Promise<SubmitIntakeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const nameNorm = normalizeCompanyName(payload.companyName);
  const domain = emailDomain(payload.workEmail);

  try {
    // 3) Find or create organization (nameNorm + domain uniqueness)
    let orgId: string | undefined;
    {
      const { data: existingOrg } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("name_normalized", nameNorm)
        .eq("domain", domain ?? "")
        .maybeSingle();
      if (existingOrg) orgId = existingOrg.id;
      else {
        const { data: created, error } = await supabaseAdmin
          .from("organizations")
          .insert({ name: payload.companyName.trim(), name_normalized: nameNorm, domain })
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "org create failed");
        orgId = created.id;
      }
    }

    // 4) Look up existing user by email (safe: never enumerate)
    let userId: string | null = null;
    try {
      // Best-effort: list first 1 user matching email via admin listUsers filter (email)
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      userId =
        userList?.users?.find(
          (u) => (u.email ?? "").toLowerCase() === payload.workEmail,
        )?.id ?? null;
    } catch {
      userId = null;
    }

    // 5) Membership (only if user exists)
    if (userId) {
      await supabaseAdmin
        .from("org_memberships")
        .upsert(
          { org_id: orgId, user_id: userId, role: "owner" },
          { onConflict: "org_id,user_id" },
        );
      // Ensure client role assigned
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "client" }, { onConflict: "user_id,role" });
    }

    // 6) Position — idempotent by intake_id
    let positionId: string | undefined;
    {
      const { data: existingPos } = await supabaseAdmin
        .from("positions")
        .select("id")
        .eq("intake_id", intakeId)
        .maybeSingle();
      if (existingPos) positionId = existingPos.id;
      else {
        const insertPayload = {
          org_id: orgId!,
          created_by: userId,
          title: payload.roleTitle.trim(),
          work_model: payload.workModel,
          location: emptyToNull(payload.location),
          employment_type: emptyToNull(payload.employmentType),
          seniority: emptyToNull(payload.seniority),
          target_countries: payload.targetCountries ?? [],
          compensation: emptyToNull(payload.compensation),
          headcount:
            typeof payload.headcount === "number" && !Number.isNaN(payload.headcount)
              ? payload.headcount
              : null,
          hiring_urgency: emptyToNull(payload.hiringUrgency),
          target_titles: payload.targetTitles ?? [],
          work_authorization: emptyToNull(payload.workAuthorization),
          must_have_skills: payload.mustHaveSkills ?? [],
          preferred_requirements: emptyToNull(payload.preferredRequirements),
          dealbreakers: emptyToNull(payload.dealbreakers),
          job_description: emptyToNull(payload.jobDescription),
          status: "submitted" as const,
          visibility: "private",
          intake_id: intakeId,
        };
        const { data: created, error } = await supabaseAdmin
          .from("positions")
          .insert(insertPayload)
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "position create failed");
        positionId = created.id;
      }
    }

    // 7) Structured screening questions — idempotent (delete+recreate if none present)
    {
      const { count } = await supabaseAdmin
        .from("screening_questions")
        .select("*", { count: "exact", head: true })
        .eq("position_id", positionId!);
      if (!count || count === 0) {
        const defaults = buildScreeningQuestions(payload);
        await supabaseAdmin.from("screening_questions").insert(
          defaults.map((q, i) => ({
            position_id: positionId!,
            prompt: q.prompt,
            kind: q.kind,
            required: q.required,
            ordering: i,
          })),
        );
      }
    }

    // 8) Audit
    await supabaseAdmin.from("audit_log").insert({
      actor_id: userId,
      action: "intake.submitted",
      entity_type: "client_intakes",
      entity_id: intakeId,
      diff: { orgId, positionId },
      trace_id: traceId,
    });

    // 9) Complete intake row
    await supabaseAdmin
      .from("client_intakes")
      .update({
        status: "completed",
        org_id: orgId,
        position_id: positionId,
        completed_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", intakeId);

    return {
      ok: true,
      intakeId,
      orgId: orgId!,
      positionId: positionId!,
      status: "created",
      traceId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("client_intakes")
      .update({ status: "preparation_failed", error: message })
      .eq("id", intakeId);
    await supabaseAdmin.from("audit_log").insert({
      action: "intake.preparation_failed",
      entity_type: "client_intakes",
      entity_id: intakeId,
      diff: { error: message },
      trace_id: traceId,
    });
    // Read partial state to return non-destructive preparation status
    const { data: partial } = await supabaseAdmin
      .from("client_intakes")
      .select("org_id, position_id")
      .eq("id", intakeId)
      .maybeSingle();
    return {
      ok: true,
      intakeId,
      orgId: partial?.org_id ?? "",
      positionId: partial?.position_id ?? "",
      status: "preparation",
      traceId,
    };
  }
}

function emptyToNull(v: string | undefined | null) {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function buildScreeningQuestions(payload: z.infer<typeof intakeSchema>) {
  const qs: { prompt: string; kind: string; required: boolean }[] = [
    {
      prompt: "Are you currently authorized to work in the target location(s)?",
      kind: "single_choice",
      required: true,
    },
    {
      prompt: "What is your earliest possible start date?",
      kind: "short_text",
      required: true,
    },
    {
      prompt: "What is your current or expected total compensation range?",
      kind: "short_text",
      required: false,
    },
  ];
  const skills = (payload.mustHaveSkills ?? []).slice(0, 3);
  for (const s of skills) {
    qs.push({
      prompt: `Briefly describe your experience with ${s}.`,
      kind: "long_text",
      required: true,
    });
  }
  return qs;
}
