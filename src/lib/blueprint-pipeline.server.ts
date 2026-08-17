// Runs the express-onboarding preparation for one role, end to end:
// read the job description → review permitted public company information →
// generate the Role Blueprint → apply it to the position, rubric and screening
// questions → notify the client and the TaaSFlow team.
//
// Server only. Never throws: every failure lands in positions.blueprint_status
// = 'failed' with a reason a human can act on and retry.

import {
  generateBlueprint,
  readJobDescription,
  researchCompany,
  type CompanyResearch,
  type RoleBlueprint,
} from "./blueprint-engine.server";

type Stage =
  | "queued"
  | "analyzing_jd"
  | "researching_company"
  | "drafting_blueprint"
  | "ready"
  | "failed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

async function setStage(admin: Admin, positionId: string, stage: Stage, error?: string | null) {
  await admin
    .from("positions")
    .update({ 
      blueprint_status: stage, 
      blueprint_error: error ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", positionId);
}

export interface BlueprintRunInput {
  positionId: string;
  organizationId: string;
  intakeId: string | null;
  roleTitle: string;
  companyName: string;
  companyWebsite: string;
  contactEmail: string;
  contactName: string;
  researchConsent: boolean;
  jdFile?: { bytes: Uint8Array; mime: string; filename: string } | null;
  jdPastedText?: string | null;
}

export async function runBlueprintPipeline(input: BlueprintRunInput): Promise<{ ok: boolean; reason?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as Admin;

  try {
    // 1 — Job description text
    await setStage(admin, input.positionId, "analyzing_jd");
    const jd = await readJobDescription({ pastedText: input.jdPastedText, file: input.jdFile });
    if (jd.text.trim().length < 40) {
      await setStage(admin, input.positionId, "failed", jd.reason ?? "job_description_unreadable");
      return { ok: false, reason: jd.reason ?? "job_description_unreadable" };
    }
    await admin
      .from("positions")
      .update({ jd_text: jd.text.slice(0, 100000), jd_source: jd.source })
      .eq("id", input.positionId);

    // 2 — Permitted public company research
    let research: CompanyResearch | null = null;
    if (input.researchConsent && input.companyWebsite) {
      await setStage(admin, input.positionId, "researching_company");
      research = await researchCompany(input.companyWebsite);
      await admin
        .from("positions")
        .update({
          company_research: {
            ok: research.ok,
            url: research.url,
            pages: research.pages,
            reason: research.reason ?? null,
            fetched_at: research.fetched_at,
            chars: research.text.length,
          },
        })
        .eq("id", input.positionId);
    }

    // 3 — Generate
    await setStage(admin, input.positionId, "drafting_blueprint");
    const result = await generateBlueprint({
      roleTitle: input.roleTitle,
      companyName: input.companyName,
      companyWebsite: input.companyWebsite,
      jobDescription: jd.text,
      research,
    });
    if (!result.ok) {
      console.error("[runBlueprintPipeline] generate failed", result.reason);
      await setStage(admin, input.positionId, "failed", result.reason);
      return { ok: false, reason: result.reason };
    }
      return { ok: false, reason: result.reason };
    }
    const bp = result.blueprint;

    // 4 — Apply to the position so every downstream system (scoring, job board,
    //     sourcing) sees real values, not an empty shell.
    await applyBlueprintToPosition(admin, input.positionId, bp, jd.text);
    await applyScreeningQuestions(admin, input.positionId, bp);
    await enrichOrganization(admin, input.organizationId, bp);

    await admin
      .from("positions")
      .update({
        blueprint: bp as unknown as Record<string, unknown>,
        blueprint_status: "ready",
        blueprint_error: null,
        blueprint_model: bp.model,
        blueprint_generated_at: bp.generated_at,
      })
      .eq("id", input.positionId);

    if (input.intakeId) {
      await admin
        .from("intake_submissions")
        .update({ workspace_status: "ready", requisition_pending: false })
        .eq("id", input.intakeId);
    }

    await notifyReady(admin, input, bp);
    return { ok: true };
  } catch (err) {
    const reason = `pipeline_error:${(err as Error).message?.slice(0, 200)}`;
    console.error("[blueprint] pipeline failed", { positionId: input.positionId, err });
    try {
      await setStage(admin, input.positionId, "failed", reason);
    } catch {
      /* nothing more we can do */
    }
    return { ok: false, reason };
  }
}

/* ------------------------------------------------------------------ */

/** True for values a human clearly has not filled in yet. */
function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    if (keys.length === 0) return true;
    // For requirement-like objects, if all fields are empty, it's empty.
    return Object.values(v as object).every((val) => isEmptyValue(val));
  }
  return false;
}

