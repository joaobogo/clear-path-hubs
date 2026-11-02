/**
 * Additive profile backfill: parsed CV facts → candidate_profiles columns.
 *
 * CV hydration keeps some of what it parses only under
 * `candidate_profiles.consent.extracted` (certifications, years_of_experience,
 * summary, employers…). The client workspace reads the profile COLUMNS, so a
 * certificate the parser found never reached anyone: Vijay's two mushroom
 * courses, Daim's IOSH and LANTRA, Anna's twelve (HACCP, FSSC…) and Chiedza's
 * driving licence were all parsed and all invisible (Hughes research, item 5).
 *
 * The plan here only ever fills a gap. A profile field that already holds a
 * value — entered by the candidate, a recruiter, or an earlier parse — is never
 * replaced, and a field a person locked or corrected is never touched even when
 * it is empty (an admin who cleared a wrong certificate list keeps it cleared).
 * Scoring reads the CV text, not these columns, so nothing here moves a score.
 */
import type { ParsedCvFacts } from "./parse-facts";

/** The shape the client DTO reads (`toClientCandidateDTO` in client-kpi.server). */
export type ProfileCertification = { name: string; issuer: string | null; date: string | null };

/** The candidate profile editor's own cap (candidate.functions.ts `profileSchema`). */
const MAX_CERTIFICATIONS = 50;
const MAX_CERT_TEXT = 200;

type Row = Record<string, unknown>;

function cleanText(v: unknown, max = MAX_CERT_TEXT): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

/**
 * Parser certifications (strings, or objects with name/title, issuer/
 * organization/authority, date/issued/year) → `{ name, issuer, date }`.
 * Blank entries are dropped and repeats (same name, any case) kept once.
 */
export function normalizeParsedCertifications(raw: unknown): ProfileCertification[] {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const out: ProfileCertification[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    let cert: ProfileCertification | null = null;
    if (typeof item === "string") {
      const name = cleanText(item);
      cert = name ? { name, issuer: null, date: null } : null;
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Row;
      const name = cleanText(o.name ?? o.title ?? o.certification);
      cert = name
        ? {
            name,
            issuer: cleanText(o.issuer ?? o.organization ?? o.authority ?? o.issued_by),
            date: cleanText(o.date ?? o.issued ?? o.year, 40),
          }
        : null;
    }
    if (!cert) continue;
    const key = cert.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cert);
    if (out.length >= MAX_CERTIFICATIONS) break;
  }
  return out;
}

/**
 * Parser years of experience → a whole number for the integer column, or null.
 * Rounds down (4.6 years is "4 yrs", never an overstated "5") and keeps the
 * same 1..60 range the deterministic extractor accepts.
 */
export function normalizeParsedYears(raw: unknown): number | null {
  let n: number | null = null;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string") {
    const m = raw.trim().match(/^(\d{1,2}(?:\.\d+)?)\s*\+?$/);
    if (m) n = Number(m[1]);
  }
  if (n == null || !Number.isFinite(n)) return null;
  const whole = Math.floor(n);
  return whole >= 1 && whole <= 60 ? whole : null;
}

function isBlank(v: unknown): boolean {
  return (
    v == null ||
    (typeof v === "string" && v.trim() === "") ||
    (Array.isArray(v) && v.length === 0)
  );
}

/**
 * Same rule as cv-hydration's `isProtected`: a field named in
 * `consent.locked_fields`, or whose provenance says a person corrected or
 * confirmed it, is never written by the parser. Any alias counts.
 */
export function isFieldProtected(consent: unknown, aliases: string[]): boolean {
  if (!consent || typeof consent !== "object") return false;
  const c = consent as Row;
  const locked = Array.isArray(c.locked_fields) ? (c.locked_fields as unknown[]) : [];
  const prov = (c.provenance && typeof c.provenance === "object" ? c.provenance : {}) as Record<
    string,
    { source?: unknown } | undefined
  >;
  return aliases.some((f) => {
    if (locked.includes(f)) return true;
    const src = prov[f]?.source;
    return src === "admin_corrected" || src === "user_confirmed";
  });
}

export type ProfileBackfillRow = {
  certifications?: unknown;
  years_experience?: unknown;
  linkedin_url?: unknown;
  languages?: unknown;
  skills?: unknown;
  consent?: unknown;
};

export type ProfileBackfillPatch = {
  certifications?: ProfileCertification[];
  years_experience?: number;
  linkedin_url?: string;
  languages?: string[];
  skills?: string[];
};

/**
 * What the parser knows that the profile does not. Sources, in order of trust:
 *   - `cvFacts`: deterministic extraction from the CV text (same input, same
 *     output);
 *   - `consent.extracted`: what CV hydration parsed and kept off the columns.
 * Returns only fields that are blank on the profile and not protected.
 */
export function planProfileBackfill(
  profile: ProfileBackfillRow | null | undefined,
  cvFacts?: Pick<ParsedCvFacts, "years_experience" | "linkedin_url" | "languages" | "skills"> | null,
): ProfileBackfillPatch {
  if (!profile) return {};
  const consent = profile.consent;
  const extracted = (
    consent && typeof consent === "object" && (consent as Row).extracted &&
    typeof (consent as Row).extracted === "object"
      ? (consent as Row).extracted
      : {}
  ) as Row;
  const patch: ProfileBackfillPatch = {};

  if (isBlank(profile.certifications) && !isFieldProtected(consent, ["certifications"])) {
    const certs = normalizeParsedCertifications(extracted.certifications);
    if (certs.length > 0) patch.certifications = certs;
  }

  if (
    profile.years_experience == null &&
    !isFieldProtected(consent, ["years_experience", "years_of_experience"])
  ) {
    const years =
      normalizeParsedYears(cvFacts?.years_experience) ??
      normalizeParsedYears(extracted.years_of_experience);
    if (years != null) patch.years_experience = years;
  }

  if (isBlank(profile.linkedin_url) && !isFieldProtected(consent, ["linkedin_url"])) {
    const url = cvFacts?.linkedin_url?.trim();
    if (url && /^https?:\/\/\S+$/i.test(url)) patch.linkedin_url = url;
  }

  if (isBlank(profile.languages) && !isFieldProtected(consent, ["languages"])) {
    if (cvFacts?.languages?.length) patch.languages = cvFacts.languages;
  }

  if (isBlank(profile.skills) && !isFieldProtected(consent, ["skills"])) {
    if (cvFacts?.skills?.length) patch.skills = cvFacts.skills;
  }

  return patch;
}

/** The columns `planProfileBackfill` reads; select these before calling it. */
export const PROFILE_BACKFILL_COLUMNS =
  "certifications,years_experience,linkedin_url,languages,skills,consent";
