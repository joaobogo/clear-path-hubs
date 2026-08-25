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
  type PendingConfirmationInterview,
} from "@/lib/kpis/interviews.server";
