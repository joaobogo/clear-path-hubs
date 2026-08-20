/**
 * What TaaSFlow does next, and by when.
 *
 * Every client decision must produce a visible consequence. A decision that
 * disappears into the system trains clients to stop deciding, so each stage
 * carries an explicit commitment ("We'll propose interview slots within 24h")
 * with a real deadline computed from when the candidate entered that stage.
 */

import type { MatchStage } from "@/lib/client-kpi.server";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate, formatTime, formatWeekday } from "@/lib/format/datetime";
import { calendarDaysUntil } from "@/lib/format/relative-date";

export type NextStep = {
  /** Short promise in client language, no internal vocabulary. */
  headline: string;
  /** Who the ball is with. */
  owner: "taasflow" | "client";
  /** Hours we commit to, or null when the next move is the client's. */
  withinHours: number | null;
};

const STEPS: Record<string, NextStep> = {
  new: {
    headline: "We're finishing the review before this profile reaches you.",
    owner: "taasflow",
    withinHours: 24,
  },
  reviewing: {
    headline: "Waiting on your review — advance, hold or decline whenever you're ready.",
    owner: "client",
    withinHours: null,
  },
  archived: {
    headline: "Archived — no further action needed.",
    owner: "client",
    withinHours: null,
  },
  delivered: {
    headline: "Waiting on your review — advance, hold or decline whenever you're ready.",
    owner: "client",
    withinHours: null,
  },

  shortlisted: {
    headline: "We'll propose interview slots",
    owner: "taasflow",
    withinHours: 24,
  },
  interview_process: {
    headline: "We'll confirm the time and send calendar invites",
    owner: "taasflow",
    withinHours: 24,
  },
  offer: {
    headline: "We'll present the offer and come back with the candidate's response",
    owner: "taasflow",
    withinHours: 48,
  },
  hired: {
    headline: "We'll confirm the start date and handle onboarding paperwork",
    owner: "taasflow",
    withinHours: 72,
  },
  not_moving_forward: {
    headline: "We'll let the candidate know and put fresh profiles in front of you",
    owner: "taasflow",
    withinHours: 48,
  },
};

const FALLBACK_STEP: NextStep = {
  headline: "We're reviewing this profile and will come back to you.",
  owner: "taasflow",
  withinHours: 24,
};

export function nextStepForStage(stage: MatchStage): NextStep {
  return STEPS[stage as string] ?? FALLBACK_STEP;
}

/** "within 24h" / "within 2 days" — plain wording for a commitment window. */
export function withinLabel(hours: number): string {
  if (hours < 24) return `within ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "within 24h" : `within ${days} days`;
}

/** Absolute deadline from the moment the stage was entered. */
export function dueAt(stageEnteredAt: string | null, hours: number, now = new Date()): Date {
  const start = stageEnteredAt ? new Date(stageEnteredAt) : now;
  return new Date(start.getTime() + hours * 3_600_000);
}

/** "by 14:00 today" / "by tomorrow 09:00" / "by Fri 09:00". */
export function dueLabel(due: Date, now = new Date()): string {
  const time = formatTime(due);
  const dayDiff = calendarDaysUntil(due, now) ?? 0;
  if (dayDiff <= 0) return `by ${time} today`;
  if (dayDiff === 1) return `by tomorrow ${time}`;
  if (dayDiff < 7) return `by ${formatWeekday(due)} ${time}`;
  return `by ${formatDate(due)}`;
}

export type NextStepView = {
  headline: string;
  /** Full sentence including the commitment window, e.g. "…within 24h". */
  sentence: string;
  /** Deadline phrasing, or null when the next move belongs to the client. */
  due: string | null;
  owner: NextStep["owner"];
  /** True when our own commitment window has already passed. */
  overdue: boolean;
};

export function buildNextStep(
  stage: MatchStage,
  stageEnteredAt: string | null,
  now = new Date(),
): NextStepView {
  const step = nextStepForStage(stage);
  if (step.owner === "client" || step.withinHours === null) {
    return {
      headline: step.headline,
      sentence: step.headline,
      due: null,
      owner: step.owner,
      overdue: false,
    };
  }
  const deadline = dueAt(stageEnteredAt, step.withinHours, now);
  const isOverdue = deadline.getTime() < now.getTime();

  // When overdue, we drop the "within X days" SLA clause and state the elapsed time instead.
  let sentence = `${step.headline} ${withinLabel(step.withinHours)}.`;
  let due = dueLabel(deadline, now);

  if (isOverdue) {
    sentence = step.headline;
    const hoursOverdue = Math.max(1, Math.floor((now.getTime() - deadline.getTime()) / 3_600_000));
    const daysOverdue = Math.floor(hoursOverdue / 24);
    const overdueLabel =
      daysOverdue >= 1
        ? `Overdue by ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"}`
        : `Overdue by ${hoursOverdue}h`;

    due = `${overdueLabel} — we're on it.`;
  }

  return {
    headline: step.headline,
    sentence,
    due,
    owner: step.owner,
    overdue: isOverdue,
  };
}


/**
 * The consequence line shown the instant a decision lands, before any data
 * refetch — keyed off the stage the candidate has just moved into.
 */
export function confirmationLine(stage: MatchStage, now = new Date()): string {
  const step = nextStepForStage(stage);
  if (step.owner === "client" || step.withinHours === null) return step.headline;
  const due = dueAt(now.toISOString(), step.withinHours, now);
  return `${step.headline} ${withinLabel(step.withinHours)} — ${dueLabel(due, now)}.`;
}
