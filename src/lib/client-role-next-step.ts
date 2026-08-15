import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
/**
 * "What happens next" for a whole role, in one line: what happens, who owns it,
 * and the date it is expected by. If we owe the client something we say so; if
 * we are waiting on them, we say that instead.
 */

export type RoleNextStep = {
  sentence: string;
  owner: "taasflow" | "client";
  ownerLabel: string;
  /** Human date the step is expected by, or null when there is no date yet. */
  dateLabel: string | null;
  overdue: boolean;
};

export type RoleNextStepInput = {
  stage_key?: string | null;
  stage_label?: string | null;
  delivered_pending?: number | null;
  promised_shortlist_by?: string | null;
  shortlist_delivered_at?: string | null;
  interviews_unscheduled?: number | null;
  offers_open?: number | null;
};

function fmt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE, day: "numeric", month: "short" });
}

function inDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE, day: "numeric", month: "short" });
}

export function roleNextStep(role: RoleNextStepInput, now = new Date()): RoleNextStep {
  const pending = role.delivered_pending ?? 0;
  const unscheduled = role.interviews_unscheduled ?? 0;
  const offers = role.offers_open ?? 0;

  if (pending > 0) {
    return {
      sentence:
        pending === 1
          ? "One candidate is waiting for your decision."
          : `${pending} candidates are waiting for your decision.`,
      owner: "client",
      ownerLabel: "You",
      dateLabel: null,
      overdue: false,
    };
  }

  if (unscheduled > 0) {
    return {
      sentence: "We'll come back with interview times.",
      owner: "taasflow",
      ownerLabel: "TaaSFlow",
      dateLabel: inDays(1),
      overdue: false,
    };
  }

  if (offers > 0) {
    return {
      sentence: "We'll come back with the candidate's response to the offer.",
      owner: "taasflow",
      ownerLabel: "TaaSFlow",
      dateLabel: inDays(2),
      overdue: false,
    };
  }

  if (!role.shortlist_delivered_at) {
    const promised = role.promised_shortlist_by ?? null;
    const late = promised ? new Date(promised).getTime() < now.getTime() : false;
    return {
      sentence: late
        ? "Your first shortlist is late. We're on it and will send it as soon as it's ready."
        : "We'll send your first shortlist.",
      owner: "taasflow",
      ownerLabel: "TaaSFlow",
      dateLabel: fmt(promised),
      overdue: late,
    };
  }

  return {
    sentence: "We'll keep adding candidates as they clear screening.",
    owner: "taasflow",
    ownerLabel: "TaaSFlow",
    dateLabel: null,
    overdue: false,
  };
}