async function applyBlueprintToPosition(
  admin: Admin,
  positionId: string,
  bp: RoleBlueprint,
  jdText: string,
) {
  const { data: current } = await admin
    .from("positions")
    .select(
      "description, requirements, preferred_requirements, dealbreakers, evaluation_weights, " +
        "department, location, work_model, employment_type, seniority, openings, " +
        "travel_expectation, primary_timezone, compensation, work_authorization, " +
        "intake_context, blueprint_generated_at",
    )
    .eq("id", positionId)
    .maybeSingle();

  const existingContext = (current?.intake_context ?? {}) as Record<string, unknown>;

  // A blueprint has already been applied to this role once, so a person may
  // have edited these fields since. Generated values are gap-fillers only:
  // they never replace data a client or staff member already provided.
  const requirements = bp.must_have_skills.map((label) => ({ label, kind: "skill", weight: 1 }));
  const preferred = bp.nice_to_have_skills.map((label) => ({ label }));
  const dealbreakers = bp.dealbreakers.map((label) => ({ label }));
  const compensation =
    bp.compensation.note || bp.compensation.min || bp.compensation.max
      ? {
          note: bp.compensation.note,
          currency: bp.compensation.currency,
          min: bp.compensation.min,
          max: bp.compensation.max,
          generated: true,
        }
      : {};

  const generated: Record<string, unknown> = {
    description: (current?.description ?? "").trim() || jdText.slice(0, 20000),
    department: bp.role.department || null,
    location: bp.role.location || null,
    work_model: bp.role.work_model,
    employment_type: bp.role.employment_type || null,
    seniority: bp.role.seniority || null,
    openings: bp.role.headcount,
    travel_expectation: bp.geography.travel_expectation || null,
    primary_timezone: bp.geography.timezone_requirements || null,
    requirements,
    preferred_requirements: preferred,
    dealbreakers,
    evaluation_weights: bp.rubric.weights,
    compensation,
    work_authorization: {
      note: bp.candidate_profile.work_authorization,
      countries: bp.geography.target_countries,
      target_titles: bp.sourcing_plan.target_titles,
    },
  };

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(generated)) {
    const existing = (current as Record<string, unknown> | null)?.[key];
    // Never overwrite values a human already provided — generated content fills gaps only.
    if (!isEmptyValue(existing)) continue;
    if (isEmptyValue(value)) continue;
    patch[key] = value;
  }

  // intake_context is additive by construction: generated keys never replace a
  // key a human has already set on a retry.
  const generatedContext: Record<string, unknown> = {
    generated_by_blueprint: true,
    blueprint_version: bp.version,
    employer_value_proposition: bp.company.value_proposition,
    responsibilities: bp.responsibilities.join("\n"),
    experience: bp.candidate_profile.experience,
    education: bp.candidate_profile.education,
    languages: bp.candidate_profile.languages,
    industry_experience: bp.candidate_profile.industry_experience,
    certifications_list: bp.certifications,
    tools_platforms: bp.tools_platforms,
    nice_to_have_skills: bp.nice_to_have_skills,
    timezone_requirements: bp.geography.timezone_requirements,
    open_worldwide: bp.geography.open_worldwide,
    hiring_timeline: bp.timeline.hiring_urgency,
    time_to_hire: bp.timeline.time_to_hire,
    target_start_date: bp.timeline.target_start_date,
    currency: bp.compensation.currency,
    budget_min: bp.compensation.min,
    budget_max: bp.compensation.max,
    target_company_types: bp.sourcing_plan.target_company_types,
    include_keywords: bp.sourcing_plan.include_keywords,
    exclude_keywords: bp.sourcing_plan.exclude_keywords,
    disqualifiers: bp.sourcing_plan.disqualifiers,
    additional_context: bp.role.summary,
  };
  const mergedContext: Record<string, unknown> = { ...existingContext };
  for (const [key, value] of Object.entries(generatedContext)) {
    if (!isEmptyValue(existingContext[key])) continue;
    if (isEmptyValue(value)) continue;
    mergedContext[key] = value;
  }
  patch.intake_context = mergedContext;

  await admin.from("positions").update(patch).eq("id", positionId);
}

