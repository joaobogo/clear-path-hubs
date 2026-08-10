import { describe, expect, it } from "vitest";
import { MAX_CV_BYTES } from "@/lib/apply-schema";
import { CV_MESSAGES, MAX_CV_PAGES, sanitizeFilename, validateCv } from "@/lib/cv-validation";

const enc = (s: string) => new TextEncoder().encode(s);

function bytes(...parts: (number[] | Uint8Array | string)[]): Uint8Array {
  const chunks = parts.map((p) =>
    typeof p === "string" ? enc(p) : p instanceof Uint8Array ? p : new Uint8Array(p),
  );
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

const validPdf = (pages = 1) =>
  bytes(
    "%PDF-1.7\n",
    Array.from({ length: pages }, (_, i) => `${i + 3} 0 obj\n<< /Type /Page >>\nendobj\n`).join(""),
    "trailer\n<< /Root 1 0 R >>\n%%EOF\n",
  );

describe("validateCv — accepts real PDFs", () => {
  it("accepts a well-formed PDF", async () => {
    const r = await validateCv(validPdf(2), "my-cv.pdf", "application/pdf");
    expect(r.ok).toBe(true);
    expect(r.detected_mime).toBe("application/pdf");
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.page_count).toBe(2);
  });

  it("accepts a PDF when the browser sends no/generic MIME", async () => {
    expect((await validateCv(validPdf(), "cv.pdf", "")).ok).toBe(true);
    expect((await validateCv(validPdf(), "cv.pdf", "application/octet-stream")).ok).toBe(true);
  });
});

describe("validateCv — rejects non-PDF files", () => {
  const cases: [string, Uint8Array, string, string][] = [
    ["DOCX renamed to .pdf", bytes([0x50, 0x4b, 0x03, 0x04], "[Content_Types].xml word/"), "cv.pdf", "docx"],
    ["legacy .doc", bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], "junk"), "cv.pdf", "doc"],
    ["JPEG photo", bytes([0xff, 0xd8, 0xff, 0xe0], "junk"), "cv.pdf", "image"],
    ["PNG screenshot", bytes([0x89, 0x50, 0x4e, 0x47], "junk"), "cv.pdf", "image"],
    ["zip archive", bytes([0x52, 0x61, 0x72, 0x21], "junk"), "cv.pdf", "archive"],
    ["executable", bytes([0x4d, 0x5a], "this is a windows binary"), "cv.pdf", "executable"],
    ["plain text", enc("Name: Jane Doe\nExperience: 5 years\n"), "cv.pdf", "plain_text"],
    ["random binary", bytes([0x01, 0x02, 0x03, 0x99, 0xfe]), "cv.pdf", "bad_mime"],
  ];

  for (const [label, buf, name, code] of cases) {
    it(`rejects ${label} with a clear message`, async () => {
      const r = await validateCv(buf, name, "application/pdf");
      expect(r.ok).toBe(false);
      expect(r.code).toBe(code);
      expect(r.message).toBe(CV_MESSAGES[r.code!]);
      expect(r.message!.length).toBeGreaterThan(20);
      expect(r.message).not.toMatch(/undefined|null|Error|stack/i);
    });
  }

  it("rejects disallowed extensions even when the bytes are a PDF", async () => {
    for (const name of ["cv.docx", "cv.doc", "cv.txt", "cv.png", "cv", "cv.pdf.exe"]) {
      const r = await validateCv(validPdf(), name, "application/pdf");
      expect(r.ok, name).toBe(false);
      expect(r.code).toBe("bad_extension");
      expect(r.message).toBe(CV_MESSAGES.bad_extension);
    }
  });

  it("rejects a mismatched declared MIME", async () => {
    const r = await validateCv(validPdf(), "cv.pdf", "image/png");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("bad_mime");
  });
});

describe("validateCv — rejects size violations", () => {
  it("rejects an empty file", async () => {
    const r = await validateCv(new Uint8Array(0), "cv.pdf", "application/pdf");
    expect(r.code).toBe("empty");
    expect(r.message).toBe(CV_MESSAGES.empty);
  });

  it("rejects a file over the 10 MB limit", async () => {
    const big = new Uint8Array(MAX_CV_BYTES + 1);
    big.set(enc("%PDF-1.7"), 0);
    const r = await validateCv(big, "cv.pdf", "application/pdf");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("too_large");
    expect(r.message).toContain("10 MB");
  });

  it("accepts a file exactly at the limit", async () => {
    const pdf = validPdf();
    const atLimit = new Uint8Array(MAX_CV_BYTES);
    atLimit.fill(0x20);
    atLimit.set(pdf.subarray(0, 9), 0);
    atLimit.set(enc("%%EOF\n"), MAX_CV_BYTES - 6);
    const r = await validateCv(atLimit, "cv.pdf", "application/pdf");
    expect(r.code).not.toBe("too_large");
  });
});

describe("validateCv — rejects corrupt and unreadable PDFs", () => {
  it("rejects a truncated PDF with no EOF marker", async () => {
    const r = await validateCv(bytes("%PDF-1.7\n1 0 obj\n<< /Type /Page >>"), "cv.pdf", "application/pdf");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("corrupt");
    expect(r.message).toBe(CV_MESSAGES.corrupt);
  });

  it("rejects a PDF whose body was overwritten with garbage", async () => {
    const r = await validateCv(
      bytes("%PDF-1.4\n", new Uint8Array(2048).fill(0x00)),
      "cv.pdf",
      "application/pdf",
    );
    expect(r.ok).toBe(false);
    expect(r.code).toBe("corrupt");
  });

  it("rejects a password-protected PDF", async () => {
    const r = await validateCv(
      bytes("%PDF-1.7\n<< /Encrypt 9 0 R >>\ntrailer\n%%EOF\n"),
      "cv.pdf",
      "application/pdf",
    );
    expect(r.ok).toBe(false);
    expect(r.code).toBe("encrypted");
    expect(r.message).toContain("password-protected");
  });

  it("rejects an over-long PDF", async () => {
    const r = await validateCv(validPdf(MAX_CV_PAGES + 5), "cv.pdf", "application/pdf");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("too_many_pages");
    expect(r.message).toContain(String(MAX_CV_PAGES));
  });
});

describe("sanitizeFilename", () => {
  it("strips path segments and forces a .pdf extension", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd.pdf");
    expect(sanitizeFilename("C:\\Users\\me\\My CV (final).pdf")).toBe("My_CV_final_.pdf");
    expect(sanitizeFilename("")).toBe("cv.pdf");
  });
});
