/**
 * Concurrency guard for candidate decisions.
 *
 * Two people can look at the same shortlist. If a candidate has already moved
 * since the screen was drawn, the honest answer is to stop and say what
 * changed — not to apply a decision to a stage the client never saw.
 *
 * Shared between the server (which raises the error) and the client (which
 * turns it back into a sentence).
 */
export const STALE_PREFIX = "candidate_moved:";

export const STAGE_LABELS: Record<string, string> = {
	sourced: "Sourced",
	screened: "In screening",
	delivered: "Delivered to you",
	shortlisted: "Shortlisted",
	interview_process: "In interviews",
	offer: "At offer",
	hired: "Hired",
	not_moving_forward: "Not moving forward",
};

export function stageLabel(stage: string | null | undefined) {
	if (!stage) return "an earlier stage";
	return STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
}

/** Raised server-side when the caller's expected stage no longer matches. */
export function staleStateError(expected: string, actual: string) {
	return new Error(`${STALE_PREFIX}${expected}>${actual}`);
}

/**
 * Turn any mutation failure into a sentence. Returns null when the error is
 * not a stale-state error, so callers can fall through to their own handling.
 */
export function readStaleStateError(err: unknown): {
	expected: string;
	actual: string;
	message: string;
} | null {
	const raw = err instanceof Error ? err.message : String(err ?? "");
	const idx = raw.indexOf(STALE_PREFIX);
	if (idx === -1) return null;
	const body = raw.slice(idx + STALE_PREFIX.length).split(/[\s"']/)[0] ?? "";
	const [expected = "", actual = ""] = body.split(">");
	return {
		expected,
		actual,
		message: `This candidate has already moved to ${stageLabel(
			actual,
		)} since this page was loaded — your change was not applied. The list has been refreshed so you can decide again.`,
	};
}
