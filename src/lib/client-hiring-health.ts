/**
 * Hiring health line — one judgement, three plain figures.
 *
 * Replaces the counter wall at the top of the client workspace. A hiring
 * manager should read one sentence and know whether hiring is on track or
 * slipping.
 *
 * Pure. No DB access, no projections. Every input is a real count derived from
 * recorded dates and stored commitments.
 *
 * Rule order is fixed and evaluated top down:
 *   1. Urgent actions (blocks or overdue)             → "N urgent things need you."
 *   2. Routine review (new candidates)                → "N candidates need review."
 *   3. Behind schedule (no shortlist)                 → "N roles are behind schedule."
 *   4. Otherwise                                      → "Hiring is on track."

 *
 * Only one sentence ever shows.
 */

export type HiringHealthInput = {
  /** Open roles (active, paused or approved). */
  openRoles: number;
  /** Candidates delivered and still awaiting a first client decision. */
  awaitingDecision: number;
  /** Open roles with no shortlist delivered yet. */
  rolesWithoutShortlist: number;
  /** Awaiting decisions past their stored client_decision_due_at. */
  overdueDecisions: number;
  /** Open roles past their promised first-shortlist date with nothing delivered. */
  behindScheduleRoles: number;
  /** Roles blocked by missing information (gaps). */
  blocks: number;
};

export type HiringHealthTone = "on_track" | "attention";

export type HiringHealthFigureKey =
  | "open_roles"
  | "awaiting_decision"
  | "roles_without_shortlist";

export type HiringHealthFigure = {
  key: HiringHealthFigureKey;
  value: number;
  label: string;
};

export type HiringHealth = {
  sentence: string;
  tone: HiringHealthTone;
  /** Which rule produced the sentence — useful for tests and telemetry. */
  reason: "blocks" | "overdue_decisions" | "behind_schedule" | "on_track";
  figures: HiringHealthFigure[];
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function count(n: number): string {
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  return n < words.length ? words[n]! : String(n);
}

export function computeHiringHealth(input: HiringHealthInput): HiringHealth {
  const figures: HiringHealthFigure[] = [
    { key: "open_roles", value: input.openRoles, label: plural(input.openRoles, "open role", "open roles") },
    {
      key: "awaiting_decision",
      value: input.awaitingDecision,
      label: plural(input.awaitingDecision, "awaiting your decision", "awaiting your decision"),
    },
    {
      key: "roles_without_shortlist",
      value: input.rolesWithoutShortlist,
      label: plural(
        input.rolesWithoutShortlist,
        "role with no shortlist yet",
        "roles with no shortlist yet",
      ),
    },
  ];
  
  const urgent = input.overdueDecisions + input.blocks;
  if (urgent > 0) {
    return {
      sentence: `${count(urgent)} urgent ${plural(urgent, "thing needs", "things need")} you.`,
      tone: "attention",
      reason: input.blocks > 0 ? "blocks" : "overdue_decisions",
      figures,
    };
  }

  if (input.awaitingDecision > 0) {
    const total = input.awaitingDecision;
    return {
      sentence: `${count(total)} ${plural(total, "candidate needs", "candidates need")} review.`,
      tone: "on_track",
      reason: "on_track",
      figures,
    };
  }


  if (input.behindScheduleRoles > 0) {
    const n = input.behindScheduleRoles;
    return {
      sentence: `${count(n)} ${plural(n, "role is", "roles are")} behind schedule.`,
      tone: "attention",
      reason: "behind_schedule",
      figures,
    };
  }

  return {
    sentence: "Hiring is on track.",
    tone: "on_track",
    reason: "on_track",
    figures,
  };
}
