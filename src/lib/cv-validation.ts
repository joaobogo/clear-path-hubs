// CV file validation. Pure functions — server-safe and unit-testable.
// Validates: extension, MIME, size, empty, magic bytes, encrypted PDF, corrupt file.

import {
  ALLOWED_CV_EXT,
  ALLOWED_CV_MIME,
  MAX_CV_BYTES,
  fileExt,
} from "./apply-schema";

export type CvIssueCode =
  | "empty"
  | "too_large"
  | "bad_extension"
  | "bad_mime"
  | "corrupt"
  | "encrypted"
  | "unknown";

export interface CvValidationResult {
  ok: boolean;
  code?: CvIssueCode;
  detected_mime?: string;
  message?: string;
  sha256?: string;
}

// Candidate-safe user messages — never leak internals.
export const CV_MESSAGES: Record<CvIssueCode, string> = {
  empty: "That file looks empty. Please choose your CV file.",
  too_large: "Your CV is larger than 10 MB. Please upload a smaller file.",
  bad_extension:
    "Please upload a PDF, DOC, or DOCX. Other file types are not accepted.",
  bad_mime:
    "That file does not look like a PDF, DOC, or DOCX. Please upload one of these formats.",
  corrupt:
    "We could not read that file. It may be damaged — please try re-saving or uploading again.",
  encrypted:
    "That PDF is password-protected. Please upload an unlocked copy so we can review it.",
  unknown: "We could not accept that file. Please try a different CV.",
};

function detectMime(buf: Uint8Array): string | null {
  if (buf.length < 4) return null;
  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "application/pdf";
  }
  // Zip (DOCX): PK\x03\x04
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  // Legacy MS Office .doc: D0 CF 11 E0 A1 B1 1A E1
  if (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0 &&
    buf[4] === 0xa1 &&
    buf[5] === 0xb1 &&
    buf[6] === 0x1a &&
    buf[7] === 0xe1
  ) {
    return "application/msword";
  }
  return null;
}

function looksLikeEncryptedPdf(buf: Uint8Array): boolean {
  // Search first & last 4KB for "/Encrypt " token in PDF trailer dict.
  const head = buf.subarray(0, Math.min(buf.length, 4096));
  const tail = buf.subarray(Math.max(0, buf.length - 4096));
  const needle = new TextEncoder().encode("/Encrypt");
  return contains(head, needle) || contains(tail, needle);
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

function pdfHasEof(buf: Uint8Array): boolean {
  // A well-formed PDF ends with "%%EOF" (optionally followed by whitespace).
  const tail = buf.subarray(Math.max(0, buf.length - 1024));
  return contains(tail, new TextEncoder().encode("%%EOF"));
}

async function sha256Hex(buf: Uint8Array): Promise<string> {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", ab);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function validateCv(
  buf: Uint8Array,
  filename: string,
  mime: string,
): Promise<CvValidationResult> {
  if (buf.length === 0) {
    return { ok: false, code: "empty", message: CV_MESSAGES.empty };
  }
  if (buf.length > MAX_CV_BYTES) {
    return { ok: false, code: "too_large", message: CV_MESSAGES.too_large };
  }

  const ext = fileExt(filename);
  if (!ALLOWED_CV_EXT.has(ext)) {
    return { ok: false, code: "bad_extension", message: CV_MESSAGES.bad_extension };
  }

  const detected = detectMime(buf);
  if (!detected) {
    return { ok: false, code: "bad_mime", message: CV_MESSAGES.bad_mime };
  }

  // Client MIME must be in the allow list OR match detected (tolerant of browsers that omit MIME).
  if (mime && !ALLOWED_CV_MIME.has(mime) && mime !== detected) {
    return { ok: false, code: "bad_mime", message: CV_MESSAGES.bad_mime };
  }

  if (detected === "application/pdf") {
    if (!pdfHasEof(buf)) {
      return { ok: false, code: "corrupt", message: CV_MESSAGES.corrupt };
    }
    if (looksLikeEncryptedPdf(buf)) {
      return { ok: false, code: "encrypted", message: CV_MESSAGES.encrypted };
    }
  }

  const sha256 = await sha256Hex(buf);
  return { ok: true, detected_mime: detected, sha256 };
}
