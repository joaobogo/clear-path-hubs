/**
 * Which passages may count as requirement evidence (owner, 2 Nov 2026 —
 * Hughes Mushrooms research, platform issues 2 and 3).
 *
 * 1. The role's own words are not evidence. A work-authorisation answer that
 *    said "I would require sponsorship from Hughes Mushrooms" was crediting
 *    both mushroom must-haves, and a CV summary "seeking to apply ... to the
 *    Mushroom Harvesting Manager role" met "Previous experience as a
 *    Harvesting Manager". `maskNonEvidence` blanks, before any term is
 *    searched:
 *      - the client organisation's name, except in a dated work entry (a
 *        former employee of the client keeps that evidence);
 *      - the role title where the passage is about this application (it
 *        names the client, says "apply for/to", "this role", "the advertised
 *        position", or calls the title "the ... role"), never in a dated work
 *        entry: the same title held at another employer stays evidence;
 *      - the aspirational clause itself: "I want to", "I would like to",
 *        "seeking", "looking for", "interested in", "aspire to", "applying
 *        for ... role", up to the clause's end (a comma, semicolon, "and" or
 *        full stop; the target role when it names one) and never past a fact
 *        ("that I supervised", "my eight years", "15 years").
 *    Masking keeps every offset, so quotes and locations still point at the
 *    original text. Clauses about learning ("I would like to learn X") are
 *    left to the negation cues, which already read them as a denial.
 *
 * 2. Study and training are not employment. A student member of a college
 *    mushroom centre was scored as hands-on commercial picking and picking-
 *    team supervision. `studyContextOf` marks passages in education, course,
 *    training or qualification sections (a section ends at the next heading
 *    of any kind, or at a dated job entry), entries whose header names study
 *    (a student role, a course or training, a university project, a
 *    university or college without a job title), and passages with an
 *    explicit cue of the candidate's own study (coursework, modules, a
 *    dissertation, "as a student", "completed a ... course"). The bare words
 *    "training", "course" or "students" never mark a passage, and inside a
 *    dated job entry only a bullet that opens with study ("Studied",
 *    "Completed a ... course") is study. For experience requirements such
 *    passages count as partial at most: real credit for genuine student work,
 *    never the same as doing the job. Degree and qualification requirements
 *    are not experience requirements and are unaffected.
 *
 * Pure functions; the engine (scoring-engine.server.ts) applies them, so the
 * live pipeline, offline rescore and replay read evidence the same way.
 */

export type RoleContext = {
  /** The client organisation's names (registered name, brand display name). */
  organisation_names: string[];
  /** The title of the role being scored. */
  role_title: string | null;
};

const LEGAL_SUFFIX = /[\s,]+(?:ltd\.?|limited|plc|inc\.?|llc|llp|gmbh|pty\.?(?:\s+ltd\.?)?)$/i;
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Accepts a stored or caller-supplied context and drops what cannot match. */
export function normaliseRoleContext(
  ctx: Partial<RoleContext> | null | undefined,
): RoleContext | null {
  if (!ctx) return null;
  const names: string[] = [];
  for (const raw of ctx.organisation_names ?? []) {
    const name = clean(raw);
    if (name.length >= 3 && !names.some((n) => n.toLowerCase() === name.toLowerCase()))
      names.push(name);
  }
  const title = clean(ctx.role_title);
  if (names.length === 0 && title.length < 3) return null;
  return { organisation_names: names, role_title: title.length >= 3 ? title : null };
}

/** The role context from the organisation and position records. */
export function roleContextOf(input: {
  organisation_name?: string | null;
  brand_display_name?: string | null;
  role_title?: string | null;
}): RoleContext | null {
  const names: string[] = [];
  for (const raw of [input.organisation_name, input.brand_display_name]) {
    const name = clean(raw);
    if (name) names.push(name, name.replace(LEGAL_SUFFIX, "").trim());
  }
  return normaliseRoleContext({ organisation_names: names, role_title: input.role_title ?? null });
}

// ---------- units: sentences, bullet items, entry lines and headings ----------

/** Bullet glyphs, plus the private-use Symbol/Wingdings bullets PDF text extracts to. */
const BULLET_CHARS = "•▪●⚫◦■‣⁃" + String.fromCharCode(0xf0b7, 0xf0a7, 0xf076, 0xf0d8, 0xf0fc);
const BULLET = new RegExp(`[${BULLET_CHARS}]`);
/**
 * A bullet line: a bullet glyph or "- " / "* ", or an indented line — PDF
 * extraction often drops the glyph and keeps the indent (" Two-year
 * association with ...").
 */
const LINE_BULLET = new RegExp(`^(?:[ \\t]*[${BULLET_CHARS}]|[ \\t]*[-*]\\s|[ \\t]+\\S)`);

