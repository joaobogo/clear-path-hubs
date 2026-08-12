// Canonical requisition (job) domain schema shared by client wizard and server.
// Structured fields live here; free-text job description stays a separate field
// and never substitutes for structured decision-critical data.
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export const COUNTRIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "AE", name: "United Arab Emirates" },
  { code: "AR", name: "Argentina" },
  { code: "AT", name: "Austria" },
  { code: "AU", name: "Australia" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CH", name: "Switzerland" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "CZ", name: "Czechia" },
  { code: "DE", name: "Germany" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "EG", name: "Egypt" },
  { code: "ES", name: "Spain" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong SAR" },
  { code: "HR", name: "Croatia" },
  { code: "HU", name: "Hungary" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IN", name: "India" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "KR", name: "South Korea" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "LV", name: "Latvia" },
  { code: "MA", name: "Morocco" },
  { code: "MX", name: "Mexico" },
  { code: "MY", name: "Malaysia" },
  { code: "NG", name: "Nigeria" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "NZ", name: "New Zealand" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RS", name: "Serbia" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SE", name: "Sweden" },
  { code: "SG", name: "Singapore" },
  { code: "SI", name: "Slovenia" },
  { code: "SK", name: "Slovakia" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Türkiye" },
  { code: "TW", name: "Taiwan" },
  { code: "UA", name: "Ukraine" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "VN", name: "Vietnam" },
  { code: "ZA", name: "South Africa" },
  { code: "XX", name: "Unspecified / legacy" },
];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c.name]));
export const countryName = (code: string) => COUNTRY_BY_CODE.get(code) ?? code;

export const TRAVEL_EXPECTATIONS = [
  { value: "none", label: "No travel" },
  { value: "occasional", label: "Occasional (up to 10%)" },
  { value: "regular", label: "Regular (10–25%)" },
  { value: "frequent", label: "Frequent (25–50%)" },
  { value: "extensive", label: "Extensive (50%+)" },
] as const;

export const COMPENSATION_VISIBILITY = [
  { value: "internal", label: "TaaSFlow team only" },
  { value: "client", label: "Client hiring team" },
  { value: "public", label: "Shown on the job board" },
] as const;

/* ------------------------------------------------------------------ */
/* Evaluation priorities (client-adjustable weights)                   */
/* ------------------------------------------------------------------ */

export const WEIGHT_DIMENSIONS = [
  { key: "skills", label: "Skills & tools", help: "Depth of the must-have technical/functional skills." },
  { key: "experience", label: "Relevant experience", help: "Years and scope in comparable roles." },
  { key: "industry", label: "Industry context", help: "Familiarity with your sector and its constraints." },
  { key: "seniority", label: "Seniority & scope", help: "Ownership level, team size, decision scope." },
  { key: "credentials", label: "Credentials & licences", help: "Degrees, certifications, regulated licences." },
  { key: "language", label: "Languages", help: "Working-language proficiency." },
  { key: "logistics", label: "Location & logistics", help: "Location, work model, timezone overlap, travel." },
] as const;

export type WeightKey = (typeof WEIGHT_DIMENSIONS)[number]["key"];

/** Safe limits: no single dimension can dominate or be zeroed out. */
export const WEIGHT_MIN = 5;
export const WEIGHT_MAX = 35;
export const DEFAULT_WEIGHTS: Record<WeightKey, number> = {
  skills: 25,
  experience: 20,
  industry: 15,
  seniority: 15,
  credentials: 10,
  language: 8,
  logistics: 7,
};

export const weightsSchema = z
  .record(z.string(), z.number())
  .transform((raw) => {
    const out = {} as Record<WeightKey, number>;
    for (const d of WEIGHT_DIMENSIONS) {
      const v = Number(raw[d.key]);
      out[d.key] = Number.isFinite(v) ? Math.round(v) : DEFAULT_WEIGHTS[d.key];
    }
    return out;
  })
  .superRefine((w, ctx) => {
    for (const d of WEIGHT_DIMENSIONS) {
      if (w[d.key] < WEIGHT_MIN || w[d.key] > WEIGHT_MAX) {
        ctx.addIssue({
          code: "custom",
          message: `${d.label} must stay between ${WEIGHT_MIN}% and ${WEIGHT_MAX}% so no single signal can dominate the evaluation.`,
        });
      }
    }
  });

