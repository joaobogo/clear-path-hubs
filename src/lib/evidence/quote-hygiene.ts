/**
 * Quote hygiene for evidence snippets.
 *
 * Raw quotes are character-offset slices of a CV, so they begin mid-word and
 * can carry contact details. Contact release is a separate permission, so an
 * email, phone number or URL must never reach a stored or rendered quote.
 */

export const QUOTE_MAX_CHARS = 240;
/** Below this, a slice is a fragment rather than a readable quote. */
export const QUOTE_MIN_CHARS = 24;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|dev|co|ai)(\/\S*)?\b/i;
// 7+ digits once separators are ignored, incl. +44 (0) 7... forms.
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;

function hasContactDetail(line: string): boolean {
  if (EMAIL_RE.test(line) || URL_RE.test(line)) return true;
  const phoneCandidate = line.match(PHONE_RE)?.[0] ?? "";
  return phoneCandidate.replace(/\D/g, "").length >= 7;
}

/**
 * Collapse letter-spaced PDF headings. Designers space out masthead titles
 * ("T E C H N I C A L  P R O D U C T  D E V E L O P E R") and text extraction
 * keeps every letter as its own token; a character-offset slice through one of
 * these produced "evidence" quotes that were somebody's name banner.
 */
function stripLetterSpacedRuns(text: string): string {
  return text
    .replace(/(?:\b[A-Za-zÀ-ÿ]\b[ \t]+){6,}\b[A-Za-zÀ-ÿ]\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The regex above only recognises runs of *single* letters, so PDF extraction
 * that fuses a pair — "E D U C AT I O N", "P R O D U CT" — splits the run into
 * two short halves and neither reaches the threshold. The banner then survived
 * into rendered evidence (audit #4, L2).
 *
 * This walks tokens instead: a run of six or more tokens that are all one or
 * two letters, at least five of them single letters, is a spaced banner. Real
 * prose never strings six such tokens together, and the single-letter floor
 * keeps short-word sequences ("it is on us to do it") out of range.
 *
 * Render-side only. `cleanQuote` keeps the original regex because it feeds the
 * scoring engine and the golden-score gate pins its output.
 */
function spacedTokenLetters(token: string): string | null {
  const letters = token.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters || letters.length > 2) return null;
  // Only trailing/leading punctuation may ride along — never digits or symbols
  // that carry meaning ("3.5", "C++").
  if (token.replace(/[.,:;·|]/g, "").length !== letters.length) return null;
  return letters;
}

/** A lone separator between banner words: "D E V E L O P E R | T E C H…". */
function isSeparatorToken(token: string): boolean {
  return /^[|·•/\\\-–—,:;]+$/.test(token);
}

function stripSpacedBanners(text: string): string {
  const parts = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    let end = i;
    let singles = 0;
    let lastLetterEnd = i; // never let a run end on a trailing separator
    while (end < parts.length) {
      const token = parts[end]!;
      // A bare separator continues the banner without counting toward it, so
      // "F U L L S T A C K | T E C H N I C A L" stays one run rather than two
      // halves that each fall under the threshold (audit #4, item 30).
      if (isSeparatorToken(token)) {
        end += 1;
        continue;
      }
      const letters = spacedTokenLetters(token);
      if (letters === null) break;
      if (letters.length === 1) singles += 1;
      end += 1;
      lastLetterEnd = end;
    }
    if (lastLetterEnd - i >= 6 && singles >= 5) {
      i = lastLetterEnd; // drop the whole banner
      continue;
    }
    out.push(parts[i]!);
    i += 1;
  }
  return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

const LINK_HUB_WORDS = [
  "github", "linkedin", "portfolio", "email", "website", "phone",
  "contact", "blog", "twitter", "behance", "dribbble",
];
const PROSE_MARKERS =
  /\b(the|and|with|for|from|our|their|using|built|led|worked|developed|managed|created|designed|delivered|responsible)\b/g;

/**
 * A CV masthead is a strip of platform names and title words with no prose —
 * "FULL STACK DEVELOPER · GitHub Portfolio Email LinkedIn". It carries zero
 * evidence about any requirement, but its keyword density made it a favourite
 * pick for offset-sliced quotes.
 */
export function isLinkHubDebris(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const t = String(raw).toLowerCase();
  const hits = LINK_HUB_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(t)).length;
  const prose = (t.match(PROSE_MARKERS) ?? []).length;

  if (hits < 3) return false;
  return prose <= 1;
}

/**
 * Remove a leading "Links: …" run from a quote.
 *
 * A CV's links section bleeds into whatever follows it, and the resulting
 * slice reached a PUBLISHED client page as evidence: "Links: GitHub Website
 * Puro Doce Website Jun 2026 - Present Built and deployed…" (audit #6, 2.3d).
 * `isLinkHubDebris` could not catch it — it names only two known platforms,
 * one under the three-hit floor, and the prose at the tail disqualified it.
 *
 * So the strip is removed rather than the quote dropped: everything from the
 * opening "Links:" up to the first word that reads as prose. What remains
 * faces the ordinary minimum-length rule, which discards the stub in practice.
 */
function stripLeadingLinkStrip(text: string): string {
  if (!/^\s*links?\s*[:\-–—]/i.test(text)) return text;
  const tokens = text.trim().split(/\s+/);
  let i = 1; // skip the "Links:" token itself
  while (i < tokens.length) {
    const tok = tokens[i]!;
    const bare = tok.replace(/[^A-Za-zÀ-ÿ]/g, "");
    // A lowercase word of real length is where the prose starts.
    if (bare.length >= 3 && bare === bare.toLowerCase()) break;
    i += 1;
  }
  return tokens.slice(i).join(" ").trim();
}

const PHONE_RE_GLOBAL = /\+?\d[\d\s().-]{6,}\d/g;

/** Remove every address, domain and phone number from a line of text. */
function scrubContactTokens(line: string): string {
  return line
    // Spaced phone numbers ("+55 11 5555 0119") span several tokens.
    .replace(PHONE_RE_GLOBAL, (match) => (match.replace(/\D/g, "").length >= 7 ? " " : match))
    .split(/\s+/)
    .filter((token) => {
      // Catches truncated addresses ("rui@demo.") that a full email regex misses.
      if (token.includes("@") || URL_RE.test(token)) return false;
      return token.replace(/\D/g, "").length < 7;
    })
    .join(" ")
    // Tidy brackets left empty by a scrubbed value, e.g. "Porto ( )".
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Remove every email, phone number and URL. A contact-only line is dropped
 * whole; a line that mixes contact details with prose keeps the prose. Tiny
 * leftover fragments a mid-word slice leaves behind are dropped too.
 */
export function stripContactLines(raw: string): string {
  return raw
    .split(/\r?\n|(?:\s*[\u2022\u00b7]\s*)|(?:\s*\|\s*)/)
    .map((line) => scrubContactTokens(line))
    .filter((line, i, all) => {
      if (!line) return false;
      // A 1-3 char opening fragment is slice debris, not a sentence.
      if (i < all.length - 1 && line.length <= 3) return false;
      return true;
    })
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Drop a mid-word opening token left by a character-offset slice. */
function dropOpeningFragment(text: string): string {
  const out = text.trim();
  if (!/^[a-z]/.test(out)) return out;
  const nextWord = out.indexOf(" ");
  if (nextWord > 0 && nextWord < 24 && out.length - nextWord >= 30) {
    return out.slice(nextWord + 1).trim();
  }
  return out;
}

/** Drop a leading partial sentence when a usable sentence follows. */
function snapStart(text: string): string {
  const out = text.trim();
  const firstBoundary = out.search(/[.!?]\s+[A-Z]/);
  if (firstBoundary !== -1) {
    const candidate = out.slice(firstBoundary + 1).trim();
    if (candidate.length >= 60) return candidate;
  }
  return out;
}

/**
 * Index of the last sentence-ending punctuation, ignoring dots inside tokens
 * like "Node.js" or "3.5" (a real ending is followed by space or end of text).
 */
function lastSentenceEnd(text: string): number {
  let idx = -1;
  const re = /[.!?](?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) idx = m.index;
  return idx;
}

/** Drop a trailing partial sentence, or at least a trailing partial word. */
function snapEnd(text: string): string {
  let out = text.trim();
  const lastBoundary = lastSentenceEnd(out);
  if (lastBoundary >= 25) {
    out = out.slice(0, lastBoundary + 1);
  } else {
    const lastSpace = out.lastIndexOf(" ");
    if (lastSpace >= 25) out = `${out.slice(0, lastSpace).trim()}…`;
  }
  return out.trim();
}


/** Remove leading punctuation/digit debris left by an offset slice. */
function stripLeadingJunk(text: string): string {
  // Digits open real quotes ("5+ years Kubernetes"), so only punctuation and
  // whitespace count as slice debris.
  let out = text.replace(/^[^A-Za-z0-9]+/, "").trim();
  const firstSpace = out.indexOf(" ");
  if (firstSpace > 0 && firstSpace <= 2 && out.length - firstSpace >= 40) {
    out = out.slice(firstSpace + 1).trim();
  }
  return out;
}

function capAtWord(text: string): string {
  if (text.length <= QUOTE_MAX_CHARS) return text;
  const cut = text.slice(0, QUOTE_MAX_CHARS);
  const boundary = lastSentenceEnd(cut);
  if (boundary >= 60) return cut.slice(0, boundary + 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trim()}…`;
}

/**
 * Clean an evidence quote: remove contact details, snap to sentence boundaries
 * and trim to ~240 characters without cutting a word in half.
 *
 * NOTE: this is the STABLE version used by the scoring engine. Any change here
 * moves the golden-score regression gate. For UI rendering, use `renderQuote`.
 */
export function cleanQuote(raw: string | null | undefined): string {
  if (!raw) return "";
  if (isTemplatedEvidence(raw) || isLinkHubDebris(raw)) return "";
  const collapsed = stripLetterSpacedRuns(
    stripContactLines(String(raw)).replace(/\s+/g, " ").trim(),
  );
  if (!collapsed) return "";
  const base = dropOpeningFragment(stripLeadingJunk(collapsed));
  const trimmedStart = snapStart(base);
  // Never let hygiene reduce a quote to a stub: keep the fuller start instead.
  const started = snapEnd(trimmedStart).length >= 40 ? trimmedStart : base;
  let out = capAtWord(snapEnd(started)).trim();
  if (out.length < QUOTE_MIN_CHARS) return "";
  // A quote that still opens mid-sentence is marked as a continuation.
  if (/^[a-z]/.test(out)) out = `…${out}`;
  return out;
}

// ---------------------------------------------------------------------------
// renderQuote — client/admin UI rendering only. Aggressive PII + boundary snap.
// ---------------------------------------------------------------------------

/**
 * A quote sliced out of a CV whose extraction produced byte soup rather than
 * text — "…M������_�ҡ…". These were rendered as evidence under real
 * requirements, so a candidate whose CV nothing could be read from appeared to
 * have quoted proof of AI tooling and UX principles (audit #4, item 13).
 *
 * Deliberately stricter than the whole-document `isGarbageCvText` gate: a
 * quote is short, so a handful of replacement characters is already fatal,
 * while a document of the same ratio might still be mostly readable.
 */
export function isMojibake(raw: string | null | undefined): boolean {
  const text = String(raw ?? "");
  if (!text) return false;
  const n = text.length;
  // U+FFFD is the decoder saying it could not read the byte. Two of them in a
  // passage means the passage is not text.
  const replacement = (text.match(/�/g) ?? []).length;
  if (replacement >= 2 || replacement / n > 0.02) return true;
  // Control characters (excluding tab/newline/carriage return) never appear in
  // prose and are the other signature of a mis-decoded binary stream.
  const control = (text.match(/[ --]/g) ?? []).length;
  if (control > 0) return true;
  // Finally, a passage that is mostly not letters, digits, spaces or ordinary
  // punctuation is not something to quote at anybody.
  const ordinary = (text.match(/[\p{L}\p{N}\s.,;:!?'"()\-–—/&%+#@]/gu) ?? []).length;
  return ordinary / n < 0.85;
}

const RENDER_EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const RENDER_URL_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|dev|co|ai)(\/\S*)?\b/gi;
const RENDER_PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/g;
const RENDER_PHONE_RE_GLOBAL = /\+?\d[\d\s().-]{6,}\d/g;

function scrubRenderContactTokens(line: string): string {
  return line
    .replace(RENDER_PHONE_RE_GLOBAL, (match) => (match.replace(/\D/g, "").length >= 7 ? " " : match))
    .split(/\s+/)
    .filter((token) => {
      if (token.includes("@") || RENDER_URL_RE.test(token)) return false;
      return token.replace(/\D/g, "").length < 7;
    })
    .join(" ")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripRenderContactLines(raw: string): string {
  return raw
    .split(/\r?\n|(?:\s*[\u2022\u00b7]\s*)|(?:\s*\|\s*)/)
    .map((line) => scrubRenderContactTokens(line))
    .filter((line, i, all) => {
      if (!line) return false;
      if (i < all.length - 1 && line.length <= 3) return false;
      return true;
    })
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderDropOpeningFragment(text: string): string {
  const out = text.trim();
  if (!/^[a-z]/.test(out)) return out;
  const nextSpace = out.indexOf(" ");
  if (nextSpace > 0 && out.length - nextSpace >= 12) {
    return out.slice(nextSpace + 1).trim();
  }
  return out;
}

function renderSnapStart(text: string): string {
  const out = text.trim();
  const midWord = /^[a-z]/.test(out);
  const firstSentence = out.search(/[.!?]\s+[A-Z]/);
  if (firstSentence !== -1 && firstSentence < 60) {
    const candidate = out.slice(firstSentence + 2).trim();
    if (candidate.length >= 30) return candidate;
  }
  if (midWord) {
    const firstSpace = out.indexOf(" ");
    if (firstSpace > 0 && out.length - firstSpace >= 12) {
      return out.slice(firstSpace + 1).trim();
    }
  }
  return out;
}

function renderSnapEnd(text: string): string {
  let out = text.trim();
  const lastSpace = out.lastIndexOf(" ");
  if (lastSpace >= 25 && !/[.!?]$/.test(out)) {
    out = `${out.slice(0, lastSpace).trim()}…`;
  }
  const lastBoundary = lastSentenceEnd(out);
  if (lastBoundary >= 25) {
    out = out.slice(0, lastBoundary + 1);
  }
  return out.trim();
}

function renderStripLeadingJunk(text: string): string {
  let out = text.replace(/^[^A-Za-z0-9]+/, "").trim();
  const firstSpace = out.indexOf(" ");
  if (firstSpace > 0 && firstSpace <= 2 && out.length - firstSpace >= 40) {
    out = out.slice(firstSpace + 1).trim();
  }
  return out;
}

/**
 * Whole words that legitimately open a quote in all caps: common acronyms and
 * CV section headings. Anything else all-caps at the start of a stored quote
 * is the tail of a word the offset slice cut into ("NGUAGES", "TORY").
 */
const KEEP_OPENING_TOKENS = new Set([
  "SQL", "AWS", "API", "GCP", "CI", "CD", "QA", "UI", "UX", "ETL", "KPI",
  "OKR", "SLA", "SLO", "GDPR", "HIPAA", "SOC", "ISO", "PHP", "CSS", "HTML",
  "JSON", "REST", "GRPC", "ML", "AI", "NLP", "SRE", "TDD", "BDD", "DDD",
  "B2B", "B2C", "SAAS", "PAAS", "IAAS", "SDK", "IDE", "ORM", "SSR", "SSG",
  "LANGUAGES", "LANGUAGE", "HISTORY", "SUMMARY", "EXPERIENCE", "EDUCATION",
  "SKILLS", "PROFILE", "PROJECTS", "EMPLOYMENT", "CERTIFICATIONS", "STACK",
  "TOOLS", "OBJECTIVE", "ABOUT", "HIGHLIGHTS", "ACHIEVEMENTS",
]);

/**
 * Drop an opening token that is the fragment of a word a character-offset
 * slice cut into: an unrecognised all-caps stub ("NGUAGES", "TORY") or a
 * 1-3 digit stub ("020" from "2020"). Whole words are never touched.
 */
function renderDropTruncatedOpeningToken(text: string): string {
  let out = text.trim();
  for (let i = 0; i < 2; i++) {
    const m = out.match(/^(\S+)(\s+\S[\s\S]*)$/);
    if (!m) return out;
    const [, first, rest] = m;
    if (rest.trim().length < 12) return out;
    const isDigitStub = /^\d{1,3}$/.test(first);
    const isCapsStub = /^[A-Z]{3,12}$/.test(first) && !KEEP_OPENING_TOKENS.has(first);
    if (!isDigitStub && !isCapsStub) return out;
    out = rest.replace(/^[^A-Za-z0-9]+/, "").trim();
  }
  return out;
}

function renderCapAtWord(text: string): string {
  if (text.length <= QUOTE_MAX_CHARS) return text;
  const cut = text.slice(0, QUOTE_MAX_CHARS);
  const boundary = lastSentenceEnd(cut);
  if (boundary >= 60) return cut.slice(0, boundary + 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trim()}…`;
}

/**
 * Render a quote for the client/admin UI.
 *
 * Differences from `cleanQuote` (the scoring-engine stable version):
 *   - PII regexes are global and run repeatedly.
 *   - Always snaps to sentence/word boundaries; never opens or ends mid-word.
 *   - Adds leading/trailing ellipses when the slice falls mid-sentence.
 *
 * Use this for any component that renders a CV-derived evidence snippet.
 */
/**
 * A quotable passage contains prose. One with no lowercase word of any length
 * is a run of CV section headers or a bare technology list —
 * "EDUCATION & LANGUAGES Bachiller - IPU", "CSS3 Tailwind CSS Bootstrap HTML5
 * React Hooks Redux" — both of which reached client pages as the evidence
 * behind a "Met" (audit #6, 2.3b/2.3d). A list of nouns proves nothing about
 * what the candidate did with them.
 */
function hasProse(text: string): boolean {
  return /\b[a-zà-ÿ]{3,}\b/.test(text);
}

export function renderQuote(raw: string | null | undefined): string {
  if (!raw) return "";
  if (isTemplatedEvidence(raw) || isLinkHubDebris(raw)) return "";
  if (isMojibake(raw)) return "";

  const scrubbed = stripLeadingLinkStrip(
    stripSpacedBanners(
      stripLetterSpacedRuns(stripRenderContactLines(String(raw)).replace(/\s+/g, " ").trim()),
    ),
  );
  if (!scrubbed) return "";

  const base = renderDropOpeningFragment(
    renderStripLeadingJunk(renderDropTruncatedOpeningToken(renderStripLeadingJunk(scrubbed))),
  );
  const trimmedStart = renderSnapStart(base);
  const ended = renderSnapEnd(trimmedStart);
  const started = ended.length >= 40 ? trimmedStart : base;
  let out = renderCapAtWord(renderSnapEnd(started)).trim();
  if (out.length < QUOTE_MIN_CHARS) return "";
  // A run of section headers or a bare technology list is not a passage.
  if (!hasProse(out)) return "";
  if (/^[a-z]/.test(out)) out = `…${out}`;
  return out;
}


/** Humanize evidence sources. */
export function humanizeSource(source: string | null | undefined): string {
  if (!source) return "Direct observation";

  // D1: Handle character offsets if passed as source string (safety fallback)
  if (source.includes('"location":')) {
    try {
      const loc = JSON.parse(source);
      if (loc.location) return humanizeSource(loc.location);
    } catch { /* fallback to default parsing */ }
  }

  // D1: Render CV location as human-readable string
  // Matches cv:134-299
  const cvMatch = source.match(/^cv:(\d+)-(\d+)$/i);
  if (cvMatch) {
    return `CV · characters ${cvMatch[1]}–${cvMatch[2]}`;
  }

  const map: Record<string, string> = {
    resume: "Curriculum Vitae",
    cv: "Curriculum Vitae",
    linkedin: "LinkedIn Profile",
    github: "GitHub Registry",
    interview_note: "Interview Record",
    screening_call: "Screening Assessment",
  };
  return map[source.toLowerCase()] || source;
}


/**

 * Clean a short field value — a requirement label, availability, location.
 *
 * These are not CV slices: they never open mid-sentence and are legitimately
 * shorter than a quote, so only contact scrubbing and whitespace tidying
 * apply. Running them through `cleanQuote` erases them via the minimum length.
 */
export function cleanFieldValue(raw: string | null | undefined): string {
  if (!raw) return "";
  return scrubContactTokens(String(raw).replace(/\s+/g, " ")).trim();
}

/**
 * Detect evidence that is a generic template rather than a per-requirement
 * quote from the candidate's own record. These fragments appear for many
 * candidates and many unrelated requirements; they must not be rendered as
 * evidence.
 */
const TEMPLATED_PATTERNS = [
  /core\s+stack\s*:/i,
  /full\s+regression\s+suite/i,
  /delivered\s+in\s+phases\s+with\s+no\s+downtime/i,
  /profile\s+full-stack\s+engineer\s+with\s+\d+\s+years\s+of\s+professional\s+experience/i,
  /references\s+available\s+on\s+request/i,
  /languages\s+portuguese\s*\(native\)\s*,\s*english\s*\(c2\)/i,
  /bsc\s+information\s+systems/i,
  /instituto\s+superior\s+técnico/i,
  /selected\s+projects\s+platform\s+rebuild/i,
  /^beatriz\s+costa\s+senior\s+full-stack\s+engineer/i,
  /^sofia\s+marques\s+senior\s+full-stack\s+engineer/i,
  /^inês\s+lopes\s+senior\s+full-stack\s+engineer/i,
  /^pedro\s+fernandes\s+full-stack\s+engineer/i,
  /beatriz\s+costa/i,
  /om\s+·\s+\+\d+/i,
  /\.costa@demo/i,
  /om\s*·\s*\+\d+[\d\s().-]+\d\s*Profile/i,
  /\.costa@demo\.taasflow\.com\s*·\s*\+\d+[\d\s().-]+\d/i,
];

export function isTemplatedEvidence(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const text = String(raw).trim();
  return TEMPLATED_PATTERNS.some((re) => re.test(text));
}

/**
 * Detect a candidate-skill summary line that names a broad stack. A skills list
 * is not evidence for an unrelated requirement, but it is a legitimate context
 * line when it is labeled as context.
 */
export function isGenericSkillsList(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const text = String(raw).trim();
  return /^core\s+stack\s*:/i.test(text);
}

/**
 * Ensures a quoted span is actually relevant to the requirement by checking for
 * a term overlap between the requirement label and the quote.
 */
export function isRelevantEvidence(quote: string, requirement: string): boolean {
  if (isCandidateHeadline(quote)) return false;

  const q = quote.toLowerCase();
  const r = requirement.toLowerCase();

  // Literal substring match check (T5/T6 fix)
  if (q.includes(r) || r.includes(q)) return true;

  // 1. Exact phrase/term match is the gold standard.
  const stopWords = ["and", "with", "for", "the", "experience", "exposure", "familiarity", "similar", "production", "features", "product", "engineer", "stack", "focused", "professional", "beatriz", "costa", "sofia", "marques", "inês", "lopes", "pedro", "fernandes"];
  const terms = r
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !stopWords.includes(t));

  if (terms.length === 0) return true; // Can't verify, allow for now.

  const hasOverlap = terms.some((t) => q.includes(t));
  if (hasOverlap) return true;

  // 2. Known synonym clusters.
  const synonyms: Array<[string[], string[]]> = [
    [["ai", "llm", "gpt", "openai", "generative"], ["artificial intelligence", "language model"]],
    [["tanstack", "remix", "next.js", "react", "frontend"], ["framework", "stack"]],
    [["sql", "postgres", "postgresql", "db", "database"], ["relational", "modeling"]],
    [["aws", "cloud", "azure", "gcp"], ["infrastructure", "devops"]],
  ];

  for (const [cluster1, cluster2] of synonyms) {
    const rMatch = cluster1.some((t) => r.includes(t)) || cluster2.some((t) => r.includes(t));
    const qMatch = cluster1.some((t) => q.includes(t)) || cluster2.some((t) => q.includes(t));
    if (rMatch && qMatch) return true;
  }

  return false;
}

/**
 * Returns true if the evidence snippet is merely a candidate's self-written
 * headline (e.g. "Senior Full-Stack Engineer — product-focused...").
 * Headlines are context, not proof of specific technical requirements.
 */
export const isCandidateHeadline = (snippet: string | null | undefined): boolean => {
  if (!snippet) return false;
  const s = String(snippet).toLowerCase().trim();
  // Most headlines follow this "Name Title — Description" or "Title — Stack" pattern
  // especially when truncated by an offset slice.
  return (
    (s.includes("engineer") ||
    s.includes("developer") ||
    s.includes("manager") ||
    s.includes("product-focused")) && (s.includes("—") || s.includes("|") || s.length < 100)
  );
}
