/**
 * Text-layer CV fixture.
 *
 * The apply flow's extractor treats a PDF whose recoverable text is under 200
 * characters as a scan and parks the match in `ocr_required`. This fixture is a
 * structurally valid single-page PDF with an *uncompressed* text content stream,
 * so the same extractor recovers a full CV body and the match advances to
 * `parsed` without an OCR runner.
 */

const CV_LINES = [
  "Ana Ribeiro - Senior Operations Manager",
  "Lisbon, Portugal | ana.ribeiro.qa@example.com | +351 912 345 678",
  "SUMMARY",
  "Operations leader with 9 years running multi-site hospitality and service",
  "teams. Owns hiring, scheduling, cost control and quality standards.",
  "EXPERIENCE",
  "Operations Manager, Northwind Hospitality (2019-2026)",
  "Ran 4 properties and 120 staff. Cut agency spend 31% by building an",
  "internal bank of trained relief staff. Lifted guest satisfaction from",
  "7.9 to 9.1 across two seasons.",
  "Assistant Operations Manager, Harbour Group (2016-2019)",
  "Owned rota planning, payroll input and supplier negotiation.",
  "SKILLS",
  "Workforce planning, budgeting, vendor management, ATS hiring workflows,",
  "onboarding design, Portuguese (native), English (fluent), Spanish (B2).",
  "EDUCATION",
  "BSc Hospitality Management, Universidade de Lisboa, 2016.",
];

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildTextLayerPdf(): Buffer {
  const body =
    "BT /F1 11 Tf 14 TL 56 736 Td\n" +
    CV_LINES.map((line) => `(${escapePdfText(line)}) Tj T*`).join("\n") +
    "\nET\n";

  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    `<</Length ${Buffer.byteLength(body, "latin1")}>>\nstream\n${body}endstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/** Valid single-page PDF carrying a real, extractable text layer (>200 chars). */
export const TEXT_LAYER_CV_PDF = buildTextLayerPdf();

/** Plain-text CV body, handy for assertions on extracted text. */
export const TEXT_LAYER_CV_TEXT = CV_LINES.join("\n");
