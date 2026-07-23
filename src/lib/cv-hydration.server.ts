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

export type StructureResult =
  | { ok: true; data: StructuredCv; source: "llm" | "heuristic"; degraded_reason?: string }
  | { ok: false; reason: string };

export async function structureCv(cvText: string): Promise<StructureResult> {
  const key = process.env.LOVABLE_API_KEY;
  const trimmed = cvText.slice(0, 18_000); // keep context small
  if (!key) {
    return { ok: true, data: heuristicStructure(cvText), source: "heuristic", degraded_reason: "no_lovable_api_key" };
  }
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
      // 402/403 credit limit, 429 rate limit, 5xx transient: fall back to heuristic parser so
      // the pipeline keeps making forward progress instead of getting stuck at hydrate=failed.
      if (res.status === 402 || res.status === 403 || res.status === 429 || res.status >= 500) {
        return {
          ok: true,
          data: heuristicStructure(cvText),
          source: "heuristic",
          degraded_reason: `gateway_${res.status}:${body.slice(0, 160)}`,
        };
      }
      return { ok: false, reason: `gateway_${res.status}:${body.slice(0, 160)}` };
    }
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = j.choices?.[0]?.message?.content ?? "";
    if (!content) {
      return { ok: true, data: heuristicStructure(cvText), source: "heuristic", degraded_reason: "empty_completion" };
    }
    const stripped = content
      .replace(/^\uFEFF/, "")
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      const first = stripped.indexOf("{");
      const last = stripped.lastIndexOf("}");
      if (first < 0 || last <= first) {
        return { ok: true, data: heuristicStructure(cvText), source: "heuristic", degraded_reason: "non_json_completion" };
      }
      try {
        parsed = JSON.parse(stripped.slice(first, last + 1));
      } catch {
        return { ok: true, data: heuristicStructure(cvText), source: "heuristic", degraded_reason: "non_json_completion" };
      }
    }
    void trimmed;
    return { ok: true, data: parsed as StructuredCv, source: "llm" };
  } catch (e) {
    return {
      ok: true,
      data: heuristicStructure(cvText),
      source: "heuristic",
      degraded_reason: `fetch_failed:${(e as Error).message?.slice(0, 120)}`,
    };
  }
}

// ─── Heuristic fallback ────────────────────────────────────────────────────
// A pragmatic regex/section parser used when the LLM gateway is unavailable
// (credit limit reached, rate-limited, transient 5xx, missing key). Confidence
// is intentionally modest so admin-corrected values always win.
function heuristicStructure(cvText: string): StructuredCv {
  const text = cvText.replace(/\r\n/g, "\n");
  const out: StructuredCv = {};

  const emailMatch = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (emailMatch) out.email = { value: emailMatch[0], confidence: 0.9, source_snippet: emailMatch[0] };

  const phoneMatch = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  if (phoneMatch) out.phone = { value: phoneMatch[1].trim(), confidence: 0.75, source_snippet: phoneMatch[1] };

  // Full name: first non-empty line that looks like a name (2-4 capitalized words, no digits/@).
  const firstLines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 10);
  for (const line of firstLines) {
    if (line.length > 60 || /[@\d]/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;
    if (words.every((w) => /^[A-ZÀ-Ý][a-zà-ÿ'’.-]+$/.test(w))) {
      out.full_name = { value: line, confidence: 0.7, source_snippet: line };
      break;
    }
  }

  // Location: line containing common location cues near the top.
  for (const line of firstLines) {
    if (/\b(remote|hybrid|based in|located|city|,\s*[A-Z]{2,})\b/i.test(line) && line.length < 80) {
      out.location = { value: line, confidence: 0.55, source_snippet: line };
      break;
    }
  }

  // Headline: line just after name, short and non-contact.
  if (out.full_name) {
    const idx = firstLines.indexOf(out.full_name.value as string);
    for (let i = idx + 1; i < Math.min(idx + 4, firstLines.length); i++) {
      const l = firstLines[i];
      if (!l || l.length > 90 || /[@]/.test(l) || /\d{4}/.test(l)) continue;
      out.headline = { value: l, confidence: 0.6, source_snippet: l };
      break;
    }
  }

  // Skills: look for a "Skills" section and collect comma/bullet separated tokens.
  const skillsSection = text.match(/(?:^|\n)\s*(?:skills|competências|competencies|technical skills)\s*[:\n]([\s\S]{0,1200}?)(?:\n\s*\n|\n[A-Z][A-Z ]{3,}\n|$)/i);
  if (skillsSection) {
    const tokens = skillsSection[1]
      .split(/[,•·\n|/]+/)
      .map((t) => t.replace(/^[-*\s]+/, "").trim())
      .filter((t) => t.length >= 2 && t.length <= 40);
    const uniq = Array.from(new Set(tokens)).slice(0, 30);
    if (uniq.length > 0) out.skills = { value: uniq, confidence: 0.65 };
  }

  // Years of experience: look for "X years" near "experience".
  const yoeMatch = text.match(/(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)/i);
  if (yoeMatch) {
    const n = Number(yoeMatch[1]);
    if (Number.isFinite(n) && n > 0 && n < 60) {
      out.years_of_experience = { value: n, confidence: 0.7, source_snippet: yoeMatch[0] };
    }
  }

  // Summary: first paragraph of 120-600 chars.
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim());
  for (const p of paragraphs) {
    if (p.length >= 120 && p.length <= 600 && !/@/.test(p) && p.split(/\s+/).length > 15) {
      out.summary = { value: p.slice(0, 600), confidence: 0.55 };
      break;
    }
  }

  return out;
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

  const parserSource: "llm" | "heuristic" = parsed.source;
  const degradedReason = parsed.degraded_reason;

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
      parser: parserSource,
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

  const newConsent: Row = {
    ...consent,
    provenance,
    extracted: consentExtras,
    hydrated_at: new Date().toISOString(),
    hydration_parser: parserSource,
    ...(degradedReason ? { hydration_degraded_reason: degradedReason } : {}),
  };

  const { error: upErr } = await s
    .from("candidate_profiles")
    .update({ ...columnUpdate, consent: newConsent })
    .eq("id", opts.candidate_profile_id);
  if (upErr) return { ok: false, applied, skipped, reason: `update_failed:${upErr.message}` };

  return {
    ok: true,
    applied,
    skipped,
    reason: degradedReason ? `degraded:${parserSource}:${degradedReason}` : undefined,
  };
}
