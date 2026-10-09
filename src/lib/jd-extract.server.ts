/**
 * Uploaded job-description file → text, with a clear reason when it cannot be.
 *
 * PDF and DOCX go through the extractor the CV pipeline already uses
 * (cv-extractor.server), so a document that reads for a CV reads for a JD. What
 * this adds is what a JD upload needs on top:
 *
 *  - the file TYPE comes from its bytes, not the browser's mime or the name: a
 *    PDF saved as ".txt" or sent as application/octet-stream still reads;
 *  - DOCX keeps its lists (as "• " bullets) and tables (one row per line), so
 *    the Requirements bullets survive into the instant read;
 *  - RTF is decoded properly (\'e9 and \u233? escapes, paragraphs, skipped
 *    font/colour/picture groups) instead of stripping control words;
 *  - TXT accepts UTF-8, UTF-16 (with BOM) and Windows-1252, and a short text
 *    file is still a job description — no 200-character floor;
 *  - every failure says what is wrong and what to do: a scanned PDF, a
 *    password, a damaged file, a legacy .doc, an image.
 */
import { htmlToText } from "@/lib/jd-html";

export type JdExtractResult =
  | { ok: true; text: string; kind: FileKind }
  | { ok: false; error: string; message: string };

export type FileKind = "pdf" | "docx" | "rtf" | "text" | "doc" | "image" | "zip" | "unknown";

const MIN_TEXT_CHARS = 30;

function startsWith(bytes: Uint8Array, sig: number[], at = 0): boolean {
  if (bytes.length < at + sig.length) return false;
  for (let i = 0; i < sig.length; i += 1) if (bytes[at + i] !== sig[i]) return false;
  return true;
}

function containsAscii(bytes: Uint8Array, needle: string, from: number, to: number): boolean {
  const n = needle.split("").map((c) => c.charCodeAt(0));
  const end = Math.min(bytes.length, to) - n.length;
  outer: for (let i = Math.max(0, from); i <= end; i += 1) {
    for (let j = 0; j < n.length; j += 1) if (bytes[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

/** What the file really is, by its bytes first and its name second. */
export function sniffKind(bytes: Uint8Array, filename = "", mime = ""): FileKind {
  const name = filename.toLowerCase();
  if (containsAscii(bytes, "%PDF-", 0, 1024)) return "pdf";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const tail = Math.max(0, bytes.length - 65_536);
    if (containsAscii(bytes, "word/", 0, 65_536) || containsAscii(bytes, "word/", tail, bytes.length)) return "docx";
    return name.endsWith(".docx") ? "docx" : "zip";
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return "doc";
  if (containsAscii(bytes, "{\\rtf", 0, 16)) return "rtf";
  if (
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) ||
    startsWith(bytes, [0xff, 0xd8, 0xff]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) ||
    (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && containsAscii(bytes, "WEBP", 8, 12))
  ) return "image";
  if (name.endsWith(".pdf") || mime.includes("pdf")) return "pdf";
  if (name.endsWith(".rtf") || mime.includes("rtf")) return "rtf";
  if (name.endsWith(".doc")) return "doc";
  return looksLikeText(bytes) ? "text" : "unknown";
}

function looksLikeText(bytes: Uint8Array): boolean {
  if (startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff]) || startsWith(bytes, [0xef, 0xbb, 0xbf])) return true;
  const n = Math.min(bytes.length, 4096);
  if (n === 0) return false;
  let bad = 0;
  for (let i = 0; i < n; i += 1) {
    const b = bytes[i]!;
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) bad += 1;
  }
  return bad / n < 0.02;
}

/** UTF-8 when it is valid UTF-8, UTF-16 by BOM, otherwise Windows-1252. */
export function decodeTextBytes(bytes: Uint8Array): string {
  if (startsWith(bytes, [0xff, 0xfe])) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (startsWith(bytes, [0xfe, 0xff])) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  const body = startsWith(bytes, [0xef, 0xbb, 0xbf]) ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return new TextDecoder("windows-1252").decode(body);
  }
}

const CP1252_HIGH: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š",
  0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "'", 0x92: "'", 0x93: '"', 0x94: '"', 0x95: "•", 0x96: "–", 0x97: "—",
  0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

/** Groups whose content is never document text. */
const SKIP_DEST = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "header", "footer", "headerl", "headerr", "footerl",
  "footerr", "listtable", "listoverridetable", "rsidtbl", "generator", "xmlnstbl", "themedata", "colorschememapping",
  "latentstyles", "datastore", "fldinst", "filetbl", "revtbl", "pgdsctbl", "bkmkstart", "bkmkend",
]);

/**
 * A small RTF reader: text, paragraphs, tabs, hex and unicode escapes, and the
 * groups that hold fonts, colours, pictures and metadata skipped. Linear in the
 * input; never throws.
 */
