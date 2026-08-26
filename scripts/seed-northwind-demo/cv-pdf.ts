/**
 * Renders a dossier CV to a real A4 PDF with pdf-lib.
 *
 * Three visual templates so a reviewer opening several CVs sees documents that
 * plainly came from different people:
 *   T1 "Classic"  serif, single column, centred name block.
 *   T2 "Modern"   sans, left sidebar for facts, right column for the story.
 *   T3 "Senior"   compact sans, ruled section bands, denser leading.
 *
 * WinAnsi only: the standard fonts cannot encode anything outside cp1252, so the
 * text is sanitised (typographic dashes and quotes folded to their ASCII
 * equivalents) while Portuguese accents are kept.
 *
 * Every template draws each block of prose in a single top-to-bottom flow, so
 * extracted text keeps sentences contiguous and the seeder's verbatim evidence
 * assertions hold for all three.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CvDoc, CvLayout } from "./types";

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
  fonts: { regular: string; bold: string; italic: string };
};

const THEMES: Record<CvLayout, Theme> = {
  T1: {
    margin: 62,
    body: 10.8,
    lead: 14.2,
    head: 11,
    nameSize: 20,
    accent: [0.16, 0.2, 0.3],
    ink: [0.1, 0.11, 0.13],
    muted: [0.36, 0.38, 0.42],
    fonts: {
      regular: StandardFonts.TimesRoman,
      bold: StandardFonts.TimesRomanBold,
      italic: StandardFonts.TimesRomanItalic,
    },
  },
  T2: {
    margin: 48,
    body: 10.2,
    lead: 13.2,
    head: 10,
    nameSize: 21,
    accent: [0.11, 0.35, 0.42],
    ink: [0.11, 0.12, 0.14],
    muted: [0.4, 0.42, 0.46],
    fonts: {
      regular: StandardFonts.Helvetica,
      bold: StandardFonts.HelveticaBold,
      italic: StandardFonts.HelveticaOblique,
    },
  },
  T3: {
    margin: 52,
    body: 9.8,
    lead: 12.4,
    head: 9.6,
    nameSize: 17,
    accent: [0.2, 0.18, 0.16],
    ink: [0.08, 0.09, 0.1],
    muted: [0.38, 0.38, 0.4],
    fonts: {
      regular: StandardFonts.Helvetica,
      bold: StandardFonts.HelveticaBold,
      italic: StandardFonts.HelveticaOblique,
    },
  },
};

export async function renderCvPdf(cv: CvDoc): Promise<Uint8Array> {
  const layout: CvLayout = cv.layout ?? "T1";
  const t = THEMES[layout];
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(t.fonts.regular);
  const bold = await doc.embedFont(t.fonts.bold);
  const italic = await doc.embedFont(t.fonts.italic);

  let page = doc.addPage([A4.w, A4.h]);

  // Column geometry: T2 reserves a left rail; the others use the full width.
  const railW = layout === "T2" ? 158 : 0;
  const gutter = layout === "T2" ? 22 : 0;
  const mainX = t.margin + railW + gutter;
  const mainW = A4.w - t.margin - mainX;
  let y = A4.h - t.margin;

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
    x?: number;
    width?: number;
    lead?: number;
  };

  /** Main-column flow writer. */
  const draw = (text: string, opts: DrawOpts = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? t.body;
    const indent = opts.indent ?? 0;
    const x0 = (opts.x ?? mainX) + indent;
    const width = (opts.width ?? mainW) - indent;
    const lead = opts.lead ?? t.lead;
    for (const line of wrap(text, font, size, width)) {
      need(lead);
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

  const bullets = (items: string[], marker = "-") => {
    for (const b of items) {
      const lines = wrap(`${marker} ${b}`, regular, t.body, mainW - 12);
      lines.forEach((line, i) => {
        need(t.lead);
        page.drawText(line, {
          x: mainX + 10 + (i === 0 ? 0 : 9),
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
    need(t.lead * 2.4);
    y -= layout === "T3" ? 4 : 6;
    if (layout === "T3") {
      // Ruled band: a filled strip with the heading reversed out of it.
      need(16);
      page.drawRectangle({
        x: mainX,
        y: y - 12,
        width: mainW,
        height: 14,
        color: rgb(0.93, 0.93, 0.94),
      });
      page.drawText(winAnsiSafe(title.toUpperCase()), {
        x: mainX + 5,
        y: y - 9,
        size: t.head,
        font: bold,
        color: rgb(...t.accent),
      });
      y -= 20;
      return;
    }
    draw(title.toUpperCase(), {
      font: bold,
      size: t.head,
      color: t.accent,
      align: layout === "T1" ? "center" : "left",
    });
    page.drawLine({
      start: { x: mainX, y: y - 1 },
      end: { x: mainX + mainW, y: y - 1 },
      thickness: layout === "T2" ? 1.1 : 0.6,
      color: rgb(...(layout === "T2" ? t.accent : [0.72, 0.74, 0.78])),
    });
    y -= 9;
  };

  // ── Header ────────────────────────────────────────────────────────────────
  if (layout === "T1") {
    draw(cv.name, { font: bold, size: t.nameSize, align: "center" });
    y -= 2;
    draw(cv.title, { size: 12, align: "center", color: t.muted });
    y -= 1;
    draw(cv.contact, { size: 9.4, align: "center", color: t.muted, gap: 6 });
  } else if (layout === "T2") {
    // Name spans both columns; the rail then carries the facts.
    const nameLines = wrap(cv.name, bold, t.nameSize, A4.w - t.margin * 2);
    for (const line of nameLines) {
      page.drawText(line, {
        x: t.margin,
        y: y - t.nameSize,
        size: t.nameSize,
        font: bold,
        color: rgb(...t.ink),
      });
      y -= t.nameSize + 3;
    }
    page.drawText(winAnsiSafe(cv.title), {
      x: t.margin,
      y: y - 11.5,
      size: 11.5,
      font: regular,
      color: rgb(...t.accent),
    });
    y -= 24;
    page.drawLine({
      start: { x: t.margin, y: y + 8 },
      end: { x: A4.w - t.margin, y: y + 8 },
      thickness: 1.4,
      color: rgb(...t.accent),
    });

    // Rail is drawn first, top to bottom, then the main column continues.
    const railTop = y;
    let ry = y;
    const rail = (text: string, opts: { font?: Font; size?: number; gap?: number; color?: [number, number, number] } = {}) => {
      const font = opts.font ?? regular;
      const size = opts.size ?? 9.4;
      for (const line of wrap(text, font, size, railW)) {
        page.drawText(line, {
          x: t.margin,
          y: ry - size,
          size,
          font,
          color: rgb(...(opts.color ?? t.ink)),
        });
        ry -= size + 3.2;
      }
      if (opts.gap) ry -= opts.gap;
    };
    const railHead = (label: string) => {
      ry -= 6;
      rail(label.toUpperCase(), { font: bold, size: 8.6, color: t.accent, gap: 1 });
    };

    railHead("Contact");
    for (const part of cv.contact.split(/\s+·\s+/)) rail(part);
    railHead("Core skills");
    rail(cv.coreSkills);
    railHead("Education");
    for (const line of cv.education) rail(line);
    if (cv.certifications.length > 0) {
      railHead("Certifications");
      for (const line of cv.certifications) rail(line);
    }
    railHead("Languages");
    for (const line of cv.languages) rail(line);
    if (cv.interests) {
      railHead("Outside work");
      rail(cv.interests);
    }
    y = railTop;
    void railTop;
  } else {
    draw(cv.name, { font: bold, size: t.nameSize });
    draw(`${cv.title}  |  ${cv.contact}`, { size: 9, color: t.muted, gap: 4 });
  }

  // ── Main flow ─────────────────────────────────────────────────────────────
  section("Profile");
  draw(cv.summary, { gap: 2 });

  if (layout !== "T2") {
    section("Core skills");
    draw(cv.coreSkills, { gap: 2 });
  }

  section(layout === "T3" ? "Experience" : "Professional history");
  for (const role of cv.experience) {
    need(t.lead * 3);
    draw(role.heading, { font: bold });
    draw(role.dates, { font: italic, size: 9.4, color: t.muted });
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
    section("Education");
    bullets(cv.education);

    if (cv.certifications.length > 0) {
      section("Certifications");
      bullets(cv.certifications);
    }

    section("Languages");
    bullets(cv.languages);

    if (cv.interests) {
      section("Outside work");
      draw(cv.interests);
    }
  }

  // One or two A4 pages. Short careers legitimately fit on one page; nothing
  // is padded to reach two, and three pages means the dossier is over length.
  const pages = doc.getPageCount();
  if (pages > 2) throw new Error(`cv_too_long: rendered ${pages} pages`);

  return await doc.save();
}
