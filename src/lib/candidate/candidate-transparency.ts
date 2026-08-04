/**
 * Candidate-facing transparency layer.
 * ------------------------------------------------------------------
 * One vocabulary for what a candidate is told, used by the public status
 * page, the application receipt, the apply form and the signed-in
 * candidate area — so the same words appear everywhere.
 *
 * Rules for anything added to this file:
 *   1. Nothing internal. No scores, no weights, no rubric names, no
 *      reviewer notes, no other candidates, no client-side decisions
 *      that have not been communicated.
 *   2. No legal conclusions. We describe what we do and what a candidate
 *      can ask for. We do not claim compliance with any framework.
 *   3. Plain, respectful language. Automation runs behind this product;
 *      the writing should still sound like a person wrote it.
 */

export type CandidateStateKey =
  | "application_received"
  | "information_required"
  | "under_review"
  | "interview_stage"
  | "decision_made"
  | "role_closed"
  | "withdrawn"
  | "support_required";

export interface CandidateStateCopy {
  key: CandidateStateKey;
  /** Short label shown as a heading or badge. */
  label: string;
  /** What this state means, in one line. */
  meaning: string;
  /** What is happening on our side right now. */
  happening: string;
  /** What, if anything, we need from the candidate. */
  needed: string;
  /** Design-token tone. Never a raw colour. */
  tone: string;
  /** Whether a person is involved at this point. */
  humanInvolved: boolean;
}

export const CANDIDATE_STATES: Record<CandidateStateKey, CandidateStateCopy> = {
  application_received: {
    key: "application_received",
    label: "Application received",
    meaning: "Your application and CV are with us.",
    happening:
      "We are preparing your application for review: reading your CV, pulling out your experience, and checking it against what the role asks for.",
    needed: "Nothing right now. We will email you when there is news or a question.",
    tone: "bg-secondary text-secondary-foreground",
    humanInvolved: false,
  },
  information_required: {
    label: "Information needed",
    key: "information_required",
    meaning: "Someone on the team has asked you a question.",
    happening:
      "Your application is paused at this point until we hear back, so nothing moves ahead without your answer.",
    needed: "Answer the question below, or reply to the email we sent you.",
    tone: "taas-bg-warning-soft taas-fg-warning",
    humanInvolved: true,
  },
  under_review: {
    key: "under_review",
    label: "Under review",
    meaning: "A person is reading your application.",
    happening:
      "A reviewer is going through your CV and answers alongside the summary our tools prepared, and decides whether to share your profile with the hiring team.",
    needed: "Nothing right now. You can still correct your details or upload a newer CV.",
    tone: "taas-bg-info-soft taas-fg-info",
    humanInvolved: true,
  },
  interview_stage: {
    key: "interview_stage",
    label: "Interview stage",
    meaning: "The hiring team wants to speak with you.",
    happening:
      "Scheduling and interview feedback are handled between you, us and the hiring team.",
    needed:
      "Watch your inbox for interview details. Reply to that email if the timings do not work, or if you need any adjustments.",
    tone: "taas-bg-success-soft taas-fg-success",
    humanInvolved: true,
  },
  decision_made: {
    key: "decision_made",
    label: "Decision made",
    meaning: "A decision has been reached on this application.",
    happening:
      "We have written to you with the outcome. A person made this decision — it is not the result of an automated score on its own.",
    needed:
      "Nothing further for this role. If you would like feedback or think something was misread, write to us and we will look again.",
    tone: "bg-muted text-muted-foreground",
    humanInvolved: true,
  },
  role_closed: {
    key: "role_closed",
    label: "Role closed",
    meaning: "This role is no longer open.",
    happening:
      "The hiring team has closed the role, so applications for it are no longer being progressed.",
    needed:
      "Nothing for this role. Other roles on our board are open to you, and we will keep your details for future roles for as long as you allow.",
    tone: "bg-muted text-muted-foreground",
    humanInvolved: true,
  },
  withdrawn: {
    key: "withdrawn",
    label: "Withdrawn",
    meaning: "You withdrew this application.",
    happening: "We have stopped reviewing it and told the hiring team.",
    needed:
      "Nothing. You are welcome to apply to other roles at any time, and you can ask us to delete your data whenever you like.",
    tone: "bg-muted text-muted-foreground",
    humanInvolved: false,
  },
  support_required: {
    key: "support_required",
    label: "Support needed",
    meaning: "Something did not work as it should.",
    happening:
      "This may be a file we could not read, a detail that does not match, or a fault on our side. It is not a judgement about your application.",
    needed:
      "Write to hello@taasflow.com with your reference and we will sort it out by hand. Nothing you sent has been lost.",
    tone: "taas-bg-warning-soft taas-fg-warning",
    humanInvolved: true,
  },
};