export type EvaluationWeights = Record<WeightKey, number>;

export function normalizeWeights(input: Partial<Record<string, unknown>> | null | undefined): EvaluationWeights {
  const out = { ...DEFAULT_WEIGHTS };
  if (input && typeof input === "object") {
    for (const d of WEIGHT_DIMENSIONS) {
      const v = Number((input as Record<string, unknown>)[d.key]);
      if (Number.isFinite(v)) out[d.key] = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(v)));
    }
  }
  return out;
}

/** Rescale to exactly 100 while respecting the per-dimension safe band. */
export function balanceWeights(input: EvaluationWeights): EvaluationWeights {
  const keys = WEIGHT_DIMENSIONS.map((d) => d.key);
  const out = { ...input };
  for (let guard = 0; guard < 50; guard++) {
    const total = keys.reduce((sum, k) => sum + out[k], 0);
    const diff = 100 - total;
    if (diff === 0) return out;
    const adjustable = keys.filter((k) =>
      diff > 0 ? out[k] < WEIGHT_MAX : out[k] > WEIGHT_MIN,
    );
    if (adjustable.length === 0) return out;
    const step = diff > 0 ? 1 : -1;
    for (const k of adjustable) {
      const total2 = keys.reduce((sum, kk) => sum + out[kk], 0);
      if (total2 === 100) break;
      out[k] += step;
    }
  }
  return out;
}

export function explainWeights(w: EvaluationWeights): string {
  const ranked = [...WEIGHT_DIMENSIONS].sort((a, b) => w[b.key] - w[a.key]);
  const top = ranked.slice(0, 2).map((d) => `${d.label} (${w[d.key]}%)`);
  const low = ranked[ranked.length - 1];
  return `Shortlists lead with ${top.join(" and ")}; ${low.label} carries the least weight (${w[low.key]}%). Every dimension keeps at least ${WEIGHT_MIN}% so a candidate can never be ranked on one signal alone.`;
}

/* ------------------------------------------------------------------ */
/* Locations                                                           */
/* ------------------------------------------------------------------ */

export const locationSchema = z.object({
  id: z.string().uuid().optional(),
  country_code: z.string().trim().length(2).toUpperCase(),
  region: z.string().trim().max(120).default(""),
  city: z.string().trim().max(120).default(""),
  work_model: z.enum(["remote", "hybrid", "onsite"]),
  is_primary: z.boolean().default(false),
  headcount: z.number().int().min(1).max(999).nullable().default(null),
  timezone: z.string().trim().max(80).default(""),
  onsite_days_per_week: z.number().int().min(0).max(7).nullable().default(null),
  notes: z.string().trim().max(500).default(""),
});

export type RequisitionLocation = z.infer<typeof locationSchema>;

export function locationLabel(l: Pick<RequisitionLocation, "country_code" | "region" | "city">) {
  return [l.city, l.region, countryName(l.country_code)].filter(Boolean).join(", ");
}

/* ------------------------------------------------------------------ */
/* Requisition meta (the Phase 8 structured layer)                     */
/* ------------------------------------------------------------------ */

