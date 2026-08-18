/**
 * "Your team" activity for one candidate — the client's own people only.
 *
 * Clients running a controlled process need to know who on THEIR side has
 * already looked at a candidate. This list is built from recorded events only:
 * a candidate opened, a comment written, feedback submitted, a decision
 * recorded. Nothing is inferred — if we never recorded it, it does not appear.
 *
 * Recruiter and TaaSFlow staff activity is excluded entirely; this is the
 * client's own team, not a window into how we work the role.
 */
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

export const TEAM_ACTIVITY_KINDS = ["viewed", "commented", "feedback", "decision"] as const;
export type TeamActivityKind = (typeof TEAM_ACTIVITY_KINDS)[number];

export type TeamActivityEntry = {
  id: string;
  kind: TeamActivityKind;
  actorName: string;
  /** Recorded moment, ISO string. */
  at: string;
  /** Short factual detail, e.g. the recommendation or decision made. */
  detail: string | null;
};

/** How many entries show before "Show all". */
export const TEAM_ACTIVITY_PREVIEW = 5;

/** Recorded view events collapse when they repeat inside this window. */
export const VIEW_DEDUPE_MINUTES = 30;

export const VIEW_ACTION = "client.candidate.viewed";

/** Plain sentence for one entry, written the way a person would say it. */
export function activityLine(entry: TeamActivityEntry): string {
  switch (entry.kind) {
    case "viewed":
      return `${entry.actorName} opened this candidate`;
    case "commented":
      return `${entry.actorName} added a comment`;
    case "feedback":
      return `${entry.actorName} submitted interview feedback`;
    case "decision":
      return `${entry.actorName} recorded a decision`;
    default:
      return entry.actorName;
  }
}

/** Newest first, so the most recent review is the first thing read. */
export function sortActivity(entries: TeamActivityEntry[]): TeamActivityEntry[] {
  return [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(APP_LOCALE, {
    timeZone: WORKSPACE_TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
