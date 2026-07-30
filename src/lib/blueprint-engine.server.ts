// Role Blueprint engine — server only.
//
// Takes the two things an employer actually gives us in express onboarding (a
// job title and a job description) plus permitted public information from
// their website, and produces the full set of answers the long intake used to
// ask for: role definition, candidate profile, compensation, geography,
// timeline, scoring rubric, screening questions and a sourcing plan.
//
// Every generated value is marked with where it came from so a human can see
// what was read from the JD, what came from the website, and what the system
// inferred. Nothing here ever throws — the pipeline records a failure state
// the dashboards can show and a human can retry.

import { extractCvText } from "./cv-extractor.server";
import {
  DEFAULT_WEIGHTS,
  WEIGHT_DIMENSIONS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type WeightKey,
} from "./requisition-schema";
import { SCREENING_MAX_QUESTIONS, SCREENING_MAX_REQUIRED } from "./screening-limits";

export const BLUEPRINT_VERSION = "role-blueprint@2026.07.30";
const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type FieldSource = "job_description" | "company_website" | "inferred";

export interface BlueprintScreeningQuestion {
  question: string;
  answer_type: "text" | "boolean" | "number" | "single_choice" | "multi_choice";
  required: boolean;
  dealbreaker: boolean;
  rationale?: string;
}

export interface RoleBlueprint {
  version: string;
  generated_at: string;
  model: string;
  role: {
    title: string;
    department: string;
    seniority: string;
    work_model: "remote" | "hybrid" | "onsite";
    employment_type: "full_time" | "part_time" | "contract" | "temporary" | "internship" | "";
    location: string;
    headcount: number;
    summary: string;
  };
  company: {
    name: string;
    website: string;
    industry: string;
    size: string;
    headquarters: string;
    summary: string;
    value_proposition: string;
  };
  responsibilities: string[];
  must_have_skills: string[];
  nice_to_have_skills: string[];
  tools_platforms: string[];
  certifications: string[];
  candidate_profile: {
    experience: string;
    education: string;
    languages: string;
    industry_experience: string;
    work_authorization: string;
  };
  compensation: { currency: string; min: number | null; max: number | null; note: string };
  geography: {
    open_worldwide: boolean;
    target_countries: string[];
    timezone_requirements: string;
    travel_expectation: string;
  };
  timeline: { hiring_urgency: string; target_start_date: string; time_to_hire: string };
  dealbreakers: string[];
  rubric: { weights: Record<WeightKey, number>; rationale: string };
  screening_questions: BlueprintScreeningQuestion[];
  sourcing_plan: {
    target_titles: string[];
    target_company_types: string[];
    include_keywords: string[];
    exclude_keywords: string[];
    disqualifiers: string[];
    channels: string[];
    outreach_angle: string;
  };
  field_sources: Record<string, FieldSource>;
  assumptions: string[];
  open_questions: string[];
  confidence: { overall: number; low_confidence_fields: string[] };
}

/* ------------------------------------------------------------------ */
/* Job description text                                                */
/* ------------------------------------------------------------------ */

export async function readJobDescription(args: {
  pastedText?: string | null;
  file?: { bytes: Uint8Array; mime: string; filename: string } | null;
}): Promise<{ text: string; source: "pasted" | "file" | "none"; reason?: string }> {
  const pasted = (args.pastedText ?? "").trim();
  if (args.file) {
    const res = await extractCvText(args.file.bytes, args.file.mime, args.file.filename);
    const fromFile = (res.text ?? "").trim();
    if (fromFile.length >= 80) return { text: fromFile, source: "file" };
    if (pasted.length >= 80) return { text: pasted, source: "pasted", reason: res.reason };
    return { text: fromFile || pasted, source: "file", reason: res.reason ?? "jd_text_too_short" };
  }
  if (pasted.length > 0) return { text: pasted, source: "pasted" };
  return { text: "", source: "none", reason: "no_job_description" };
}

/* ------------------------------------------------------------------ */
/* Permitted public company research                                   */
/* ------------------------------------------------------------------ */

const BLOCKED_HOST = /(^|\.)(localhost|internal|local|test|localdomain)$/i;

function normalizeSiteUrl(raw: string): URL | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname;
    // Block loopback, link-local, private ranges and raw IP literals — never
    // let a submitted URL reach anything but a public, named host.
    if (BLOCKED_HOST.test(host)) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    if (host.startsWith("[") || host.includes(":")) return null; // IPv6 literal
    if (host.endsWith(".internal") || !host.includes(".")) return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface CompanyResearch {
  ok: boolean;
  url: string | null;
  pages: string[];
  text: string;
  fetched_at: string;
  reason?: string;
}

