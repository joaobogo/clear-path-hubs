/**
 * Order a candidate's certifications for one role: the ones that share a
 * meaningful word with the role's title or requirements come first, most
 * shared words first; ties and everything else keep the stored order. Nothing
 * is dropped; ordering only decides what a reader sees first.
 *
 * Anna's twelve, read for the Mushroom Harvesting Manager role (which asks for
 * "Food safety team experience (HACCP, TACCP, VACCP, BRC)" and an "Advanced
 * Food Hygiene qualification"), lead with Food Safety & Hygiene, FSSC and
 * HACCP instead of Germplasm Value Preservation and Lift Truck Operator.
 */

// Words that appear in almost every requirement or course title and say
// nothing about which credential is relevant.
const GENERIC = new Set([
  "and", "the", "for", "with", "from", "into", "within", "across", "using", "based",
  "experience", "experienced", "skill", "skills", "strong", "good", "excellent",
  "basic", "advanced", "previous", "including", "working", "work", "hours",
  "approach", "flexible", "written", "verbal", "team", "level", "management",
  "manager", "training", "trained", "course", "certificate", "certification",
  "certified", "program", "programme", "qualification", "qualifications",
  "degree", "education", "awareness", "knowledge", "ability", "able", "hands",
  "related", "year", "years", "plus", "preferred", "required", "must", "have",
  "nice", "other", "any", "all", "etc", "minimum", "professional", "online",
]);

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  const plain = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const raw of plain.split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || /^\d+$/.test(raw) || GENERIC.has(raw)) continue;
    // "standards"/"standard", "rates"/"rate": a light plural fold only.
    out.add(raw.length > 4 && raw.endsWith("s") && !raw.endsWith("ss") ? raw.slice(0, -1) : raw);
  }
  return out;
}

function requirementTexts(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const r of list) {
    if (typeof r === "string") out.push(r);
    else if (r && typeof r === "object") {
      const o = r as Record<string, unknown>;
      const text = o.label ?? o.text ?? o.requirement ?? o.name;
      if (typeof text === "string") out.push(text);
    }
  }
  return out;
}

export type RoleForCertifications = {
  title?: unknown;
  requirements?: unknown;
  preferred_requirements?: unknown;
} | null | undefined;

export function orderCertificationsForRole<T extends { name: string; issuer?: string | null }>(
  certs: T[],
  role: RoleForCertifications,
): T[] {
  if (!role || certs.length < 2) return certs;
  const roleWords = new Set<string>();
  const texts = [
    typeof role.title === "string" ? role.title : "",
    ...requirementTexts(role.requirements),
    ...requirementTexts(role.preferred_requirements),
  ];
  for (const t of texts) for (const w of tokens(t)) roleWords.add(w);
  if (roleWords.size === 0) return certs;
  return certs
    .map((c, i) => {
      let shared = 0;
      for (const w of tokens(`${c.name} ${c.issuer ?? ""}`)) if (roleWords.has(w)) shared++;
      return { c, i, shared };
    })
    .sort((a, b) => b.shared - a.shared || a.i - b.i)
    .map((x) => x.c);
}
