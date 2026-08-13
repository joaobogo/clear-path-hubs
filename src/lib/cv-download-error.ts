/**
 * Plain-English explanations for a failed CV fetch.
 *
 * Never surface raw errors, storage paths or stack traces to a client user:
 * they read as broken software. Each case gets a short reason plus a hint that
 * says what happens next, and a flag for whether retrying can actually help.
 */
export type CvDownloadFailure = {
  /** Short reason, shown in the error row and the toast. */
  message: string;
  /** One line of what to do next. */
  hint: string;
  /** Whether a retry has any chance of succeeding. */
  retryable: boolean;
};

export function describeCvDownloadFailure(raw: unknown): CvDownloadFailure {
  const text = String((raw as { message?: string })?.message ?? raw ?? "").trim();

  if (/no cv/i.test(text)) {
    return {
      message: "No CV on file yet",
      hint: "We will attach it here as soon as the candidate's document is in.",
      retryable: false,
    };
  }
  if (/not found|unauthor|permission|forbidden|403/i.test(text)) {
    return {
      message: "This CV is not available to you yet",
      hint: "It unlocks once the candidate's contact details are released to your team.",
      retryable: false,
    };
  }
  if (/file missing/i.test(text)) {
    return {
      message: "The stored file could not be read",
      hint: "Retry once — if it keeps failing our team is alerted to re-upload it.",
      retryable: true,
    };
  }
  if (/expired|signature|signed url|link/i.test(text)) {
    return {
      message: "That download link expired",
      hint: "Retry to get a fresh link.",
      retryable: true,
    };
  }
  if (/failed to fetch|network|offline|timeout|timed out|aborted/i.test(text)) {
    return {
      message: "Network problem while fetching the CV",
      hint: "Check your connection and retry — nothing was lost.",
      retryable: true,
    };
  }
  if (/blocked|popup/i.test(text)) {
    return {
      message: "Your browser blocked the new tab",
      hint: "Allow pop-ups for this site, or use Download instead of Preview.",
      retryable: true,
    };
  }
  return {
    message: text || "Could not download the CV",
    hint: "Retry to fetch the latest file from storage.",
    retryable: true,
  };
}