/** Reads only publicly served pages, honours robots.txt disallow-all, and caps size. */
export async function researchCompany(website: string): Promise<CompanyResearch> {
  const base = normalizeSiteUrl(website);
  const now = new Date().toISOString();
  if (!base) return { ok: false, url: null, pages: [], text: "", fetched_at: now, reason: "no_website" };

  const get = async (url: string): Promise<string | null> => {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(url, {
        redirect: "follow",
        signal: ctl.signal,
        headers: { "User-Agent": "TaaSFlowBot/1.0 (+https://taasflow.com)", Accept: "text/html" },
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (!type.includes("html") && !type.includes("text/plain")) return null;
      const raw = await res.text();
      return raw.slice(0, 400_000);
    } catch {
      return null;
    }
  };

  // Respect a blanket robots.txt disallow.
  const robots = await get(new URL("/robots.txt", base).toString());
  if (robots && /User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*(\n|$)/i.test(robots)) {
    return { ok: false, url: base.toString(), pages: [], text: "", fetched_at: now, reason: "robots_disallow" };
  }

  const candidates = [base.toString(), new URL("/about", base).toString(), new URL("/careers", base).toString()];
  const pages: string[] = [];
  const chunks: string[] = [];
  for (const url of candidates) {
    const html = await get(url);
    if (!html) continue;
    const text = htmlToText(html);
    if (text.length < 120) continue;
    pages.push(url);
    chunks.push(`# ${url}\n${text.slice(0, 6000)}`);
    if (chunks.join("\n\n").length > 14000) break;
  }

  if (chunks.length === 0) {
    return { ok: false, url: base.toString(), pages: [], text: "", fetched_at: now, reason: "no_readable_pages" };
  }
  return { ok: true, url: base.toString(), pages, text: chunks.join("\n\n").slice(0, 16000), fetched_at: now };
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

const SYSTEM = `You are a senior recruitment operations analyst at TaaSFlow.

You receive a job title, a job description, and (sometimes) public text from the employer's own website. From these you must fill in a complete hiring brief that a recruiter would otherwise collect in a long intake call.

Non-negotiables:
- Prefer facts stated in the job description. Use the company website only for company context (industry, size, headquarters, what they do, employer value proposition).
- When neither source states something, make a clearly reasonable, conservative inference and record the field name in "confidence.low_confidence_fields" and note it in "assumptions".
- NEVER invent salary figures, headcount, legal entities, benefits, or start dates that are not stated. Leave numeric compensation null and the note empty if unknown.
- "field_sources" maps each top-level field name to exactly one of: "job_description", "company_website", "inferred".
- Screening questions: at most ${SCREENING_MAX_QUESTIONS} in total and at most ${SCREENING_MAX_REQUIRED} marked required. Mark a question "dealbreaker" only for a genuine hard filter (e.g. work authorisation, licence, non-negotiable language).
- Scoring weights: use exactly the keys ${WEIGHT_DIMENSIONS.map((d) => d.key).join(", ")}. Integers only, each between ${WEIGHT_MIN} and ${WEIGHT_MAX}, summing to 100, tuned to what this specific role actually needs.
- "open_questions" are the 3-6 things a recruiter should confirm with the client before sourcing starts.
- Write in plain, professional English. No marketing language, no filler.

Return ONLY a JSON object matching the requested shape.`;

function shapeHint(): string {
  return JSON.stringify(
    {
      role: {
        title: "string",
        department: "string",
        seniority: "junior|mid|senior|lead|executive",
        work_model: "remote|hybrid|onsite",
        employment_type: "full_time|part_time|contract|temporary|internship|",
        location: "string",
        headcount: 1,
        summary: "2-3 sentence plain description of the role",
      },
      company: {
        name: "string",
        website: "string",
        industry: "string",
        size: "string",
        headquarters: "string",
        summary: "string",
        value_proposition: "string",
      },
      responsibilities: ["string"],
      must_have_skills: ["string"],
      nice_to_have_skills: ["string"],
      tools_platforms: ["string"],
      certifications: ["string"],
      candidate_profile: {
        experience: "string",
        education: "string",
        languages: "string",
        industry_experience: "string",
        work_authorization: "string",
      },
      compensation: { currency: "string", min: null, max: null, note: "string" },
      geography: {
        open_worldwide: false,
        target_countries: ["string"],
        timezone_requirements: "string",
        travel_expectation: "string",
      },
      timeline: { hiring_urgency: "string", target_start_date: "", time_to_hire: "string" },
      dealbreakers: ["string"],
      rubric: { weights: DEFAULT_WEIGHTS, rationale: "string" },
      screening_questions: [
        {
          question: "string",
          answer_type: "text|boolean|number|single_choice|multi_choice",
          required: true,
          dealbreaker: false,
          rationale: "string",
        },
      ],
      sourcing_plan: {
        target_titles: ["string"],
        target_company_types: ["string"],
        include_keywords: ["string"],
        exclude_keywords: ["string"],
        disqualifiers: ["string"],
        channels: ["string"],
        outreach_angle: "string",
      },
      field_sources: { responsibilities: "job_description" },
      assumptions: ["string"],
      open_questions: ["string"],
      confidence: { overall: 0.8, low_confidence_fields: ["string"] },
    },
    null,
    2,
  );
}

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
}

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function arr(v: unknown, max = 24, itemMax = 200): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim().slice(0, itemMax) : ""))
    .filter(Boolean)
    .slice(0, max);
}
function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Clamp to the product's rules: bounded per dimension, always summing to 100. */
export function normalizeWeights(raw: unknown): Record<WeightKey, number> {
  const source = (raw ?? {}) as Record<string, unknown>;
  const out = {} as Record<WeightKey, number>;
  for (const d of WEIGHT_DIMENSIONS) {
    const n = Number(source[d.key]);
    out[d.key] = Number.isFinite(n)
      ? Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(n)))
      : DEFAULT_WEIGHTS[d.key];
  }
  let total = Object.values(out).reduce((a, b) => a + b, 0);
  const keys = WEIGHT_DIMENSIONS.map((d) => d.key);
  let guard = 0;
  while (total !== 100 && guard++ < 200) {
    const dir = total > 100 ? -1 : 1;
    for (const k of keys) {
      const next = out[k] + dir;
      if (next < WEIGHT_MIN || next > WEIGHT_MAX) continue;
      out[k] = next;
      total += dir;
      if (total === 100) break;
    }
  }
  return out;
}

