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
 *
 * A field is filled once per CV: the write records `consent.backfilled.<field>`
 * with the CV it came from, and a field already recorded for the current CV is
 * not filled again, so a candidate who clears a parsed list keeps it cleared
 * until they upload a new CV.
 */
import type { ParsedCvFacts } from "./parse-facts";

/** The shape the client DTO reads (`toClientCandidateDTO` in client-kpi.server). */
export type ProfileCertification = { name: string; issuer: string | null; date: string | null };

/** The candidate profile editor's own cap (candidate.functions.ts `profileSchema`). */
const MAX_CERTIFICATIONS = 50;
const MAX_CERT_TEXT = 200;

/**
 * Below this hydration confidence the parsed certification list is not copied
 * at all. On live data (2 Nov 2026) only one list sat below it: Basma
 * Youssef's 0.75, two award lines and the fragment "Shorts".
 */
export const MIN_CERTIFICATION_CONFIDENCE = 0.8;

// Award lines the model files under certifications ("Effie's 2023 award
// Silver…", "Cannes Lions"). A plain "Award" is a real UK qualification size
// ("Level 2 Award in Food Safety", "NEBOSH Award"), so it only counts with a
// medal word next to it. Mirrored in scripts/backfill/0001a/0001b.
const AWARD_LINE =
  /\b(effies?|cannes lions|grand prix|shortlist(ed)?|finalists?|winners?|nominee|nominated|honou?rable mention)\b/i;
const AWARD_WORD = /\bawards?\b/i;
const MEDAL_WORD = /\b(gold|silver|bronze)\b/i;

/**
 * Obvious parser noise that must never appear on a client card as a
 * certification: names under three characters, a single short word that is
 * not an acronym ("Shorts"; "HACCP", "IOSH", "CFA" stay), and award lines.
 */
export function isCertificationNoise(name: string): boolean {
  const s = name.replace(/\s+/g, " ").trim();
  if (s.length < 3) return true;
  const capitals = (s.match(/[A-Z]/g) ?? []).length;
  if (!/\s/.test(s) && s.length <= 6 && !/[0-9]/.test(s) && capitals < 2) return true;
  if (AWARD_LINE.test(s)) return true;
  if (AWARD_WORD.test(s) && MEDAL_WORD.test(s)) return true;
  return false;
}

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
 * Blank entries and parser noise (`isCertificationNoise`) are dropped and
 * repeats (same name, any case) kept once.
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
    if (!cert || isCertificationNoise(cert.name)) continue;
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

function asRow(v: unknown): Row | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null;
}

/**
 * True when this field was already filled by a backfill from the profile's
 * current CV (`consent.backfilled.<field>.cv_file_id`). Whatever the field
 * holds now — including an empty list a person cleared — is then theirs.
 */
export function wasBackfilledFromCurrentCv(
  consent: unknown,
  field: BackfillField,
  currentCvFileId: unknown,
): boolean {
  const marker = asRow(consent)?.backfilled;
  const entry = asRow(marker)?.[field];
  if (entry == null) return false;
  const markedCv = asRow(entry)?.cv_file_id ?? null;
  return (markedCv ?? null) === ((currentCvFileId as string | null | undefined) ?? null);
}

export type ProfileBackfillRow = {
  certifications?: unknown;
  years_experience?: unknown;
  linkedin_url?: unknown;
  languages?: unknown;
  skills?: unknown;
  consent?: unknown;
  current_cv_file_id?: unknown;
};

