import { CANDIDATE_STATES, type CandidateStateKey } from "@/lib/candidate/candidate-transparency";
import {
  CANDIDATE_STATUS_COPY,
  candidateStatusFromStateKey,
} from "@/lib/candidate/status-vocabulary";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

/**
 * The single place a candidate is told where they stand: what the state
 * means, what is happening, and what (if anything) we need from them.
 */
export function CandidateStatePanel({
  state,
  lastUpdate,
  nextInterviewAt,
  className,
}: {
  state: CandidateStateKey;
  lastUpdate?: string | null;
  nextInterviewAt?: string | null;
  className?: string;
}) {
  const copy = CANDIDATE_STATES[state];
  // The chip always uses the shared six-word vocabulary, so this application
  // reads identically here, on the list, on the detail page and in email.
  const status = candidateStatusFromStateKey(state);
  return (
    <section
      className={`rounded-lg border bg-card p-5 sm:p-6 ${className ?? ""}`}
      aria-labelledby="candidate-state-heading"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex max-w-full items-center whitespace-normal break-words rounded-full px-3 py-1 text-xs font-medium ${CANDIDATE_STATUS_COPY[status].tone}`}
        >
          {status}
        </span>
        <span className="text-xs text-muted-foreground">
          {copy.humanInvolved ? "A person is involved at this point" : "No action needed from you"}
        </span>
      </div>

      <h2 id="candidate-state-heading" className="mt-3 text-lg font-semibold">
        {copy.meaning}
      </h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            What&apos;s happening
          </dt>
          <dd className="mt-1">{copy.happening}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            What we need from you
          </dt>
          <dd className="mt-1">{copy.needed}</dd>
        </div>
        {nextInterviewAt ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Interview</dt>
            <dd className="mt-1">
              {new Date(nextInterviewAt).toLocaleString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE,
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
        ) : null}
      </dl>

      {lastUpdate ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Last change to your application: {new Date(lastUpdate).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE })}
        </p>
      ) : null}
    </section>
  );
}
