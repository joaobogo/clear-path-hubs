// Job descriptions arrive as free text written by clients. Rather than dumping
// one pre-wrapped blob on the page, we parse the common shapes people actually
// write — ALL-CAPS headings, "Title:" headings, and "-"/"*"/"1." bullets — into
// typed blocks the detail page can render with real hierarchy.

export type JobBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

const BULLET = /^\s*(?:[-*•–]|\d+[.)])\s+/;
const MD_HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
/**
 * A Markdown thematic break ("---", "***", "___"). It carries no words, so it
 * is dropped rather than printed as literal dashes on the page.
 */
const MD_RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;

/**
 * Clients often paste Markdown. Raw `##` and `**` must never reach the page,
 * so emphasis and inline heading marks are stripped as the text is read.
 */
export function stripJobMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,;:)])/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isHeading(line: string): boolean {
  const t = line.trim();
  if (MD_HEADING.test(t)) return true;
  if (!t || t.length > 70 || BULLET.test(line)) return false;
  // "MAIN RESPONSIBILITIES" — all caps, at least one letter, no trailing period.
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase() && !t.endsWith(".")) return true;
  // "Responsibilities:" — short line ending in a colon.
  if (/^[^.!?]{3,60}:$/.test(t)) return true;
  return false;
}

function titleCase(text: string): string {
  const t = stripJobMarkdown(text).replace(/:\s*$/, "").trim();
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters && letters === letters.toUpperCase()) {
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
  return t;
}


export function parseJobDescription(description: string): JobBlock[] {
  const blocks: JobBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ kind: "list", items: list });
      list = [];
    }
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  // Some descriptions arrive as a single pasted line. Markdown headings then
  // need a line of their own before anything can be read as hierarchy.
  const normalized = (description ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/(\S)\s+(#{1,6}\s+)/g, "$1\n$2");

  for (const raw of normalized.split("\n")) {
    const line = raw.trim();
    if (!line || MD_RULE.test(line)) {
      flush();
      continue;
    }
    if (isHeading(line)) {
      flush();
      blocks.push({ kind: "heading", text: titleCase(line) });
      continue;
    }
    if (BULLET.test(raw)) {
      flushParagraph();
      list.push(stripJobMarkdown(line.replace(BULLET, "")));
      continue;
    }
    flushList();
    paragraph.push(stripJobMarkdown(line));
  }

  flush();

  return blocks.filter(
    (b) => (b.kind === "list" ? b.items.length > 0 : b.text.length > 0),
  );
}

/** Short plain-text summary for meta descriptions and previews. */
export function jobDescriptionSummary(description: string, max = 155): string {
  const paragraphs = parseJobDescription(description).flatMap((b) =>
    b.kind === "paragraph" ? [b.text] : [],
  );
  // Skip label lines like "Junior to Mid-Level | Brazil | Full-Time" — a card
  // should open on a real sentence about the work.
  const sentence =
    paragraphs.find((t) => /[.!?]/.test(t) && t.length > 60 && !t.includes("|")) ??
    paragraphs[0];
  const text = sentence ?? stripJobMarkdown((description ?? "").trim());


  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
