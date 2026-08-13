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

/** Drop whole lines that contain an email, phone number or URL. */
export function stripContactLines(raw: string): string {
  return raw
    .split(/\r?\n|(?:\s\u2022\s)|(?:\s\|\s)/)
    .filter((line) => line.trim() && !hasContactDetail(line))
    .join(" ");
}

/**
 * Snap a slice to sentence boundaries: drop a leading partial sentence and a
 * trailing partial one when a complete sentence remains.
 */
function snapToSentences(text: string): string {
  let out = text.trim();
  const firstBoundary = out.search(/[.!?]\s+[A-Z0-9]/);
  if (firstBoundary !== -1 && firstBoundary < out.length - 20) {
    const candidate = out.slice(firstBoundary + 1).trim();
    if (candidate.length >= 40) out = candidate;
  } else if (/^[a-z]/.test(out)) {
    // Started mid-word/mid-sentence with no later boundary: snap to next word.
    const nextWord = out.indexOf(" ");
    if (nextWord > 0 && nextWord < 24) out = out.slice(nextWord + 1).trim();
  }
  const lastBoundary = Math.max(out.lastIndexOf("."), out.lastIndexOf("!"), out.lastIndexOf("?"));
  if (lastBoundary >= 40) out = out.slice(0, lastBoundary + 1);
  return out.trim();
}

/**
 * Clean an evidence quote: remove contact lines, snap to sentence boundaries
 * and trim to ~240 characters without cutting a word in half.
 */
export function cleanQuote(raw: string | null | undefined): string {
  if (!raw) return "";
  const collapsed = stripContactLines(String(raw)).replace(/\s+/g, " ").trim();
  if (!collapsed) return "";
  let out = snapToSentences(collapsed) || collapsed;
  if (out.length > QUOTE_MAX_CHARS) {
    const cut = out.slice(0, QUOTE_MAX_CHARS);
    const boundary = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
    out =
      boundary >= 60
        ? cut.slice(0, boundary + 1)
        : `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : QUOTE_MAX_CHARS).trim()}…`;
  }
  return out.trim();
}
