/**
 * Why a candidate has no evidence.
 *
 * "No evidence" is never a fact about the candidate — it is a fact about a step
 * of ours that did not finish. Each reason below names that step, who owns it,
 * and — critically for the question "did we ask them for the wrong thing?" —
 * what the candidate was actually told at the moment it happened.
 *
 * `candidateWasTold` is the honest record of our side of the conversation:
 *   - "nothing"  → they believe everything is fine, or they saw a generic error
 *   - "generic"  → we showed them a message that did not name the real problem
 *   - "specific" → we named the problem and what to do about it
 * Anything other than "specific" is a communication defect on us, not a
 * candidate who failed to supply evidence.
 */

export type GapOwner = "engineering" | "recruiter" | "candidate";
export type ToldQuality = "nothing" | "generic" | "specific";

export type GapReason = {
  code: string;
  label: string;
  /** What actually happened, in one sentence. */
  cause: string;
  /** The single next action that clears it. */
  nextAction: string;
  owner: GapOwner;
  candidateWasTold: ToldQuality;
  /** The words the candidate saw, so we can judge them. */
  candidateSaw: string | null;
  /** True when the candidate did their part correctly and we still have nothing. */
  ourFault: boolean;
};

export const GAP_REASONS: Record<string, GapReason> = {
  upload_without_application: {
    code: "upload_without_application",
    label: "CV arrived, application never created",
    cause:
      "Their CV uploaded and was stored, but the application record failed to be created, so there is nothing for evidence to attach to.",
    nextAction:
      "Contact the candidate to confirm they still want to be considered, then re-enter the application from their stored CV.",
    owner: "engineering",
    candidateWasTold: "generic",
    candidateSaw: "Network error — please try again.",
    ourFault: true,
  },
  duplicate_orphan_upload: {
    code: "duplicate_orphan_upload",
    label: "Same CV uploaded repeatedly, still no application",
    cause:
      "The candidate re-submitted the same document several times because the failure message told them to try again, and every attempt failed the same way.",
    nextAction:
      "Treat as one person, not several uploads. Reach out directly — they have already tried more than once.",
    owner: "engineering",
    candidateWasTold: "generic",
    candidateSaw: "Network error — please try again.",
    ourFault: true,
  },
  application_without_match: {
    code: "application_without_match",
    label: "Application exists, never entered the pipeline",
    cause:
      "The application was recorded but no pipeline record was created, so nothing was ever queued for extraction.",
    nextAction: "Create the pipeline record for this application and run processing.",
    owner: "engineering",
    candidateWasTold: "nothing",
    candidateSaw: "Application received, with a reference.",
    ourFault: true,
  },
  no_cv_supplied: {
    code: "no_cv_supplied",
    label: "No CV on the application",
    cause: "The application has no document attached, so there is nothing to extract evidence from.",
    nextAction: "Ask the candidate for a PDF CV, naming the role they applied to.",
    owner: "recruiter",
    candidateWasTold: "nothing",
    candidateSaw: "Application received, with a reference.",
    ourFault: true,
  },
  cv_never_parsed: {
    code: "cv_never_parsed",
    label: "Document still waiting to be read",
    cause:
      "The document is stored and queued but extraction never started, so no evidence could be produced.",
    nextAction: "Run extraction for this document, then let scoring follow.",
    owner: "engineering",
    candidateWasTold: "nothing",
    candidateSaw: "Application received, with a reference.",
    ourFault: true,
  },
  cv_unreadable: {
    code: "cv_unreadable",
    label: "Document could not be read",
    cause: "Extraction ran and failed, so there is no text to draw evidence from.",
    nextAction: "Handle it in the unreadable-documents queue: ask for a re-upload or paste the text.",
    owner: "recruiter",
    candidateWasTold: "specific",
    candidateSaw: "A plain-language request naming what to send instead.",
    ourFault: false,
  },
  parsed_but_never_scored: {
    code: "parsed_but_never_scored",
    label: "Document read, evidence never extracted",
    cause:
      "We have usable text but no evidence record was written, so the reviewer sees an empty profile.",
    nextAction: "Re-run evidence extraction for this application.",
    owner: "engineering",
    candidateWasTold: "nothing",
    candidateSaw: "Application received, with a reference.",
    ourFault: true,
  },
  evidence_row_empty: {
    code: "evidence_row_empty",
    label: "Evidence record written but empty",
    cause:
      "An evidence record exists with no findings in it, which reads as 'no evidence' everywhere downstream.",
    nextAction: "Review the document by hand and record what it does and does not show.",
    owner: "recruiter",
    candidateWasTold: "nothing",
    candidateSaw: "Application received, with a reference.",
    ourFault: true,
  },
  no_requirements_to_match: {
    code: "no_requirements_to_match",
    label: "Role has nothing to evidence against",
    cause:
      "The role carries no stated requirements or screening questions, so there is nothing for the document to be evidence of.",
    nextAction: "Complete the role brief with must-haves before expecting evidence.",
    owner: "recruiter",
    candidateWasTold: "nothing",
    candidateSaw: "Application received, with a reference.",
    ourFault: true,
  },
};

export function resolveGapReason(code: string | null | undefined): GapReason {
  return (code && GAP_REASONS[code]) || GAP_REASONS["parsed_but_never_scored"]!;
}

export const OWNER_LABEL: Record<GapOwner, string> = {
  engineering: "Engineering",
  recruiter: "Recruiter",
  candidate: "Candidate",
};

export const TOLD_LABEL: Record<ToldQuality, string> = {
  nothing: "We told them nothing",
  generic: "We showed a message that hid the real problem",
  specific: "We named the problem and the fix",
};
