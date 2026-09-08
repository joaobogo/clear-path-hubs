/**
 * Interviews awaiting a time.
 *
 * The one reader now lives with the other business figures in
 * `src/lib/kpis/interviews.server.ts`; this module stays as its old name so
 * existing callers keep pointing at the same implementation.
 */
export {
  loadInterviewsAwaitingTime as loadInterviewsAwaitingConfirmation,
  countInterviewsAwaitingTime as countInterviewsAwaitingConfirmation,
  // Whose move it is. A caller that puts an interview in front of the CLIENT
  // must filter with `awaitingClient` — the loader returns everything pending,
  // including the interviews we have not sent times for.
  awaitingClient,
  awaitingUs,
  type PendingConfirmationInterview,
} from "@/lib/kpis/interviews.server";
