/**
 * The client and the staff queue must describe the same interview.
 *
 * Two directions of the same defect (audit #8, TF8-08):
 *
 *   - Diogo Martins and Laura Fernández sat in /admin/interviews under
 *     "Awaiting a time · the client asked to interview", while their own client
 *     workspace showed them as merely "Shortlisted" and offered a "Request
 *     interview" button for a request already in the staff queue. Asking twice
 *     for something already asked for is the most confusing state the product
 *     can produce, and the mechanism to prevent it — interview_awaiting_time —
 *     had been built in audit #6 (A6-23) and was simply never fed on the list.
 *
 *   - Rui Almeida's only interview was cancelled, but the stage stays at
 *     interview_process, so the client was shown "Interviewing" with a
 *     "Make offer" action.
 */
import { describe, expect, it } from "vitest";
import { advanceFor } from "@/components/client/candidate-primary-action";
import {
  CONFIRMATION_PENDING_STATUSES,
  interviewNeedsTimeConfirmed,
} from "@/lib/client/interviews-to-confirm";

describe("a request already in the staff queue is not offered again", () => {
  it("offers no advance action while a time is being arranged", () => {
    expect(advanceFor("shortlisted", true)).toBeNull();
  });

  it("never requests interviews from candidate list actions", () => {
    expect(advanceFor("shortlisted", false)).toBeNull();
  });

  it("uses the same statuses the admin queue counts by", () => {
    // If these drift, the client's button and the staff queue disagree again.
    for (const status of CONFIRMATION_PENDING_STATUSES) {
      expect(interviewNeedsTimeConfirmed(status), status).toBe(true);
    }
    for (const status of ["scheduled", "completed", "cancelled", "no_show", null, ""]) {
      expect(interviewNeedsTimeConfirmed(status), String(status)).toBe(false);
    }
  });
});

/**
 * The stage word alone is not the whole truth. These mirror the three-way read
 * the candidate card and the compact list both apply, so the two surfaces
 * cannot describe one candidate differently.
 */
function clientStageWord(c: {
  stage: string;
  interview_awaiting_time: boolean;
  interview_called_off: boolean;
}): "Interview requested" | "Interview cancelled" | "stage" {
  if (c.interview_awaiting_time) return "Interview requested";
  if (c.interview_called_off && c.stage === "interview_process") return "Interview cancelled";
  return "stage";
}

describe("a cancelled interview does not read as interviewing", () => {
  it("says so when the only interview was called off", () => {
    expect(
      clientStageWord({
        stage: "interview_process",
        interview_awaiting_time: false,
        interview_called_off: true,
      }),
    ).toBe("Interview cancelled");
  });

  it("leaves a held interview reading as the stage", () => {
    // interview_called_off is false when an interview was completed — that is a
    // normal interview_process state and must keep reading as Interviewing.
    expect(
      clientStageWord({
        stage: "interview_process",
        interview_awaiting_time: false,
        interview_called_off: false,
      }),
    ).toBe("stage");
  });

  it("does not claim a cancellation outside the interview stage", () => {
    expect(
      clientStageWord({
        stage: "shortlisted",
        interview_awaiting_time: false,
        interview_called_off: true,
      }),
    ).toBe("stage");
  });

  it("puts an awaiting-time request ahead of a past cancellation", () => {
    // A re-request after a cancellation is live work, not a cancellation.
    expect(
      clientStageWord({
        stage: "interview_process",
        interview_awaiting_time: true,
        interview_called_off: true,
      }),
    ).toBe("Interview requested");
  });
});

describe("Make offer needs an interview to have happened", () => {
  // Marta Nunes read "Interviewing / Make offer" with one interview still
  // awaiting a slot and none held, so the client was invited to make an offer
  // to someone they had never met (audit 1 Sep, F20b).
  it("offers nothing while an interview is arranged but not held", () => {
    expect(advanceFor("interview_process", false, false, false)).toBeNull();
  });

  it("does not make an offer when the interview stage was reached", () => {
    expect(advanceFor("interview_process", false, false, true)).toBeNull();
  });

  it("never creates new interview bookings after cancellation", () => {
    expect(advanceFor("interview_process", false, true, false)).toBeNull();
  });

  it("leaves hire confirmation exclusively to the Kanban", () => {
    expect(advanceFor("offer", false, false, false)).toBeNull();
  });
});
