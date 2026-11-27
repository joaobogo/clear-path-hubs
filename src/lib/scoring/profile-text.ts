/**
 * The candidate's profile as evidence (v1.8.0).
 *
 * The engine read the CV file and nothing else, so a profile a recruiter had
 * rewritten from LinkedIn and a call, with corrected dates, changed no score.
 * buildProfileText turns the profile's headline, summary and experience into
 * one block of text the engine reads beside the CV.
 *
 * What counts. Most profiles are the parser's copy of the CV (hydration,
 * the parser fallback, a legacy import). That text is machine-written: it
 * repeats the CV at best and paraphrases it at worst, and it is not evidence.
 * A field is included only where the profile records that a person wrote it
 * (candidate_profiles.consent.provenance.<field>.source):
 *   - admin_corrected: a recruiter wrote or corrected it. Labelled
 *     recruiter-edited; its dates win over the CV's.
 *   - user_confirmed, candidate_provided: the candidate wrote it. Labelled
 *     profile, never recruiter-edited; its dates do not override the CV.
 * Anything else (cv_parsed, enriched, inferred, legacy, or no record) is left
 * out, and the CV is scored exactly as before.
 *
 * Sentences the CV already contains are dropped from the block, so a profile
 * that repeats the CV adds nothing and nothing is counted twice.
 *
 * The block is one string, so a run's replay snapshot and input hash carry it
 * whole. Each section opens with a label line that also says who wrote it;
 * profileSections reads the labels back.
 */

export type ProfileField = "headline" | "summary" | "experience";
export type ProfileOrigin = "recruiter" | "candidate";

export type ProfileTextInput = {
  headline?: string | null;
  summary?: string | null;
  /** candidate_profiles.experience: [{ title, company, start, end, summary }]. */
  experience?: unknown;
  /** candidate_profiles.consent, read for provenance only. */
  consent?: unknown;
};

const LABEL: Record<ProfileField, string> = {
  headline: "PROFILE HEADLINE",
  summary: "PROFILE SUMMARY",
  experience: "PROFILE EXPERIENCE",
};
/**
 * Who wrote the section, as one letter: R for a recruiter, C for the
 * candidate. A letter and not a word, so a label line can never be read as
 * evidence of recruiting or of anything else.
 */
const ORIGIN_TAG: Record<ProfileOrigin, string> = {
  recruiter: "(R)",
  candidate: "(C)",
};
const LABEL_LINE = /^PROFILE (HEADLINE|SUMMARY|EXPERIENCE) \((R|C)\)$/;
/** A label line of the profile block: it names a section and belongs to no role. */
export const PROFILE_LABEL_LINE = LABEL_LINE;

const asRow = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const text = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** Who wrote a profile field, or null when no person is on record for it. */
export function profileFieldOrigin(consent: unknown, field: ProfileField): ProfileOrigin | null {
  const prov = asRow(asRow(consent)?.provenance);
  const source = asRow(prov?.[field])?.source;
  if (source === "admin_corrected") return "recruiter";
  if (source === "user_confirmed" || source === "candidate_provided") return "candidate";
  return null;
}

/**
 * The provenance record a staff edit of a profile field writes, so the engine
 * reads the field as recruiter-edited. Returns the consent to store; nothing
 * else in it is changed.
 */
export function stampRecruiterEdit(
  consent: unknown,
  fields: ProfileField[],
  by: { user_id: string | null; at: string; note?: string | null },
): Record<string, unknown> {
  const base = asRow(consent) ?? {};
  const provenance = { ...(asRow(base.provenance) ?? {}) };
  for (const field of fields) {
    provenance[field] = {
      source: "admin_corrected",
      corrected_by: by.user_id,
      corrected_at: by.at,
      ...(by.note ? { note: by.note } : {}),
    };
  }
  return { ...base, provenance };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}$£€%+]+/gu, " ")
    .trim();

