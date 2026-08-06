/**
 * Parse failure states, written out once.
 *
 * Every failure code maps to one plain cause, one recommended next action, and
 * one named owner. OCR-required documents are a separate state, not a failure,
 * so they are never retried in a loop. The candidate-facing sentence never
 * contains an error code, an engine version, or any internal detail.
 */

export type FailureOwner = "recruiter" | "candidate" | "engineering";

export type ParseFailure = {
  code: string;
  /** Short internal label for queues. */
  label: string;
  /** Why it happened, in one sentence, for staff. */
  cause: string;
  /** The one action that closes the gap. */
  nextAction: string;
  /** Who is accountable for that action. */
  owner: FailureOwner;
  /** True when asking the candidate for a new file is the fix. */
  reuploadFixes: boolean;
  /**
   * What the candidate reads. Null when there is nothing useful for them to do
   * and the work sits with us — silence is better than a false request.
   */
  candidateMessage: string | null;
  /** Distinct OCR route: readable document, missing text layer. */
  ocr?: boolean;
};

const REUPLOAD_LINE =
  "Please upload your CV again as a PDF that contains selectable text, rather than a photo or scan.";

export const PARSE_FAILURES: Record<string, ParseFailure> = {
  text_layer_missing: {
    code: "text_layer_missing",
    label: "Scan without text",
    cause: "The document is a scan or an image, so it carries no text layer to read.",
    nextAction: "Run OCR on the document, or ask the candidate for a text-based PDF.",
    owner: "recruiter",
    reuploadFixes: true,
    candidateMessage: REUPLOAD_LINE,
    ocr: true,
  },
  encrypted_pdf: {
    code: "encrypted_pdf",
    label: "Password protected",
    cause: "The PDF is password protected or otherwise restricted, so its text cannot be opened.",
    nextAction: "Ask the candidate for an unprotected copy of the same document.",
    owner: "candidate",
    reuploadFixes: true,
    candidateMessage:
      "Your CV is password protected, so we cannot open it. Please upload a version without a password.",
  },
  extract_empty: {
    code: "extract_empty",
    label: "Empty text layer",
    cause: "The file opened but produced no usable text.",
    nextAction: "Ask the candidate to re-upload, or paste the CV text in by hand.",
    owner: "recruiter",
    reuploadFixes: true,
    candidateMessage:
      "We could not read any text from the file you sent. Please upload your CV again as a PDF.",
  },
  storage_unreadable: {
    code: "storage_unreadable",
    label: "Corrupt upload",
    cause: "The stored file could not be downloaded, so the upload is incomplete or corrupt.",
    nextAction: "Ask the candidate to upload the document again; the stored copy is unusable.",
    owner: "candidate",
    reuploadFixes: true,
    candidateMessage:
      "Your upload did not finish correctly, so we do not have a readable copy. Please upload your CV again.",
  },
  legacy_doc_unsupported: {
    code: "legacy_doc_unsupported",
    label: "Old .doc format",
    cause: "The file is an old binary Word document, which is not a supported format.",
    nextAction: "Ask the candidate for the same CV saved as a PDF.",
    owner: "candidate",
    reuploadFixes: true,
    candidateMessage: "We can only read PDF files. Please upload your CV as a PDF.",
  },
  unsupported_format: {
    code: "unsupported_format",
    label: "Unsupported format",
    cause: "The uploaded file type is not one the parser can read.",
    nextAction: "Ask the candidate for a PDF version of the document.",
    owner: "candidate",
    reuploadFixes: true,
    candidateMessage: "We can only read PDF files. Please upload your CV as a PDF.",
  },
  pdf_parse_failed: {
    code: "pdf_parse_failed",
    label: "Corrupt PDF",
    cause: "The PDF structure is damaged, so the reader stopped part-way through.",
    nextAction: "Re-run processing once, then ask for a fresh export of the document.",
    owner: "engineering",
    reuploadFixes: true,
    candidateMessage:
      "The file you sent appears to be damaged. Please export your CV again and upload the new file.",
  },
  docx_parse_failed: {
    code: "docx_parse_failed",
    label: "Corrupt Word file",
    cause: "The Word document could not be opened by the reader.",
    nextAction: "Ask the candidate for the same CV saved as a PDF.",
    owner: "candidate",
    reuploadFixes: true,
    candidateMessage: "We could not open your Word file. Please upload your CV as a PDF.",
  },
  timeout: {
    code: "timeout",
    label: "Timed out",
    cause: "Processing ran past its time limit before finishing.",
    nextAction: "Re-run processing once; escalate if it times out again.",
    owner: "engineering",
    reuploadFixes: false,
    candidateMessage: null,
  },
  max_attempts_exceeded: {
    code: "max_attempts_exceeded",
    label: "Retries exhausted",
    cause: "Automatic processing failed three times in a day, so retries have stopped.",
    nextAction: "Review the document by hand and record the outcome; do not retry blindly.",
    owner: "engineering",
    reuploadFixes: false,
    candidateMessage: null,
  },
  missing_usable_cv: {
    code: "missing_usable_cv",
    label: "No CV on file",
    cause: "No document is attached to this application, so there is nothing to read.",
    nextAction: "Ask the candidate to upload a CV.",
    owner: "candidate",
    reuploadFixes: true,
    candidateMessage: "We do not have a CV for this application yet. Please upload one.",
  },
};

const UNKNOWN: ParseFailure = {
  code: "unknown",
  label: "Unclassified failure",
  cause: "Processing stopped for a reason the pipeline did not classify.",
  nextAction: "Open the document, read it by hand, and record the outcome.",
  owner: "engineering",
  reuploadFixes: false,
  candidateMessage: null,
};

/** Resolve a stored code, tolerating the `code:detail` form the parser emits. */
export function resolveParseFailure(code: string | null | undefined): ParseFailure {
  if (!code) return UNKNOWN;
  const base = code.split(":")[0]!.trim();
  return PARSE_FAILURES[base] ?? { ...UNKNOWN, code: base };
}

/** Parse states that need a human before the application can move on. */
export const BLOCKING_PARSE_STATES = ["failed", "review_required"] as const;

export function isBlockingParseState(state: string | null | undefined): boolean {
  return state === "failed" || state === "review_required";
}

/**
 * The candidate-facing sentence for a stuck document, or null when there is
 * nothing for them to do.
 */
export function candidateParseMessage(
  parseState: string | null | undefined,
  code: string | null | undefined,
): string | null {
  if (!isBlockingParseState(parseState)) return null;
  return resolveParseFailure(code).candidateMessage;
}
