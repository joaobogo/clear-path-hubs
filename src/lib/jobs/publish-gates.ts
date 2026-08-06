/**
 * What blocks publishing a role, and what merely improves it.
 *
 * Blocking fields are the ones candidates screen on: pay decision, location
 * and work model, work authorisation, employment type and at least three
 * must-haves. Everything else improves the posting but never holds it back.
 *
 * No score, no percentage, no progress ring — a list of questions with owners.
 */

import { arrangementGaps, type ArrangementInput } from "./arrangement-statement";
import { resolveCompensationDecision, type CompensationDecisionInput } from "./compensation-decision";
import { authorisationStatement, type WorkAuthorisationInput } from "./work-authorisation";
import type { BriefRequirement } from "./brief-requirements";

export type PublishGap = {
  key: string;
  /** The single question that resolves it. */
  question: string;
  group: "blocking" | "improving";
  /** Who has to answer: the client, or us. */
  owner: "client" | "taasflow";
};

export type PublishGateInput = {
  arrangement: ArrangementInput;
  compensation: CompensationDecisionInput;
  authorisation: WorkAuthorisationInput;
  employment_type?: string | null;
  requirements?: BriefRequirement[] | null;
  responsibilities?: string | null;
  outcomes?: unknown[] | null;
  /** The client explicitly chose not to publish a blocking field. */
  waived?: string[] | null;
};

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function publishGaps(input: PublishGateInput): PublishGap[] {
  const waived = new Set((input.waived ?? []).map((k) => text(k)));
  const gaps: PublishGap[] = [];

  const comp = resolveCompensationDecision(input.compensation);
  if (!comp.ok) {
    gaps.push({ key: "compensation", question: comp.blocker, group: "blocking", owner: "client" });
  }

  for (const g of arrangementGaps(input.arrangement)) {
    gaps.push({ key: `arrangement.${g.key}`, question: g.question, group: "blocking", owner: "client" });
  }

  if (authorisationStatement(input.authorisation) === null) {
    gaps.push({
      key: "work_authorisation",
      question: "Will you sponsor work authorisation for this role? Yes or no — we do not assume either way.",
      group: "blocking",
      owner: "client",
    });
  }

  if (!text(input.employment_type)) {
    gaps.push({
      key: "employment_type",
      question: "Is this permanent, fixed-term or contract?",
      group: "blocking",
      owner: "client",
    });
  }

  const musts = (input.requirements ?? []).filter((r) => r.kind === "must_have");
  if (musts.length < 3) {
    gaps.push({
      key: "must_haves",
      question: "Name at least three must-haves we can screen against.",
      group: "blocking",
      owner: "client",
    });
  }

  // Improving: real gaps, but never a reason to hold a posting.
  if (!text(input.responsibilities)) {
    gaps.push({
      key: "responsibilities",
      question: "What will this person actually do day to day?",
      group: "improving",
      owner: "client",
    });
  }
  if (!Array.isArray(input.outcomes) || input.outcomes.length === 0) {
    gaps.push({
      key: "outcomes",
      question: "What should be true after the first 90 days?",
      group: "improving",
      owner: "client",
    });
  }
  for (const r of musts) {
    if (!text(r.reason)) {
      gaps.push({
        key: `must_have_reason.${r.id}`,
        question: `Why is "${r.text}" a must-have rather than trainable?`,
        group: "improving",
        owner: "client",
      });
    }
  }

  return gaps.filter((g) => !(g.group === "blocking" && waived.has(g.key)));
}

/** Generation of candidate-facing content stays off while anything blocks. */
export function canGenerateCandidateContent(input: PublishGateInput): boolean {
  return publishGaps(input).every((g) => g.group !== "blocking");
}

/** The one line every list shows for an incomplete role: field plus owner. */
export function blockingSummaryLine(gaps: PublishGap[]): string | null {
  const blocking = gaps.filter((g) => g.group === "blocking");
  if (blocking.length === 0) return null;
  const who = blocking[0].owner === "client" ? "waiting on you" : "waiting on TaaSFlow";
  const first = blocking[0].question;
  return blocking.length === 1
    ? `${first} (${who})`
    : `${first} (${who}) · ${blocking.length - 1} more to answer`;
}
