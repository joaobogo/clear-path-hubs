// CV file validation. Pure functions — server-safe and unit-testable.
// PDF-only. Validates: extension, MIME, size, empty, magic bytes / file signature,
// disguised file types (DOC/DOCX/images/archives/executables/text), encrypted PDFs,
// corrupt PDFs and page-count limits. Also owns filename sanitisation so no
// user-controlled path segment ever reaches storage.

import {
  ALLOWED_CV_EXT,
  ALLOWED_CV_MIME,
  MAX_CV_BYTES,
  fileExt,
} from "./apply-schema";

export const MAX_CV_PAGES = 30;

export type CvIssueCode =
  | "empty"
  | "too_large"
  | "bad_extension"
  | "bad_mime"
  | "docx"
  | "doc"
  | "image"
  | "archive"
  | "executable"
  | "plain_text"
  | "corrupt"
  | "encrypted"
  | "too_many_pages"
  | "unknown";

export interface CvValidationResult {
  ok: boolean;
  code?: CvIssueCode;
  detected_mime?: string;
  message?: string;
  sha256?: string;
  page_count?: number;
}

// Candidate-safe user messages — never leak internals.
export const CV_MESSAGES: Record<CvIssueCode, string> = {
  empty: "That file looks empty. Please choose your CV file.",
  too_large: "Your CV is larger than 10 MB. Please upload a smaller file.",
  bad_extension: "Please upload a PDF. Other file types are not accepted.",
  bad_mime:
    "That file does not look like a PDF. Please upload a PDF version of your CV.",
  docx: "That is a Word document. Please use “Save as PDF” and upload the PDF.",
  doc: "That is an older Word document. Please save it as a PDF and upload the PDF.",
  image: "That is an image. Please upload a PDF version of your CV, not a photo or screenshot.",
  archive: "That is a compressed archive. Please upload your CV as a single PDF.",
  executable: "That file type cannot be accepted. Please upload a PDF.",
  plain_text: "That is a plain text file. Please upload a PDF version of your CV.",
  corrupt:
    "We could not read that file. It may be damaged — please try re-saving or uploading again.",
  encrypted:
    "That PDF is password-protected. Please upload an unlocked copy so we can review it.",
  too_many_pages: `That PDF has more than ${MAX_CV_PAGES} pages. Please upload a shorter CV.`,
  unknown: "We could not accept that file. Please try a different CV.",
};

type Signature = { code: CvIssueCode; mime: string };

