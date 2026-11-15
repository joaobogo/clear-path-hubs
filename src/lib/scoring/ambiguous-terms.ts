/**
 * Words that mean something else inside a set phrase (v1.7.7).
 *
 * A requirement keyword is one word; a CV uses the same word inside phrases
 * that have nothing to do with the requirement. "engagement" in "engagement
 * terms" is not "Employee Engagement groups"; "office" in "the Woodbridge
 * office" is not "Microsoft Office"; "time" in "time entry" is not
 * "full-time". A hit inside one of these phrases is not evidence, unless the
 * requirement itself uses that phrase.
 *
 * Data, not inference: the same table and CV always give the same result.
 */
const UNRELATED: Record<string, RegExp> = {
  engagement:
    /\b(?:employee|staff|customer|client|community|social(?:\s+media)?|user|audience|stakeholder|fan|brand)\s+engagements?\b|\bengagements?\s+(?:groups?|committees?|surveys?|scores?|rates?|metrics|activities|events|initiatives|rings?)\b/i,
  office:
    /\b(?:microsoft|ms)\s+office\b|\boffice\s+(?:365|suite|products|applications|apps|manager|administrator|assistant|supplies)\b|\b(?:front|back|box|post)\s+office\b/i,
  time: /\b(?:full|part|real|first|long|short)[-\s]?time\b|\bon\s+time\b|\btime\s+(?:management|zone|zones|frame|frames)\b|\b(?:at\s+a|over|every|each|same|one)\s+time\b|\btimely\b/i,
  entry:
    /\b(?:data|order|journal|double|ledger|market|point\s+of)[-\s]entr(?:y|ies)\b|\bentry[-\s]level\b/i,
  terms: /\bin\s+terms\s+of\b|\b(?:long|short|mid|medium|near)[-\s]terms?\b/i,
  rate: /\b(?:interest|exchange|success|turnover|retention|attrition|error|growth|response|conversion|utili[sz]ation|occupancy|click|open|bounce|denial|tax)\s+rates?\b|\bfirst[-\s]rate\b/i,
  full: /\bfull[-\s]?(?:time|charge|stack|service)\b/i,
  end: /\b(?:month|year|quarter|week|day|front|back|high|low|week)[-\s]end\b|\bend[-\s](?:users?|clients?|customers?)\b/i,
  new: /\bnew\s+(?:york|jersey|hampshire|mexico|zealand|delhi|orleans|haven)\b/i,
  days: /\b\d+\s+days\b|\b(?:business|working|calendar)\s+days\b/i,
  review: /\b(?:performance|peer|code|annual|quarterly)\s+reviews?\b/i,
  bill: /\bbill\s+(?:of\s+(?:lading|materials)|gates|clinton)\b/i,
};

/** Characters each side of a hit that are read for a set phrase. */
const WINDOW = 28;

/**
 * True when the hit of `term` at `at` in `text` sits inside a phrase that
 * gives the word another meaning, and the requirement does not use that
 * phrase itself.
 */
export function isUnrelatedCompound(
  term: string,
  form: string,
  text: string,
  at: number,
  requirementText: string,
): boolean {
  const lower = term.toLowerCase();
  const singular = lower.replace(/ies$/, "y").replace(/s$/, "");
  const re = UNRELATED[lower] ?? UNRELATED[singular];
  if (!re) return false;
  if (re.test(requirementText)) return false;
  const from = Math.max(0, at - WINDOW);
  const around = text.slice(from, at + form.length + WINDOW);
  const hitAt = at - from;
  // The phrase must contain the hit itself.
  for (const m of around.matchAll(new RegExp(re.source, "gi"))) {
    if (m.index <= hitAt && m.index + m[0].length >= hitAt + Math.min(form.length, 3)) return true;
  }
  return false;
}
