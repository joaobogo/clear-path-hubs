/**
 * Inclusive-language check with an explanation, never a score.
 *
 * Findings are advisory: they explain why a span narrows the pool and offer a
 * neutral alternative. Nothing is rewritten automatically and no number is
 * produced. The one exception is the prohibited set (nationality, age, health
 * and friends), which blocks publishing outright.
 */

import { findProhibitedContent } from "./work-authorisation";

export type LanguageCategory =
  | "gendered"
  | "age_coded"
  | "ableist"
  | "culture_fit"
  | "language_nativeness"
  | "unjustified_threshold"
  | "superlative"
  | "prohibited";

export type LanguageFinding = {
  span: string;
  category: LanguageCategory;
  /** Why this narrows the pool. Plain English, one line. */
  reason: string;
  /** A neutral alternative the client may accept or ignore. */
  suggestion: string;
  /** Only the prohibited set blocks publishing. */
  blocking: boolean;
};

type Rule = {
  pattern: RegExp;
  category: LanguageCategory;
  reason: string;
  suggestion: string;
};

const RULES: Rule[] = [
  {
    pattern: /\b(he\/she|s\/he|his\/her|guys|salesman|salesmen|manpower|chairman)\b/gi,
    category: "gendered",
    reason: "Gendered wording measurably reduces applications from people it excludes.",
    suggestion: "Use 'they', 'the team' or a neutral job noun.",
  },
  {
    pattern: /\b(young|youthful|digital native|recent graduate|fresh out of|energetic team of young)\b/gi,
    category: "age_coded",
    reason: "Age-coded wording is an age proxy and is unlawful in most markets.",
    suggestion: "Describe the skill or stage of career instead — unless this is a genuine graduate programme, in which case say so.",
  },
  {
    pattern: /\b(walk-in|stand up in front of|able-bodied|see clearly|hear clearly)\b/gi,
    category: "ableist",
    reason: "Physical framing excludes people who could do the job with an adjustment.",
    suggestion: "State the task, not the body: 'present to stakeholders', 'review written material'.",
  },
  {
    pattern: /\b(culture fit|cultural fit|work hard,? play hard|like a family|rockstar|ninja|guru|wear many hats)\b/gi,
    category: "culture_fit",
    reason: "Culture-fit and mascot language says nothing checkable and filters for sameness.",
    suggestion: "Describe how the team actually works: hours, autonomy, review cadence.",
  },
  {
    pattern: /\b(native (english|speaker)|mother tongue|native-level)\b/gi,
    category: "language_nativeness",
    reason: "Nativeness is a nationality proxy, and fluency is what the job needs.",
    suggestion: "State the level required, e.g. 'professional written and spoken English'.",
  },
  {
    pattern: /\b(\d{1,2})\+? years'? (of )?experience\b|\b(bachelor'?s|master'?s|degree) (required|essential)\b/gi,
    category: "unjustified_threshold",
    reason: "Year and degree thresholds cut strong candidates unless the outcome genuinely needs them.",
    suggestion: "Tie it to an outcome, or move it to the trainable column.",
  },
  {
    pattern: /\b(perfect candidate|ideal candidate|world-class|best-in-class|rock ?solid|superstar|unicorn)\b/gi,
    category: "superlative",
    reason: "Unearned superlatives read as noise and discourage strong, careful applicants.",
    suggestion: "Say what the person will do in the first 90 days instead.",
  },
];

/** Every finding in a draft, in the order they appear. Never a score. */
export function findLanguageIssues(draft: string): LanguageFinding[] {
  const text = typeof draft === "string" ? draft : "";
  if (!text.trim()) return [];

  const findings: LanguageFinding[] = [];

  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      findings.push({
        span: m[0],
        category: rule.category,
        reason: rule.reason,
        suggestion: rule.suggestion,
        blocking: false,
      });
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }

  for (const p of findProhibitedContent(text)) {
    findings.push({
      span: p.span,
      category: "prohibited",
      reason: p.reason,
      suggestion: "Remove this. It cannot be published.",
      blocking: true,
    });
  }

  return findings;
}

/** Publishing is blocked only by the prohibited set. */
export function hasBlockingLanguageFinding(draft: string): boolean {
  return findLanguageIssues(draft).some((f) => f.blocking);
}