async function applyScreeningQuestions(admin: Admin, positionId: string, bp: RoleBlueprint) {
  if (bp.screening_questions.length === 0) return;
  const { count } = await admin
    .from("screening_questions")
    .select("id", { count: "exact", head: true })
    .eq("position_id", positionId);
  if ((count ?? 0) > 0) return; // never overwrite questions a human already set

  const rows = bp.screening_questions.map((q, i) => ({
    position_id: positionId,
    question: q.question,
    answer_type: q.answer_type,
    required: q.required,
    dealbreaker: q.dealbreaker,
    display_order: i,
  }));
  await admin.from("screening_questions").insert(rows);
}

async function enrichOrganization(admin: Admin, organizationId: string, bp: RoleBlueprint) {
  const { data: org } = await admin
    .from("organizations")
    .select("industry, headquarters")
    .eq("id", organizationId)
    .maybeSingle();
  const patch: Record<string, unknown> = {};
  if (!org?.industry && bp.company.industry) patch.industry = bp.company.industry;
  if (!org?.headquarters && bp.company.headquarters) patch.headquarters = bp.company.headquarters;
  if (Object.keys(patch).length > 0) {
    await admin.from("organizations").update(patch).eq("id", organizationId);
  }
}

async function notifyReady(admin: Admin, input: BlueprintRunInput, bp: RoleBlueprint) {
  // In-app: client admins + platform staff.
  try {
    const { data: members } = await admin
      .from("memberships")
      .select("user_id")
      .eq("organization_id", input.organizationId)
      .eq("status", "active");
    const rows = (members ?? []).map((m: { user_id: string }) => ({
      recipient_user_id: m.user_id,
      audience: "client" as const,
      organization_id: input.organizationId,
      event_type: "position_updated" as const,
      title: `Role blueprint ready — ${bp.role.title}`,
      body: "Review and edit the generated brief, rubric and screening questions.",
      link_path: `/client/positions/${input.positionId}`,
    }));
    if (rows.length > 0) await admin.from("notifications").insert(rows);
  } catch (err) {
    console.error("[blueprint] in-app notify failed", err);
  }

  // Email the client contact.
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("role-blueprint-ready", input.contactEmail, {
      idempotencyKey: `blueprint-ready-${input.positionId}`,
      templateData: {
        contactName: input.contactName,
        roleTitle: bp.role.title,
        companyName: input.companyName,
        openQuestions: bp.open_questions,
        mustHaves: bp.must_have_skills.slice(0, 6),
        reviewUrl: absoluteUrl(`/client/positions/${input.positionId}`),
      },
    });
  } catch (err) {
    console.error("[blueprint] client email failed", err);
  }

  // Team channel.
  try {
    const { notifyTeamsSafe } = await import("@/lib/teams-notify.server");
    notifyTeamsSafe({
      title: "Role blueprint ready",
      subtitle: `${input.companyName} · ${bp.role.title}`,
      facts: [
        { label: "Confidence", value: `${Math.round(bp.confidence.overall * 100)}%` },
        { label: "Must-haves", value: String(bp.must_have_skills.length) },
        { label: "Screening questions", value: String(bp.screening_questions.length) },
      ],
      linkPath: `/admin/positions/${input.positionId}`,
      linkLabel: "Open role",
    });
  } catch (err) {
    console.error("[blueprint] teams notify failed", err);
  }
}

