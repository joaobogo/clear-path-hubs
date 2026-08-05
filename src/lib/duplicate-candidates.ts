/**
 * Duplicate candidate detection — pure logic and shared types.
 *
 * Detection is deliberately strict: two people are only suspected duplicates
 * when they share an EXACT identifier (email or phone). No fuzzy name matching,
 * no probabilistic scoring, no automatic merging.
 */

export type DuplicateMatchKind = "email" | "phone";

export type DuplicateApplicationRow = {
  application_id: string | null;
  applied_at: string | null;
  position_id: string | null;
  position_title: string | null;
  organization_name: string | null;
  stage: string | null;
};

export type DuplicatePersonSide = {
  person_id: string;
  display_name: string | null;
  primary_email: string | null;
  first_seen_at: string | null;
  candidate_profile_ids: string[];
  /** Primary profile used for "open profile" links. */
  candidate_profile_id: string | null;
  emails: string[];
  phones: string[];
  applications: DuplicateApplicationRow[];
};

export type DuplicateMatchedIdentifier = {
  kind: DuplicateMatchKind;
  /** Display value (masked-free — staff only surface). */
  value: string;
};

export type DuplicatePair = {
  /** Stable id: ordered person ids joined. */
  pair_key: string;
  person_a: DuplicatePersonSide;
  person_b: DuplicatePersonSide;
  matched: DuplicateMatchedIdentifier[];
};

export type DuplicateDecisionRow = {
  id: string;
  person_a_id: string;
  person_b_id: string;
  decision: "merged" | "distinct";
  note: string | null;
  created_at: string;
  decided_by: string | null;
  decided_by_name: string | null;
};

export type DuplicateReview = {
  pairs: DuplicatePair[];
  /** Pairs previously resolved and still in force (audit/undo surface). */
  resolved: DuplicateDecisionRow[];
  scanned_people: number;
};

/** Lower-cased, trimmed email. Empty string when unusable. */
export function normaliseEmail(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  return v.includes("@") ? v : "";
}

/**
 * Digits-only phone key. Uses the last 9 digits so country-code and formatting
 * differences still count as an exact same-number match. Empty when too short.
 */
export function normalisePhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D+/g, "");
  if (digits.length < 8) return "";
  return digits.slice(-9);
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export type IdentifierInput = {
  person_id: string;
  kind: string;
  value: string;
};

/**
 * Group identifiers into suspected duplicate person pairs.
 * Only email/phone identifiers participate; merged people are excluded upstream.
 */
export function detectPairs(
  identifiers: IdentifierInput[],
  suppressed: Set<string>,
): Map<string, DuplicateMatchedIdentifier[]> {
  const buckets = new Map<string, { kind: DuplicateMatchKind; value: string; people: Set<string> }>();

  for (const row of identifiers) {
    const kind: DuplicateMatchKind | null =
      row.kind === "email" ? "email" : row.kind === "phone" ? "phone" : null;
    if (!kind) continue;
    const key = kind === "email" ? normaliseEmail(row.value) : normalisePhone(row.value);
    if (!key) continue;
    const bucketKey = `${kind}:${key}`;
    const bucket = buckets.get(bucketKey) ?? { kind, value: row.value, people: new Set<string>() };
    bucket.people.add(row.person_id);
    buckets.set(bucketKey, bucket);
  }

  const out = new Map<string, DuplicateMatchedIdentifier[]>();
  for (const bucket of buckets.values()) {
    const people = [...bucket.people].sort();
    if (people.length < 2) continue;
    for (let i = 0; i < people.length; i += 1) {
      for (let j = i + 1; j < people.length; j += 1) {
        const a = people[i]!;
        const b = people[j]!;
        const key = pairKey(a, b);
        if (suppressed.has(key)) continue;
        const list = out.get(key) ?? [];
        if (!list.some((m) => m.kind === bucket.kind && m.value === bucket.value)) {
          list.push({ kind: bucket.kind, value: bucket.value });
        }
        out.set(key, list);
      }
    }
  }
  return out;
}

export const MATCH_LABEL: Record<DuplicateMatchKind, string> = {
  email: "Same email",
  phone: "Same phone",
};
