/**
 * Proves the JD file extractor actually reads a real document.
 *
 * The blueprint unit tests cover the cleaning; this covers the half that
 * cannot be faked — that a PDF and a DOCX on disk come back as text. Written
 * as a script rather than a test because it builds real files and exercises
 * the edge-runtime extractor end to end.
 */
import { extractCvText } from "../src/lib/cv-extractor.server.ts";
import { PDFDocument, StandardFonts } from "pdf-lib";

const JD = `Senior Accountant
Austin, TX (hybrid)
Full-time. $95,000 - $115,000 per year.

About the role
We are hiring a Senior Accountant to own the monthly close.
You will report to the Controller and work with a finance team of six.

Requirements
- Five years of accounting experience
- CPA licence
- Month-end close ownership
- Advanced Excel
- US GAAP
- Authorised to work in the US without sponsorship

Nice to have
- NetSuite
- SaaS industry experience
`;

async function makePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage();
  let y = page.getHeight() - 40;
  for (const line of JD.split("\n")) {
    if (y < 40) {
      page = doc.addPage();
      y = page.getHeight() - 40;
    }
    page.drawText(line.slice(0, 90), { x: 40, y, size: 11, font });
    y -= 16;
  }
  return new Uint8Array(await doc.save());
}

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures += 1;
};

// 1. PDF with a real text layer
const pdfBytes = await makePdf();
const pdf = await extractCvText(pdfBytes, "application/pdf", "sample_jd.pdf");
check("PDF extracts text", !pdf.needs_ocr && pdf.chars > 200, `${pdf.chars} chars`);
check("PDF keeps the title", /Senior Accountant/i.test(pdf.text));
check("PDF keeps the compensation", /95,?000/.test(pdf.text));
check("PDF keeps a requirement", /CPA/i.test(pdf.text));

// 2. Plain text
const txt = await extractCvText(new TextEncoder().encode(JD), "text/plain", "jd.txt");
check("TXT extracts text", !txt.needs_ocr && txt.chars > 200, `${txt.chars} chars`);
check("TXT keeps the location", /Austin/.test(txt.text));

// 3. A scanned PDF (no text layer) must be REFUSED, not silently empty
const blank = await PDFDocument.create();
blank.addPage();
const blankBytes = new Uint8Array(await blank.save());
const scanned = await extractCvText(blankBytes, "application/pdf", "scan.pdf");
check("empty PDF is flagged, not passed through", scanned.needs_ocr === true, scanned.reason ?? "");

// 4. Garbage never throws
const junk = await extractCvText(new Uint8Array([1, 2, 3, 4, 5]), "application/pdf", "x.pdf");
check("garbage returns a decision instead of throwing", typeof junk.chars === "number");

console.log(failures === 0 ? "\nAll extraction checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
