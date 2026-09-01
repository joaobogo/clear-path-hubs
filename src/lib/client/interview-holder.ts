/**
 * Whose move is it on an interview that has no confirmed time.
 *
 * ONE derivation, because the alternative is what the client Interviews page
 * was doing: heading everything "Waiting on you to confirm a time" while every
 * row read "No times sent yet". Three Northwind interviews sat under that
 * heading with no slots ever proposed, admin's own work queue listed the same
 * three as "Interviews to coordinate" owned by TaaSFlow, and the SLA desk
 * recorded the breach at 267.5h against a 24-hour commitment. The client was
 * shown our eleven-day miss as their inaction (audit 1 Sep, F16).
 *
 * The rule is simple and the record already knows it: a client can only
 * confirm a time that is on the table.
 */
import { liveSlots } from "@/lib/scheduling";

export type InterviewHolder = "us" | "client";

type SchedulableInterview = {
  proposed_times?: string[] | null;
  availability_expires_at?: string | null;
};

export type InterviewHolderResult = {
  holder: InterviewHolder;
  /**
   * The single status line for this interview. The page used to show two
   * mutually exclusive strings — "No times still available — we will send new
   * ones" (slots were sent and lapsed) and "No times sent yet" (none ever
   * were) — for the same record.
   */
  status: string;
};

export function interviewHolder(interview: SchedulableInterview): InterviewHolderResult {
  const proposed = interview.proposed_times ?? [];
  const live = liveSlots(proposed, interview.availability_expires_at ?? null);

  if (live.length > 0) {
    return { holder: "client", status: "Times proposed — pick one that works" };
  }
  if (proposed.length > 0) {
    return {
      holder: "us",
      // Times were genuinely sent and have lapsed. Saying so is honest, and
      // the next move is still ours.
      status: "The times we sent have passed — we will send new ones",
    };
  }
  return {
    holder: "us",
    // The case that was being blamed on the client.
    status: "We have not sent times yet — this is with us",
  };
}