export function rtfToText(rtf: string): string {
  const out: string[] = [];
  const stack: Array<{ skip: boolean; uc: number }> = [];
  let skip = false;
  let uc = 1;
  let pendingSkip = 0;
  let i = 0;
  const n = Math.min(rtf.length, 8_000_000);
  const emit = (s: string) => {
    if (skip) return;
    if (pendingSkip > 0) {
      const drop = Math.min(pendingSkip, s.length);
      pendingSkip -= drop;
      s = s.slice(drop);
    }
    if (s) out.push(s);
  };
  while (i < n) {
    const ch = rtf[i]!;
    if (ch === "{") {
      stack.push({ skip, uc });
      i += 1;
      if (rtf.startsWith("\\*", i)) skip = true;
      continue;
    }
    if (ch === "}") {
      const top = stack.pop();
      if (top) {
        skip = top.skip;
        uc = top.uc;
      }
      i += 1;
      continue;
    }
    if (ch === "\\") {
      const next = rtf[i + 1] ?? "";
      if (next === "\\" || next === "{" || next === "}") {
        emit(next);
        i += 2;
        continue;
      }
      if (next === "'") {
        const hex = parseInt(rtf.slice(i + 2, i + 4), 16);
        if (Number.isFinite(hex)) emit(hex >= 0x80 && hex <= 0x9f ? CP1252_HIGH[hex] ?? "" : String.fromCharCode(hex));
        i += 4;
        continue;
      }
      if (next === "~") {
        emit(" ");
        i += 2;
        continue;
      }
      if (next === "-" || next === "_") {
        i += 2;
        continue;
      }
      if (next === "\n" || next === "\r") {
        emit("\n");
        i += 2;
        continue;
      }
      const m = /^([a-zA-Z]{1,32})(-?\d{1,10})? ?/.exec(rtf.slice(i + 1, i + 46));
      if (!m) {
        i += 2;
        continue;
      }
      const word = m[1]!;
      const arg = m[2] !== undefined ? parseInt(m[2], 10) : undefined;
      i += 1 + m[0].length;
      if (SKIP_DEST.has(word)) {
        skip = true;
        continue;
      }
      switch (word) {
        case "par":
        case "line":
        case "sect":
        case "page":
        case "row":
          emit("\n");
          break;
        case "cell":
          emit(" | ");
          break;
        case "tab":
          emit("\t");
          break;
        case "bullet":
          emit("•");
          break;
        case "emdash":
          emit("—");
          break;
        case "endash":
          emit("–");
          break;
        case "lquote":
        case "rquote":
          emit("'");
          break;
        case "ldblquote":
        case "rdblquote":
          emit('"');
          break;
        case "uc":
          uc = arg ?? 1;
          break;
        case "u": {
          if (arg !== undefined) {
            const code = arg < 0 ? arg + 65536 : arg;
            emit(String.fromCharCode(code));
            pendingSkip = uc;
          }
          break;
        }
        default:
          break;
      }
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      i += 1;
      continue;
    }
    emit(ch);
    i += 1;
  }
  return out
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ \| \n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function enoughText(s: string): boolean {
  return s.replace(/\s+/g, "").length >= MIN_TEXT_CHARS;
}

const MESSAGES = {
  scanned:
    "That PDF is a scanned image with no text we can read. Paste the text instead, or upload the original Word or PDF export.",
  encrypted: "That PDF is password-protected. Remove the password and upload it again, or paste the text instead.",
  damaged: "That file looks damaged and could not be opened. Save it again and re-upload, or paste the text instead.",
  doc: "Legacy .doc files can't be read. Save it as PDF or DOCX and upload again, or paste the text instead.",
  image: "That is an image, not a document, so there is no text to read. Paste the text instead.",
  unknown: "We couldn't read that file — upload a PDF, DOCX, TXT or RTF, or paste the text instead.",
  empty: "We couldn't find any text in that file — paste the text instead.",
};

type CvExtractor = typeof import("@/lib/cv-extractor.server");

/** Never throws; always returns text or a message the client can act on. */
export async function extractJdFile(
  bytes: Uint8Array,
  mime: string,
  filename: string,
  loadCv: CvExtractor | (() => Promise<CvExtractor>),
): Promise<JdExtractResult> {
  const kind = sniffKind(bytes, filename, mime);
  // The PDF/DOCX libraries are heavy; a text or RTF upload never loads them.
  const cvModule = () => (typeof loadCv === "function" ? loadCv() : Promise.resolve(loadCv));
  try {
    if (kind === "pdf") {
      const cv = await cvModule();
      const res = await cv.extractCvText(bytes, "application/pdf", "upload.pdf");
      if (res.reason === "encrypted_pdf") return { ok: false, error: "jd_encrypted", message: MESSAGES.encrypted };
      if (res.reason?.startsWith("pdf_parse_failed")) return { ok: false, error: "jd_unreadable", message: MESSAGES.damaged };
      if (!enoughText(res.text)) return { ok: false, error: "jd_unreadable", message: MESSAGES.scanned };
      return { ok: true, text: res.text, kind };
    }
    if (kind === "docx") {
      try {
        const mammoth = (await import("mammoth")).default;
        const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const html = await mammoth.convertToHtml({ buffer: buf });
        const text = htmlToText(html.value ?? "");
        if (enoughText(text)) return { ok: true, text, kind };
      } catch {
        /* fall through to the raw-text extractor */
      }
      const cv = await cvModule();
      const res = await cv.extractCvText(
        bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "upload.docx",
      );
      if (res.reason?.startsWith("docx_parse_failed")) return { ok: false, error: "jd_unreadable", message: MESSAGES.damaged };
      if (!enoughText(res.text)) return { ok: false, error: "jd_unreadable", message: MESSAGES.empty };
      return { ok: true, text: res.text, kind };
    }
    if (kind === "rtf") {
      const text = rtfToText(new TextDecoder("latin1").decode(bytes));
      return enoughText(text) ? { ok: true, text, kind } : { ok: false, error: "jd_unreadable", message: MESSAGES.empty };
    }
    if (kind === "text") {
      const text = decodeTextBytes(bytes).replace(/\r\n?/g, "\n").trim();
      return enoughText(text) ? { ok: true, text, kind } : { ok: false, error: "jd_unreadable", message: MESSAGES.empty };
    }
    if (kind === "doc") return { ok: false, error: "jd_unreadable", message: MESSAGES.doc };
    if (kind === "image") return { ok: false, error: "jd_unreadable", message: MESSAGES.image };
    return { ok: false, error: "jd_unreadable", message: MESSAGES.unknown };
  } catch {
    return { ok: false, error: "jd_unreadable", message: MESSAGES.damaged };
  }
}