/** Detect the real file type from magic bytes, regardless of name or MIME. */
export function detectSignature(buf: Uint8Array): Signature | null {
  const b = buf;
  const at = (i: number) => (i < b.length ? b[i] : -1);
  const starts = (bytes: number[], offset = 0) =>
    bytes.every((v, i) => at(offset + i) === v);

  if (b.length < 4) return null;

  // %PDF
  if (starts([0x25, 0x50, 0x44, 0x46])) return { code: "unknown", mime: "application/pdf" };

  // ZIP container — DOCX/XLSX/PPTX/ODT or a plain archive.
  if (starts([0x50, 0x4b, 0x03, 0x04]) || starts([0x50, 0x4b, 0x05, 0x06])) {
    const head = new TextDecoder("latin1").decode(b.subarray(0, Math.min(b.length, 4096)));
    if (/word\/|\[Content_Types\]/i.test(head)) {
      return {
        code: "docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    }
    return { code: "archive", mime: "application/zip" };
  }

  // Legacy OLE2 (.doc/.xls)
  if (starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return { code: "doc", mime: "application/msword" };

  // Images
  if (starts([0xff, 0xd8, 0xff])) return { code: "image", mime: "image/jpeg" };
  if (starts([0x89, 0x50, 0x4e, 0x47])) return { code: "image", mime: "image/png" };
  if (starts([0x47, 0x49, 0x46, 0x38])) return { code: "image", mime: "image/gif" };
  if (starts([0x42, 0x4d])) return { code: "image", mime: "image/bmp" };
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return { code: "image", mime: "image/webp" };
  if (starts([0x49, 0x49, 0x2a, 0x00]) || starts([0x4d, 0x4d, 0x00, 0x2a]))
    return { code: "image", mime: "image/tiff" };
  if (starts([0x00, 0x00, 0x00]) && starts([0x66, 0x74, 0x79, 0x70], 4))
    return { code: "image", mime: "image/heic" };

  // Archives
  if (starts([0x52, 0x61, 0x72, 0x21])) return { code: "archive", mime: "application/vnd.rar" };
  if (starts([0x1f, 0x8b])) return { code: "archive", mime: "application/gzip" };
  if (starts([0x37, 0x7a, 0xbc, 0xaf])) return { code: "archive", mime: "application/x-7z-compressed" };

  // Executables
  if (starts([0x4d, 0x5a])) return { code: "executable", mime: "application/x-msdownload" };
  if (starts([0x7f, 0x45, 0x4c, 0x46])) return { code: "executable", mime: "application/x-elf" };
  if (starts([0xca, 0xfe, 0xba, 0xbe])) return { code: "executable", mime: "application/x-mach-binary" };
  if (starts([0x23, 0x21])) return { code: "executable", mime: "application/x-sh" };

  // RTF is text-ish
  if (starts([0x7b, 0x5c, 0x72, 0x74])) return { code: "plain_text", mime: "application/rtf" };

  return null;
}

function contains(hay: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function looksLikeEncryptedPdf(buf: Uint8Array): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 4096));
  const tail = buf.subarray(Math.max(0, buf.length - 4096));
  const needle = new TextEncoder().encode("/Encrypt");
  return contains(head, needle) || contains(tail, needle);
}

function pdfHasEof(buf: Uint8Array): boolean {
  const tail = buf.subarray(Math.max(0, buf.length - 2048));
  return contains(tail, new TextEncoder().encode("%%EOF"));
}

/**
 * Cheap structural page count: counts `/Type /Page` objects. Returns null when
 * the document is compressed in a way we cannot cheaply read (then the real
 * count comes from the parser later).
 */
export function estimatePdfPages(buf: Uint8Array): number | null {
  const text = new TextDecoder("latin1").decode(buf);
  const pages = text.match(/\/Type\s*\/Page[^s]/g);
  if (pages && pages.length > 0) return pages.length;
  const counts = [...text.matchAll(/\/Count\s+(\d{1,5})/g)].map((m) => Number(m[1]));
  if (counts.length > 0) return Math.max(...counts);
  return null;
}

/**
 * Strip every path-ish or unsafe character. Never trust the client name for a
 * storage key: callers still prefix an owner-scoped, server-generated path.
 */
export function sanitizeFilename(name: string): string {
  const base = (name ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[._-]+/, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
  const cleaned = base.replace(/\.pdf$/i, "");
  return `${cleaned || "cv"}.pdf`;
}

async function sha256Hex(buf: Uint8Array): Promise<string> {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", ab);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fail(code: CvIssueCode, detected_mime?: string): CvValidationResult {
  return { ok: false, code, detected_mime, message: CV_MESSAGES[code] };
}

export async function validateCv(
  buf: Uint8Array,
  filename: string,
  mime: string,
): Promise<CvValidationResult> {
  if (buf.length === 0) return fail("empty");
  if (buf.length > MAX_CV_BYTES) return fail("too_large");

  const ext = fileExt(filename);
  if (!ALLOWED_CV_EXT.has(ext)) return fail("bad_extension");

  const sig = detectSignature(buf);
  if (!sig) {
    // Decodable text with no signature → plain text renamed to .pdf.
    const sample = new TextDecoder("utf-8", { fatal: false }).decode(
      buf.subarray(0, Math.min(buf.length, 512)),
    );
    if (/^[\s\x20-\x7e]+$/.test(sample)) return fail("plain_text", "text/plain");
    return fail("bad_mime");
  }
  if (sig.mime !== "application/pdf") return fail(sig.code, sig.mime);

  // Declared MIME must be allowed (browsers sometimes send nothing at all).
  if (mime && !ALLOWED_CV_MIME.has(mime) && mime !== "application/octet-stream") {
    return fail("bad_mime", sig.mime);
  }

  if (!pdfHasEof(buf)) return fail("corrupt", sig.mime);
  if (looksLikeEncryptedPdf(buf)) return fail("encrypted", sig.mime);

  const page_count = estimatePdfPages(buf);
  if (page_count != null && page_count > MAX_CV_PAGES) {
    return fail("too_many_pages", sig.mime);
  }

  const sha256 = await sha256Hex(buf);
  return {
    ok: true,
    detected_mime: "application/pdf",
    sha256,
    page_count: page_count ?? undefined,
  };
}