export const CANDIDATE_STATE_ORDER: CandidateStateKey[] = [
  "application_received",
  "information_required",
  "under_review",
  "interview_stage",
  "decision_made",
];

/* ------------------------------------------------- transparency sections */

export interface TransparencySection {
  id: string;
  title: string;
  /** Two or three short lines at most. */
  body: string[];
}

/**
 * `company` is included when we know it, so the copy can name who sees
 * what instead of saying "the employer".
 */
export function transparencySections(company?: string | null): TransparencySection[] {
  const employer = company?.trim() ? company.trim() : "the hiring team for this role";
  return [
    {
      id: "what-we-ask",
      title: "What we ask for, and why",
      body: [
        "Your name and email so we can reach you, your location and work eligibility so we only put you forward for roles you can actually take, and your CV and screening answers so a reviewer can see your experience against what the role needs.",
        "Anything optional is marked optional. Accessibility or adjustment requests are handled privately and play no part in the assessment of your application.",
      ],
    },
    {
      id: "automation",
      title: "Where automation is involved",
      body: [
        "Software reads your CV and answers to pull out structured details — roles, dates, skills, qualifications — and drafts a summary of how your experience lines up with the role's requirements.",
        "That summary helps a reviewer read your application quickly and consistently. It is assistance, not a verdict: no rejection, shortlist or interview decision is issued by automation on its own.",
      ],
    },
    {
      id: "evidence",
      title: "How evidence supports the review",
      body: [
        "Each point in the summary is tied back to where it came from in what you sent, so a reviewer can check it rather than take it on trust.",
        "If the evidence for a requirement is thin or unclear, the reviewer sees that too — and we would rather ask you than assume.",
      ],
    },
    {
      id: "human-review",
      title: "Where a person reviews",
      body: [
        `A member of the TaaSFlow team reviews your application before anything is shared with ${employer}. Interview and hiring decisions are made by people at ${employer}.`,
        "We do not share your application with any other company without asking you first.",
      ],
    },
    {
      id: "corrections",
      title: "If something is wrong",
      body: [
        "You can correct your name, phone number and location, and upload a newer CV, from your status page while the role is open. Changes are recorded with your application so a reviewer can see what you updated.",
        "If you think something was read incorrectly, tell us and we will have a person look at it again.",
      ],
    },
    {
      id: "privacy",
      title: "Your data and how long we keep it",
      body: [
        "Your CV and answers are visible to the TaaSFlow review team and, once you progress, to the hiring team for this role. CV files are stored privately and are not publicly accessible.",
        "We keep your application for 12 months after the role closes, or 24 months if you asked to join the talent network, and then delete it. You can ask us to delete everything sooner from your status page or by writing to privacy@taasflow.com; we action deletion requests within 30 days.",
      ],
    },
    {
      id: "support",
      title: "Getting help from a person",
      body: [
        "Email hello@taasflow.com with your 6-character reference for anything about your application, or privacy@taasflow.com for questions about your data.",
        "If you need an adjustment at any stage of the process, tell us — it stays between you and the TaaSFlow team unless you ask us to pass it on.",
      ],
    },
  ];
}

export const SUPPORT_EMAIL = "hello@taasflow.com";
export const PRIVACY_EMAIL = "privacy@taasflow.com";
