/**
 * Where hiring criteria live in each save path, as the fields the
 * protected-attribute detector reads (scoring/protected-attributes.ts).
 *
 * One list per path so the screen that shows a finding and the server that
 * refuses the save read exactly the same rows: the client intake, the role
 * editor, and a stored position at publish time. Pure: no I/O, safe in the
 * browser.
 */
import {
  criteriaLabels,
  findProtectedCriteriaInFields,
  type CriteriaField,
  type CriteriaFieldFinding,
} from "@/lib/scoring/protected-attributes";

const TAG_NOUN: Record<string, string> = {
  must_have: "Must-have",
  nice_to_have: "Nice-to-have",
  trainable: "Trainable",
};

function rows(field: string, noun: string, values: readonly unknown[] | null | undefined): CriteriaField[] {
  const out: CriteriaField[] = [];
  (values ?? []).forEach((v, i) => {
    const text = typeof v === "string" ? v : "";
    if (text.trim()) out.push({ field, index: i, label: `${noun} ${i + 1}`, text });
  });
  return out;
}

const lines = (s: string | null | undefined) =>
  (s ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

/** The criteria a client writes in the intake: requirements and deal-breakers. */
export type IntakeCriteriaInput = {
  requirements?: Array<{ text: string; tag: string }> | null;
  mustHaves?: string | null;
  niceToHaves?: string | null;
  trainable?: string | null;
  dealBreakerList?: readonly string[] | null;
  dealBreakers?: string | null;
};

export function intakeCriteriaFields(data: IntakeCriteriaInput): CriteriaField[] {
  const out: CriteriaField[] = [];
  const reqs = data.requirements ?? [];
  if (reqs.length > 0) {
    // Numbered within their own tag, as the list shows them.
    const seen: Record<string, number> = {};
    reqs.forEach((r, i) => {
      if (!r?.text?.trim()) return;
      const n = (seen[r.tag] = (seen[r.tag] ?? 0) + 1);
      out.push({ field: "requirements", index: i, label: `${TAG_NOUN[r.tag] ?? "Requirement"} ${n}`, text: r.text });
    });
  } else {
    // Legacy payloads carry the three lists as text, one per line.
    out.push(...rows("mustHaves", "Must-have", lines(data.mustHaves)));
    out.push(...rows("niceToHaves", "Nice-to-have", lines(data.niceToHaves)));
    out.push(...rows("trainable", "Trainable", lines(data.trainable)));
  }
  const dealBreakers = data.dealBreakerList?.length ? data.dealBreakerList : lines(data.dealBreakers);
  out.push(...rows("dealBreakerList", "Deal-breaker", dealBreakers));
  return out;
}

/** The criteria the role editor saves. */
export type RoleFormCriteriaInput = {
  must_have_skills?: readonly string[] | null;
  nice_to_have_skills?: readonly string[] | null;
  trainable_skills?: readonly string[] | null;
  disqualifier_tags?: readonly string[] | null;
  screening_questions?: ReadonlyArray<{ question: string }> | null;
};

export function roleFormCriteriaFields(data: RoleFormCriteriaInput): CriteriaField[] {
  return [
    ...rows("must_have_skills", "Must-have", data.must_have_skills),
    ...rows("nice_to_have_skills", "Nice-to-have", data.nice_to_have_skills),
    ...rows("trainable_skills", "Trainable", data.trainable_skills),
    ...rows("disqualifier_tags", "Deal-breaker", data.disqualifier_tags),
    ...rows(
      "screening_questions",
      "Screening question",
      (data.screening_questions ?? []).map((q) => q?.question ?? ""),
    ),
  ];
}

/** The criteria stored on a position row, plus its screening questions. */
export type StoredPositionCriteria = {
  requirements?: unknown;
  preferred_requirements?: unknown;
  dealbreakers?: unknown;
  screening_questions?: ReadonlyArray<{ question?: string | null }> | null;
};

export function storedPositionCriteriaFields(p: StoredPositionCriteria): CriteriaField[] {
  return [
    ...rows("requirements", "Must-have", criteriaLabels(p.requirements)),
    ...rows("preferred_requirements", "Preferred requirement", criteriaLabels(p.preferred_requirements)),
    ...rows("dealbreakers", "Deal-breaker", criteriaLabels(p.dealbreakers)),
    ...rows(
      "screening_questions",
      "Screening question",
      (p.screening_questions ?? []).map((q) => q?.question ?? ""),
    ),
  ];
}

export function storedPositionProtectedCriteria(
  p: StoredPositionCriteria & { title?: string | null },
): CriteriaFieldFinding[] {
  return findProtectedCriteriaInFields(storedPositionCriteriaFields(p), { roleTitle: p.title ?? null });
}

/**
 * Generated criteria (a role blueprint) are checked before they are saved.
 * Flagged items are held back for a person to review, never rewritten: the
 * suggestion travels with them.
 */
export function screenGeneratedCriteria(
  field: string,
  items: readonly string[],
  opts: { roleTitle?: string | null } = {},
): { kept: string[]; held: CriteriaFieldFinding[] } {
  const found = findProtectedCriteriaInFields(rows(field, "Generated item", items), opts);
  const heldIdx = new Set(found.map((f) => f.index));
  return {
    kept: items.filter((t, i) => !heldIdx.has(i) && typeof t === "string"),
    held: found,
  };
}

/** The parts of a generated role blueprint that are hiring criteria. */
export type GeneratedCriteria = {
  role?: { title?: string | null } | null;
  must_have_skills?: string[] | null;
  nice_to_have_skills?: string[] | null;
  dealbreakers?: string[] | null;
  screening_questions?: Array<{ question: string }> | null;
  sourcing_plan?: { disqualifiers?: string[] | null } | null;
};

export type HeldBackCriterion = {
  field: string;
  text: string;
  replacement: string;
  reasons: string[];
};

/**
 * The blueprint's criteria with anything stating a protected attribute held
 * back. Pure, so the rule is tested without a database.
 */
export function screenBlueprintCriteria(bp: GeneratedCriteria): {
  mustHaves: string[];
  niceToHaves: string[];
  dealbreakers: string[];
  disqualifiers: string[];
  held: HeldBackCriterion[];
} {
  const opts = { roleTitle: bp.role?.title ?? null };
  const must = screenGeneratedCriteria("requirements", bp.must_have_skills ?? [], opts);
  const nice = screenGeneratedCriteria("preferred_requirements", bp.nice_to_have_skills ?? [], opts);
  const deal = screenGeneratedCriteria("dealbreakers", bp.dealbreakers ?? [], opts);
  const disq = screenGeneratedCriteria("disqualifiers", bp.sourcing_plan?.disqualifiers ?? [], opts);
  const questions = screenGeneratedCriteria(
    "screening_questions",
    (bp.screening_questions ?? []).map((q) => q.question),
    opts,
  );
  const held = [...must.held, ...nice.held, ...deal.held, ...disq.held, ...questions.held].map((f) => ({
    field: f.field,
    text: f.text,
    replacement: f.replacement,
    reasons: [...new Set(f.findings.map((x) => x.message))],
  }));
  return {
    mustHaves: must.kept,
    niceToHaves: nice.kept,
    dealbreakers: deal.kept,
    disqualifiers: disq.kept,
    held,
  };
}

