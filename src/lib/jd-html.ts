/**
 * HTML → job-description text, for a fetched job page or a converted DOCX.
 *
 * Pure (no DOM, no server imports) so it is tested directly. Keeps structure the
 * readers rely on: list items become "• " bullets and headings, paragraphs and
 * table rows become their own lines, so the instant read finds the
 * Requirements bullets in an uploaded Word file or a careers page exactly as it
 * does in pasted text.
 *
 * Job boards (Greenhouse, Lever, Workable, LinkedIn, Indeed, most ATS pages)
 * also embed a schema.org JobPosting as JSON-LD. When one is present its
 * labelled facts — title, location, employment type, pay — are put on top of
 * the text as labelled lines, which is the most reliable thing on the page.
 */

const ENT: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ndash: "–", mdash: "—", bull: "•",
  rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: "…", euro: "€", pound: "£",
};

export function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, g: string) => {
    if (g[0] === "#") {
      const code = g[1] === "x" || g[1] === "X" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return " ";
      try {
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    }
    return ENT[g.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<(script|style|noscript|svg|head|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<li\b[^>]{0,500}>/gi, "\n• ")
      .replace(/<\/(p|div|h[1-6]|tr|section|article|ul|ol|table|header|footer|blockquote)\s*>/gi, "\n")
      .replace(/<(h[1-6]|p|tr|section|article)\b[^>]{0,500}>/gi, "\n")
      .replace(/<\/t[dh]\s*>/gi, " | ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]{1,2000}>/g, " "),
  )
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\| *\n/g, "\n")
    .replace(/\n[ ]+/g, "\n")
    .replace(/[ ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Json = Record<string, unknown>;

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
}

function findJobPosting(node: unknown, depth = 0): Json | null {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findJobPosting(n, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  const o = node as Json;
  const type = asArray(o["@type"]).map(String);
  if (type.some((t) => t.toLowerCase() === "jobposting")) return o;
  if (o["@graph"]) return findJobPosting(o["@graph"], depth + 1);
  return null;
}

const EMPLOYMENT_LABEL: Record<string, string> = {
  FULL_TIME: "Full-time", PART_TIME: "Part-time", CONTRACTOR: "Contract", TEMPORARY: "Temporary",
  INTERN: "Internship", INTERNSHIP: "Internship",
};
const UNIT_LABEL: Record<string, string> = { YEAR: "per year", MONTH: "per month", HOUR: "per hour" };
const CURRENCIES = new Set(["USD", "EUR", "GBP", "BRL", "CAD", "AUD"]);

function placeOf(loc: unknown): string | null {
  const l = loc as Json | undefined;
  const a = (l?.["address"] ?? l) as Json | undefined;
  if (!a || typeof a !== "object") return null;
  const parts = [a["addressLocality"], a["addressRegion"], a["addressCountry"]]
    .map((p) => (typeof p === "string" ? p : typeof p === "object" && p ? (p as Json)["name"] : null))
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  return parts.length ? [...new Set(parts)].join(", ") : null;
}

/** Labelled header lines from a JobPosting, only for facts it states in a known vocabulary. */
export function jobPostingHeader(html: string): { header: string; description: string } | null {
  const re = /<script\b[^>]{0,300}type\s*=\s*["']application\/ld\+json["'][^>]{0,300}>([\s\S]*?)<\/script\s*>/gi;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(html)) && guard++ < 20) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    const jp = findJobPosting(data);
    if (!jp) continue;
    const lines: string[] = [];
    if (typeof jp["title"] === "string" && jp["title"].trim()) lines.push(`Job Title: ${decodeHtmlEntities(jp["title"].trim())}`);
    const remote = String(jp["jobLocationType"] ?? "").toUpperCase() === "TELECOMMUTE";
    const places = asArray(jp["jobLocation"]).map(placeOf).filter((p): p is string => Boolean(p));
    if (places.length === 1) lines.push(`Location: ${places[0]}`);
    if (remote) lines.push("Work model: Remote");
    const types = asArray(jp["employmentType"]).map((t) => EMPLOYMENT_LABEL[String(t).toUpperCase()]).filter(Boolean);
    if (types.length === 1) lines.push(`Employment type: ${types[0]}`);
    const sal = jp["baseSalary"] as Json | undefined;
    const code = typeof sal?.["currency"] === "string" ? String(sal["currency"]).toUpperCase() : "";
    const cur = CURRENCIES.has(code) ? code : undefined;
    const val = sal?.["value"] as Json | undefined;
    const unit = val ? UNIT_LABEL[String(val["unitText"] ?? "").toUpperCase()] : undefined;
    if (cur && val && unit) {
      const min = Number(val["minValue"] ?? val["value"]);
      const max = Number(val["maxValue"] ?? val["value"]);
      if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min) {
        lines.push(min === max ? `Salary: ${min} ${cur} ${unit}` : `Salary: ${min} - ${max} ${cur} ${unit}`);
      }
    }
    const description = typeof jp["description"] === "string" ? htmlToText(decodeHtmlEntities(jp["description"])) : "";
    return { header: lines.join("\n"), description };
  }
  return null;
}

/** Page HTML → the text the readers see: JobPosting facts first, then the posting. */
export function jobPageToText(html: string): string {
  const jp = jobPostingHeader(html);
  if (jp && jp.description.length >= 200) return `${jp.header}\n\n${jp.description}`.trim();
  const body = htmlToText(html);
  return jp?.header ? `${jp.header}\n\n${body}` : body;
}
