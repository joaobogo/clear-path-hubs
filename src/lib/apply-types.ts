import type { ExistingApplicationSummary } from "./candidate/existing-application.server";

export type SubmitApplicationResult =
  | {
      ok: true;
      application_id: string;
      match_id?: string;
      reference: string; // short human-friendly ref
      tracking_path: string; // route to send the candidate to
      deduped: boolean;
      /**
       * Present when deduped: the candidate's own earlier application for this
       * posting — its date, plain-English status and reference. Applying twice
       * is not an error, so we tell them the truth about the first one.
       */
      existing?: ExistingApplicationSummary | null;
      /** True when an earlier withdrawn/rejected application allowed a fresh submission. */
      prior_closed?: boolean;
      // Account outcome for an unauthenticated applicant:
      //  created  → we just made their candidate account with the password given
      //  existing → an account already existed for this email; they should sign in
      //  none     → no password supplied, no account created
      account: "created" | "existing" | "none";
      eligibility?: "eligible" | "not_eligible";
    }
  | {
      ok: false;
      trace_id: string;
      code: string;
      message: string;
    };