const ACADEMIC_HEADINGS = new Set([
  "EDUCATION",
  "EDUCATIONAL",
  "ACADEMIC",
  "ACADEMICS",
  "COURSEWORK",
  "COURSE",
  "COURSES",
  "TRAINING",
  "TRAININGS",
  "QUALIFICATION",
  "QUALIFICATIONS",
  "CERTIFICATION",
  "CERTIFICATIONS",
  "CERTIFICATES",
  "DISSERTATION",
  "THESIS",
  "EXTRACURRICULAR",
  "EXTRA-CURRICULAR",
  "SOCIETIES",
  "EDUCAÇÃO",
  "EDUCACAO",
  "FORMAÇÃO",
  "FORMACAO",
  "CURSOS",
]);
const WORK_HEADINGS = new Set([
  "EXPERIENCE",
  "EXPERIENCES",
  "EMPLOYMENT",
  "CAREER",
  "HISTORY",
  "SKILLS",
  "SUMMARY",
  "PROFILE",
  "OBJECTIVE",
  "LANGUAGES",
  "INTERESTS",
  "HOBBIES",
  "REFERENCES",
  "REFEREES",
  "INFORMATION",
  "DETAILS",
  "STRENGTHS",
  "ACHIEVEMENTS",
  "ACCOMPLISHMENTS",
  "COMPETENCIES",
  "EXPERTISE",
  "VOLUNTEERING",
  "OVERVIEW",
  "BACKGROUND",
  "HIGHLIGHTS",
  "FOOTPRINT",
  "RECORD",
  "POSITIONS",
  "ROLES",
  "EXPERIÊNCIA",
  "EXPERIENCIA",
  "HABILIDADES",
  "COMPETÊNCIAS",
  "RESUMO",
  "PERFIL",
  "IDIOMAS",
]);
/** Headings that name neither study nor work ("PROJECTS"): they end a section. */
const NEUTRAL_HEADINGS = new Set([
  "PROJECTS",
  "PUBLICATIONS",
  "PRESENTATIONS",
  "AWARDS",
  "HONOURS",
  "HONORS",
  "MEMBERSHIPS",
]);
const HEADING_CONNECTORS = new Set(["&", "/", "-", "–", "AND", "E", "OF"]);
/** Job nouns: a line naming one is a job title or an employer entry, not a heading or a course. */
const JOB_WORD =
  /\b(?:manager|management|technician|assistant|officer|supervisor|worker|lead|leader|head|consultant|engineer|analyst|researcher|scientist|co-?ordinator|executive|director|administrator|advis[eo]r|specialist|lecturer|tutor|teacher|demonstrator|intern|apprentice|associate|operative|operator|picker|packer|grower|harvester|porter|driver|chef|cook|nurse|clerk|receptionist|technologist|agronomist|biologist|chemist|microbiologist|founder|owner|partner|employee|labourer|foreman|attendant|carer|developer|designer|planner|buyer|inspector|auditor|controller|accountant|postdoc|postdoctoral|fellow|volunteer|editor|president|captain)s?\b/i;

/**
 * A section heading. `generic` marks a heading-like line or capitals run that
 * ends in no recognised heading word ("GEOGRAPHIC FOOTPRINT", "Career
 * Highlights"): it is read only to end an education or training section.
 */
type Heading = { start: number; end: number; academic: boolean; generic: boolean };
type Unit = { start: number; end: number; bullet: boolean; heading: Heading | null };

const bare = (token: string) => token.replace(/^[^\p{L}]+|[^\p{L}-]+$/gu, "").toUpperCase();
const isAcademicHeading = (words: string[]) =>
  words.some((w) => ACADEMIC_HEADINGS.has(w)) && !words.some((w) => WORK_HEADINGS.has(w));
const endsInHeadingWord = (words: string[]) => {
  const last = words[words.length - 1] ?? "";
  return ACADEMIC_HEADINGS.has(last) || WORK_HEADINGS.has(last) || NEUTRAL_HEADINGS.has(last);
};
const endsAcademic = (words: string[]) => ACADEMIC_HEADINGS.has(words[words.length - 1] ?? "");
const isCapitalsToken = (t: string) => /\p{Lu}.*\p{Lu}/u.test(t) && !/\p{Ll}|\d/u.test(t);

/**
 * Words that put a capitals run or short line inside an education entry
 * ("UNIVERSITY OF DELHI", "MBA INSEAD", "BSC BOTANY"): never a generic heading.
 */
const INSTITUTION_WORD =
  /\b(?:university|universidade|universidad|college|school|institute|institut|academy|polytechnic|faculty|campus|mba|bsc|msc|ba|ma|bba|bcom|mcom|beng|meng|llb|llm|phd|dphil|hons|degree|diploma|certificate|bachelor|bachelors|master|masters|gcse|gcses|a-levels?|baccalaureate)\b/i;

/**
 * A heading-like run or line that names no recognised heading word: two to
 * five words, none a job noun, an institution or a qualification, at least
 * one of five letters or more (so "UAE GCC KSA" is not a heading), no commas
 * or digits.
 */
