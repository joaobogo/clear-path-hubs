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
 *      - the client organisation's name, wherever it appears;
 *      - the role title where the passage is about this application (it names
 *        the client, applying or the vacancy, or calls the title "the role");
 *        the same title held at another employer stays evidence;
 *      - aspirational and intent clauses, from the cue to the end of the
 *        clause: "I want to", "I would like to", "seeking", "looking for",
 *        "interested in", "aspire", "applying for".
 *    Masking keeps every offset, so quotes and locations still point at the
 *    original text. Clauses about learning ("I would like to learn X") are
 *    left to the negation cues, which already read them as a denial.
 *
 * 2. Study and training are not employment. A student member of a college
 *    mushroom centre was scored as hands-on commercial picking and picking-
 *    team supervision. `studyContextOf` marks passages in education, course,
 *    training or qualification sections, sentences that name study
 *    (coursework, modules, a training course, a student role, a dissertation,
 *    a university project), and bullets under an entry whose header line does
 *    or that names a university or college without a job title. For
 *    experience requirements such passages count as partial at most: real
 *    credit for genuine student work, never the same as doing the job. Degree
 *    and qualification requirements are not experience requirements and are
 *    unaffected.
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

type Heading = { start: number; end: number; academic: boolean };
type Unit = { start: number; end: number; bullet: boolean; heading: Heading | null };

const bare = (token: string) => token.replace(/^[^\p{L}]+|[^\p{L}-]+$/gu, "").toUpperCase();
const isAcademicHeading = (words: string[]) =>
  words.some((w) => ACADEMIC_HEADINGS.has(w)) && !words.some((w) => WORK_HEADINGS.has(w));
const endsInHeadingWord = (words: string[]) => {
  const last = words[words.length - 1] ?? "";
  return ACADEMIC_HEADINGS.has(last) || WORK_HEADINGS.has(last) || NEUTRAL_HEADINGS.has(last);
};
const isCapitalsToken = (t: string) => /\p{Lu}.*\p{Lu}/u.test(t) && !/\p{Ll}|\d/u.test(t);

/**
 * Section headings: a run of capitals ending in a heading word ("EDUCATION",
 * "TRAINING & CERTIFICATIONS (SELECTED)", "RELEVANT ... LABORATORY
 * EXPERIENCE") — which also finds them inside a CV stored as one line — or a
 * short title-case line ending in one ("Work Experience"). A document written
 * mostly in capitals has no capitalised headings to tell apart, so only its
 * short standalone lines are read as headings there. A job title is never a
 * heading ("HEAD OF TRAINING").
 */
