/**
 * One requirement per dealbreaker question.
 *
 * A dealbreaker answered "no" makes a candidate not_eligible
 * (scoring/screening-eligibility.ts). When one question asks for two things,
 * a candidate with one but not the other can only answer "no" and is
 * excluded, and a "yes" cannot say which half it covers. Hughes Mushrooms'
 * first dealbreaker (owner research, 2 Nov) asked for "hands-on mushroom
 * picking experience as well as supervisory experience on a commercial
 * mushroom farm".
 *
 * Every save path refuses a new or edited dealbreaker that bundles two
 * requirements, with a suggested split the author applies; nothing is
 * rewritten silently. A dealbreaker already stored with the same wording
 * never blocks an unrelated save. The role generator splits its own drafts
 * only on an explicit joiner ("as well as"); any other bundle it drafts is
 * kept as a question that is weighed and excludes nobody.
 *
 * The detector would rather miss a bundle than flag a normal question:
 * "skilled and unskilled workers", "a regulated and audited environment",
 * "both willing and able" and "working together with" are one requirement.
 * Pure: no I/O, safe in the browser.
 */
import { SCREENING_MAX_QUESTIONS, SCREENING_MAX_REQUIRED } from "@/lib/screening-limits";

export type CompoundSplit = {
  /** The words that join the two requirements, e.g. "as well as". */
  connector: string;
  /** The two questions to ask instead, each testing one requirement. */
  questions: [string, string];
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const wordsOf = (s: string) =>
  clean(s.replace(/[?!.,;:]+/g, " "))
    .split(" ")
    .filter(Boolean);
const norm = (s: string) => clean(s).toLowerCase();
const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Words that make a clause an experience requirement. */
const EXPERIENCE = /\b(?:experience[ds]?|years?|yrs)\b/i;
/**
 * Explicit joiners: two requirements in one question. "together with" is not
 * one: "experience working together with cross-functional teams" is the idiom.
 */
const JOINER = /,?\s+(as well as|and also|along with|in addition to)\s+/gi;
/** The connectors JOINER reports. The generator splits its drafts only on these. */
const EXPLICIT_CONNECTORS = new Set(["as well as", "and also", "along with", "in addition to"]);
/** "working along with the team": a way of working, not a second requirement. */
const WORKING_WITH = /\bwork(?:s|ed|ing)?$/i;
/** A plain "and" that may join two experience clauses ("and/or", "and above" do not). */
const AND = /,?\s+and\s+(?!\/|or\b|above\b|over\b|more\b|up\b|beyond\b|so on\b)/gi;
/** "both X and Y", where X is at most eight words. */
const BOTH = /\bboth\s+((?:[^\s,.;:?!]+\s+){0,7}?[^\s,.;:?!]+)\s+and\s+([^,.;:?!]+)/i;
/** "both written and spoken" describes one language requirement, not two. */
const LANGUAGE_MODES = new Set([
  "written",
  "spoken",
  "verbal",
  "oral",
  "reading",
  "writing",
  "speaking",
  "listening",
  "read",
  "write",
  "speak",
]);
/** "both picking and supervisory experience": the head noun both halves share. */
const SHARED_HEADS = new Set([
  "experience",
  "skills",
  "knowledge",
  "background",
  "shifts",
  "roles",
  "work",
  "qualifications",
  "certificates",
  "licences",
  "licenses",
]);
const PARTICIPLE =
  /^(?:[a-z]+ed|led|run|built|done|held|taught|grown|driven|been|overseen|undertaken)$/i;
/**
 * A word that modifies the noun after it: "skilled", "regulated",
 * "fast-paced". When the word before "and" is one, the "and" joins two
 * modifiers of one noun ("skilled and unskilled workers"), not two clauses.
 */
const MODIFIER = (w: string) => /ed$/i.test(w) || PARTICIPLE.test(w) || w.includes("-");
/** "both a forklift licence and a CSCS card": each half is a whole noun phrase. */
const DETERMINER = /^(?:a|an|the|\d[\d+.,]*)$/i;

/** Subject and auxiliary: "Do you", "Have you", "Are you". */
const AUX_LEAD = /^(?:do|did|will|would|can|could|are|were|have|has|is)\s+you\b/i;
/** Subject, auxiliary and main verb the second half reuses. */
const VERB_LEADS: RegExp[] = [
  /^(?:do|did|will|would|can|could)\s+you\s+(?:(?:currently|also|already|still)\s+)?(?:have|hold|possess|bring|speak|own)\b/i,
  /^(?:are|were)\s+you\s+(?:(?:currently|also)\s+)?(?:legally\s+)?(?:able|willing|happy|prepared|available|comfortable|eligible|authori[sz]ed)\s+to\s+[a-z]+\b/i,
  /^(?:are|were)\s+you\s+(?:(?:currently|also)\s+)?(?:fluent|experienced|qualified|certified|licensed|trained|skilled|proficient)\s+(?:in|with|as)\b/i,
  /^(?:have|has)\s+you\s+(?:(?:ever|personally|previously|already|also)\s+)?(?:got\s+)?[a-z]+\b/i,
  // "Can you drive a forklift as well as a reach truck?": the word after "you" is the verb.
  /^(?:do|did|will|would|can|could)\s+you\s+(?:(?:currently|also|already|still|regularly)\s+)?[a-z]+\b/i,
];
/** The second half is already a question of its own. */
const OWN_QUESTION = /^(?:do|did|does|will|would|can|could|are|were|have|has|is)\s+(?:you|your)\b/i;
/** "Have you <verb> <object>": the clause names its own experience. */
const HAVE_YOU_DID =
  /^(?:have|has)\s+you\s+(?:(?:ever|personally|previously|already|also)\s+)?([a-z]+)\s+\S/i;

/** Last sentence of a stretch of text, and whatever preamble came before it. */
function lastSentence(text: string): { preamble: string; clause: string } {
  const parts = clean(text).split(/(?<=[.!?])\s+/);
  const clause = parts.pop() ?? "";
  return { preamble: parts.join(" "), clause };
}

/** First sentence of a stretch of text. */
const firstSentence = (text: string) => clean(text).split(/(?<=[?!])\s+/)[0] ?? "";

function finish(s: string, asQuestion: boolean): string {
  const body = clean(s).replace(/[\s,;:?.!]+$/, "");
  return capitalise(body) + (asQuestion ? "?" : "");
}

/** The second half as a standalone question: "supervisory experience" -> "Do you have supervisory experience?" */
function secondHalf(clause: string, right: string): string {
  const r = clean(right).replace(/^(?:also|that you)\s+/i, "");
  if (OWN_QUESTION.test(r)) return r;
  const aux = AUX_LEAD.exec(clause)?.[0];
  const verb = VERB_LEADS.map((re) => re.exec(clause)?.[0]).find((v): v is string => Boolean(v));
  const first = (r.split(" ")[0] ?? "").toLowerCase();
  if (!aux) return r;
  if (!verb) return `${aux} ${r}`;
  const mainVerb = (verb.split(/\s+/).pop() ?? "").toLowerCase();
  // "...and also have supervisory experience" repeats the verb itself.
  if (first === mainVerb) return `${aux} ${r}`;
  // "Have you picked mushrooms and supervised a team?"
  if (/^(?:have|has)\s/i.test(aux) && PARTICIPLE.test(first)) return `${aux} ${r}`;
  return `${verb} ${r}`;
}

function build(text: string, left: string, right: string, connector: string): CompoundSplit | null {
  const { preamble, clause } = lastSentence(left);
  const tail = firstSentence(right);
  if (wordsOf(clause).length < 3 || wordsOf(tail).length < 1) return null;
  const asQuestion = /\?/.test(text) || AUX_LEAD.test(clause);
  const lead = preamble ? `${preamble} ` : "";
  return {
    connector,
    questions: [
      lead + finish(clause, asQuestion),
      lead + finish(secondHalf(clause, tail), asQuestion),
    ],
  };
}

function explicitJoiner(text: string): CompoundSplit | null {
  for (const m of text.matchAll(JOINER)) {
    const at = m.index ?? 0;
    if (WORKING_WITH.test(text.slice(0, at))) continue;
    const found = build(text, text.slice(0, at), text.slice(at + m[0].length), m[1]!.toLowerCase());
    if (found) return found;
  }
  return null;
}

function bothAnd(text: string): CompoundSplit | null {
  const m = BOTH.exec(text);
  if (!m) return null;
  const x = clean(m[1]!);
  const y = clean(m[2]!);
  const xw = x.split(" ");
  const yw = y.split(" ");
  if (
    xw.length === 1 &&
    LANGUAGE_MODES.has(x.toLowerCase()) &&
    LANGUAGE_MODES.has((yw[0] ?? "").toLowerCase())
  ) {
    return null;
  }
  const before = text.slice(0, m.index);
  const after = text.slice(m.index + m[0].length);
  const asQuestion = /\?/.test(text);
  // "both picking and supervisory experience" -> "picking experience" + "supervisory experience".
  const sharesHead =
    xw.length <= 3 &&
    yw.length >= 2 &&
    SHARED_HEADS.has((yw[1] ?? "").toLowerCase()) &&
    !xw.some((w) => SHARED_HEADS.has(w.toLowerCase()));
  // "both a forklift licence and a CSCS card": two whole things.
  const twoPhrases =
    xw.length >= 2 &&
    yw.length >= 2 &&
    DETERMINER.test(xw[0] ?? "") &&
    DETERMINER.test(yw[0] ?? "");
  // Anything else is one requirement, or a split that cannot be worded
  // reliably: "both willing and able to work nights", "both permanent and
  // agency staff", "both punctual and reliable". Better missed than flagged.
  if (!sharesHead && !twoPhrases) return null;
  const leftPart = sharesHead ? `${x} ${yw.slice(1).join(" ")}` : x;
  const phrase = (part: string) =>
    finish(`${before}${part}${after}`.replace(/\s+([,.;:?!])/g, "$1"), asQuestion);
  return { connector: "both … and", questions: [phrase(leftPart), phrase(y)] };
}

function experienceClauses(text: string): CompoundSplit | null {
  for (const m of text.matchAll(AND)) {
    const at = m.index ?? 0;
    const left = text.slice(0, at);
    const rest = text.slice(at + m[0].length);
    const { clause } = lastSentence(left);
    // "skilled and unskilled workers", "a regulated and audited site",
    // "fast-paced and regulated": two modifiers of one noun.
    const leftWords = wordsOf(clause);
    if (MODIFIER(leftWords[leftWords.length - 1] ?? "")) continue;
    // The second clause runs to the next "and", comma or end of sentence.
    const segment = firstSentence(rest).split(/\s+and\s+|,/i)[0] ?? "";
    const rightWords = wordsOf(segment.replace(/^(?:also|have)\s+/i, ""));
    if (rightWords.length < 2) continue;
    const bothExperience = EXPERIENCE.test(clause) && EXPERIENCE.test(segment);
    const did = HAVE_YOU_DID.exec(clause);
    // "Have you picked mushrooms and supervised a picking team?": the second
    // participle needs an object of its own, two words or more.
    const bothDone = Boolean(
      did && PARTICIPLE.test(did[1]!) && PARTICIPLE.test(rightWords[0] ?? "") && rightWords.length >= 3,
    );
    if (!bothExperience && !bothDone) continue;
    const found = build(text, left, rest, "and");
    if (found) return found;
  }
  return null;
}

/**
 * The two questions a bundled question should be, or null when it asks for
 * one requirement. Reads explicit joiners ("as well as", "and also", "along
 * with", "in addition to"), "both X and Y" with a shared head noun or two
 * whole noun phrases, and two experience clauses joined by "and". "both
 * written and spoken" (one language requirement), two modifiers joined by
 * "and", "and/or" and "and above" are not bundles.
 */
export function splitCompoundQuestion(question: string | null | undefined): CompoundSplit | null {
  const text = clean(question ?? "");
  if (text.length < 8) return null;
  return explicitJoiner(text) ?? bothAnd(text) ?? experienceClauses(text);
}

/** True when the split was read from an explicit joiner ("as well as"), not a heuristic. */
export const isExplicitJoiner = (split: Pick<CompoundSplit, "connector">) =>
  EXPLICIT_CONNECTORS.has(split.connector);

/** Content words two requirements can share ("mushroom", "supervisory"). */
const FRAMING = new Set([
  "experience",
  "experienced",
  "years",
  "have",
  "with",
  "your",
  "from",
  "that",
  "this",
  "able",
  "direct",
  "previous",
  "proven",
]);
const contentWords = (s: string) =>
  new Set(
    clean(s.toLowerCase().replace(/[^a-z0-9+#\s-]/g, " "))
      .split(" ")
      .filter((w) => w.length >= 4 && !FRAMING.has(w)),
  );
const shared = (a: string, b: string) => {
  const bw = contentWords(b);
  return [...contentWords(a)].filter((w) => bw.has(w)).length;
};

/** "Do you have supervisory experience on a farm?" -> "Supervisory experience on a farm". */
function requirementOf(question: string): string {
  const body = clean(question)
    .replace(/[?.!\s]+$/, "")
    .replace(
      /^(?:(?:do|did|will|would|can|could)\s+you\s+(?:(?:currently|also|already|still)\s+)?(?:have|hold|possess|bring|own)\s+|(?:are|were)\s+you\s+(?:currently\s+)?|(?:have|has)\s+you\s+(?:(?:ever|personally|previously|already)\s+)?(?:got\s+)?|(?:do|did|will|would|can|could)\s+you\s+)/i,
      "",
    );
  return capitalise(body);
}

/**
 * The must-have each half of a split tests: never the bundled original on
 * both, or a "yes" to one half would count as evidence for the other.
 *
 * A must-have that itself bundles two is split the same way and each part
 * goes to the half it shares most words with; one that names a single
 * requirement goes to the half it clearly matches and the other half names
 * its own; otherwise (no must-have, or one that still joins two things with
 * "and") each half names the requirement in its own words.
 */
export function splitMustHave(
  mustHave: string | null | undefined,
  halves: readonly [string, string],
): [string, string] {
  const own: [string, string] = [requirementOf(halves[0]), requirementOf(halves[1])];
  const original = clean(mustHave ?? "");
  if (!original) return own;
  const parts = splitCompoundQuestion(original)?.questions;
  if (parts) {
    const kept = shared(halves[0], parts[0]) + shared(halves[1], parts[1]);
    const swapped = shared(halves[0], parts[1]) + shared(halves[1], parts[0]);
    const [a, b] = swapped > kept ? [parts[1], parts[0]] : [parts[0], parts[1]];
    return [shared(halves[0], a) > 0 ? a : own[0], shared(halves[1], b) > 0 ? b : own[1]];
  }
  // "Mushroom picking and supervision" still names both: neither half gets it.
  if (/\band\b|&|\bplus\b/i.test(original)) return own;
  const s0 = shared(halves[0], original);
  const s1 = shared(halves[1], original);
  if (s0 >= 2 && s0 > s1) return [original, own[1]];
  if (s1 >= 2 && s1 > s0) return [own[0], original];
  return own;
}

/** The candidate-facing reason for a split half, from its own must-have. */
export function whyAskedFor(mustHave: string): string {
  const m = clean(mustHave);
  if (!m) return "";
  // Keep an acronym or a name ("HACCP", "UK") as written.
  const first = m.split(" ")[0] ?? "";
  const lead = first.length > 1 && first === first.toUpperCase() ? m : m.charAt(0).toLowerCase() + m.slice(1);
  return `We ask this to check ${lead} before the interview.`;
}

export type ScreeningQuestionLike = {
  id?: string | null;
  question?: string | null;
  dealbreaker?: boolean | null;
};

export type CompoundDealbreakerFinding = {
  /** Row in the list as the form shows it. */
  index: number;
  id: string | null;
  /** "Screening question 1". */
  label: string;
  text: string;
  connector: string;
  /** The suggested split: two dealbreaker questions, one requirement each. */
  questions: [string, string];
};

/**
 * Dealbreaker questions that bundle two requirements.
 *
 * `stored` is what the role held before this save: a dealbreaker whose
 * wording is unchanged from a stored dealbreaker is not reported, so an old
 * question never blocks an unrelated edit. Publish and blueprint sign-off
 * pass no `stored` and read every dealbreaker.
 */
export function findCompoundDealbreakers(
  questions: ReadonlyArray<ScreeningQuestionLike | null | undefined> | null | undefined,
  opts: { stored?: ReadonlyArray<ScreeningQuestionLike | null | undefined> | null } = {},
): CompoundDealbreakerFinding[] {
  const unchanged = new Set(
    (opts.stored ?? []).filter((q) => q?.dealbreaker === true).map((q) => norm(q?.question ?? "")),
  );
  const out: CompoundDealbreakerFinding[] = [];
  (questions ?? []).forEach((q, index) => {
    if (q?.dealbreaker !== true) return;
    const text = q.question ?? "";
    if (unchanged.has(norm(text))) return;
    const split = splitCompoundQuestion(text);
    if (!split) return;
    out.push({
      index,
      id: q.id ?? null,
      label: `Screening question ${index + 1}`,
      text,
      connector: split.connector,
      questions: split.questions,
    });
  });
  return out;
}

export const COMPOUND_DEALBREAKER_ERROR_PREFIX = "compound_dealbreaker: ";

/** Every finding with its suggested split, readable wherever it is shown. */
export function compoundDealbreakerMessage(found: CompoundDealbreakerFinding[]): string {
  const lines = found.map(
    (f) =>
      `${f.label} ("${f.text}") joins two requirements with "${f.connector}". ` +
      `Suggested: ask "${f.questions[0]}" and "${f.questions[1]}" as two dealbreaker questions.`,
  );
  return (
    `${found.length === 1 ? "One dealbreaker question asks" : `${found.length} dealbreaker questions ask`} ` +
    `for two requirements at once: a candidate with one but not the other can only answer "no" and is excluded. ` +
    lines.join(" | ")
  );
}

export function compoundDealbreakerErrorMessage(found: CompoundDealbreakerFinding[]): string {
  return COMPOUND_DEALBREAKER_ERROR_PREFIX + compoundDealbreakerMessage(found);
}

/** Save paths: throws with every new or edited bundled dealbreaker and its split. */
export function assertNoCompoundDealbreakers(
  questions: ReadonlyArray<ScreeningQuestionLike | null | undefined> | null | undefined,
  opts: { stored?: ReadonlyArray<ScreeningQuestionLike | null | undefined> | null } = {},
): void {
  const found = findCompoundDealbreakers(questions, opts);
  if (found.length > 0) throw new Error(compoundDealbreakerErrorMessage(found));
}

/**
 * The role generator's own drafts. Nobody reviews them before they are
 * stored, so only a bundle joined explicitly ("X as well as Y") is split into
 * two dealbreakers, each with the must-have of its own requirement; the
 * shared rationale is dropped so each half gets a reason from its own
 * must-have. A bundle read heuristically ("both X and Y", "X experience and
 * Y experience") is kept as written but stops being a dealbreaker: it is
 * weighed and excludes nobody. Caps are applied by the caller afterwards.
 */
export function splitGeneratedDealbreakers<
  Q extends { question: string; dealbreaker: boolean; must_have?: string; rationale?: string },
>(questions: readonly Q[]): Q[] {
  return questions.flatMap((q): Q[] => {
    if (!q.dealbreaker) return [q];
    const split = splitCompoundQuestion(q.question);
    if (!split) return [q];
    if (!isExplicitJoiner(split)) return [{ ...q, dealbreaker: false }];
    const mustHaves = splitMustHave(q.must_have, split.questions);
    return split.questions.map((question, i) => {
      const { rationale: _shared, ...rest } = q;
      return { ...rest, question, must_have: mustHaves[i] || undefined } as Q;
    });
  });
}

export type SplittableQuestion = {
  id?: string;
  question: string;
  dealbreaker: boolean;
  required: boolean;
  /** Role editor only: the must-have the question tests. */
  must_have?: string | null;
  /** Role editor only: the reason shown to candidates. */
  why_asked?: string | null;
};

/**
 * What the editors do when the author presses "Split into two questions".
 *
 * The two halves are added as dealbreakers right after the original, each
 * with the must-have and reason of its own requirement (never a copy of the
 * bundled ones). A saved original stays on the role as an optional,
 * non-dealbreaker question, so the answers candidates already gave are kept
 * (deleting a question deletes its answers); an unsaved original is replaced.
 * Returns null when the split would exceed the question limit, so the editor
 * offers keepAsOptionalQuestion instead.
 */
export function applyDealbreakerSplit<Q extends SplittableQuestion>(
  questions: readonly Q[],
  finding: Pick<CompoundDealbreakerFinding, "index" | "questions">,
  limits: { maxQuestions?: number; maxRequired?: number } = {},
): Q[] | null {
  const maxQuestions = limits.maxQuestions ?? SCREENING_MAX_QUESTIONS;
  const maxRequired = limits.maxRequired ?? SCREENING_MAX_REQUIRED;
  const original = questions[finding.index];
  if (!original) return null;
  const others = questions.filter((_, i) => i !== finding.index);
  let requiredLeft = maxRequired - others.filter((q) => q.required).length;
  const { id: _id, ...unsaved } = original;
  const mustHaves = splitMustHave(original.must_have, finding.questions);
  const halves = finding.questions.map((question, i) => {
    const required = original.required && requiredLeft > 0;
    if (required) requiredLeft -= 1;
    const half: SplittableQuestion = { ...unsaved, question, dealbreaker: true, required };
    if ("must_have" in original) half.must_have = mustHaves[i];
    if ("why_asked" in original) half.why_asked = whyAskedFor(mustHaves[i]);
    return half as Q;
  });
  const kept = original.id ? [{ ...original, dealbreaker: false, required: false }] : [];
  const next = [
    ...questions.slice(0, finding.index),
    ...kept,
    ...halves,
    ...questions.slice(finding.index + 1),
  ];
  return next.length > maxQuestions ? null : next;
}

/**
 * The path when a split does not fit (the role is at its question limit):
 * the bundled question stays on the role, with its answers, as an optional
 * question that is weighed and excludes nobody.
 */
export function keepAsOptionalQuestion<Q extends SplittableQuestion>(
  questions: readonly Q[],
  finding: Pick<CompoundDealbreakerFinding, "index">,
): Q[] {
  return questions.map((q, i) =>
    i === finding.index ? { ...q, dealbreaker: false, required: false } : q,
  );
}

/**
 * Blueprint sign-off refuses while a stored dealbreaker bundles two
 * requirements. A short sentence (it is shown as a toast) that names the
 * question and the step that works on this role: the split when it fits,
 * otherwise keeping it as an optional question. Null when nothing is bundled.
 */
export function compoundDealbreakerSignOffMessage(
  rows: ReadonlyArray<{
    id?: string | null;
    question?: string | null;
    dealbreaker?: boolean | null;
    required?: boolean | null;
  }>,
): string | null {
  const questions: SplittableQuestion[] = rows.map((r) => ({
    ...(r.id ? { id: r.id } : {}),
    question: r.question ?? "",
    dealbreaker: r.dealbreaker === true,
    required: r.required === true,
  }));
  const found = findCompoundDealbreakers(questions);
  if (found.length === 0) return null;
  const numbers = found.map((f) => f.index + 1);
  const list =
    numbers.length === 1
      ? String(numbers[0])
      : `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
  const one = found.length === 1;
  const noRoom = found.some((f) => applyDealbreakerSplit(questions, f) === null);
  const head = one
    ? `Screening question ${list} is a dealbreaker asking for two requirements at once.`
    : `Screening questions ${list} are dealbreakers asking for two requirements at once.`;
  const next = noRoom
    ? ` There is no room to split ${one ? "it" : "them"}: in the role editor, keep ${one ? "it as an optional question" : "them as optional questions"}, then confirm.`
    : ` Split ${one ? "it" : "them"} in the role editor, then confirm.`;
  return head + next;
}