function normalizeScreening(raw: unknown): BlueprintScreeningQuestion[] {
  if (!Array.isArray(raw)) return [];
  const allowedTypes = new Set(["text", "boolean", "number", "single_choice", "multi_choice"]);
  const out: BlueprintScreeningQuestion[] = [];
  let required = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    const question = str(q.question, 500);
    if (question.length < 3) continue;
    const type = str(q.answer_type, 40);
    const wantsRequired = q.required === true;
    const isRequired = wantsRequired && required < SCREENING_MAX_REQUIRED;
    if (isRequired) required += 1;
    out.push({
      question,
      answer_type: (allowedTypes.has(type) ? type : "text") as BlueprintScreeningQuestion["answer_type"],
      required: isRequired,
      dealbreaker: q.dealbreaker === true,
      rationale: str(q.rationale, 300) || undefined,
    });
    if (out.length >= SCREENING_MAX_QUESTIONS) break;
  }
  return out;
}

function normalizeBlueprint(parsed: Record<string, unknown>, fallback: { title: string; company: string; website: string }): RoleBlueprint {
  const role = (parsed.role ?? {}) as Record<string, unknown>;
  const company = (parsed.company ?? {}) as Record<string, unknown>;
  const profile = (parsed.candidate_profile ?? {}) as Record<string, unknown>;
  const comp = (parsed.compensation ?? {}) as Record<string, unknown>;
  const geo = (parsed.geography ?? {}) as Record<string, unknown>;
  const time = (parsed.timeline ?? {}) as Record<string, unknown>;
  const rubric = (parsed.rubric ?? {}) as Record<string, unknown>;
  const sourcing = (parsed.sourcing_plan ?? {}) as Record<string, unknown>;
  const conf = (parsed.confidence ?? {}) as Record<string, unknown>;

  const workModel = str(role.work_model, 20).toLowerCase();
  const empType = str(role.employment_type, 24).toLowerCase();

  const sources: Record<string, FieldSource> = {};
  const rawSources = (parsed.field_sources ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(rawSources)) {
    const val = str(v, 40);
    if (val === "job_description" || val === "company_website" || val === "inferred") {
      sources[k.slice(0, 60)] = val;
    }
  }

  return {
    version: BLUEPRINT_VERSION,
    generated_at: new Date().toISOString(),
    model: MODEL,
    role: {
      title: str(role.title, 160) || fallback.title,
      department: str(role.department, 120),
      seniority: str(role.seniority, 40),
      work_model: (["remote", "hybrid", "onsite"].includes(workModel) ? workModel : "remote") as
        | "remote"
        | "hybrid"
        | "onsite",
      employment_type: (["full_time", "part_time", "contract", "temporary", "internship"].includes(empType)
        ? empType
        : "") as RoleBlueprint["role"]["employment_type"],
      location: str(role.location, 160),
      headcount: Math.min(99, Math.max(1, num(role.headcount) ?? 1)),
      summary: str(role.summary, 1200),
    },
    company: {
      name: str(company.name, 160) || fallback.company,
      website: str(company.website, 255) || fallback.website,
      industry: str(company.industry, 120),
      size: str(company.size, 60),
      headquarters: str(company.headquarters, 160),
      summary: str(company.summary, 1500),
      value_proposition: str(company.value_proposition, 2000),
    },
    responsibilities: arr(parsed.responsibilities, 20, 400),
    must_have_skills: arr(parsed.must_have_skills, 20, 120),
    nice_to_have_skills: arr(parsed.nice_to_have_skills, 20, 120),
    tools_platforms: arr(parsed.tools_platforms, 24, 120),
    certifications: arr(parsed.certifications, 12, 160),
    candidate_profile: {
      experience: str(profile.experience, 400),
      education: str(profile.education, 400),
      languages: str(profile.languages, 400),
      industry_experience: str(profile.industry_experience, 400),
      work_authorization: str(profile.work_authorization, 300),
    },
    compensation: {
      currency: str(comp.currency, 8),
      min: num(comp.min),
      max: num(comp.max),
      note: str(comp.note, 400),
    },
    geography: {
      open_worldwide: geo.open_worldwide === true,
      target_countries: arr(geo.target_countries, 20, 80),
      timezone_requirements: str(geo.timezone_requirements, 200),
      travel_expectation: str(geo.travel_expectation, 160),
    },
    timeline: {
      hiring_urgency: str(time.hiring_urgency, 80),
      target_start_date: str(time.target_start_date, 40),
      time_to_hire: str(time.time_to_hire, 80),
    },
    dealbreakers: arr(parsed.dealbreakers, 12, 200),
    rubric: { weights: normalizeWeights(rubric.weights), rationale: str(rubric.rationale, 1200) },
    screening_questions: normalizeScreening(parsed.screening_questions),
    sourcing_plan: {
      target_titles: arr(sourcing.target_titles, 16, 160),
      target_company_types: arr(sourcing.target_company_types, 12, 120),
      include_keywords: arr(sourcing.include_keywords, 20, 120),
      exclude_keywords: arr(sourcing.exclude_keywords, 20, 120),
      disqualifiers: arr(sourcing.disqualifiers, 12, 160),
      channels: arr(sourcing.channels, 10, 120),
      outreach_angle: str(sourcing.outreach_angle, 1200),
    },
    field_sources: sources,
    assumptions: arr(parsed.assumptions, 12, 300),
    open_questions: arr(parsed.open_questions, 8, 300),
    confidence: {
      overall: Math.min(1, Math.max(0, Number(conf.overall) || 0.6)),
      low_confidence_fields: arr(conf.low_confidence_fields, 20, 60),
    },
  };
}

