/**
 * Compatibility shim. The candidate status vocabulary lives in one place —
 * @/lib/candidate/status-vocabulary — and these maps are derived from it so no
 * surface can drift into its own wording.
 */
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_COPY,
  type CandidateStatus,
} from "@/lib/candidate/status-vocabulary";

function derive<K extends keyof (typeof CANDIDATE_STATUS_COPY)[CandidateStatus]>(field: K) {
  return Object.fromEntries(
    CANDIDATE_STATUSES.map((s) => [s, CANDIDATE_STATUS_COPY[s][field]]),
  ) as Record<CandidateStatus, (typeof CANDIDATE_STATUS_COPY)[CandidateStatus][K]>;
}

/** Candidate status → badge tone. Design tokens only, never colour alone. */
export const CANDIDATE_STATUS_TONE = derive("tone");

/** One-line explanation of what each status means. */
export const CANDIDATE_STATUS_MEANING = derive("meaning");

/** The one line that answers "what do I do now?". Never blank. */
export const CANDIDATE_STATUS_NEXT_STEP = derive("nextStep");
