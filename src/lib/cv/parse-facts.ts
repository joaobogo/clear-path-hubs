/**
 * Deterministic CV fact extraction — the fallback behind "Parsed facts".
 *
 * The profile hydration step (LLM) fills these fields when it can; when it
 * cannot — Portuguese section headings, unusual layouts — the evidence record
 * showed "YEARS EXPERIENCE —", "LANGUAGES —", "SKILLS —" for candidates whose
 * CVs plainly listed all three, and the client page said "LinkedIn Not
 * provided" against a CV containing the URL (audit S-20). These extractors are
 * plain pattern matching over the raw text: same input, same output, in both
 * English and Portuguese.
 */

export type ParsedCvFacts = {
  years_experience: number | null;
  languages: string[];
  skills: string[];
  linkedin_url: string | null;
};

/** Section headings that introduce a language list, EN + PT. */
const LANGUAGE_HEADINGS = /^(languages?|idiomas?)\s*[:\-–—]?\s*$/i;
/** Section headings that introduce a skill list, EN + PT. */
const SKILL_HEADINGS =
  /^(skills|technical skills|core skills|habilidades|compet[êe]ncias|tecnologias|ferramentas)\s*[:\-–—]?\s*$/i;
/** Any section heading — ends the section we are collecting. */
const ANY_HEADING =
  /^[A-ZÀ-Ü][A-ZÀ-Ü &/]{2,40}$|^(experience|education|summary|profile|projects|certifications|experi[êe]ncia|educa[çc][ãa]o|forma[çc][ãa]o|resumo|projetos|certifica[çc][õo]es)\s*[:\-–—]?\s*$/i;

const KNOWN_LANGUAGES = [
  "english", "inglês", "ingles", "portuguese", "português", "portugues",
  "spanish", "espanhol", "español", "espanol", "french", "francês", "frances",
  "german", "alemão", "alemao", "italian", "italiano", "japanese", "japonês",
  "japones", "mandarin", "mandarim", "chinese", "chinês", "chines", "dutch",
  "holandês", "holandes", "korean", "coreano", "russian", "russo", "arabic",
  "árabe", "arabe", "hindi",
];

function splitList(line: string): string[] {
  return line
    .split(/[,;•·|]/)
    .map((s) => s.trim().replace(/[.]+$/, ""))
    .filter((s) => s.length >= 2 && s.length <= 60);
}

/** Spelled-out counts. CVs write "eleven years" as often as "11 years". */
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30,
  um: 1, dois: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20,
};

const COUNT = `(\\d{1,2}|${Object.keys(WORD_NUMBERS).join("|")})`;

/**
 * Doing-words that make "N years <x>" a claim about working, not about
 * anything else a span of years could describe. Kept to professional activity
 * on purpose: "three years at university" and "two years ago" must not read as
 * experience, which is why this is a list rather than "any word".
 */
const DOING =
  "building|leading|running|developing|delivering|designing|engineering|" +
  "shipping|working|writing|managing|owning|maintaining|architecting|" +
  "consulting|contracting|programming|coding|construindo|liderando|trabalhando";

/**
 * "6+ years of experience", "eleven years building production React",
 * "9 anos de experiência" → the number. Largest claim wins.
 *
 * The pattern used to require the literal phrase "years of experience", and
 * digits only. A CV reading "eleven years building production React and
 * TypeScript applications" — which is the better sentence, and how strong CVs
 * are actually written — yielded nothing, so the profile had no years and the
 * candidate's row rendered without the "N yrs" line every other row carries.
 * It looked like a rendering bug on one candidate; it was the parser declining
 * to read ordinary English.
 */
export function extractYearsExperience(cvText: string): number | null {
  const patterns = [
    // "…N years of professional experience" — the original, now word-aware.
    new RegExp(
      `${COUNT}\\s*\\+?\\s*(?:years?|anos?)\\s+(?:of\\s+|de\\s+)?` +
        `(?:professional\\s+|profissional\\s+)?(?:experience|experi[êe]ncia)`,
      "gi",
    ),
    // "…N years building X" — a span of years spent doing the work.
    new RegExp(`${COUNT}\\s*\\+?\\s*(?:years?|anos?)\\s+(?:${DOING})\\b`, "gi"),
  ];

  let best: number | null = null;
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(cvText)) !== null) {
      const raw = m[1]!.toLowerCase();
      const n = WORD_NUMBERS[raw] ?? Number(raw);
      if (Number.isFinite(n) && n > 0 && n <= 60 && (best === null || n > best)) best = n;
    }
  }
  return best;
}

