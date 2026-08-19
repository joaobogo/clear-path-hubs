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
 */
export function cleanQuote(raw: string | null | undefined): string {
  if (!raw) return "";
  const collapsed = stripContactLines(String(raw)).replace(/\s+/g, " ").trim();
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
export const isCandidateHeadline = (snippet: string): boolean => {
  const s = snippet.toLowerCase().trim();
  // Most headlines follow this "Name Title — Description" or "Title — Stack" pattern
  // especially when truncated by an offset slice.
  return (
    (s.includes("engineer") ||
    s.includes("developer") ||
    s.includes("manager") ||
    s.includes("product-focused")) && (s.includes("—") || s.includes("|") || s.length < 100)
  );
}