export const requisitionMetaSchema = z
  .object({
    position_id: z.string().uuid(),
    reference_code: z
      .string()
      .trim()
      .max(40)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Use letters, numbers, dot, dash, slash or underscore")
      .or(z.literal(""))
      .default(""),
    owner_user_id: z.string().uuid().nullable().default(null),
    travel_expectation: z
      .enum(["none", "occasional", "regular", "frequent", "extensive", ""])
      .default(""),
    primary_timezone: z.string().trim().max(80).default(""),
    timezone_overlap_hours: z.number().int().min(0).max(12).nullable().default(null),
    target_start_date: z.string().trim().max(20).default(""),
    compensation_collected: z.boolean().default(false),
    compensation_visibility: z.enum(["internal", "client", "public"]).default("internal"),
    currency: z.string().trim().max(8).default("USD"),
    budget_min: z.string().trim().max(20).default(""),
    budget_max: z.string().trim().max(20).default(""),
    evaluation_weights: weightsSchema,
    locations: z.array(locationSchema).max(40).default([]),
    /** required when a scoring-relevant change is detected server-side */
    change_reason: z.string().trim().max(500).default(""),
  })
  .superRefine((v, ctx) => {
    const remoteOnly = v.locations.length > 0 && v.locations.every((l) => l.work_model === "remote");
    if (v.locations.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["locations"],
        message: "Add at least one location — fully remote roles still need the countries you can hire in.",
      });
    }
    if (v.locations.filter((l) => l.is_primary).length > 1) {
      ctx.addIssue({ code: "custom", path: ["locations"], message: "Only one location can be primary." });
    }
    const seen = new Set<string>();
    for (const l of v.locations) {
      const key = `${l.country_code}|${l.region.toLowerCase()}|${l.city.toLowerCase()}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["locations"], message: `Duplicate location: ${locationLabel(l)}` });
      }
      seen.add(key);
      if (l.work_model !== "remote" && !l.city.trim() && !l.region.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["locations"],
          message: `${countryName(l.country_code)} is ${l.work_model} — add a city or region so candidates know where to show up.`,
        });
      }
      if (l.work_model === "hybrid" && l.onsite_days_per_week === null) {
        ctx.addIssue({
          code: "custom",
          path: ["locations"],
          message: `${locationLabel(l)} is hybrid — set how many days per week are on-site.`,
        });
      }
      if (l.work_model === "remote" && l.onsite_days_per_week !== null && l.onsite_days_per_week > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["locations"],
          message: `${locationLabel(l)} is remote but requires on-site days — use hybrid instead.`,
        });
      }
    }
    if (remoteOnly && v.timezone_overlap_hours === null && !v.primary_timezone.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["primary_timezone"],
        message: "Fully remote roles need a timezone anchor or a required overlap window.",
      });
    }
    if (v.compensation_collected) {
      const min = Number(v.budget_min.replace(/[^\d.]/g, ""));
      const max = Number(v.budget_max.replace(/[^\d.]/g, ""));
      if (!v.budget_min.trim() || !v.budget_max.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["budget_min"],
          message: "Compensation is marked as collected — record the range or switch the toggle off.",
        });
      } else if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
        ctx.addIssue({ code: "custom", path: ["budget_max"], message: "Maximum must be at least the minimum." });
      }
    }
    if (v.target_start_date && Number.isNaN(Date.parse(v.target_start_date))) {
      ctx.addIssue({ code: "custom", path: ["target_start_date"], message: "Invalid date." });
    }
  });

export type RequisitionMetaInput = z.input<typeof requisitionMetaSchema>;

/* ------------------------------------------------------------------ */
/* Job quality — missing decision-critical information, not a % guess  */
/* ------------------------------------------------------------------ */

export type QualityGapSeverity = "blocking" | "degrades" | "optional";

export type QualityGap = {
  id: string;
  severity: QualityGapSeverity;
  label: string;
  why: string;
  step?: number;
};

export type QualityInput = {
  title: string;
  description: string;
  seniority: string;
  employment_type: string;
  department: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  disqualifier_tags: string[];
  responsibilities: string;
  experience: string;
  interview_process: string;
  screening_questions: unknown[];
  locations: RequisitionLocation[];
  travel_expectation: string;
  primary_timezone: string;
  timezone_overlap_hours: number | null;
  target_start_date: string;
  headcount: number | "" | null;
  owner_user_id: string | null;
  reference_code: string;
  compensation_collected: boolean;
};

export function assessJobQuality(i: QualityInput): {
  gaps: QualityGap[];
  blocking: QualityGap[];
  degrades: QualityGap[];
  optional: QualityGap[];
  readiness: "not_scoreable" | "scoreable_with_gaps" | "decision_ready";
  summary: string;
} {
  const gaps: QualityGap[] = [];
  const add = (g: QualityGap) => gaps.push(g);

  if (i.title.trim().length < 3)
    add({ id: "title", severity: "blocking", label: "Job title", why: "Nothing can be matched without the role being named.", step: 1 });
  if (i.must_have_skills.length < 3)
    add({ id: "must_haves", severity: "blocking", label: "At least 3 must-have requirements", why: "Must-haves are the backbone of evidence-based scoring; fewer than three makes ranking arbitrary.", step: 2 });
  if (!i.seniority.trim())
    add({ id: "seniority", severity: "blocking", label: "Seniority level", why: "Scope and level decide whether strong candidates are over- or under-qualified.", step: 1 });
  if (i.locations.length === 0)
    add({ id: "locations", severity: "blocking", label: "At least one location", why: "Eligibility gates (right to work, timezone, commute) cannot run without locations.", step: 5 });
  if (!i.employment_type.trim())
    add({ id: "employment_type", severity: "blocking", label: "Employment type", why: "Contract vs permanent changes both the candidate pool and the eligibility checks.", step: 1 });

  if (i.disqualifier_tags.length === 0)
    add({ id: "disqualifiers", severity: "degrades", label: "Disqualifiers / critical gates", why: "Without hard gates, unsuitable candidates reach your shortlist and dilute it.", step: 4 });
  if (!i.experience.trim())
    add({ id: "experience", severity: "degrades", label: "Required experience", why: "Experience bands anchor the seniority signal in scoring.", step: 2 });
  if (i.responsibilities.trim().length < 40 && i.description.trim().length < 120)
    add({ id: "outcomes", severity: "degrades", label: "Role outcomes / responsibilities", why: "Outcomes let evidence extraction look for what this person must actually deliver.", step: 2 });
  const needsTz = i.locations.some((l) => l.work_model === "remote");
  if (needsTz && !i.primary_timezone.trim() && i.timezone_overlap_hours === null)
    add({ id: "timezone", severity: "degrades", label: "Timezone anchor or overlap", why: "Remote hiring across countries fails on collaboration hours more often than on skills.", step: 5 });
  if (!i.headcount)
    add({ id: "headcount", severity: "degrades", label: "Hiring volume", why: "Volume drives pipeline sizing and delivery commitments.", step: 1 });
  if (!i.owner_user_id)
    add({ id: "owner", severity: "degrades", label: "Responsible admin", why: "Unowned requisitions stall — nobody is accountable for delivery.", step: 5 });

  if (!i.travel_expectation.trim())
    add({ id: "travel", severity: "optional", label: "Travel expectations", why: "Surfacing travel early avoids late-stage drop-off.", step: 5 });
  if (!i.target_start_date.trim())
    add({ id: "start_date", severity: "optional", label: "Target start date", why: "Notice periods can quietly disqualify otherwise perfect candidates.", step: 1 });
  if (!i.interview_process.trim())
    add({ id: "interview_process", severity: "optional", label: "Interview process", why: "Candidates convert better when the process is known upfront.", step: 4 });
  if (i.screening_questions.length === 0)
    add({ id: "screening", severity: "optional", label: "Screening questions", why: "Role-specific questions capture evidence a CV never contains.", step: 4 });
  if (!i.department.trim())
    add({ id: "department", severity: "optional", label: "Department / function", why: "Used for grouping, reporting and internal routing.", step: 1 });
  if (i.nice_to_have_skills.length === 0)
    add({ id: "nice_to_have", severity: "optional", label: "Preferred requirements", why: "Preferred signals separate good from great once must-haves are met.", step: 2 });

  const blocking = gaps.filter((g) => g.severity === "blocking");
  const degrades = gaps.filter((g) => g.severity === "degrades");
  const optional = gaps.filter((g) => g.severity === "optional");

  const readiness = blocking.length > 0 ? "not_scoreable" : degrades.length > 0 ? "scoreable_with_gaps" : "decision_ready";

  const summary =
    readiness === "not_scoreable"
      ? `Not scoreable yet — ${blocking.length} decision-critical item${blocking.length === 1 ? "" : "s"} missing.`
      : readiness === "scoreable_with_gaps"
        ? `Scoreable, but ${degrades.length} gap${degrades.length === 1 ? "" : "s"} will weaken shortlist accuracy.`
        : "Decision-ready — every field scoring depends on is present.";

  return { gaps, blocking, degrades, optional, readiness, summary };
}