function isGenericHeading(words: string[], textOf: string): boolean {
  const real = words.filter((w) => /\p{L}{2,}/u.test(w));
  return (
    real.length >= 2 &&
    real.length <= 5 &&
    real.some((w) => w.replace(/[^\p{L}]/gu, "").length >= 5) &&
    !/[,\d]/.test(textOf) &&
    !JOB_WORD.test(textOf) &&
    !INSTITUTION_WORD.test(textOf)
  );
}

/**
 * Section headings: a run of capitals ending in a heading word ("EDUCATION",
 * "TRAINING & CERTIFICATIONS (SELECTED)", "RELEVANT ... LABORATORY
 * EXPERIENCE") — which also finds them inside a CV stored as one line — or a
 * short title-case line ending in one ("Work Experience"). A document written
 * mostly in capitals has no capitalised headings to tell apart, so only its
 * short standalone lines are read as headings there. A job title is never a
 * heading ("HEAD OF TRAINING").
 *
 * With `generic`, other heading-like runs and lines are returned too, marked
 * generic and never academic ("GEOGRAPHIC FOOTPRINT", "Career Highlights").
 */
function findHeadings(text: string, generic = false): Heading[] {
  const out: Heading[] = [];
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const capitals = text.match(/\p{Lu}/gu)?.length ?? 0;
  const mostlyCapitals = letters > 0 && capitals / letters > 0.6;

  if (!mostlyCapitals) {
    const tokens = [...text.matchAll(/\S+/g)];
    const inRun = (t: string) =>
      isCapitalsToken(t) || HEADING_CONNECTORS.has(t) || /^\(\p{Lu}+\)$/u.test(t);
    let i = 0;
    while (i < tokens.length) {
      if (!isCapitalsToken(tokens[i]![0])) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < tokens.length && inRun(tokens[j + 1]![0])) j++;
      const run = tokens.slice(i, j + 1);
      const words = run
        .filter((t) => !/^\(.*\)$/.test(t[0]))
        .map((t) => bare(t[0]))
        .filter(Boolean);
      const runText = run.map((t) => t[0]).join(" ");
      const last = run[run.length - 1]!;
      if (run.length <= 10 && endsInHeadingWord(words) && !JOB_WORD.test(runText)) {
        out.push({
          start: run[0]!.index!,
          end: last.index! + last[0].length,
          academic: isAcademicHeading(words),
          generic: false,
        });
      } else if (generic && run.length <= 10 && endsInHeadingWord(words) && !endsAcademic(words)) {
        // "EXECUTIVE SUMMARY": a job noun before a work heading word is not a
        // job title ("HEAD OF TRAINING" is), so it still ends a section.
        out.push({
          start: run[0]!.index!,
          end: last.index! + last[0].length,
          academic: false,
          generic: true,
        });
      } else if (generic) {
        // A generic run never ends on a connector ("SALES &").
        let g = run.length - 1;
        while (g > 0 && HEADING_CONNECTORS.has(run[g]![0])) g--;
        const head = run.slice(0, g + 1);
        const headText = head.map((t) => t[0]).join(" ");
        const end = head[g]!;
        if (head.length <= 6 && isGenericHeading(headText.split(" ").map(bare), headText)) {
          out.push({
            start: head[0]!.index!,
            end: end.index! + end[0].length,
            academic: false,
            generic: true,
          });
        }
      }
      i = j + 1;
    }
  }

  let at = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim().replace(/[:\s]+$/, "");
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (
      words.length > 0 &&
      words.length <= 5 &&
      !/\d/.test(trimmed) &&
      words.every((w) => /^[\p{Lu}&/(–-]/u.test(w) || HEADING_CONNECTORS.has(w.toUpperCase()))
    ) {
      const upperWords = words.map(bare).filter(Boolean);
      const start = at + line.indexOf(trimmed);
      const known = out.some((h) => h.start <= start && start < h.end);
      if (endsInHeadingWord(upperWords) && !known && !JOB_WORD.test(trimmed)) {
        out.push({
          start,
          end: start + trimmed.length,
          academic: isAcademicHeading(upperWords),
          generic: false,
        });
      } else if (
        generic &&
        !known &&
        !/[.!?]$/.test(trimmed) &&
        ((endsInHeadingWord(upperWords) && !endsAcademic(upperWords)) ||
          isGenericHeading(words, trimmed))
      ) {
        out.push({ start, end: start + trimmed.length, academic: false, generic: true });
      }
    }
    at += line.length + 1;
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Split text into the units a reader takes as one statement: sentences,
 * bullet items, entry lines and headings. A line that wraps mid-sentence (it
 * ends on a lower-case word or a comma, or the next line starts in lower
 * case) continues the unit; a blank line, a bullet or a heading ends it.
 */
function segment(text: string, genericHeadings = false): { units: Unit[]; headings: Heading[] } {
  const headings = findHeadings(text, genericHeadings);
  const cuts = new Set<number>([0]);
  for (const h of headings) {
    cuts.add(h.start);
    cuts.add(h.end);
  }
  // A sentence ends at . ! ? before a word that does not start in lower case
  // ("e.g. the" and "(Hons.) in" do not end one).
  for (const m of text.matchAll(/[.!?](?=\s+(?!\p{Ll})|\s*$)/gu)) cuts.add(m.index! + 1);
  for (let i = 0; i < text.length; i++) if (BULLET.test(text[i]!)) cuts.add(i);
  const lines = text.split("\n");
  let at = 0;
  for (let li = 0; li < lines.length - 1; li++) {
    const line = lines[li]!;
    const next = lines[li + 1]!;
    const nextStart = at + line.length + 1;
    const lastWord = line.trim().split(/\s+/).pop() ?? "";
    const wraps =
      line.trim() !== "" &&
      next.trim() !== "" &&
      !LINE_BULLET.test(next) &&
      (/^\p{Ll}/u.test(lastWord) || /[,–-]$/.test(lastWord) || /^\s*\p{Ll}/u.test(next));
    if (!wraps) cuts.add(nextStart);
    at = nextStart;
  }
  const sorted = [...cuts].filter((c) => c >= 0 && c < text.length).sort((a, b) => a - b);
  const units: Unit[] = [];
  for (let k = 0; k < sorted.length; k++) {
    const start = sorted[k]!;
    const end = sorted[k + 1] ?? text.length;
    const body = text.slice(start, end);
    if (body.trim() === "") continue;
    // A unit is a bullet item when it opens a line that is one; a sentence
    // that starts mid-line after a full stop is not, whatever spaces precede it.
    const lead = body.length - body.replace(/^[\r\n]+/, "").length;
    const lineStart = start + lead === 0 || text[start + lead - 1] === "\n";
    units.push({
      start,
      end,
      bullet:
        BULLET.test(body.trim()[0] ?? "") || (lineStart && LINE_BULLET.test(body.slice(lead))),
      heading: headings.find((h) => h.start <= start && end <= h.end) ?? null,
    });
  }
  return { units, headings };
}

// ---------- 1. the role's own words ----------

/** Cues that open an aspirational or intent clause. */
const INTENT_CUE =
  /\b(?:i\s+(?:really\s+)?(?:want|wanted|would\s+(?:really\s+)?(?:like|love)|wish|hope|aim|intend|plan)\s+to|i['’]d\s+(?:really\s+)?(?:like|love)\s+to|seeking|looking\s+(?:for|to)|interested\s+in|aspir(?:e|es|ing)(?:\s+to)?|aspirations?\s+(?:is\s+|are\s+)?to|eager\s+to|keen\s+to|(?:apply|applying|application)\s+(?:for|to)\b(?=[^.;\n]{0,80}\b(?:role|position|post|vacancy|job|opportunit)))\b/gi;
/** "Responsible for seeking new suppliers": the gerund is the work, not an aim. */
const GERUND_AFTER_PREPOSITION =
  /\b(?:for|of|in|by|while|when|after|before|on|from|about|at|through)\s+$/i;
/** What an aspirational clause aims at: when it names one, the clause runs to it. */
const TARGET_NOUN =
  /\b(?:role|position|post|vacancy|job|opportunit(?:y|ies)|career|challenge|employment|placement|opening)s?\b/i;
const NUMBER_WORD =
  "(?:\\d+\\+?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|several|many)";
/**
 * Where the candidate's own facts begin: an aspirational clause never runs
 * past one ("I would like to highlight | that I supervised 30 pickers", "keen
 * to bring | my eight years", "seeking a senior role | 15 years in FMCG").
 */
const FACT_START = new RegExp(
  "\\b(?:that\\s+)?i\\s+(?:have\\s+|had\\s+|was\\s+|also\\s+)?(?!(?:wanted|needed|hoped|wished|intended|planned|aimed|liked|loved|seemed)\\b)(?:\\w+ed|ran|led|built|grew|oversaw|took|made|won|drove|sold|taught|held|kept|spent|did|set|met|hired)\\b" +
    `|\\b(?:my|our)\\s+(?:${NUMBER_WORD}|[\\w-]+-year|years?|experience|background|track\\s+record)\\b` +
    `|\\b${NUMBER_WORD}\\s*(?:years?|yrs|months?)\\b` +
    "|\\b(?:19|20)\\d{2}\\b",
  "i",
);
/** "Dubai, UAE": a comma before a place or name is not the clause's end. */
const APPOSITIVE = /^,\s*(?:\p{Lu}[\p{L}.&'’-]*\s*){1,3}(?=[.;,!?)]|$|\n|(?:and|or)\b)/u;
/** Longest stretch an aspirational clause without a named target may blank. */
const MAX_INTENT_SPAN = 80;
/** Longest stretch between a cue and the role it aims at ("seeking to apply ... to the X role"). */
const MAX_TARGET_REACH = 160;

/**
 * The end of the aspirational clause that starts at `from` (just after its
 * cue). It runs to the next comma, semicolon, "and", "but" or full stop, at
 * most MAX_INTENT_SPAN characters; when the clause names a role or
 * opportunity it runs to that target and the phrase after it ("the
 * Mushroom Harvesting Manager role at Hughes Mushrooms"). It never runs past
 * the start of a fact, a bullet, a "|" field or the end of the unit.
 */
function intentClauseEnd(text: string, from: number, limit: number): number {
  const fact = FACT_START.exec(text.slice(from, limit));
  const hardEnd = fact ? from + fact.index : limit;
  /** The first clause boundary at or after `start`, before `max`. */
  const boundary = (start: number, max: number, clauseWords: boolean): number => {
    const stop = Math.min(max, hardEnd);
    for (let i = start; i < stop; i++) {
      const c = text[i]!;
      if (c === "\n" || c === "|" || BULLET.test(c)) return i;
      if (/[;!?]/.test(c)) return i;
      if (c === "." && (i + 1 >= text.length || /\s/.test(text[i + 1]!))) return i;
      if (!clauseWords) continue;
      if (c === "," && !APPOSITIVE.test(text.slice(i, i + 48))) return i;
      if (/\s/.test(c) && /^\s+(?:and|but)\s/i.test(text.slice(i, i + 6))) return i;
    }
    return stop;
  };
  const sentenceEnd = boundary(from, from + MAX_TARGET_REACH, false);
  const target = TARGET_NOUN.exec(text.slice(from, sentenceEnd));
  if (target) {
    const after = from + target.index + target[0].length;
    return boundary(after, after + MAX_INTENT_SPAN, true);
  }
  return boundary(from, from + MAX_INTENT_SPAN, true);
}

/**
 * A passage about this application rather than past work: applying for or to
 * a role, "this role", the advertised position, the employer addressed as
 * "your company".
 */
const APPLICATION_CUE =
  /\b(?:(?:apply|applying|applied|application)\s+(?:for|to)\b(?=[^.;\n]{0,80}\b(?:role|position|post|vacancy|job|opportunit|you|your))|this\s+(?:role|position|post|vacancy|opportunity|job|opening)\b|(?:the|your)\s+advertised\s+(?:role|position|post|vacancy|job)\b|(?:the|your)\s+(?:vacancy|opening)\b|your\s+(?:company|organi[sz]ation|team|business|farm|advert))/i;
/** Work authorisation is about this application too ("sponsorship from Hughes Mushrooms"). */
const WORK_AUTHORISATION =
  /\b(?:visa|sponsorship|right\s+to\s+work|work\s+permit|work\s+authori[sz]ation)\b/i;
const aboutApplication = (body: string) =>
  APPLICATION_CUE.test(body) || WORK_AUTHORISATION.test(body);
/** "the Mushroom Harvesting Manager role": the title named as the vacancy. */
const TITLE_AS_VACANCY = /^\s*(?:role|position|post|vacancy|opening|opportunity)\b/i;
/** "my previous Harvesting Manager role": the candidate's own past role, not the vacancy. */
const OWN_ROLE_BEFORE =
  /\b(?:my|his|her|our|previous|former|prior|last|current|earlier)\s+(?:[\w-]+\s+)?$/i;

const YEAR = /\b(?:19|20)\d{2}\b/;
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
const DATE_RANGE = new RegExp(
  `(?:19|20)\\d{2}\\s*(?:-|–|—|to|until|till)\\s*(?:(?:${MONTH}\\s*)?(?:\\d{1,2}\\/)?(?:19|20)?\\d{2}\\b|present|current|now|date|today|ongoing)` +
    `|\\b${MONTH}\\s*(?:-|–|—|to)\\s*${MONTH}\\s+(?:19|20)\\d{2}`,
  "i",
);
const WORKED = /\b(?:worked|working|employed|joined|served)\b/i;
/** A dated entry line: a year with a date range, a job noun, "|" fields or "worked". */
const isDatedEntry = (body: string) =>
  YEAR.test(body) &&
  (DATE_RANGE.test(body) || JOB_WORD.test(body) || /\s\|\s/.test(body) || WORKED.test(body));

/**
 * Which units belong to a dated work entry: a dated entry line (or a line
 * whose first bullet is its dates, "CEO, FPO • Jul 2021 – Aug 2023 • Led
 * ...") and the bullets under it.
 */
function datedEntryUnits(text: string, units: Unit[]): boolean[] {
  const out = new Array<boolean>(units.length).fill(false);
  let open = false;
  units.forEach((u, k) => {
    const body = text.slice(u.start, u.end);
    if (u.heading) {
      open = false;
      return;
    }
    if (!u.bullet) {
      open = isDatedEntry(body);
    } else if (isDatedEntry(body)) {
      if (!open && k > 0 && !units[k - 1]!.bullet && !units[k - 1]!.heading) out[k - 1] = true;
      open = true;
    }
    out[k] = open;
  });
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phraseRe = (s: string) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])${s.split(/\s+/).map(escapeRe).join("\\s+")}(?![\\p{L}\\p{N}])`,
    "giu",
  );

function titleVariants(title: string): string[] {
  const short = title
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+[-–|].*$/, "")
    .trim();
  return [...new Set([title, short].filter((t) => t.length >= 3))];
}

/**
 * The text with everything that is not evidence of the candidate's own
 * experience blanked out: same length and offsets as the input, line breaks
 * kept.
 */
export function maskNonEvidence(text: string, ctx: RoleContext | null | undefined): string {
  if (!text) return text;
  const chars = text.split("");
  const blank = (start: number, end: number) => {
    for (let i = start; i < end; i++) if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " ";
  };
  const { units } = segment(text);
  const unitIndexAt = (i: number) => units.findIndex((u) => u.start <= i && i < u.end);
  const bodyOf = (k: number) => (k >= 0 ? text.slice(units[k]!.start, units[k]!.end) : "");
  const inEntry = datedEntryUnits(text, units);
  /** A dated work entry not about this application: its words stay evidence. */
  const workEntry = (k: number) => k >= 0 && inEntry[k]! && !aboutApplication(bodyOf(k));

  const orgSpans: Array<[number, number]> = [];
  for (const name of ctx?.organisation_names ?? []) {
    const oneWord = !/\s/.test(name);
    for (const m of text.matchAll(phraseRe(name))) {
      // A one-word name counts only as a proper noun ("Harvest" the company,
      // not "harvest" the activity).
      if (oneWord && !/^\p{Lu}/u.test(m[0])) continue;
      orgSpans.push([m.index!, m.index! + m[0].length]);
    }
  }
  // The client's name, except where a former employee lists the client as an
  // employer: "Harvest Supervisor | Hughes Mushrooms | 2015 – 2022".
  for (const [s, e] of orgSpans) if (!workEntry(unitIndexAt(s))) blank(s, e);

  for (const title of ctx?.role_title ? titleVariants(ctx.role_title) : []) {
    for (const m of text.matchAll(phraseRe(title))) {
      const s = m.index!;
      const e = s + m[0].length;
      const k = unitIndexAt(s);
      // The same title held at another employer (or at the client, before)
      // is the strongest evidence there is.
      if (workEntry(k)) continue;
      const unit = k >= 0 ? units[k]! : null;
      const namesClient = !!unit && orgSpans.some(([os]) => unit.start <= os && os < unit.end);
      const asVacancy =
        TITLE_AS_VACANCY.test(text.slice(e, e + 20)) &&
        !OWN_ROLE_BEFORE.test(text.slice(Math.max(0, s - 40), s));
      if (namesClient || aboutApplication(bodyOf(k)) || asVacancy) blank(s, e);
    }
  }

  for (const m of text.matchAll(INTENT_CUE)) {
    const s = m.index!;
    if (
      /^(?:seeking|looking)/i.test(m[0]) &&
      GERUND_AFTER_PREPOSITION.test(text.slice(Math.max(0, s - 16), s))
    )
      continue;
    const k = unitIndexAt(s);
    const e = intentClauseEnd(text, s + m[0].length, k >= 0 ? units[k]!.end : text.length);
    // "I would like to learn X" says the candidate lacks X; the negation cues
    // read that, so the clause is left for them.
    if (/\blearn/i.test(text.slice(s, e))) continue;
    blank(s, e);
  }
  return chars.join("");
}

// ---------- 2. study and training ----------

/** Training the candidate gave rather than received. */
const DELIVERING_BEFORE =
  /\b(?:deliver\w*|provid\w*|conduct\w*|led|lead\w*|ran|run\w*|gave|giv\w*|organi[sz]\w*|design\w*|develop\w*|facilitat\w*|coordinat\w*|oversaw|oversee\w*|launch\w*|responsible\s+for)\s+(?:[\w-]+\s+){0,3}$/i;
const RECIPIENTS =
  "(?:staff|starters|recruits|pickers|team|teams|colleagues|employees|operatives|workers|members|others|people|trainees|students|farmers|growers|advisors|advisers|managers|supervisors)";
const DELIVERED_TO_AFTER = new RegExp(
  `^\\s+(?:(?:of|for|to)\\s+)?(?:(?:all|the|our|\\d+)\\s+)?(?:new\\s+|junior\\s+)?${RECIPIENTS}\\b`,
  "i",
);

const COURSE_NOUN =
  "(?:course|training|module|certificate|certification|diploma|workshop|bootcamp)s?";
/**
 * A course or training the candidate took: "completed a mushroom cultivation
 * course", "did a full course on ...", "attended HACCP training" — never one
 * given to others ("completed induction training for 30 new pickers").
 */
const OWN_COURSE = `(?:completed|attended|took|undertook|enrolled\\s+(?:in|on)|studying|did|passed)\\s+(?:[\\p{L}\\d'’&/-]+\\s+){0,6}?${COURSE_NOUN}\\b(?!\\s+(?:for|to|of)\\s+(?:(?:all|the|our|\\d+)\\s+)?(?:new\\s+|junior\\s+)?${RECIPIENTS}\\b)`;
/** A passage that opens with the candidate's own study: "Studied ...", "Completed a ... course". */
const STUDY_OPENING = new RegExp(`^[\\s\\W]*(?:(?:studied|learnt|learned)\\b|${OWN_COURSE})`, "iu");
/** "Studied ...": a bullet that opens like this makes a non-job entry study. */
const STUDY_VERB = /^\W*(?:studied|learnt|learned)\b/i;

/**
 * Explicit cues of the candidate's own study. The bare words "training",
 * "course" and "students" are not among them: "launch tailor made training
 * for all advisors", "400 online courses" and "a group with 20,000+
 * students" are work.
 */
const STUDY_CUES: RegExp[] = [
  /\b(?:course\s*work|dissertation|thesis|capstone)\b/gi,
  /\bfellow\s+students?\b/gi,
  /\bstudent\s+(?:member|ambassador|representative|rep|society|union|council|project|exchange)\b/gi,
  /\bas\s+an?\s+(?:[\p{L}-]+\s+){0,2}student\b/giu,
  /\b(?:undergraduate|postgraduate|graduate|m\.?sc|b\.?sc|mba|phd|final[- ]year|degree|university|college|academic|student|school)\s+(?:research\s+)?projects?\b/gi,
  /\bacademic\s+(?:training|project|placement|year|study|studies|work|course|module|exercise)s?\b/gi,
  /\b(?:relevant|core|optional|taught|elective|compulsory|course|degree|university|academic)\s+modules?\b/gi,
  /\bmodules?\s*(?::|studied|taken|included|covered|completed)/gi,
  /\bcourse\s+(?:representative|rep)\b/gi,
  new RegExp(`\\b${OWN_COURSE}`, "giu"),
];

/** Where in a passage it names the candidate's own study; empty when it does not. */
function studyCueSpans(unit: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const re of STUDY_CUES)
    for (const m of unit.matchAll(re)) out.push([m.index!, m.index! + m[0].length]);
  const open = STUDY_OPENING.exec(unit);
  if (open) out.push([0, open[0].length]);
  const society = /\bsociety\b/i.exec(unit);
  if (
    society &&
    /\b(?:university|college|school|students?|undergraduate|departmental)\b/i.test(unit)
  )
    out.push([society.index, society.index + society[0].length]);
  return out;
}
const namesStudy = (unit: string) => studyCueSpans(unit).length > 0;

/** An entry line: it carries a year or "|"-separated fields. */
const isEntryHeader = (unit: string) => YEAR.test(unit) || /\s\|\s/.test(unit);
/**
 * How much of an entry line is its header. In a CV stored as one line the
 * header runs straight into the job description, whose words ("launch
 * training for all advisors") do not describe the entry.
 */
const HEADER_CHARS = 200;
/** "Practera Industry Consulting Project | Team Lead": a project, not "Projects Manager". */
const PROJECT_ENTRY =
  /\bprojects?\b(?!\s+(?:manager|management|lead|leader|officer|co-?ordinator|director|engineer|analyst|assistant|executive|consultant|administrator|specialist|planner|controller|accountant)s?\b)/i;

/** A company's name ("Lantra Training Ltd"), not a course. */
const COMPANY_SUFFIX = /\b(?:ltd|limited|plc|inc|llc|llp|gmbh|group|company|services|solutions)\b/i;

/**
 * A course or training named as the entry itself ("Practical Shiitake
 * Mushroom Production Training", "Diploma in Mental Health"): the noun is
 * capitalised, as a course's name is, and is not one the candidate gave. A
 * lower-case list of duties ("harvesting, grading, training") is not a course.
 */
function namesCourse(header: string): boolean {
  for (const m of header.matchAll(
    /\b(?:course|training|certificate|certification|diploma|workshop|bootcamp)s?\b/gi,
  )) {
    if (!/^\p{Lu}/u.test(m[0])) continue;
    const before = header.slice(0, m.index!);
    const after = header.slice(m.index! + m[0].length);
    if (
      /^course/i.test(m[0]) &&
      (/^\s+of\b/i.test(after) || /\b(?:of|golf|race|water|main)\s+$/i.test(before))
    )
      continue;
    if (!DELIVERING_BEFORE.test(before) && !DELIVERED_TO_AFTER.test(after)) return true;
  }
  return false;
}

type EntryKind = "study" | "work" | "other";
/**
 * Study: the header names a student role, a university project, a course, or
 * a university or college without a job title ("Mycology, Mushroom
 * Cultivation Technology | University of Delhi | 2022-2023"). Work: a job
 * title and a year. Anything else is neither.
 */
function entryKind(line: string): EntryKind {
  const head = line.slice(0, HEADER_CHARS);
  const job = JOB_WORD.test(head);
  if (namesStudy(head)) return "study";
  if (/\b(?:university|college)\b/i.test(head) && (!job || PROJECT_ENTRY.test(head)))
    return "study";
  if (!job && namesCourse(head)) return "study";
  return job && YEAR.test(head) ? "work" : "other";
}

/** A passage longer than this is a CV stored as one line: a cue marks its own clause only. */
const LONG_UNIT = 240;
const CLAUSE_STOP = new RegExp(`[.;!?|\\n${BULLET_CHARS}]`);

/**
 * A predicate telling whether the passage at an offset is study or training:
 *   - inside an education, course, training or qualification section, which
 *     ends at the next heading of any kind ("GEOGRAPHIC FOOTPRINT", "Career
 *     Highlights") or at a dated job entry;
 *   - in an entry whose header names study (see entryKind), or that has a
 *     bullet opening "Studied";
 *   - in a passage with an explicit cue of the candidate's own study
 *     (studyCueSpans); in a long one-line passage, only the cue's clause.
 * Inside a dated job entry only a bullet that opens with study ("Completed a
 * Lantra supervisor training course") is study: training given, students
 * taught and a course catalogue sold are the job.
 *
 * A recognised section heading is marked too: it labels the passages under
 * it and is not work evidence on its own ("RELEVANT MYCOLOGY, MUSHROOM
 * CULTIVATION AND LABORATORY EXPERIENCE" above a student membership).
 */
export function studyContextOf(text: string): (at: number) => boolean {
  if (!text) return () => false;
  const { units } = segment(text, true);
  const marks = new Uint8Array(text.length);
  const mark = (a: number, b: number) => marks.fill(1, a, b);
  const markCues = (u: Unit, body: string) => {
    const spans = studyCueSpans(body);
    if (spans.length === 0) return;
    if (body.length <= LONG_UNIT) return mark(u.start, u.end);
    for (const [a, b] of spans) {
      let from = a;
      while (from > 0 && a - from < 100 && !CLAUSE_STOP.test(body[from - 1]!)) from--;
      let to = b;
      while (to < body.length && to - b < 120 && !CLAUSE_STOP.test(body[to]!)) to++;
      mark(u.start + from, u.start + to);
    }
  };
  let sectionStudy = false;
  let entry: Unit[] = [];
  let kind: EntryKind | null = null;
  const closeEntry = () => {
    if (kind === "study") for (const u of entry) mark(u.start, u.end);
    entry = [];
    kind = null;
  };
  /**
   * A "|" field that names a course or training and no job or company
   * ("Agricultural Operations | Mushroom Production Training"): that field is
   * study, whatever the rest of the line is.
   */
  const markCourseFields = (u: Unit, body: string) => {
    if (u.bullet || !/\s\|\s/.test(body)) return;
    let at = 0;
    for (const field of body.split("|")) {
      if (namesCourse(field) && !JOB_WORD.test(field) && !COMPANY_SUFFIX.test(field))
        mark(u.start + at, u.start + at + field.length);
      at += field.length + 1;
    }
  };
  for (const u of units) {
    const body = text.slice(u.start, u.end);
    markCourseFields(u, body);
    if (u.heading) {
      closeEntry();
      if (u.heading.generic) {
        // A heading the reader does not recognise still ends the section.
        sectionStudy = false;
        continue;
      }
      sectionStudy = u.heading.academic;
      mark(u.start, u.end);
      continue;
    }
    if (!u.bullet && isEntryHeader(body)) {
      closeEntry();
      kind = entryKind(body);
      entry = [u];
      if (kind === "work") {
        // A dated job leaves an education section that has no heading after it.
        if (DATE_RANGE.test(body.slice(0, HEADER_CHARS))) sectionStudy = false;
        continue;
      }
    } else if (u.bullet && kind) {
      entry.push(u);
      if (kind === "work") {
        if (STUDY_OPENING.test(body)) mark(u.start, u.end);
        continue;
      }
      if (STUDY_VERB.test(body)) kind = "study";
    } else if (!u.bullet) {
      closeEntry();
    }
    if (sectionStudy) mark(u.start, u.end);
    else markCues(u, body);
  }
  closeEntry();
  return (at: number) => at >= 0 && at < marks.length && marks[at] === 1;
}

/**
 * Requirements that ask for experience — hands-on X experience, supervisory
 * experience, previous experience as Y — as opposed to a degree, a
 * qualification or a skill.
 */
const EXPERIENCE_REQUIREMENT =
  /\b(?:experienced?|experiences|hands[-\s]on|track\s+record|background\s+in|worked\s+as|previous(?:ly)?|experiência|experiencia|vivência)\b/i;
const QUALIFICATION_REQUIREMENT =
  /\b(?:degree|qualification|qualified|certificat\w*|certified|licen[cs]e\w*|diploma|bachelor\w*|master['’]?s|mba|phd|doctorate|education|graduate)\b/i;

export function isExperienceRequirement(text: string): boolean {
  return EXPERIENCE_REQUIREMENT.test(text) && !QUALIFICATION_REQUIREMENT.test(text);
}
