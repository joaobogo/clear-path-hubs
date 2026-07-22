// Canonical event catalogue for TaaSFlow (Phase 10).
// This module is BROWSER-SAFE: it only exports constants and pure copy maps.

export const EVENT_TYPES = [
  "intake_submitted",
  "clarification_requested",
  "position_approved",
  "position_activated",
  "application_received",
  "candidate_processing_completed",
  "candidate_ready_for_admin_review",
  "candidate_published",
  "client_shortlisted",
  "interview_requested",
  "interview_scheduled",
  "client_feedback_submitted",
  "candidate_hired",
  "position_closed",
  "message_sent",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type Audience = "admin" | "client" | "candidate";

export type CopyEntry = { title: string; body?: string };

// Language rules:
// - Admin copy: operational, precise.
// - Client copy: business outcomes; never internal states or raw scores.
// - Candidate copy: encouraging; never reveals scores, admin steps, or failures.

export const ADMIN_COPY: Partial<Record<EventType, CopyEntry>> = {
  intake_submitted: { title: "New client intake", body: "A new intake is ready for review." },
  candidate_ready_for_admin_review: { title: "Candidate ready for review", body: "A candidate has completed processing." },
  candidate_processing_completed: { title: "Processing finished", body: "Candidate processing pipeline finished." },
  client_shortlisted: { title: "Client shortlisted a candidate", body: "A client just moved a candidate to shortlist." },
  client_feedback_submitted: { title: "Client feedback received" },
  interview_requested: { title: "Client requested an interview" },
  message_sent: { title: "New client message" },
};

export const CLIENT_COPY: Partial<Record<EventType, CopyEntry>> = {
  clarification_requested: { title: "We need a quick clarification", body: "Please review the open question on your role." },
  position_approved: { title: "Your role is approved", body: "We are preparing your position for launch." },
  position_activated: { title: "Your role is live", body: "Candidates can now apply." },
  candidate_published: { title: "New candidate delivered", body: "A vetted candidate is available in your workspace." },
  interview_scheduled: { title: "Interview scheduled" },
  message_sent: { title: "New message from TaaSFlow" },
  position_closed: { title: "Position closed" },
};

export const CANDIDATE_COPY: Partial<Record<EventType, CopyEntry>> = {
  application_received: { title: "Application received", body: "Thanks — we have your application and will be in touch." },
  clarification_requested: { title: "We need a bit more information", body: "Please check your application for an open question." },
  candidate_published: { title: "You are under consideration", body: "You have advanced to the next step." },
  client_shortlisted: { title: "You have been shortlisted", body: "The client has shortlisted you for their role." },
  interview_requested: { title: "Interview request", body: "The client would like to interview you." },
  interview_scheduled: { title: "Your interview is scheduled" },
  candidate_hired: { title: "Congratulations — offer stage", body: "The client has moved forward with an offer." },
  message_sent: { title: "New message" },
};

export function copyFor(audience: Audience, event: EventType): CopyEntry | null {
  const map = audience === "admin" ? ADMIN_COPY : audience === "client" ? CLIENT_COPY : CANDIDATE_COPY;
  return map[event] ?? null;
}

// Idempotency keys are deterministic. Same real-world event => same key => single row.
export function eventKey(event: EventType, scope: string): string {
  return `${event}:${scope}`;
}