function findHeadings(text: string): Heading[] {
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
      if (run.length <= 10 && endsInHeadingWord(words) && !JOB_WORD.test(runText)) {
        const last = run[run.length - 1]!;
        out.push({
          start: run[0]!.index!,
          end: last.index! + last[0].length,
          academic: isAcademicHeading(words),
        });
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
      !JOB_WORD.test(trimmed) &&
      words.every((w) => /^[\p{Lu}&/(–-]/u.test(w) || HEADING_CONNECTORS.has(w.toUpperCase()))
    ) {
      const upperWords = words.map(bare).filter(Boolean);
      const start = at + line.indexOf(trimmed);
      if (endsInHeadingWord(upperWords) && !out.some((h) => h.start <= start && start < h.end)) {
        out.push({ start, end: start + trimmed.length, academic: isAcademicHeading(upperWords) });
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
function segment(text: string): { units: Unit[]; headings: Heading[] } {
  const headings = findHeadings(text);
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
  /\b(?:i\s+(?:really\s+)?(?:want|wanted|would\s+(?:really\s+)?(?:like|love)|wish|hope|aim|intend|plan)\s+to|i['’]d\s+(?:really\s+)?(?:like|love)\s+to|seeking|looking\s+(?:for|to)|interested\s+in|aspir\w*|eager\s+to|keen\s+to|(?:apply|applying|application)\s+(?:for|to)\b(?=[^.;\n]{0,80}\b(?:role|position|post|vacancy|job|opportunit)))\b/gi;
/** A passage about this application rather than past work. */
const APPLICATION_CUE =
  /\b(?:apply|applying|applied|application|vacancy|vacancies|advertised|advert|your|this\s+(?:role|position|post|opportunity|job))\b/i;
const TITLE_AS_VACANCY = /^\s*(?:role|position|post|vacancy|opening|opportunity)\b/i;
/** Longest stretch one cue may blank: a clause, not the rest of a flat CV. */
const MAX_INTENT_SPAN = 240;

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
  const unitAt = (i: number) => units.find((u) => u.start <= i && i < u.end) ?? null;

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
  for (const [s, e] of orgSpans) blank(s, e);

  for (const title of ctx?.role_title ? titleVariants(ctx.role_title) : []) {
    for (const m of text.matchAll(phraseRe(title))) {
      const s = m.index!;
      const e = s + m[0].length;
      const unit = unitAt(s);
      const unitText = unit ? text.slice(unit.start, unit.end) : "";
      const namesClient = !!unit && orgSpans.some(([os]) => unit.start <= os && os < unit.end);
      if (
        namesClient ||
        APPLICATION_CUE.test(unitText) ||
        TITLE_AS_VACANCY.test(text.slice(e, e + 20))
      )
        blank(s, e);
    }
  }

  for (const m of text.matchAll(INTENT_CUE)) {
    const s = m.index!;
    const unit = unitAt(s);
    let e = Math.min(unit ? unit.end : text.length, s + MAX_INTENT_SPAN);
    const semi = text.indexOf(";", s);
    if (semi !== -1 && semi < e) e = semi;
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
  /\b(?:deliver\w*|provid\w*|conduct\w*|led|lead\w*|ran|run\w*|gave|giv\w*|organi[sz]\w*|design\w*|develop\w*|facilitat\w*|coordinat\w*|oversaw|oversee\w*|responsible\s+for)\s+(?:[\w-]+\s+){0,3}$/i;
const DELIVERED_TO_AFTER =
  /^\s+(?:(?:of|for|to)\s+)?(?:new\s+|junior\s+)?(?:staff|starters|recruits|pickers|team|teams|colleagues|employees|operatives|workers|members|others|people|trainees|students|farmers|growers)\b/i;
/** Students the candidate taught, supported or supervised. */
const WORKING_WITH_STUDENTS_BEFORE =
  /\b(?:support\w*|taught|teach\w*|tutor\w*|mentor\w*|supervis\w*|co-supervis\w*|train\w*|assess\w*|help\w*|assist\w*|with|prepar\w*|instruct\w*|lectur\w*|coach\w*|educat\w*|guid\w*|for|facilitat\w*|engag\w*|recruit\w*|manag\w*|advis\w*|counsel\w*|invigilat\w*|mark\w*)\s+(?:[\w+-]+\s+){0,3}$/i;

const STUDY_CUES: RegExp[] = [
  /\b(?:course\s*work|dissertation|thesis|capstone)\b/i,
  /\bfellow\s+students?\b/i,
  /\bstudent\s+(?:member|ambassador|representative|rep|society|union|council|project|exchange)\b/i,
  /\bas\s+an?\s+(?:[\p{L}-]+\s+){0,2}student\b/iu,
  /\b(?:undergraduate|postgraduate|graduate|m\.?sc|b\.?sc|mba|phd|final[- ]year|degree|university|college|academic|student|school)\s+(?:research\s+)?projects?\b/i,
  /\bacademic\s+(?:training|project|placement|year|study|studies|work|course|module|exercise)s?\b/i,
  /\b(?:relevant|core|optional|taught|elective|compulsory|course|degree|university|academic)\s+modules?\b/i,
  /\bmodules?\s*(?::|studied|taken|included|covered|completed)/i,
  /\bcourse\s+(?:representative|rep)\b/i,
];
/** A bullet that opens like this describes study, never a job. */
const STUDY_VERB = /^\W*(?:studied|learnt|learned)\b/i;

function namesStudy(unit: string): boolean {
  if (STUDY_CUES.some((re) => re.test(unit)) || STUDY_VERB.test(unit)) return true;
  if (
    /\bsociety\b/i.test(unit) &&
    /\b(?:university|college|school|students?|undergraduate|departmental)\b/i.test(unit)
  )
    return true;
  if (/\bprojects?\b/i.test(unit) && /\b(?:university|college)\b/i.test(unit)) return true;
  for (const m of unit.matchAll(/\btrainings?\b/gi)) {
    const before = unit.slice(0, m.index!);
    const after = unit.slice(m.index! + m[0].length);
    if (!DELIVERING_BEFORE.test(before) && !DELIVERED_TO_AFTER.test(after)) return true;
  }
  for (const m of unit.matchAll(/\bcourses?\b/gi)) {
    const before = unit.slice(0, m.index!);
    const after = unit.slice(m.index! + m[0].length);
    if (!/^\s+of\b/i.test(after) && !/\b(?:of|golf|race|water|main)\s+$/i.test(before)) return true;
  }
  for (const m of unit.matchAll(/\bstudents?\b/gi)) {
    if (!WORKING_WITH_STUDENTS_BEFORE.test(unit.slice(0, m.index!))) return true;
  }
  return false;
}

/** An entry line: it carries a year or "|"-separated fields. */
const isEntryHeader = (unit: string) => /\b(?:19|20)\d{2}\b/.test(unit) || /\s\|\s/.test(unit);

/**
 * A predicate telling whether the passage at an offset is study or training:
 * inside an education, course, training or qualification section; in a
 * sentence that names study; or in an entry whose header line names study,
 * names a university or college without a job title ("Mycology, Mushroom
 * Cultivation Technology | University of Delhi | 2022-2023"), or that has a
 * bullet opening "Studied". A training course listed under a real job does
 * not recast the job: bullets inherit from their header, not the reverse.
 *
 * A section heading is marked too: it labels the passages under it and is
 * not work evidence on its own ("RELEVANT MYCOLOGY, MUSHROOM CULTIVATION AND
 * LABORATORY EXPERIENCE" above a student membership).
 */
export function studyContextOf(text: string): (at: number) => boolean {
  if (!text) return () => false;
  const { units } = segment(text);
  const study = new Array<boolean>(units.length).fill(false);
  let sectionStudy = false;
  let entry: number[] = [];
  let entryStudy = false;
  const closeEntry = () => {
    if (entryStudy) for (const k of entry) study[k] = true;
    entry = [];
    entryStudy = false;
  };
  units.forEach((u, k) => {
    const body = text.slice(u.start, u.end);
    if (u.heading) {
      closeEntry();
      sectionStudy = u.heading.academic;
      study[k] = true;
      return;
    }
    const own = namesStudy(body);
    if (!u.bullet && isEntryHeader(body)) {
      closeEntry();
      entry = [k];
      entryStudy = own || (/\b(?:university|college)\b/i.test(body) && !JOB_WORD.test(body));
    } else if (u.bullet && entry.length > 0) {
      entry.push(k);
      if (STUDY_VERB.test(body)) entryStudy = true;
    } else if (!u.bullet) {
      closeEntry();
    }
    study[k] = sectionStudy || own;
  });
  closeEntry();
  const marks = new Uint8Array(text.length);
  units.forEach((u, k) => {
    if (study[k]) marks.fill(1, u.start, u.end);
  });
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
