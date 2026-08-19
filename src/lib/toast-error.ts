import { toast } from "sonner";
import { looksTechnical, normalizeError, logTechnical, type AudienceTone } from "@/lib/error-taxonomy";
import { humanizePublishBlockedMessage } from "@/lib/publish-gate";

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
	const raw = error instanceof Error ? error.message.replace(/^Error:\s*/, "") : "";
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
	toast.error(fallback ?? normalized.title, {
		description: `${normalized.description} Reference: ${normalized.correlationId}`,
	});
}
