/**
 * Outreach deliverability and opt-out health — pure aggregation and thresholds.
 *
 * Counts are always absolute. A rate only turns into a warning above a volume
 * floor: bounce rate over 3% needs at least 50 sends, opt-out rate over 1%
 * needs at least 100 sends. Below the floor the UI shows counts only, so a
 * 1-of-4 bounce never reads as a 25% deliverability problem.
 *
 * There is deliberately no sender-reputation score and no inbox-placement
 * estimate here — the platform has no data that could support either.
 */

export const BOUNCE_RATE_THRESHOLD = 0.03;
export const BOUNCE_MIN_SENDS = 50;
export const OPT_OUT_RATE_THRESHOLD = 0.01;
export const OPT_OUT_MIN_SENDS = 100;

export const WINDOWS = [7, 30] as const;
export type WindowDays = (typeof WINDOWS)[number];

/** States that mean the message actually left the system. */
export const SENT_STATES = ["sent", "delivered", "opened", "replied", "bounced"] as const;

export type TouchRow = {
  id: string;
  organization_id: string;
  channel: string;
  state: string;
  direction: string;
  sent_at: string | null;
  created_at: string;
  delivered_at: string | null;
  replied_at: string | null;
  error: string | null;
  candidate_profile_id: string | null;
};

export type OptOutRow = {
  id: string;
  organization_id: string | null;
  candidate_profile_id: string | null;
  email: string | null;
  channel: string | null;
  reason: string | null;
  created_at: string;
};

export type ChannelRule = {
  id: string | null;
  organization_id: string;
  org_name: string | null;
  channel: string;
  max_contacts_per_person: number;
  window_hours: number;
  enabled: boolean;
  /** Outbound sends inside the rule's own window — how close usage is to the cap. */
  sends_in_window: number;
  /** Distinct people contacted inside the rule's window. */
  people_in_window: number;
  /** People already at or above max_contacts_per_person inside the window. */
  people_at_cap: number;
};

export type WindowStats = {
  window_days: WindowDays;
  sent: number;
  delivered: number;
  bounced: number;
  replied: number;
  opted_out: number;
  /** null when below the volume floor for the metric. */
  bounce_rate: number | null;
  opt_out_rate: number | null;
  bounce_rate_suppressed: boolean;
  opt_out_rate_suppressed: boolean;
  bounce_warning: boolean;
  opt_out_warning: boolean;
};

export type ChannelHealth = {
  channel: string;
  windows: Record<WindowDays, WindowStats>;
};

export type OutreachHealth = {
  channels: ChannelHealth[];
  totals: Record<WindowDays, WindowStats>;
  rules: ChannelRule[];
  generated_at: string;
  thresholds: {
    bounce_rate: number;
    bounce_min_sends: number;
    opt_out_rate: number;
    opt_out_min_sends: number;
  };
};

const sentAt = (t: TouchRow) => t.sent_at ?? t.created_at;

const isSent = (t: TouchRow) =>
  t.direction === "outbound" && (SENT_STATES as readonly string[]).includes(t.state);

export function withinDays(iso: string | null, days: number, now: number): boolean {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  return ts >= now - days * 86_400_000;
}

function emptyWindow(window_days: WindowDays): WindowStats {
  return summarize(window_days, { sent: 0, delivered: 0, bounced: 0, replied: 0, opted_out: 0 });
}

function summarize(
  window_days: WindowDays,
  c: { sent: number; delivered: number; bounced: number; replied: number; opted_out: number },
): WindowStats {
  const bounceSuppressed = c.sent < BOUNCE_MIN_SENDS;
  const optOutSuppressed = c.sent < OPT_OUT_MIN_SENDS;
  const bounceRate = bounceSuppressed || c.sent === 0 ? null : c.bounced / c.sent;
  const optOutRate = optOutSuppressed || c.sent === 0 ? null : c.opted_out / c.sent;
  return {
    window_days,
    ...c,
    bounce_rate: bounceRate,
    opt_out_rate: optOutRate,
    bounce_rate_suppressed: bounceSuppressed,
    opt_out_rate_suppressed: optOutSuppressed,
    bounce_warning: bounceRate !== null && bounceRate > BOUNCE_RATE_THRESHOLD,
    opt_out_warning: optOutRate !== null && optOutRate > OPT_OUT_RATE_THRESHOLD,
  };
}

function statsFor(
  window_days: WindowDays,
  touches: TouchRow[],
  optOuts: OptOutRow[],
  now: number,
): WindowStats {
  const sends = touches.filter((t) => isSent(t) && withinDays(sentAt(t), window_days, now));
  return summarize(window_days, {
    sent: sends.length,
    delivered: sends.filter((t) => t.state === "delivered" || t.state === "opened" || t.state === "replied" || !!t.delivered_at)
      .length,
    bounced: sends.filter((t) => t.state === "bounced").length,
    replied: sends.filter((t) => t.state === "replied" || !!t.replied_at).length,
    opted_out: optOuts.filter((o) => withinDays(o.created_at, window_days, now)).length,
  });
}

export function aggregateOutreachHealth(input: {
  touches: TouchRow[];
  optOuts: OptOutRow[];
  rules: ChannelRule[];
  now?: number;
}): OutreachHealth {
  const now = input.now ?? Date.now();
  const channelNames = [
    ...new Set([
      ...input.touches.map((t) => t.channel),
      ...input.optOuts.map((o) => o.channel).filter((c): c is string => !!c),
    ]),
  ].sort();

  const channels: ChannelHealth[] = channelNames.map((channel) => {
    const touches = input.touches.filter((t) => t.channel === channel);
    // Channel-less opt-outs apply to every channel; count them where they land.
    const optOuts = input.optOuts.filter((o) => o.channel === channel || o.channel === null);
    return {
      channel,
      windows: {
        7: statsFor(7, touches, optOuts, now),
        30: statsFor(30, touches, optOuts, now),
      },
    };
  });

  return {
    channels,
    totals: {
      7: statsFor(7, input.touches, input.optOuts, now),
      30: statsFor(30, input.touches, input.optOuts, now),
    },
    rules: input.rules,
    generated_at: new Date(now).toISOString(),
    thresholds: {
      bounce_rate: BOUNCE_RATE_THRESHOLD,
      bounce_min_sends: BOUNCE_MIN_SENDS,
      opt_out_rate: OPT_OUT_RATE_THRESHOLD,
      opt_out_min_sends: OPT_OUT_MIN_SENDS,
    },
  };
}

export const emptyStats = emptyWindow;

export function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

export const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  phone: "Phone",
  sms: "SMS",
  referral: "Referral",
  event: "Event",
  other: "Other",
};

export const channelLabel = (channel: string) =>
  CHANNEL_LABELS[channel] ?? channel.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
