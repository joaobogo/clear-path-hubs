import { calendarDayDiff, formatDate, formatRelativeSigned } from "@/lib/format/datetime";
const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function relTime(iso: string | null | undefined): string {
  return formatRelativeSigned(iso);
}

export function daysWaiting(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** Audit-event actions in client language. Never shows an internal state name. */
export function formatAction(action: string): string {
  const map: Record<string, string> = {
    "candidate_match.stage_changed": "A candidate moved forward",
    "client.shortlist": "You shortlisted a candidate",
    "client.request_interview": "You moved a candidate to the interview stage",
    "client.offer": "An offer was made",
    "client.hire": "A hire was confirmed",
    "client.not_moving_forward": "A candidate was declined",
    "client.submit_feedback": "Interview feedback was captured",
    "position.approved": "A role was approved",
    "position.activated": "A role went live",
    "position.paused": "A role was paused",
  };
  return map[action] ?? "Your search progressed";
}