export type BlueprintResult =
  | { ok: true; blueprint: RoleBlueprint }
  | { ok: false; reason: string };

export async function generateBlueprint(args: {
  roleTitle: string;
  companyName: string;
  companyWebsite: string;
  jobDescription: string;
  research: CompanyResearch | null;
}): Promise<BlueprintResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false, reason: "missing_api_key" };

  const userMsg = [
    `JOB TITLE: ${args.roleTitle}`,
    `COMPANY: ${args.companyName}`,
    args.companyWebsite ? `WEBSITE: ${args.companyWebsite}` : "",
    "",
    "JOB DESCRIPTION:",
    args.jobDescription.slice(0, 40000) || "(none provided)",
    "",
    args.research?.ok
      ? `PUBLIC COMPANY WEBSITE TEXT (for company context only):\n${args.research.text}`
      : "PUBLIC COMPANY WEBSITE TEXT: (unavailable — do not guess company facts)",
    "",
    "Return JSON in exactly this shape:",
    shapeHint(),
  ]
    .filter(Boolean)
    .join("\n");

  let res: Response;
  try {
    res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
  } catch (e) {
    return { ok: false, reason: `gateway_unreachable:${(e as Error).message?.slice(0, 120)}` };
  }

  if (res.status === 429) return { ok: false, reason: "rate_limited" };
  if (res.status === 402) return { ok: false, reason: "ai_credits_exhausted" };
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, reason: `gateway_${res.status}:${body.slice(0, 160)}` };
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) return { ok: false, reason: "empty_completion" };

  const stripped = stripFences(content);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const first = stripped.indexOf("{");
    const last = stripped.lastIndexOf("}");
    if (first < 0 || last <= first) return { ok: false, reason: "non_json_completion" };
    try {
      parsed = JSON.parse(stripped.slice(first, last + 1));
    } catch {
      return { ok: false, reason: "non_json_completion" };
    }
  }

  return {
    ok: true,
    blueprint: normalizeBlueprint(parsed, {
      title: args.roleTitle,
      company: args.companyName,
      website: args.companyWebsite,
    }),
  };
}
