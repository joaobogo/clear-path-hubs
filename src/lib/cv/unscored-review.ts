/**
 * New candidates are processed in full on arrival, and a candidate the
 * pipeline could not score always has an admin task (owner, 29 Oct 2026).
 *
 * Two pure rules, used by pipeline-runner.server.ts:
 *
 *  1. Thin text gets one retry, and only one. A CV that extracts to under
 *     ~1,500 characters (or not at all) is read again once; the count is the
 *     file's extraction_attempts, so a later run never retries it again. OCR
 *     keeps its own single-attempt rule: a retry is a plain re-read, never a
 *     second (billed) OCR call.
 *  2. Every unscored outcome (unreadable or thin CV, no CV, a role that
 *     cannot be scored, a pipeline error) gets one open candidate_review task
 *     naming the cause and the next action. Nothing is sent to the candidate:
 *     where a re-upload is the fix, the task points staff at the
 *     parse-failure desk, which drafts the request for them to send.
 */
import { resolveParseFailure } from "@/lib/parse-failure/parse-failure-codes";

/** Below this, a CV is too thin to score without a person looking at it. */
export const THIN_CV_CHARS = 1500;

/** Extraction attempts after which thin text is never read again automatically. */
export const MAX_THIN_TEXT_ATTEMPTS = 2;

export function needsExtractionRetry(args: {
  chars: number;
  needsOcr: boolean;
  garbage: boolean;
  ocrUsed: boolean;
  /** extraction_attempts on the file before this run's first read. */
  priorAttempts: number;
}): boolean {
  if (args.needsOcr || args.garbage || args.ocrUsed) return false;
  if (args.chars >= THIN_CV_CHARS) return false;
  // This run's first read is attempt priorAttempts + 1; one more is allowed
  // only while that keeps the file within the cap.
  return args.priorAttempts + 1 < MAX_THIN_TEXT_ATTEMPTS;
}

/**
 * Stored text that is thin, on a candidate who has never been scored, is read
 * again once (when the cap allows). Scored candidates keep their stored text:
 * a rescore must never demote an existing score because of this rule.
 */
export function storedTextNeedsReread(args: {
  chars: number;
  ocrUsed: boolean;
  attempts: number;
  hasScore: boolean;
}): boolean {
  return !args.hasScore && !args.ocrUsed && args.chars < THIN_CV_CHARS && args.attempts < MAX_THIN_TEXT_ATTEMPTS;
}

/** States in which a match has no usable score and needs a person. */
const UNSCORED_STATES = new Set(["failed", "ocr_required", "provider_blocked", "manual_review_required"]);

export function needsReviewTask(
  outcome: { final_state: string; steps: Array<{ step: string; ok: boolean }> },
  match: { current_score_run_id?: string | null },
): boolean {
  if (!UNSCORED_STATES.has(outcome.final_state)) return false;
  // "Already terminal" or "another worker holds it": this run did nothing.
  const only = outcome.steps.length === 1 ? outcome.steps[0] : null;
  if (only && only.step === "skip" && only.ok) return false;
  // A scored match sent to review for low confidence already has its review.
  if (outcome.final_state === "manual_review_required" && match.current_score_run_id) return false;
  return true;
}

export type ReviewTask = {
  title: string;
  description: string;
  priority: "normal" | "high";
  reason: string;
};

const CV_CODES = new Set([
  "cv_unreadable",
  "text_layer_missing",
  "storage_unreadable",
  "extract_empty",
  "encrypted_pdf",
  "legacy_doc_unsupported",
  "cv_text_thin",
]);

export function candidateReviewTask(args: {
  code: string | null | undefined;
  message?: string | null;
  candidateName?: string | null;
  positionTitle?: string | null;
}): ReviewTask {
  const code = (args.code ?? "unknown").split(":")[0]!.trim() || "unknown";
  const who = args.candidateName?.trim() || "Candidate";
  const role = args.positionTitle?.trim() ? ` for ${args.positionTitle.trim()}` : "";
  const detail = args.message?.trim() ? ` ${args.message.trim()}` : "";
  if (CV_CODES.has(code)) {
    const f = resolveParseFailure(code);
    const reupload = f.reuploadFixes
      ? " If a new file is the fix, send the re-upload request from the parse-failure desk (/admin/parse-failures); nothing has been sent to the candidate."
      : "";
    return {
      title: `${who}${role}: CV needs review before scoring`,
      description: `${f.label}. ${f.cause}${detail} Next: ${f.nextAction}${reupload}`,
      priority: "normal",
      reason: code,
    };
  }
  const known: Record<string, { what: string; next: string }> = {
    missing_usable_cv: {
      what: "No CV is on file.",
      next: "Ask the candidate for a CV from the parse-failure desk, or attach one by hand.",
    },
    position_inactive: {
      what: "The role is not active, so the candidate was not scored.",
      next: "Activate the role to score them, or close the application.",
    },
    requirements_missing: {
      what: "The role has no structured requirements to score against.",
      next: "Add must-haves in the role editor; the candidate is rescored when they are saved.",
    },
    max_attempts_exceeded: {
      what: "Automatic processing failed repeatedly.",
      next: "Open the candidate, check the processing log, and retry once the cause is fixed.",
    },
  };
  const k = known[code] ?? {
    what: "The candidate could not be scored automatically.",
    next: "Open the candidate, check the processing log, and retry or score by hand.",
  };
  return {
    title: `${who}${role}: not scored yet`,
    description: `${k.what}${detail} Next: ${k.next}`,
    priority: code === "engine_error" || code === "unknown" ? "high" : "normal",
    reason: code,
  };
}
