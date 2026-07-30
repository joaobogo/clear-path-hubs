/**
 * Role launch state — the client-facing "Role Setup" timeline and
 * "Search Channels" panel.
 *
 * Every stage and every channel state in here is derived from a record that
 * actually exists: a position column, a stored timestamp, an outreach campaign
 * row, a job-board publication, or a delivered candidate match. Nothing is a
 * timer, and nothing advances on its own. If we have no evidence for a step it
 * stays "pending" (or, for a channel, "planned") — we never show motion the
 * backend cannot justify.
 *
 * Shared by the server (which computes it) and the client (which renders it),
 * so it must stay free of server-only imports.
 */

export type LaunchStageState = "pending" | "active" | "done" | "attention";

export const LAUNCH_STAGE_KEYS = [
  "received",
  "analyzing",
  "brief",
  "channels",
  "quality",
  "live",
  "discovery",
  "first_expected",
  "candidates",
] as const;

export type LaunchStageKey = (typeof LAUNCH_STAGE_KEYS)[number];

export interface LaunchStage {
  key: LaunchStageKey;
  label: string;
  state: LaunchStageState;
  /** ISO timestamp of the real event that completed or started this stage. */
  at: string | null;
  /** Short, calm, client-safe explanation. Never a provider error. */
  detail?: string;
}

export type ChannelState =
  | "planned"
  | "preparing"
  | "connected"
  | "active"
  | "paused"
  | "attention";

export interface LaunchChannel {
  key: string;
  label: string;
  state: ChannelState;
  /** What record backs this state, in plain client language. */
  evidence: string;
  at: string | null;
}

export const CHANNEL_STATE_LABEL: Record<ChannelState, string> = {
  planned: "Planned",
  preparing: "Preparing",
  connected: "Connected",
  active: "Active",
  paused: "Paused",
  attention: "Needs attention",
};

export interface RoleLaunchState {
  stages: LaunchStage[];
  channels: LaunchChannel[];
  /** Business-day estimate for first candidates; null until the role is live. */
  firstCandidatesExpected: string | null;
  delayed: boolean;
  /** Client-safe headline for the panel. */
  headline: string;
}

/**
 * Adds N business days (Mon–Fri) to a date.
 * Returns null for an unparseable input rather than an Invalid Date, so callers
 * can never hand `Invalid Date.toISOString()` a chance to throw.
 */
export function addBusinessDays(from: Date, days: number): Date | null {
  const start = from.getTime();
  if (!Number.isFinite(start)) return null;
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return d;
}

export function formatExpected(iso: string | null): string {
  if (!iso) return "Set once your role goes live";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Set once your role goes live";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
