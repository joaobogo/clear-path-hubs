import { toast } from "sonner";
import { looksTechnical, normalizeError, logTechnical, type AudienceTone } from "@/lib/error-taxonomy";
import { humanizePublishBlockedMessage } from "@/lib/publish-gate";
import { humanizeCode } from "@/lib/humanize-codes";

/**
 * Toast an error without leaking internals.
 *
 * Server functions throw two very different kinds of message. Some are written
 * for the person reading them ("This candidate already moved"), and those must
 * survive verbatim — rewriting them to "Something went wrong" would destroy
 * the most useful part of the message. Others are raw Postgres/provider text
 * that happens to cross the RPC boundary; those must never reach a user.
 *
 * `looksTechnical` draws that line, so callers can pass the error straight in.
 * Technical detail always goes to the private log with a reference the user can
 * quote.
 */
export function toastError(error: unknown, opts: { tone?: AudienceTone; fallback?: string; surface?: string } = {}) {
	const { tone = "client", fallback, surface } = opts;
	const raw = error instanceof Error ? error.message.replace(/^Error:\s*/, "") : String(error);

	// P07: Always check for a humanized code first. If the error is a SCREAMING_SNAKE_CASE
	// token that we have a sentence for, use it.
	if (raw && /^[A-Z0-9_]{3,64}$/.test(raw)) {
		const human = humanizeCode(raw);
		if (human !== raw && !human.includes(" ")) { // humanizeCode returns Start Case by default
			// This means it wasn't in the dictionary if it just did casing.
			// dictionary entries for sentences will have spaces.
		} else if (human !== raw) {
			toast.error(human);
			return;
		}
	}

	const intentional = raw.length > 0 && raw.length < 200 && !looksTechnical(raw);
	const human = intentional ? humanizePublishBlockedMessage(raw) : null;

	if (intentional && human) {
		const parts = human.match(/(.*)\((.*)\)/);
		if (parts && tone === "admin") {
			const [_, sentence, detail] = parts;
			toast.error(sentence.trim(), {
				action: {
					label: "Copy details",
					onClick: () => {
						navigator.clipboard.writeText(detail.trim());
						toast.success("Details copied");
					}
				}
			});
		} else {
			toast.error(human);
		}
		return;
	}

	const normalized = normalizeError(error, { tone });
	logTechnical(error, normalized, surface ? { surface } : {});
	
	// P07 fallback logic: never render raw screaming snake case.
	const displayTitle = (fallback ?? normalized.title);
	
	toast.error(displayTitle, {
		description: `${normalized.description} Reference: ${normalized.correlationId}`,
	});
}
