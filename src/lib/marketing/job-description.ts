// Job descriptions arrive as free text written by clients. Rather than dumping
// one pre-wrapped blob on the page, we parse the common shapes people actually
// write — ALL-CAPS headings, "Title:" headings, and "-"/"*"/"1." bullets — into
// typed blocks the detail page can render with real hierarchy.

export type JobBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

const BULLET = /^\s*(?:[-*•–]|\d+[.)])\s+/;

function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 70 || BULLET.test(line)) return false;
  // "MAIN RESPONSIBILITIES" — all caps, at least one letter, no trailing period.
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase() && !t.endsWith(".")) return true;
  // "Responsibilities:" — short line ending in a colon.
  if (/^[^.!?]{3,60}:$/.test(t)) return true;
  return false;
}

function titleCase(text: string): string {
  const t = text.replace(/:\s*$/, "").trim();
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

  for (const raw of (description ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
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
      list.push(line.replace(BULLET, "").trim());
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flush();

  return blocks.filter(
    (b) => (b.kind === "list" ? b.items.length > 0 : b.text.length > 0),
  );
}

/** Short plain-text summary for meta descriptions and previews. */
export function jobDescriptionSummary(description: string, max = 155): string {
  const firstParagraph = parseJobDescription(description).find((b) => b.kind === "paragraph");
  const text = firstParagraph && firstParagraph.kind === "paragraph"
    ? firstParagraph.text
    : (description ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
