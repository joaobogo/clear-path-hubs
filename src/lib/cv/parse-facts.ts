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

/** "6+ years of experience" / "6 anos de experiência" → 6. Largest claim wins. */
export function extractYearsExperience(cvText: string): number | null {
  const re =
    /(\d{1,2})\s*\+?\s*(?:years?|anos?)\s+(?:of\s+|de\s+)?(?:professional\s+|profissional\s+)?(?:experience|experi[êe]ncia)/gi;
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cvText)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n <= 60 && (best === null || n > best)) best = n;
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

export function parseCvFacts(cvText: string): ParsedCvFacts {
  const text = cvText ?? "";
  return {
    years_experience: extractYearsExperience(text),
    languages: extractLanguages(text),
    skills: extractSkills(text),
    linkedin_url: extractLinkedinUrl(text),
  };
}
