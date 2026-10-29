/**
 * One shared protected-attribute detector.
 *
 * Used by scoring (filters criteria, scrubs generated text), by every place a
 * role's text is saved (intake, admin editor, screening questions), and by the
 * publish gates. Market/country EXPERIENCE ("experience in the South Korean
 * market") is a lawful skill and must never be flagged; who a person IS
 * (nationality, citizenship, ethnicity, age, gender …) is.
 */

export type ProtectedCategory =
  | "nationality"
  | "citizenship"
  | "passport"
  | "ethnicity"
  | "national_origin"
  | "religion"
  | "age"
  | "gender"
  | "marital_status"
  | "family_status"
  | "photo";

export type ProtectedFinding = {
  category: ProtectedCategory;
  match: string;
  /** Plain-English reason shown next to the field. */
  message: string;
  /** Compliant replacement for the whole input text; "" means remove it. */
  rewrite: string;
};

/** Demonyms → the market/language they usually stand in for. */
const DEMONYMS: Record<string, { market: string; language?: string }> = {
  korean: { market: "the South Korean market", language: "Korean" },
  "south korean": { market: "the South Korean market", language: "Korean" },
  singaporean: { market: "the Singapore market" },
  chinese: { market: "the Chinese market", language: "Mandarin" },
  indian: { market: "the Indian market" },
  egyptian: { market: "the Egyptian market", language: "Arabic" },
  british: { market: "the UK market" },
  irish: { market: "the Irish market" },
  pakistani: { market: "the Pakistani market", language: "Urdu" },
  "sri lankan": { market: "the Sri Lankan market" },
  vietnamese: { market: "the Vietnamese market", language: "Vietnamese" },
  japanese: { market: "the Japanese market", language: "Japanese" },
  emirati: { market: "the UAE market", language: "Arabic" },
  arab: { market: "the Arab world", language: "Arabic" },
  arabic: { market: "the Arab world", language: "Arabic" },
  filipino: { market: "the Philippines market", language: "Filipino" },
  american: { market: "the US market" },
  french: { market: "the French market", language: "French" },
  german: { market: "the German market", language: "German" },
  spanish: { market: "the Spanish market", language: "Spanish" },
  italian: { market: "the Italian market", language: "Italian" },
  brazilian: { market: "the Brazilian market", language: "Portuguese" },
  portuguese: { market: "the Portuguese market", language: "Portuguese" },
  russian: { market: "the Russian market", language: "Russian" },
  saudi: { market: "the Saudi market", language: "Arabic" },
  lebanese: { market: "the Lebanese market", language: "Arabic" },
  nigerian: { market: "the Nigerian market" },
  polish: { market: "the Polish market", language: "Polish" },
  thai: { market: "the Thai market", language: "Thai" },
  indonesian: { market: "the Indonesian market", language: "Indonesian" },
  malaysian: { market: "the Malaysian market", language: "Malay" },
  turkish: { market: "the Turkish market", language: "Turkish" },
  mexican: { market: "the Mexican market", language: "Spanish" },
};
const DEMONYM_RE = Object.keys(DEMONYMS)
  .sort((a, b) => b.length - a.length)
  .map((d) => d.replace(/ /g, "\\s+"))
  .join("|");

type Rule = {
  category: ProtectedCategory;
  re: RegExp;
  message: string;
  rewrite: (text: string, m: RegExpMatchArray) => string;
  /** Only applies to hiring criteria, not to CVs/briefings (e.g. "Young Lions award"). */
  criteriaOnly?: boolean;
};

function demonymRewrite(word: string, preferLanguage: boolean): string {
  const d = DEMONYMS[word.toLowerCase().replace(/\s+/g, " ")];
  if (!d) return "";
  if (preferLanguage && d.language) return `${d.language} language skills`;
  return `Experience in ${d.market}`;
}

