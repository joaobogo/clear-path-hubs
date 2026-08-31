// Job descriptions may carry three inline styles and nothing else: bold,
// italic and underline. They are stored inside the same plain-text column as
// before, as `<strong>`, `<em>` and `<u>` tags. Everything else — pasted
// markup, links, scripts, styles, attributes — is stripped on the way in, so
// the stored value can never contain arbitrary HTML.

export type InlineSegment = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

const OPEN = { strong: "\u0001s\u0001", em: "\u0001e\u0001", u: "\u0001u\u0001" } as const;
const CLOSE = { strong: "\u0002s\u0002", em: "\u0002e\u0002", u: "\u0002u\u0002" } as const;

type Tag = keyof typeof OPEN;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/**
 * Reduce any markup to plain text plus the three permitted inline tags.
 * Used both when the editor serialises its content and before anything is
 * stored, so no other tag or attribute can survive a round trip.
 */
export function sanitizeInlineMarkup(input: string): string {
  let out = (input ?? "").replace(/\r\n/g, "\n");

  // Block boundaries become newlines before any tag is dropped.
  out = out
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n");

  // Park the permitted tags out of reach of the strip below.
  out = out
    .replace(/<\s*(b|strong)(\s[^>]*)?>/gi, OPEN.strong)
    .replace(/<\s*\/\s*(b|strong)\s*>/gi, CLOSE.strong)
    .replace(/<\s*(i|em)(\s[^>]*)?>/gi, OPEN.em)
    .replace(/<\s*\/\s*(i|em)\s*>/gi, CLOSE.em)
    .replace(/<\s*(u|ins)(\s[^>]*)?>/gi, OPEN.u)
    .replace(/<\s*\/\s*(u|ins)\s*>/gi, CLOSE.u);

  // Drop every remaining tag, including script/style bodies.
  out = out
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<[^>]*>/g, "");

  out = decodeEntities(out);

  // Anything left that looks like markup is text, not markup.
  out = out.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  out = out
    .replace(new RegExp(OPEN.strong, "g"), "<strong>")
    .replace(new RegExp(CLOSE.strong, "g"), "</strong>")
    .replace(new RegExp(OPEN.em, "g"), "<em>")
    .replace(new RegExp(CLOSE.em, "g"), "</em>")
    .replace(new RegExp(OPEN.u, "g"), "<u>")
    .replace(new RegExp(CLOSE.u, "g"), "</u>");

  // Empty style runs add nothing and confuse the editor.
  out = out.replace(/<(strong|em|u)>\s*<\/\1>/g, "");

  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

/** Drop the three tags too, leaving readable plain text. */
export function stripInlineMarkup(input: string): string {
  return decodeEntities((input ?? "").replace(/<\/?(strong|em|u|b|i|ins)\s*>/gi, ""));
}

/**
 * Convert Markdown syntax into the three permitted inline tags.
 *
 * Role descriptions are drafted as MARKDOWN, but this module only ever knew
 * about HTML tags — so `# Technical Product Developer`, `**Junior to
 * Mid-Level**` and `## About the Role` rendered as literal text on the client
 * role brief and the public job page (audit #6, A6-14).
 *
 * The output stays inside the same three-style vocabulary: a heading becomes
 * bold on its own line, emphasis becomes `<strong>`/`<em>`, a bullet becomes a
 * real bullet character. Nothing new can be expressed, so nothing new can be
 * injected.
 *
 * Deliberately conservative:
 *   - only `#` at the START of a line is a heading; a `#` mid-sentence is a
 *     hashtag or a C# reference and is left alone;
 *   - `*`/`_` emphasis must hug non-space text, so `2 * 3 * 4` and
 *     `snake_case_name` survive;
 *   - link syntax keeps the LABEL and drops the target — this module has never
 *     rendered links, and a bare URL in a brief is noise.
 */
export function markdownToInlineMarkup(input: string): string {
  let out = (input ?? "").replace(/\r\n/g, "\n");

  // Fenced code fences carry no meaning here; keep the contents, drop the rail.
  out = out.replace(/^```[^\n]*\n?/gm, "").replace(/^```$/gm, "");

  // Headings: bold, on their own line.
  out = out.replace(/^[ \t]{0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, "<strong>$2</strong>");

  // Horizontal rules add nothing to a brief.
  out = out.replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "");

  // Blockquote markers.
  out = out.replace(/^[ \t]{0,3}>[ \t]?/gm, "");

  // Bullets and numbered items become readable list lines.
  out = out.replace(/^[ \t]{0,6}[-*+][ \t]+/gm, "• ");
  out = out.replace(/^[ \t]{0,6}(\d+)\.[ \t]+/gm, "$1. ");

  // Links and images: keep the label, drop the target.
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Emphasis. Bold before italic so `***x***` resolves outermost-first.
  out = out.replace(/\*\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*\*/g, "<strong><em>$1</em></strong>");
  out = out.replace(/\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(?!\s)([\s\S]+?)(?<!\s)__/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\w)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^\w_])_(?!\s)([^_\n]+?)(?<!\s)_(?!\w)/g, "$1<em>$2</em>");

  // Inline code: keep the text, drop the backticks.
  out = out.replace(/`([^`\n]+)`/g, "$1");

  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Split a stored string into styled runs so React can render it without
 * `dangerouslySetInnerHTML`.
 */
export function parseInlineMarkup(input: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const open: Tag[] = [];
  // Markdown is converted HERE, at render, rather than only on the way in:
  // descriptions already stored as Markdown would otherwise keep rendering
  // "## About the Role" as literal text until someone re-saved them
  // (audit #6, A6-14).
  const source = markdownToInlineMarkup(input ?? "");
  const token = /<(\/?)(strong|em|u|b|i|ins)\s*>/gi;
  let index = 0;

  const push = (raw: string) => {
    if (!raw) return;
    const text = decodeEntities(raw);
    if (!text) return;
    segments.push({
      text,
      bold: open.includes("strong"),
      italic: open.includes("em"),
      underline: open.includes("u"),
    });
  };

  const normalise = (name: string): Tag =>
    name === "b" || name === "strong" ? "strong" : name === "u" || name === "ins" ? "u" : "em";

  let match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    push(source.slice(index, match.index));
    index = match.index + match[0].length;
    const tag = normalise(match[2]!.toLowerCase());
    if (match[1]) {
      const at = open.lastIndexOf(tag);
      if (at !== -1) open.splice(at, 1);
    } else {
      open.push(tag);
    }
  }
  push(source.slice(index));

  return segments;
}

/** Does the value carry any of the three styles? */
export function hasInlineMarkup(input: string): boolean {
  return /<\/?(strong|em|u|b|i|ins)\s*>/i.test(input ?? "");
}
