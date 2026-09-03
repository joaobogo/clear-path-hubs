/**
 * Renders a dossier CV to a real A4 PDF with pdf-lib.
 *
 * Three visual templates so a reviewer opening several CVs sees documents that
 * plainly came from different people:
 *   T1 "Classic ATS"        single column, 20pt name, thin rule under each
 *                           section heading, 11pt body, dates right-aligned on
 *                           the role line.
 *   T2 "Modern two-column"  33% light grey left sidebar carrying the facts,
 *                           right column carrying the prose. 10.5pt.
 *   T3 "Compact senior"     single column, no rules, small-caps section labels,
 *                           tighter leading, employer bold / title italic.
 *
 * WinAnsi only: the standard fonts cannot encode anything outside cp1252, so the
 * text is sanitised (typographic dashes and quotes folded to their ASCII
 * equivalents) while Portuguese accents are kept.
 *
 * Every template draws prose in a single top-to-bottom flow — in T2 the sidebar
 * is painted after the main column so the extracted reading order still follows
 * the story — which keeps the seeder's verbatim evidence assertions valid.
 *
 * Metadata carries the candidate's own name as Title and Author; Producer and
 * Creator are deliberately left at the library default.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import type { CvDoc, CvLayout } from "./types";

/**
 * Real TrueType faces are embedded (subset) rather than relying on the base-14
 * fonts: it is what a CV written in Word or Docs looks like on the inside, and
 * it puts the file in the ordinary 30-120 KB range.
 */
type Family = "sans" | "serif";
const FONT_QUERY: Record<Family, { regular: string; bold: string; italic: string }> = {
  sans: {
    regular: "Liberation Sans",
    bold: "Liberation Sans:bold",
    italic: "Liberation Sans:italic",
  },
  serif: {
    regular: "Liberation Serif",
    bold: "Liberation Serif:bold",
    italic: "Liberation Serif:italic",
  },
};

/**
 * Metric-compatible stand-ins for the Liberation faces, used when fontconfig is
 * not present. Liberation Sans matches Arial and Liberation Serif matches Times
 * New Roman by design, so line breaks and page counts stay where they were.
 *
 * `fc-match` ships with fontconfig, which is a Linux thing: on Windows it exits
 * ENOENT and CV rendering died before drawing a page. Falling back keeps the
 * seeder and any fixture script usable off Linux.
 */
const FONT_FALLBACKS: Record<string, string[]> = {
  "Liberation Sans": ["C:/Windows/Fonts/arial.ttf", "/Library/Fonts/Arial.ttf"],
  "Liberation Sans:bold": ["C:/Windows/Fonts/arialbd.ttf", "/Library/Fonts/Arial Bold.ttf"],
  "Liberation Sans:italic": ["C:/Windows/Fonts/ariali.ttf", "/Library/Fonts/Arial Italic.ttf"],
  "Liberation Serif": ["C:/Windows/Fonts/times.ttf", "/Library/Fonts/Times New Roman.ttf"],
  "Liberation Serif:bold": ["C:/Windows/Fonts/timesbd.ttf", "/Library/Fonts/Times New Roman Bold.ttf"],
  "Liberation Serif:italic": ["C:/Windows/Fonts/timesi.ttf", "/Library/Fonts/Times New Roman Italic.ttf"],
};

const fontCache = new Map<string, Uint8Array>();
function fontBytes(query: string): Uint8Array {
  const hit = fontCache.get(query);
  if (hit) return hit;

  let file = "";
  try {
    file = execFileSync("fc-match", ["-f", "%{file}", query], { encoding: "utf8" }).trim();
  } catch {
    file = "";
  }
  if (!file) {
    file = (FONT_FALLBACKS[query] ?? []).find((p) => existsSync(p)) ?? "";
  }
  if (!file) throw new Error(`font_not_found: ${query}`);

  const bytes = new Uint8Array(readFileSync(file));
  fontCache.set(query, bytes);
  return bytes;
}

const A4 = { w: 595.28, h: 841.89 };

