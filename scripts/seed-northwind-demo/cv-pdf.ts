/**
 * Renders a dossier CV to a real two-page A4 PDF with pdf-lib.
 *
 * WinAnsi only: Helvetica cannot encode anything outside cp1252, so the text is
 * sanitised (typographic dashes and quotes folded to their ASCII equivalents)
 * while Portuguese accents are kept.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CvDoc } from "./types";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56.7; // 2 cm
const BODY = 10.5;
const LEAD = 13.6;
const HEAD = 11.5;

/** Fold characters Helvetica/WinAnsi cannot draw; keep Latin-1 accents. */
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

export async function renderCvPdf(cv: CvDoc): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const maxW = A4.w - MARGIN * 2;
  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;

  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - MARGIN;
  };
  const need = (h: number) => {
    if (y - h < MARGIN) newPage();
  };

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

  const draw = (
    text: string,
    opts: { font?: Font; size?: number; indent?: number; gap?: number; color?: [number, number, number] } = {},
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? BODY;
    const indent = opts.indent ?? 0;
    const lines = wrap(text, font, size, maxW - indent);
    for (const line of lines) {
      need(LEAD);
      page.drawText(line, {
        x: MARGIN + indent,
        y: y - size,
        size,
        font,
        color: opts.color ? rgb(...opts.color) : rgb(0.09, 0.1, 0.12),
      });
      y -= LEAD;
    }
    if (opts.gap) y -= opts.gap;
  };

  const rule = () => {
    need(6);
    page.drawLine({
      start: { x: MARGIN, y: y - 2 },
      end: { x: A4.w - MARGIN, y: y - 2 },
      thickness: 0.6,
      color: rgb(0.72, 0.74, 0.78),
    });
    y -= 8;
  };

  const section = (title: string) => {
    need(LEAD * 2);
    y -= 5;
    draw(title.toUpperCase(), { font: bold, size: HEAD });
    rule();
  };

  // ── Header ────────────────────────────────────────────────────────────────
  draw(cv.name, { font: bold, size: 19 });
  y -= 3;
  draw(cv.title, { font: regular, size: 12 });
  y -= 1;
  draw(cv.contact, { font: regular, size: 9.5, color: [0.3, 0.32, 0.36], gap: 4 });

  section("Summary");
  draw(cv.summary, { gap: 2 });

  section("Core skills");
  draw(cv.coreSkills, { gap: 2 });

  section("Professional history");
  for (const role of cv.experience) {
    need(LEAD * 3);
    draw(role.heading, { font: bold });
    draw(role.dates, { font: italic, size: 9.5, color: [0.34, 0.36, 0.4] });
    for (const b of role.bullets) {
      const lines = wrap(`- ${b}`, regular, BODY, maxW - 10);
      lines.forEach((line, i) => {
        need(LEAD);
        page.drawText(line, {
          x: MARGIN + 10 + (i === 0 ? 0 : 8),
          y: y - BODY,
          size: BODY,
          font: regular,
          color: rgb(0.09, 0.1, 0.12),
        });
        y -= LEAD;
      });
    }
    y -= 4;
  }

  section("Selected work");
  for (const item of cv.selectedWork) {
    need(LEAD * 2);
    draw(item.heading, { font: bold });
    draw(item.body, { gap: 3 });
  }

  section("Education");
  for (const line of cv.education) draw(`- ${line}`, { indent: 4 });

  if (cv.certifications.length > 0) {
    section("Certifications");
    for (const line of cv.certifications) draw(`- ${line}`, { indent: 4 });
  }

  section("Languages");
  for (const line of cv.languages) draw(`- ${line}`, { indent: 4 });

  // Two A4 pages exactly: never fewer, never more.
  if (doc.getPageCount() === 1) newPage();
  if (doc.getPageCount() > 2) {
    throw new Error(`cv_too_long: rendered ${doc.getPageCount()} pages`);
  }

  return await doc.save();
}
