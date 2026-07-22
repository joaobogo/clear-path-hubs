// LLM-driven CV structuring + safe hydration into candidate_profiles.
// - Uses Lovable AI Gateway (LOVABLE_API_KEY) with a small, fast model.
// - Emits structured fields with confidence.
// - Merge policy:
//     * Never overwrite fields listed in candidate_profiles.consent.locked_fields.
//     * Never overwrite fields whose provenance is "admin_corrected" or "user_confirmed".
//     * Skip fields with confidence < 0.55.
//     * Always stamp provenance under consent.provenance[field].
//
// This module never throws to the caller — a failure returns { ok:false, reason }.

export type Provenance =
  | "candidate_provided"
  | "cv_parsed"
  | "enriched"
  | "admin_corrected"
  | "user_confirmed"
  | "legacy"
  | "inferred";

export type HydrationField = {
  value: unknown;
  confidence: number; // 0..1
  source_snippet?: string;
};

export type StructuredCv = {
  full_name?: HydrationField;
  email?: HydrationField;
  phone?: HydrationField;
  location?: HydrationField;
  headline?: HydrationField;
  summary?: HydrationField;
  years_of_experience?: HydrationField;
  current_role?: HydrationField;
  experience?: HydrationField; // array of {company,title,start,end,summary}
  employers?: HydrationField;  // array of company names
  education?: HydrationField;  // array of {school,degree,field,year}
  skills?: HydrationField;     // array of strings
  languages?: HydrationField;  // array of {name,level}
  certifications?: HydrationField; // array of strings
  work_authorization?: HydrationField;
  industry?: HydrationField;
};

// Bumped when the extraction/hydration contract changes materially.
export const HYDRATION_PARSER_VERSION = "cv-hydration@2026.07.22";

const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";


const SYSTEM = `You extract structured resume data. Output STRICT JSON matching the schema. For every field include a confidence 0..1. If a field is not present, omit it. Do not invent values. Prefer verbatim strings from the CV.`;

const SCHEMA_HINT = `{
  "full_name": {"value": "string", "confidence": 0..1},
  "email":     {"value": "string", "confidence": 0..1},
  "phone":     {"value": "string", "confidence": 0..1},
  "location":  {"value": "string", "confidence": 0..1},
  "headline":  {"value": "string", "confidence": 0..1},
  "summary":   {"value": "string (<=600 chars)", "confidence": 0..1},
  "years_of_experience": {"value": number, "confidence": 0..1},
  "current_role": {"value": "string", "confidence": 0..1},
  "experience": {"value": [{"company":"","title":"","start":"","end":"","summary":""}], "confidence": 0..1},
  "employers":  {"value": ["Company A","Company B"], "confidence": 0..1},
  "education":  {"value": [{"school":"","degree":"","field":"","year":""}], "confidence": 0..1},
  "skills":     {"value": ["skill1","skill2"], "confidence": 0..1},
  "languages":  {"value": [{"name":"English","level":"native"}], "confidence": 0..1},
  "certifications": {"value": ["cert1"], "confidence": 0..1},
  "work_authorization": {"value": "string", "confidence": 0..1},
  "industry":   {"value": "string", "confidence": 0..1}
}`;

export async function structureCv(cvText: string): Promise<{ ok: true; data: StructuredCv } | { ok: false; reason: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false, reason: "no_lovable_api_key" };
  const trimmed = cvText.slice(0, 18_000); // keep context small
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM + "\n\nSchema:\n" + SCHEMA_HINT },
          { role: "user", content: `CV TEXT:\n\n${trimmed}\n\nReturn ONLY JSON.` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: `gateway_${res.status}:${body.slice(0, 160)}` };
    }
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = j.choices?.[0]?.message?.content ?? "";
    if (!content) return { ok: false, reason: "empty_completion" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // last-ditch: pull first JSON object
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) return { ok: false, reason: "non_json_completion" };
      parsed = JSON.parse(m[0]);
    }
    return { ok: true, data: parsed as StructuredCv };
  } catch (e) {
    return { ok: false, reason: `fetch_failed:${(e as Error).message?.slice(0, 120)}` };
  }
}

// ────────────────────────────────────────────────────────────────────────────