/** Fold characters the standard fonts cannot draw; keep Latin-1 accents. */
export function winAnsiSafe(input: string): string {
  return input
    .replace(/\u2019|\u2018/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/\u2022/g, "-")
    .replace(/\ufb01/g, "fi")
    .replace(/\ufb02/g, "fl")
    .replace(/[^\x09\x0a\x20-\x7e\u00a1-\u00ff\u20ac]/g, "");
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** "Mar 2022 - Present" -> "03/2022 - Present" for the numeric-date CVs. */
function numericDates(range: string): string {
  return range.replace(/\b([A-Z][a-z]{2})\s+(\d{4})\b/g, (whole, mon: string, year: string) =>
    MONTHS[mon] ? `${MONTHS[mon]}/${year}` : whole,
  );
}

type Font = Awaited<ReturnType<PDFDocument["embedFont"]>>;

type Theme = {
  margin: number;
  body: number;
  lead: number;
  head: number;
  nameSize: number;
  accent: [number, number, number];
  ink: [number, number, number];
  muted: [number, number, number];
  family: Family;
};

const THEMES: Record<CvLayout, Theme> = {
  T1: {
    margin: 60,
    body: 11,
    lead: 14.4,
    head: 11,
    nameSize: 20,
    accent: [0.14, 0.16, 0.2],
    ink: [0.1, 0.11, 0.13],
    muted: [0.36, 0.38, 0.42],
    family: "sans",
  },
  T2: {
    margin: 42,
    body: 10.5,
    lead: 14.4,
    head: 10.2,
    nameSize: 21,
    accent: [0.11, 0.32, 0.4],
    ink: [0.11, 0.12, 0.14],
    muted: [0.4, 0.42, 0.46],
    family: "sans",
  },
  T3: {
    margin: 58,
    body: 10.6,
    lead: 13.4,
    head: 9,
    nameSize: 18,
    accent: [0.2, 0.18, 0.16],
    ink: [0.08, 0.09, 0.1],
    muted: [0.38, 0.38, 0.4],
    family: "serif",
  },
};

export async function renderCvPdf(cv: CvDoc): Promise<Uint8Array> {
  const layout: CvLayout = cv.layout ?? "T1";
  const t = THEMES[layout];
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsiSafe(cv.name));
  doc.setAuthor(winAnsiSafe(cv.name));
  doc.registerFontkit(fontkit);
  const q = FONT_QUERY[t.family];
  const regular = await doc.embedFont(fontBytes(q.regular), { subset: true });
  const bold = await doc.embedFont(fontBytes(q.bold), { subset: true });
  const italic = await doc.embedFont(fontBytes(q.italic), { subset: true });

  const firstPage = doc.addPage([A4.w, A4.h]);
  let page = firstPage;

  // T2 reserves a 33% left rail on the first page only; later pages run full width.
  const panelW = layout === "T2" ? Math.round(A4.w * 0.33) : 0;
  const railPad = 18;
  const railW = panelW > 0 ? panelW - railPad * 2 : 0;
  let mainX = layout === "T2" ? panelW + 24 : t.margin;
  let mainW = A4.w - (layout === "T2" ? 34 : t.margin) - mainX;
  let y = A4.h - t.margin;

  // The heading already says "Core skills", so the label is not repeated in the body.
  const coreSkills = cv.coreSkills.replace(/^\s*Core skills:\s*/i, "");

  const dates = (range: string) =>
    cv.dateStyle === "numeric" ? numericDates(range) : range;

  const wrap = (text: string, font: Font, size: number, width: number): string[] => {
    const words = winAnsiSafe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    if (layout === "T2") {
      mainX = t.margin;
      mainW = A4.w - t.margin * 2;
    }
    y = A4.h - t.margin;
  };
  const need = (h: number) => {
    if (y - h < t.margin) newPage();
  };

  type DrawOpts = {
    font?: Font;
    size?: number;
    indent?: number;
    gap?: number;
    color?: [number, number, number];
    align?: "left" | "center";
    width?: number;
    lead?: number;
  };

  /** Main-column flow writer. */
  const draw = (text: string, opts: DrawOpts = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? t.body;
    const indent = opts.indent ?? 0;
    const lead = opts.lead ?? t.lead;
    for (const line of wrap(text, font, size, (opts.width ?? mainW) - indent)) {
      need(lead);
      const width = (opts.width ?? mainW) - indent;
      const x0 = mainX + indent;
      const lineW = font.widthOfTextAtSize(line, size);
      page.drawText(line, {
        x: opts.align === "center" ? x0 + (width - lineW) / 2 : x0,
        y: y - size,
        size,
        font,
        color: rgb(...(opts.color ?? t.ink)),
      });
      y -= lead;
    }
    if (opts.gap) y -= opts.gap;
  };

  const bullets = (items: string[]) => {
    for (const b of items) {
      const lines = wrap(`- ${b}`, regular, t.body, mainW - 12);
      lines.forEach((line, i) => {
        need(t.lead);
        page.drawText(line, {
          x: mainX + 8 + (i === 0 ? 0 : 8),
          y: y - t.body,
          size: t.body,
          font: regular,
          color: rgb(...t.ink),
        });
        y -= t.lead;
      });
    }
  };

  const section = (title: string) => {
    need(t.lead * 2.2);
    y -= layout === "T3" ? 5 : 7;
    if (layout === "T3") {
      // Small-caps label: capitals at a reduced size, no rule.
      need(t.head + 4);
      page.drawText(winAnsiSafe(title.toUpperCase()), {
        x: mainX,
        y: y - t.head,
        size: t.head,
        font: bold,
        color: rgb(...t.accent),
      });
      y -= t.head + 5;
      return;
    }
    draw(title.toUpperCase(), { font: bold, size: t.head, color: t.accent });
    page.drawLine({
      start: { x: mainX, y: y + 1 },
      end: { x: mainX + mainW, y: y + 1 },
      thickness: layout === "T2" ? 1 : 0.5,
      color: rgb(...(layout === "T2" ? t.accent : [0.7, 0.72, 0.76])),
    });
    y -= layout === "T2" ? 8 : 7;
  };

  /** Role line: heading left, date range right-aligned on the same baseline. */
  const roleLineRight = (heading: string, range: string) => {
    const rangeText = winAnsiSafe(dates(range));
    const rangeW = italic.widthOfTextAtSize(rangeText, 9.6);
    const headingLines = wrap(heading, bold, t.body, mainW - rangeW - 14);
    headingLines.forEach((line, i) => {
      need(t.lead);
      page.drawText(line, { x: mainX, y: y - t.body, size: t.body, font: bold, color: rgb(...t.ink) });
      if (i === 0) {
        page.drawText(rangeText, {
          x: mainX + mainW - rangeW,
          y: y - t.body,
          size: 9.6,
          font: italic,
          color: rgb(...t.muted),
        });
      }
      y -= t.lead;
    });
  };

  /** T3 role line: employer bold, title italic, dates on the next line. */
  const roleLineSenior = (heading: string, range: string) => {
    // Headings are "Title - Employer, City"; split so employer reads bold.
    const parts = winAnsiSafe(heading).split(/\s+-\s+/);
    const title = parts[0] ?? heading;
    const employer = parts.slice(1).join(" - ");
    need(t.lead * 2);
    const employerText = employer || title;
    page.drawText(employerText, {
      x: mainX,
      y: y - t.body,
      size: t.body,
      font: bold,
      color: rgb(...t.ink),
    });
    if (employer) {
      const w = bold.widthOfTextAtSize(employerText, t.body);
      page.drawText(` ${title}`, {
        x: mainX + w + 4,
        y: y - t.body,
        size: t.body,
        font: italic,
        color: rgb(...t.ink),
      });
    }
    y -= t.lead;
    page.drawText(winAnsiSafe(dates(range)), {
      x: mainX,
      y: y - 9.4,
      size: 9.4,
      font: regular,
      color: rgb(...t.muted),
    });
    y -= t.lead - 1;
  };

  // ── Header ────────────────────────────────────────────────────────────────
  if (layout === "T1") {
    draw(cv.name, { font: bold, size: t.nameSize, lead: t.nameSize + 6 });
    draw(`${cv.title}`, { size: 11.5, color: t.accent, lead: 15 });
    draw(cv.contact, { size: 9.6, color: t.muted, lead: 12, gap: 4 });
  } else if (layout === "T2") {
    page.drawText(winAnsiSafe(cv.name), {
      x: mainX,
      y: y - t.nameSize,
      size: t.nameSize,
      font: bold,
      color: rgb(...t.ink),
    });
    y -= t.nameSize + 5;
    page.drawText(winAnsiSafe(cv.title), {
      x: mainX,
      y: y - 11.5,
      size: 11.5,
      font: regular,
      color: rgb(...t.accent),
    });
    y -= 22;
  } else {
    draw(cv.name, { font: bold, size: t.nameSize, lead: t.nameSize + 5 });
    draw(cv.title, { size: 10.5, font: italic, color: t.muted, lead: 13.5 });
    draw(cv.contact, { size: 9.2, color: t.muted, lead: 12, gap: 3 });
  }

  // ── Main flow ─────────────────────────────────────────────────────────────
  const educationBlock = () => {
    section("Education");
    bullets(cv.education);
    if (cv.certifications.length > 0) {
      section("Certifications");
      bullets(cv.certifications);
    }
  };

  section(cv.summaryLabel ?? "Summary");
  draw(cv.summary, { gap: 2 });

  if (layout !== "T2") {
    section("Core skills");
    draw(coreSkills, { gap: 2 });
    if (cv.educationFirst) educationBlock();
  }

  section("Experience");
  for (const role of cv.experience) {
    need(t.lead * 3);
    if (layout === "T3") roleLineSenior(role.heading, role.dates);
    else roleLineRight(role.heading, role.dates);
    bullets(role.bullets);
    y -= 4;
  }

  if (cv.selectedWork.length > 0) {
    section("Selected work");
    for (const item of cv.selectedWork) {
      need(t.lead * 2);
      draw(item.heading, { font: bold });
      draw(item.body, { gap: 3 });
    }
  }

  if (layout !== "T2") {
    if (!cv.educationFirst) educationBlock();
    section("Languages");
    bullets(cv.languages);
    if (cv.interests) {
      section("Interests");
      draw(cv.interests);
    }
  }

  // ── T2 sidebar, painted last so the extracted reading order stays natural ──
  if (layout === "T2") {
    firstPage.drawRectangle({
      x: 0,
      y: 0,
      width: panelW,
      height: A4.h,
      color: rgb(0.945, 0.949, 0.953),
    });
    let ry = A4.h - t.margin;
    const rail = (
      text: string,
      opts: { font?: Font; size?: number; gap?: number; color?: [number, number, number] } = {},
    ) => {
      const font = opts.font ?? regular;
      const size = opts.size ?? 9.4;
      for (const line of wrap(text, font, size, railW)) {
        firstPage.drawText(line, {
          x: railPad,
          y: ry - size,
          size,
          font,
          color: rgb(...(opts.color ?? t.ink)),
        });
        ry -= size + 3.4;
      }
      if (opts.gap) ry -= opts.gap;
    };
    const railHead = (label: string) => {
      ry -= 8;
      rail(label.toUpperCase(), { font: bold, size: 8.6, color: t.accent, gap: 1.5 });
    };

    railHead("Contact");
    for (const part of cv.contact.split(/\s+·\s+/)) rail(part);
    railHead("Core skills");
    rail(coreSkills);
    railHead("Languages");
    for (const line of cv.languages) rail(line);
    railHead("Education");
    for (const line of cv.education) rail(line);
    if (cv.certifications.length > 0) {
      railHead("Certifications");
      for (const line of cv.certifications) rail(line);
    }
    if (cv.interests) {
      railHead("Interests");
      rail(cv.interests);
    }
  }

  // Length is honest: short careers fit one page, longer ones run to two, and
  // the dossier declares which so drift is caught here rather than in review.
  const pages = doc.getPageCount();
  const expected = cv.targetPages ?? 2;
  if (pages !== expected) {
    throw new Error(`cv_length: ${cv.name} rendered ${pages} page(s), dossier declares ${expected}`);
  }

  return await doc.save();
}

/**
 * The order the renderer lays prose down, as plain text. Used by the seeder to
 * check that extraction preserves the document's own reading order (in T2 the
 * sidebar is drawn last, so it comes last here too).
 */
export function cvReadingOrder(cv: CvDoc): string[] {
  const layout: CvLayout = cv.layout ?? "T1";
  const main: string[] = [cv.summary];
  const facts = [cv.coreSkills.replace(/^\s*Core skills:\s*/i, ""), ...cv.education, ...cv.certifications, ...cv.languages, cv.interests ?? ""];
  if (layout !== "T2") main.push(cv.coreSkills.replace(/^\s*Core skills:\s*/i, ""));
  if (layout !== "T2" && cv.educationFirst) main.push(...cv.education, ...cv.certifications);
  for (const role of cv.experience) main.push(role.heading, role.dates, ...role.bullets);
  for (const item of cv.selectedWork) main.push(item.heading, item.body);
  if (layout !== "T2") {
    if (!cv.educationFirst) main.push(...cv.education, ...cv.certifications);
    main.push(...cv.languages);
    if (cv.interests) main.push(cv.interests);
  } else {
    main.push(cv.contact, ...facts);
  }
  return main.filter(Boolean);
}