const RULES: Rule[] = [
  {
    category: "nationality",
    // "Korean nationality", "nationality: Korean", "Arabic national", "must be Singaporean", "Japanese citizen"
    re: new RegExp(
      `\\b(${DEMONYM_RE})\\s+(?:nationality|nationals?|citizens?|citizenship|passport(?:\\s+holders?)?|candidates? only|origin|background|roots|descent)\\b`,
      "i",
    ),
    message: "Nationality can't be a hiring requirement. Ask about the market experience or language you need instead.",
    rewrite: (_t, m) => demonymRewrite(m[1], /arab/i.test(m[1])),
  },
  {
    category: "nationality",
    re: new RegExp(`\\b(?:must|should|need(?:s)? to|has to|have to)\\s+be\\s+(?:an?\\s+)?(${DEMONYM_RE})\\b`, "i"),
    message: "Nationality can't be a hiring requirement. Ask about the market experience or language you need instead.",
    rewrite: (_t, m) => demonymRewrite(m[1], false),
  },
  {
    category: "nationality",
    re: new RegExp(`\\b(?:is|as|an?|be|born|native)\\s+(${DEMONYM_RE})\\s*(?:$|[,.;)])`, "i"),
    message: "Nationality can't be a hiring requirement. Ask about the market experience or language you need instead.",
    rewrite: (_t, m) => demonymRewrite(m[1], false),
  },
  {
    category: "nationality",
    re: /\bnationalit(?:y|ies)\b/i,
    message: "Nationality can't be a hiring requirement. If you need the right to work, ask about work authorisation.",
    rewrite: () => "Right to work in the role's location (or eligible for sponsorship)",
  },
  {
    category: "citizenship",
    re: /\bcitizenship\b|\bcitizens? (?:of|only)\b/i,
    message: "Citizenship can't be required. Ask whether the candidate has the right to work there instead.",
    rewrite: () => "Right to work in the role's location (or eligible for sponsorship)",
  },
  {
    category: "passport",
    re: /\bpassport\b/i,
    message: "Asking for a specific passport screens out by nationality. Ask about right to work instead.",
    rewrite: () => "Right to work in the role's location (or eligible for sponsorship)",
  },
  {
    category: "ethnicity",
    re: /\bethnic(?:ity|ities)?\b|\brac(?:e|ial)\b(?!\s*(?:car|track|condition))|\bskin colou?r\b|\bcaucasian\b/i,
    message: "Ethnicity and race can never be a hiring criterion.",
    rewrite: () => "",
  },
  {
    category: "national_origin",
    re: /\bcountry of (?:birth|origin)\b|\bnational origin\b|\bancestry\b|\bheritage\b|\bdescent\b|\bOCI\b/i,
    message: "National origin can never be a hiring criterion.",
    rewrite: () => "",
  },
  {
    category: "religion",
    re: /\breligio(?:n|us)\b|\b(?:muslim|christian|hindu|jewish|buddhist|sikh)s?\b(?!\s+(?:market|audience|consumers?))/i,
    message: "Religion can never be a hiring criterion.",
    rewrite: () => "",
    criteriaOnly: true,
  },
  {
    category: "age",
    re: /\b(?:under|below|over|above|younger than|older than|not older than|max(?:imum)?\.?|min(?:imum)?\.?)\s+(?:the\s+)?age\s+(?:of\s+)?\d{2}\b|\bage[ds]?\s*(?:limit|range|between|:)?\s*\d{2}\s*(?:-|–|to)\s*\d{2}\b|\b(?:under|below|over|younger than|older than)\s+\d{2}\b(?!\s*(?:years? of experience|\+?\s*years? (?:in|of|experience)|%|people|staff|employees|team|reports|countries|markets|brands|stores|outlets))|\bdate of birth\b/i,
    message: "Age limits are discriminatory. Describe the experience you need instead; this line will be removed.",
    rewrite: () => "",
  },
  {
    category: "age",
    re: /\b(?:young|youthful|recent graduates? only)\b(?!\s+lions?)|\bdigital native\b/i,
    message: "Age-coded wording discourages older applicants. Describe the experience you need instead.",
    rewrite: () => "",
    criteriaOnly: true,
  },
  {
    category: "gender",
    re: /\b(?:male|female|men|women|man|woman|gender|sex)\s+(?:only|candidates?|applicants?|preferred)\b|\b(?:must be|only)\s+(?:a\s+)?(?:male|female|man|woman)\b/i,
    message: "Gender can never be a hiring criterion.",
    rewrite: () => "",
  },
  {
    category: "gender",
    re: /\bgender\b(?!\s+(?:diversity|equality|balance|pay))/i,
    message: "Gender can never be a hiring criterion.",
    rewrite: () => "",
    criteriaOnly: true,
  },
  {
    category: "marital_status",
    re: /\b(?:marital status|married|unmarried|single|divorced)\b(?=[^.]*\b(?:only|preferred|required|candidates?|applicants?|status)\b)|\bmarital status\b/i,
    message: "Marital status can never be a hiring criterion.",
    rewrite: () => "",
  },
  {
    category: "family_status",
    re: /\bpregnan(?:t|cy)\b|\bno (?:kids|children|dependants?|dependents?)\b|\bchildcare (?:commitments|responsibilities)\b|\bfamily (?:status|plans?)\b|\bplanning (?:a family|to have children)\b/i,
    message: "Pregnancy and family status can never be a hiring criterion.",
    rewrite: () => "",
  },
  {
    category: "photo",
    re: /\b(?:photo|photograph|headshot|picture)s?\b[^.]{0,30}\b(?:required|attach|include|upload|send|with (?:cv|resume|application))\b|\b(?:attach|include|upload|send)\b[^.]{0,30}\b(?:photo|photograph|headshot|picture)\b|\bcv with photo\b/i,
    message: "Asking for a photo invites bias on appearance, age and ethnicity.",
    rewrite: () => "",
  },
];