/** Sentences of a paragraph; a sentence the CV already contains is dropped. */
function newSentences(paragraph: string, cvNorm: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+(?=[\p{Lu}\d"'“‘(])/u)
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      const n = norm(s);
      return n.length > 0 && !cvNorm.includes(n);
    });
}

type Entry = { title: string; company: string; start: string; end: string; summary: string };

function entriesOf(experience: unknown): Entry[] {
  if (!Array.isArray(experience)) return [];
  const out: Entry[] = [];
  for (const raw of experience) {
    const o = asRow(raw);
    if (!o) continue;
    const e: Entry = {
      title: text(o.title),
      company: text(o.company),
      start: text(o.start),
      end: text(o.end),
      summary: text(o.summary),
    };
    if (e.title || e.company) out.push(e);
  }
  return out;
}

/**
 * The profile block the engine reads, or "" when no field was written by a
 * person or nothing in it is new beside the CV.
 */
export function buildProfileText(profile: ProfileTextInput | null | undefined, cvText: string): string {
  if (!profile) return "";
  const cvNorm = norm(cvText ?? "");
  const parts: string[] = [];

  const headlineOrigin = profileFieldOrigin(profile.consent, "headline");
  const headline = text(profile.headline);
  if (headlineOrigin && headline && !cvNorm.includes(norm(headline))) {
    parts.push(`${LABEL.headline} ${ORIGIN_TAG[headlineOrigin]}`, headline);
  }

  const summaryOrigin = profileFieldOrigin(profile.consent, "summary");
  const summary = text(profile.summary);
  if (summaryOrigin && summary) {
    const fresh = newSentences(summary, cvNorm);
    if (fresh.length > 0) parts.push(`${LABEL.summary} ${ORIGIN_TAG[summaryOrigin]}`, fresh.join(" "));
  }

  const experienceOrigin = profileFieldOrigin(profile.consent, "experience");
  const entries = experienceOrigin ? entriesOf(profile.experience) : [];
  if (experienceOrigin && entries.length > 0) {
    const lines: string[] = [];
    let anything = false;
    for (const e of entries) {
      const dates = e.start ? `${e.start} – ${e.end || "Present"}` : "";
      const header = [e.title, e.company].filter(Boolean).join(" | ");
      // A recruiter's dates are kept even when the wording repeats the CV:
      // they are the correction. A candidate's entry that adds no sentence
      // is the CV again and is left out.
      const fresh = newSentences(e.summary, cvNorm);
      if (experienceOrigin !== "recruiter" && fresh.length === 0) continue;
      lines.push(dates ? `${header} ${dates}` : header);
      for (const s of fresh) lines.push(`• ${s}`);
      anything = true;
    }
    if (anything) parts.push(`${LABEL.experience} ${ORIGIN_TAG[experienceOrigin]}`, ...lines);
  }

  return parts.join("\n");
}

export type ProfileSection = {
  field: ProfileField;
  origin: ProfileOrigin;
  /** The label line. */
  labelStart: number;
  labelEnd: number;
  /** The section's own text, after the label line. */
  start: number;
  end: number;
};

/** The sections of a profile block, with offsets into the block. */
export function profileSections(block: string): ProfileSection[] {
  const out: ProfileSection[] = [];
  let pos = 0;
  for (const line of block.split("\n")) {
    const m = LABEL_LINE.exec(line);
    if (m) {
      const last = out[out.length - 1];
      if (last) last.end = Math.max(last.start, pos - 1);
      out.push({
        field: m[1]!.toLowerCase() as ProfileField,
        origin: m[2] === "R" ? "recruiter" : "candidate",
        labelStart: pos,
        labelEnd: pos + line.length,
        start: Math.min(block.length, pos + line.length + 1),
        end: block.length,
      });
    }
    pos += line.length + 1;
  }
  return out;
}

/** What separates the CV from the profile block in the text the engine reads. */
export const PROFILE_SEPARATOR = "\n\n";
