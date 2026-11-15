/**
 * A written screening answer as evidence (v1.7.7).
 *
 * "Tell us about a time you got people to finish on schedule" is answered in
 * the candidate's own words, and a concrete account of what they did is the
 * most direct evidence there is for that requirement. Before this, only a
 * yes/no answer was linked to its requirement; a written answer counted only
 * where it happened to repeat the requirement's words.
 *
 *  - concrete: what the person did, in the past tense, with a result or the
 *    people involved ("I worked with our vendor to automate…; missing slips
 *    fell by 50% in two days").
 *  - general: a real answer that describes an approach or a view, not an
 *    occasion ("Being a hands-on manager helps the team…", "I would…").
 *  - none: empty, a few words, or "n/a".
 */
export type BehaviouralAnswer = "concrete" | "general" | "none";

const PAST_ACTION =
  /\b(?:i|we)\s+(?:also\s+|then\s+|first\s+|personally\s+)?(?:worked|sent|followed|established|implemented|automated|built|created|set\s+up|introduced|aligned|held|ran|led|developed|cut|reduced|decreased|increased|improved|trained|tracked|monitored|scheduled|met|called|emailed|reviewed|escalated|supported|managed|communicated|designed|launched|rolled\s+out|started|began|organi[sz]ed|coordinated|partnered|negotiated|resolved|fixed|streamlined|standardi[sz]ed|wrote|drafted|prepared|presented|chased|reminded|provided|gave|took|made|used|moved|changed|replaced|migrated|hired|coached|mentored|handled|got|asked|agreed|assigned|delegated)\b/gi;
/** A clause carried by the same subject: "…, communicated clear deadlines, monitored …". */
const PAST_LIST =
  /,\s*(?:and\s+)?(?:communicated|monitored|held|sent|tracked|followed|established|reviewed|escalated|scheduled|built|created|trained|reduced|improved)\b/gi;
const CONDITIONAL =
  /\b(?:i\s+would|i['’]d|we\s+should|i\s+will|i\s+could|you\s+should|one\s+should|we\s+would)\b/gi;
const RESULT =
  /\b\d+(?:\.\d+)?\s*%|\b\d+\s+(?:days?|weeks?|months?|hours?|providers|attorneys|lawyers|partners|people|staff|clients|sites|offices|invoices)\b|\b(?:by|from)\s+\d+\b|\b(?:went\s+out|finished|completed|delivered|closed)\s+on\s+(?:schedule|time)\b/i;
const NEGATIVE_OPENING =
  /^\s*(?:i\s+have\s+not|i\s+haven['’]t|i\s+have\s+never|no\s+experience|i\s+do\s+not\s+have|i\s+don['’]t\s+have|never\b|not\s+yet)/i;
const EMPTY = /^\s*(?:n\/?a|none|no|nil|not\s+applicable|-+|\.+)\s*\.?\s*$/i;

export function judgeBehaviouralAnswer(text: string | null | undefined): BehaviouralAnswer {
  const t = (text ?? "").trim();
  if (t.length < 40 || EMPTY.test(t)) return "none";
  const past = (t.match(PAST_ACTION) ?? []).length + (t.match(PAST_LIST) ?? []).length;
  // "I have not done this" is an answer, and it is not evidence.
  if (NEGATIVE_OPENING.test(t) && past < 2) return "none";
  const conditional = (t.match(CONDITIONAL) ?? []).length;
  const result = RESULT.test(t);
  if (past >= 2 && past > conditional) return "concrete";
  if (past >= 1 && result && past > conditional) return "concrete";
  return "general";
}