/** All findings for a piece of text. Empty means compliant. */
export function detectProtectedAttributes(
  text: string | null | undefined,
  opts: { context?: "criteria" | "document" } = {},
): ProtectedFinding[] {
  const context = opts.context ?? "criteria";
  const t = (text ?? "").trim();
  if (!t) return [];
  const out: ProtectedFinding[] = [];
  const seen = new Set<ProtectedCategory>();
  for (const rule of RULES) {
    const m = t.match(rule.re);
    if (rule.criteriaOnly && context === "document") continue;
    if (!m || seen.has(rule.category)) continue;
    // "Marketing experience in South Korea…" names places, not people. The
    // demonym rules only fire on identity nouns, so this guards the generic ones.
    seen.add(rule.category);
    out.push({ category: rule.category, match: m[0], message: rule.message, rewrite: rule.rewrite(t, m) });
  }
  return out;
}

export function isProtectedAttributeText(text: string): boolean {
  return detectProtectedAttributes(text).length > 0;
}

/** The single rewrite to offer for a line (first finding wins). "" = remove line. */
export function suggestCompliantRewrite(text: string): string | null {
  const f = detectProtectedAttributes(text);
  return f.length ? f[0].rewrite : null;
}

export type FieldFinding = { field: string; index?: number; text: string; findings: ProtectedFinding[] };

/** Check many named fields (strings, string arrays, or {label|text} arrays). */
export function findProtectedInFields(fields: Record<string, unknown>): FieldFinding[] {
  const out: FieldFinding[] = [];
  const asText = (v: unknown): string | null => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const s = o.label ?? o.text ?? o.name ?? o.requirement ?? o.question;
      return typeof s === "string" ? s : null;
    }
    return null;
  };
  for (const [field, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      value.forEach((v, index) => {
        const text = asText(v);
        if (!text) return;
        // Long prose: check sentence by sentence so the finding names one line.
        const findings = detectProtectedAttributes(text);
        if (findings.length) out.push({ field, index, text, findings });
      });
    } else {
      const text = asText(value);
      if (!text) continue;
      for (const sentence of splitSentences(text)) {
        const findings = detectProtectedAttributes(sentence);
        if (findings.length) out.push({ field, text: sentence, findings });
      }
    }
  }
  return out;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/** Scrub every nested generated text field without touching raw source documents. */
export function sanitizeGeneratedText<T>(value: T): T {
  if (typeof value === "string") return removeProtectedSentences(value) as T;
  if (Array.isArray(value)) return value.map(sanitizeGeneratedText).filter((item) => item !== "") as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeGeneratedText(item)])) as T;
  }
  return value;
}

export function removeProtectedSentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => detectProtectedAttributes(sentence, { context: "document" }).length === 0)
    .join(" ");
}