/** The columns a backfill may fill, in write order. */
export const BACKFILL_FIELDS = [
  "certifications",
  "years_experience",
  "linkedin_url",
  "languages",
  "skills",
] as const;
export type BackfillField = (typeof BACKFILL_FIELDS)[number];

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
  const cvId = profile.current_cv_file_id;
  const open = (field: BackfillField, aliases: string[]) =>
    !isFieldProtected(consent, aliases) && !wasBackfilledFromCurrentCv(consent, field, cvId);

  if (isBlank(profile.certifications) && open("certifications", ["certifications"])) {
    const conf = (asRow(asRow(asRow(consent)?.provenance)?.certifications) ?? {}).confidence;
    const lowConfidence =
      typeof conf === "number" && Number.isFinite(conf) && conf < MIN_CERTIFICATION_CONFIDENCE;
    const certs = lowConfidence ? [] : normalizeParsedCertifications(extracted.certifications);
    if (certs.length > 0) patch.certifications = certs;
  }

  if (
    profile.years_experience == null &&
    open("years_experience", ["years_experience", "years_of_experience"])
  ) {
    const years =
      normalizeParsedYears(cvFacts?.years_experience) ??
      normalizeParsedYears(extracted.years_of_experience);
    if (years != null) patch.years_experience = years;
  }

  if (isBlank(profile.linkedin_url) && open("linkedin_url", ["linkedin_url"])) {
    const url = cvFacts?.linkedin_url?.trim();
    if (url && /^https?:\/\/\S+$/i.test(url)) patch.linkedin_url = url;
  }

  if (isBlank(profile.languages) && open("languages", ["languages"])) {
    if (cvFacts?.languages?.length) patch.languages = cvFacts.languages;
  }

  if (isBlank(profile.skills) && open("skills", ["skills"])) {
    if (cvFacts?.skills?.length) patch.skills = cvFacts.skills;
  }

  return patch;
}

/** The columns `planProfileBackfill` reads; select these before calling it. */
export const PROFILE_BACKFILL_COLUMNS =
  "certifications,years_experience,linkedin_url,languages,skills,consent,current_cv_file_id";

/** jsonb columns: their stored value is compared as JSON text. */
const JSON_FIELDS = new Set<BackfillField>(["certifications", "languages", "skills"]);

// The narrow slice of the Supabase query builder this module uses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;
export type BackfillDb = { from(table: string): Query };

/**
 * Restrict an update to the row still holding the value the plan saw. The plan
 * only fills a field it read as empty, and the read happens before a model
 * call; whatever a person saved in that gap makes this filter miss, so their
 * value is never replaced (a compare-and-set, not a read-then-write).
 */
function whereStill(q: Query, field: BackfillField, observed: unknown): Query {
  if (observed === null || observed === undefined) return q.is(field, null);
  if (JSON_FIELDS.has(field)) return q.eq(field, JSON.stringify(observed));
  return q.eq(field, String(observed));
}

export type BackfillWriteResult = { written: BackfillField[]; marked: boolean };

/**
 * Write a planned backfill. Each field is its own conditional update (see
 * `whereStill`), so one field a person filled meanwhile does not stop the
 * others. The fields written are then recorded under `consent.backfilled`
 * with the CV they came from; that write is guarded on `updated_at` (bumped by
 * the touch trigger on every update), so a consent change made meanwhile is
 * never lost: the marker is skipped instead.
 */
export async function writeProfileBackfill(
  s: BackfillDb,
  profileId: string,
  patch: ProfileBackfillPatch,
  observed: ProfileBackfillRow | null | undefined,
  opts: { now?: Date; source?: string } = {},
): Promise<BackfillWriteResult> {
  const written: BackfillField[] = [];
  if (!observed) return { written, marked: false };
  for (const field of BACKFILL_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    const q = whereStill(
      s.from("candidate_profiles").update({ [field]: value }).eq("id", profileId),
      field,
      observed[field],
    );
    const { data, error } = await q.select("id");
    if (!error && Array.isArray(data) && data.length > 0) written.push(field);
  }
  if (written.length === 0) return { written, marked: false };

  const { data: row } = await s
    .from("candidate_profiles")
    .select("consent,updated_at")
    .eq("id", profileId)
    .maybeSingle();
  if (!row?.updated_at) return { written, marked: false };
  const consent = asRow(row.consent) ?? {};
  const backfilled: Row = { ...(asRow(consent.backfilled) ?? {}) };
  const stamp = {
    at: (opts.now ?? new Date()).toISOString(),
    cv_file_id: (observed.current_cv_file_id as string | null | undefined) ?? null,
    source: opts.source ?? "pipeline",
  };
  for (const field of written) backfilled[field] = stamp;
  const { data: marked, error: markErr } = await s
    .from("candidate_profiles")
    .update({ consent: { ...consent, backfilled } })
    .eq("id", profileId)
    .eq("updated_at", row.updated_at)
    .select("id");
  return { written, marked: !markErr && Array.isArray(marked) && marked.length > 0 };
}