const MIN_CONF = 0.55;
const COLUMN_FIELDS = [
  "full_name", "phone", "location", "headline",
  "experience", "skills", "languages", "education", "work_authorization",
] as const;
const CONSENT_FIELDS = [
  "summary", "years_of_experience", "current_role", "employers",
  "certifications", "industry",
] as const;

type Row = Record<string, unknown>;

function isProtected(field: string, consent: Row | null): boolean {
  if (!consent) return false;
  const locked = Array.isArray((consent as Row).locked_fields) ? (consent.locked_fields as string[]) : [];
  if (locked.includes(field)) return true;
  const prov = (consent.provenance as Record<string, { source?: Provenance }> | undefined) ?? {};
  const src = prov[field]?.source;
  return src === "admin_corrected" || src === "user_confirmed";
}

export type HydrationOutcome = {
  ok: boolean;
  applied: string[];
  skipped: Array<{ field: string; reason: string }>;
  reason?: string;
};

export async function hydrateProfileFromCv(opts: {
  candidate_profile_id: string;
  cv_text: string;
  trace_id: string;
  source_surface?: string;
}): Promise<HydrationOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any;

  const { data: profile } = await s
    .from("candidate_profiles")
    .select("id,full_name,email,phone,location,headline,experience,skills,languages,education,work_authorization,consent")
    .eq("id", opts.candidate_profile_id)
    .maybeSingle();
  if (!profile) return { ok: false, applied: [], skipped: [], reason: "profile_not_found" };

  const parsed = await structureCv(opts.cv_text);
  if (!parsed.ok) return { ok: false, applied: [], skipped: [], reason: parsed.reason };

  const consent: Row = (profile.consent as Row) ?? {};
  const provenance: Record<string, unknown> =
    (consent.provenance as Record<string, unknown>) ?? {};

  const columnUpdate: Row = {};
  const consentExtras: Row = { ...(consent.extracted as Row ?? {}) };
  const applied: string[] = [];
  const skipped: Array<{ field: string; reason: string }> = [];

  const stampProvenance = (field: string, conf: number, snippet?: string) => {
    provenance[field] = {
      source: "cv_parsed",
      confidence: Number(conf.toFixed(3)),
      extracted_at: new Date().toISOString(),
      trace_id: opts.trace_id,
      source_surface: opts.source_surface ?? "pipeline",
      parser_version: HYDRATION_PARSER_VERSION,
      snippet: snippet ?? null,
    };
  };


  const isBlank = (v: unknown): boolean =>
    v == null || (typeof v === "string" && v.trim() === "") ||
    (Array.isArray(v) && v.length === 0);

  for (const field of COLUMN_FIELDS) {
    const hf = (parsed.data as Record<string, HydrationField | undefined>)[field];
    if (!hf || hf.value == null) { skipped.push({ field, reason: "not_extracted" }); continue; }
    if ((hf.confidence ?? 0) < MIN_CONF) { skipped.push({ field, reason: "low_confidence" }); continue; }
    if (isProtected(field, consent)) { skipped.push({ field, reason: "protected" }); continue; }
    const existing = (profile as Row)[field];
    if (!isBlank(existing)) { skipped.push({ field, reason: "existing_value_present" }); continue; }
    columnUpdate[field] = hf.value as never;
    stampProvenance(field, hf.confidence ?? 0, hf.source_snippet);
    applied.push(field);
  }

  for (const field of CONSENT_FIELDS) {
    const hf = (parsed.data as Record<string, HydrationField | undefined>)[field];
    if (!hf || hf.value == null) { skipped.push({ field, reason: "not_extracted" }); continue; }
    if ((hf.confidence ?? 0) < MIN_CONF) { skipped.push({ field, reason: "low_confidence" }); continue; }
    if (isProtected(field, consent)) { skipped.push({ field, reason: "protected" }); continue; }
    consentExtras[field] = hf.value as never;
    stampProvenance(field, hf.confidence ?? 0, hf.source_snippet);
    applied.push(field);
  }

  const newConsent: Row = { ...consent, provenance, extracted: consentExtras, hydrated_at: new Date().toISOString() };

  const { error: upErr } = await s
    .from("candidate_profiles")
    .update({ ...columnUpdate, consent: newConsent })
    .eq("id", opts.candidate_profile_id);
  if (upErr) return { ok: false, applied, skipped, reason: `update_failed:${upErr.message}` };

  return { ok: true, applied, skipped };
}
