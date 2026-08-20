import { APP_LOCALE, WORKSPACE_TIMEZONE, calendarDayDiff, formatDate } from "@/lib/format/datetime";
const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso);
  const now = new Date();
  const diff = then.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const min = 60_000,
    hr = 60 * min,
    day = 24 * hr;
  if (abs < hr) return RELATIVE.format(Math.round(diff / min), "minute");
  if (abs < day) return RELATIVE.format(Math.round(diff / hr), "hour");
  const days = calendarDayDiff(then, now);
  if (Math.abs(days) < 30) return RELATIVE.format(days, "day");
  return formatDate(then);
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
    "client.request_interview": "You requested an interview",
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