export function absoluteUrl(path: string): string {
  const base = (process.env.PUBLIC_SITE_URL || "https://taasflow.com").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Runs the blueprint pipeline for a single position, resolving the input data
 * either from an associated intake submission or directly from the
 * position + organization + creator profile. This is the canonical entry point
 * used by the public intake, client onboarding, retry buttons, and backfill jobs.
 */
export async function runBlueprintForPosition(
  positionId: string,
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; reason?: string; status?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as Admin;

  const { data: position } = await admin
    .from("positions")
    .select(
      "id, title, description, blueprint_status, blueprint_attempts, " +
        "jd_file_path, jd_file_name, organization_id, created_by",
    )
    .eq("id", positionId)
    .maybeSingle();
  if (!position) return { ok: false, reason: "position_not_found" };

  const RUNNABLE = ["queued", "failed", "not_started", ""];
  const status = String(position.blueprint_status ?? "not_started") || "not_started";
  if (!RUNNABLE.includes(status) && !opts.force) {
    return { ok: true, status, reason: "already_running" };
  }

  const attempts = Number(position.blueprint_attempts ?? 0);
  if (!opts.force && attempts >= 5) {
    return { ok: false, reason: "attempt_limit_reached", status };
  }

  // Claim the job so concurrent drains / retries don't duplicate work.
  const { data: claimed } = await admin
    .from("positions")
    .update({
      blueprint_status: "analyzing_jd",
      blueprint_error: null,
      blueprint_attempts: attempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", position.id)
    .or(`blueprint_status.in.(${RUNNABLE.filter(Boolean).join(",")}),blueprint_status.is.null`)
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { ok: true, reason: "already_running" };
  }

  // Resolve intake data; if none exists, derive from the position owner.
  const { data: intake } = await admin
    .from("intake_submissions")
    .select("id, organization_id, position_id, primary_email, company_name, payload")
    .eq("position_id", positionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let payload: Record<string, unknown> = {};
  let companyName = "";
  let companyWebsite = "";
  let contactEmail = "";
  let contactName = "";
  let researchConsent = true;
  let intakeId: string | null = null;

  if (intake) {
    payload = (intake.payload ?? {}) as Record<string, unknown>;
    companyName = intake.company_name ?? "";
    companyWebsite = typeof payload.companyWebsite === "string" ? payload.companyWebsite : "";
    contactEmail = intake.primary_email ?? "";
    contactName = typeof payload.firstName === "string" ? payload.firstName : "";
    researchConsent = payload.researchConsent !== false;
    intakeId = intake.id;
  } else {
    const { data: org } = await admin
      .from("organizations")
      .select("name, website")
      .eq("id", position.organization_id)
      .maybeSingle();

    const { data: user, error: userErr } = await admin.auth.admin.getUserById(position.created_by);
    if (userErr) console.error("[blueprint] getUserById failed", userErr);

    const meta = (user?.user?.user_metadata ?? {}) as Record<string, unknown>;
    companyName = org?.name ?? "";
    companyWebsite = org?.website ?? "";
    contactEmail = user?.user?.email ?? "";
    contactName =
      typeof meta.full_name === "string"
        ? meta.full_name
        : typeof meta.name === "string"
          ? meta.name
          : "";
    researchConsent = true;
    intakeId = null;
  }

  // Download JD file if present.
  let jdFile: { bytes: Uint8Array; mime: string; filename: string } | null = null;
  if (position.jd_file_path) {
    try {
      const { data: blob, error: dlErr } = await admin.storage
        .from("job-descriptions")
        .download(position.jd_file_path);
      if (!dlErr && blob) {
        jdFile = {
          bytes: new Uint8Array(await blob.arrayBuffer()),
          mime: blob.type || "application/pdf",
          filename: position.jd_file_name || "job-description.pdf",
        };
      }
    } catch (err) {
      console.error("[blueprint] jd download failed", err);
    }
  }

  return runBlueprintPipeline({
    positionId: position.id,
    organizationId: position.organization_id,
    intakeId,
    roleTitle: position.title ?? "",
    companyName,
    companyWebsite,
    contactEmail,
    contactName,
    researchConsent,
    jdFile,
    jdPastedText: position.description ?? "",
  });
}

export type { RoleBlueprint, CompanyResearch };