/**
 * Language list from a LANGUAGES/IDIOMAS section, or inline statements
 * ("Fluent in English", "Inglês: fluente", "English: Fluent (C1)").
 */
export function extractLanguages(cvText: string): string[] {
  const out = new Map<string, string>(); // lowercase name -> display line
  const lines = cvText.split(/\r?\n/).map((l) => l.trim());

  for (let i = 0; i < lines.length; i += 1) {
    if (!LANGUAGE_HEADINGS.test(lines[i]!)) continue;
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j += 1) {
      const line = lines[j]!;
      if (!line || ANY_HEADING.test(line)) break;
      for (const item of splitList(line)) {
        const lower = item.toLowerCase();
        if (KNOWN_LANGUAGES.some((k) => lower.includes(k))) out.set(lower, item);
      }
    }
  }

  // Inline statements anywhere in the text.
  for (const lang of KNOWN_LANGUAGES) {
    const re = new RegExp(
      `\\b${lang}\\b\\s*[:\\-–—]?\\s*(fluent|fluente|native|nativo|nativa|advanced|avan[çc]ado|intermediate|intermedi[áa]rio|basic|b[áa]sico|c1|c2|b1|b2)`,
      "i",
    );
    const m = cvText.match(re);
    if (m) {
      const key = lang.toLowerCase();
      if (![...out.keys()].some((k) => k.includes(key))) {
        out.set(key, `${m[0].charAt(0).toUpperCase()}${m[0].slice(1)}`);
      }
    }
    const re2 = new RegExp(`\\b(fluent in|fluente em)\\s+${lang}\\b`, "i");
    const m2 = cvText.match(re2);
    if (m2 && ![...out.keys()].some((k) => k.includes(lang))) {
      out.set(lang, `${lang.charAt(0).toUpperCase()}${lang.slice(1)} (fluent)`);
    }
  }

  return [...out.values()].slice(0, 8);
}

/** Skill list from a SKILLS/HABILIDADES/COMPETÊNCIAS/TECNOLOGIAS section. */
export function extractSkills(cvText: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const lines = cvText.split(/\r?\n/).map((l) => l.trim());
  for (let i = 0; i < lines.length; i += 1) {
    if (!SKILL_HEADINGS.test(lines[i]!)) continue;
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j += 1) {
      const line = lines[j]!;
      if (!line || ANY_HEADING.test(line)) break;
      for (const item of splitList(line)) {
        const key = item.toLowerCase();
        // A skill token, not a sentence.
        if (item.split(/\s+/).length > 5) continue;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(item);
        }
      }
    }
  }
  return out.slice(0, 30);
}

/** First linkedin.com/in/... URL in the text, normalised with https://. */
export function extractLinkedinUrl(cvText: string): string | null {
  const m = cvText.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_.%]+/i);
  if (!m) return null;
  const url = m[0].replace(/[.,;)]+$/, "");
  return url.startsWith("http") ? url : `https://${url}`;
}

/**
 * True when extracted "text" is binary garbage rather than prose (audit #3
 * finding 4: a CV whose extraction produced raw PDF bytes was scored 28.6 and
 * its byte soup quoted as evidence). Three cheap signals, all of which real
 * CVs pass comfortably in any latin-script language:
 *   - printable ratio: most characters are letters/digits/punctuation/space
 *   - letter ratio: a meaningful share are actual letters
 *   - replacement characters (�) are rare
 */
export function isGarbageCvText(text: string | null | undefined): boolean {
  const t = (text ?? "").slice(0, 20_000);
  if (t.length < 60) return false; // emptiness is handled elsewhere
  let printable = 0;
  let letters = 0;
  let replacement = 0;
  for (const ch of t) {
    const code = ch.codePointAt(0)!;
    if (code === 0xfffd) {
      replacement += 1;
      continue;
    }
    if (
      (code >= 0x20 && code <= 0x7e) ||
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0xc0 && code <= 0x17f) || // latin-1 supplement + extended-A
      code === 0x2013 || code === 0x2014 || code === 0x2019 || code === 0x201c ||
      code === 0x201d || code === 0x2022 || code === 0x00b7
    ) {
      printable += 1;
      if (/\p{L}/u.test(ch)) letters += 1;
    }
  }
  const n = t.length;
  return printable / n < 0.85 || letters / n < 0.35 || replacement / n > 0.05;
}

export function parseCvFacts(cvText: string): ParsedCvFacts {
  const text = cvText ?? "";
  return {
    years_experience: extractYearsExperience(text),
    languages: extractLanguages(text),
    skills: extractSkills(text),
    linkedin_url: extractLinkedinUrl(text),
  };
}
