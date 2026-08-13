/**
 * Quote hygiene for evidence snippets.
 *
 * Raw quotes are character-offset slices of a CV, so they begin mid-word and
 * can carry contact details. Contact release is a separate permission, so an
 * email, phone number or URL must never reach a stored or rendered quote.
 */

export const QUOTE_MAX_CHARS = 240;

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
 * Drop whole lines that contain an email, phone number or URL, plus the tiny
 * leftover fragments a mid-word slice leaves behind (e.g. "m" from an email).
 */
export function stripContactLines(raw: string): string {
  return raw
    .split(/\r?\n|(?:\s*[\u2022\u00b7]\s*)|(?:\s*\|\s*)/)
    .map((line) => line.trim())
    .filter((line, i, all) => {
      if (!line) return false;
      if (hasContactDetail(line)) return false;
      // A 1-3 char opening fragment is slice debris, not a sentence.
      if (i < all.length - 1 && line.length <= 3) return false;
      return true;
    })
    .join(" ");
}

/** Drop a leading partial sentence when a usable sentence follows. */
function snapStart(text: string): string {
  let out = text.trim();
  const firstBoundary = out.search(/[.!?]\s+[A-Z0-9]/);
  if (firstBoundary !== -1) {
    const candidate = out.slice(firstBoundary + 1).trim();
    if (candidate.length >= 60) out = candidate;
  }
  if (/^[a-z]/.test(out)) {
    // Still opening mid-word: the first token is slice debris, drop it.
    const nextWord = out.indexOf(" ");
    if (nextWord > 0 && nextWord < 24 && out.length - nextWord >= 30) {
      out = out.slice(nextWord + 1).trim();
    }
  }
  return out;
}

/** Drop a trailing partial sentence, or at least a trailing partial word. */
function snapEnd(text: string): string {
  let out = text.trim();
  const lastBoundary = Math.max(out.lastIndexOf("."), out.lastIndexOf("!"), out.lastIndexOf("?"));
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
  let out = text.replace(/^[^A-Za-z]+/, "").trim();
  const firstSpace = out.indexOf(" ");
  if (firstSpace > 0 && firstSpace <= 2 && out.length - firstSpace >= 40) {
    out = out.slice(firstSpace + 1).trim();
  }
  return out;
}

function capAtWord(text: string): string {
  if (text.length <= QUOTE_MAX_CHARS) return text;
  const cut = text.slice(0, QUOTE_MAX_CHARS);
  const boundary = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
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
  const base = stripLeadingJunk(collapsed);
  const trimmedStart = snapStart(base);
  // Never let hygiene reduce a quote to a stub: keep the fuller start instead.
  const started = snapEnd(trimmedStart).length >= 40 ? trimmedStart : base;
  return capAtWord(snapEnd(started)).trim();

}

