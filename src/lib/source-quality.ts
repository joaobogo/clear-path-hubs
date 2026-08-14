/**
 * Sourcing channel quality — pure aggregation and rate rules.
 *
 * Every rate carries its absolute numerator and denominator, and a rate is only
 * produced when the denominator reaches MIN_RATE_DENOMINATOR. Below that the
 * rate is null and the UI shows counts only — a 1-of-2 channel must never read
 * as "50% hire rate". No cost-per-hire is derived here: spend only appears when
 * the underlying rows actually carry it, as a raw total.
 */

/** A rate is suppressed below this denominator. */
export const MIN_RATE_DENOMINATOR = 10;

export type SourceAttributionRow = {
  channel: string | null;
  kind: string | null;
  application_id: string;
  candidate_profile_id: string | null;
  match_id: string | null;
  stage: string | null;
  hire_status: string | null;
  hired_at: string | null;
  source_cost_cents: number | null;
};

/** Stages that mean the candidate reached the client. */
export const SUBMITTED_STAGES = [
  "delivered",
  "shortlisted",
  "interview_process",
  "offer",
  "hired",
] as const;

/** Stages that mean the client accepted the candidate for their process. */
export const ACCEPTED_STAGES = ["shortlisted", "interview_process", "offer", "hired"] as const;

export type Rate = {
  /** null when the denominator is below MIN_RATE_DENOMINATOR. */
  value: number | null;
  numerator: number;
  denominator: number;
  suppressed: boolean;
};

export function rate(numerator: number, denominator: number): Rate {
  const suppressed = denominator < MIN_RATE_DENOMINATOR;
  return {
    value: suppressed || denominator === 0 ? null : numerator / denominator,
    numerator,
    denominator,
    suppressed,
  };
}

export type ChannelQuality = {
  channel: string;
  kinds: string[];
  candidates: number;
  submitted: number;
  accepted: number;
  hired: number;
  spend_cents: number;
  /** Present only when at least one row carried a cost. */
  has_spend: boolean;
  submitted_rate: Rate;
  accepted_rate: Rate;
  hire_rate: Rate;
};

export type SourceQuality = {
  channels: ChannelQuality[];
  totals: {
    candidates: number;
    submitted: number;
    accepted: number;
    hired: number;
    spend_cents: number;
    has_spend: boolean;
  };
  min_rate_denominator: number;
};

const isSubmitted = (stage: string | null) =>
  !!stage && (SUBMITTED_STAGES as readonly string[]).includes(stage);
const isAccepted = (stage: string | null) =>
  !!stage && (ACCEPTED_STAGES as readonly string[]).includes(stage);
const isHired = (row: { stage: string | null; hire_status: string | null; hired_at: string | null }) =>
  row.stage === "hired" || row.hire_status === "hire_confirmed" || !!row.hired_at;

export function aggregateSourceQuality(rows: SourceAttributionRow[]): SourceQuality {
  const byChannel = new Map<string, SourceAttributionRow[]>();
  for (const row of rows) {
    const channel = row.channel?.trim() || "unknown";
    const list = byChannel.get(channel) ?? [];
    list.push(row);
    byChannel.set(channel, list);
  }

  const channels: ChannelQuality[] = [...byChannel.entries()].map(([channel, list]) => {
    const candidates = list.length;
    const submitted = list.filter((r) => isSubmitted(r.stage)).length;
    const accepted = list.filter((r) => isAccepted(r.stage)).length;
    const hired = list.filter(isHired).length;
    const spend_cents = list.reduce((sum, r) => sum + (r.source_cost_cents ?? 0), 0);
    return {
      channel,
      kinds: [...new Set(list.map((r) => r.kind).filter((k): k is string => !!k))].sort(),
      candidates,
      submitted,
      accepted,
      hired,
      spend_cents,
      has_spend: list.some((r) => (r.source_cost_cents ?? 0) > 0),
      submitted_rate: rate(submitted, candidates),
      accepted_rate: rate(accepted, submitted),
      hire_rate: rate(hired, accepted),
    };
  });

  channels.sort((a, b) => b.candidates - a.candidates || a.channel.localeCompare(b.channel));

  const sum = (pick: (c: ChannelQuality) => number) =>
    channels.reduce((acc, c) => acc + pick(c), 0);

  return {
    channels,
    totals: {
      candidates: sum((c) => c.candidates),
      submitted: sum((c) => c.submitted),
      accepted: sum((c) => c.accepted),
      hired: sum((c) => c.hired),
      spend_cents: sum((c) => c.spend_cents),
      has_spend: channels.some((c) => c.has_spend),
    },
    min_rate_denominator: MIN_RATE_DENOMINATOR,
  };
}

/** Rollup rows from v_source_attribution_rollup, already grouped per org/channel. */
export type RollupRow = {
  channel: string | null;
  kind: string | null;
  applications: number | string | null;
  shortlisted: number | string | null;
  interviewed: number | string | null;
  offered: number | string | null;
  hired: number | string | null;
  total_cost_cents: number | string | null;
};

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v) || 0);

/**
 * Rollup aggregation across organizations. The rollup view exposes stage
 * milestones rather than per-candidate stages, so "submitted" is taken as
 * shortlisted-or-further, matching ACCEPTED_STAGES on the detail view.
 */
export function aggregateRollup(rows: RollupRow[]): SourceQuality {
  const byChannel = new Map<string, RollupRow[]>();
  for (const row of rows) {
    const channel = row.channel?.trim() || "unknown";
    const list = byChannel.get(channel) ?? [];
    list.push(row);
    byChannel.set(channel, list);
  }

  const channels: ChannelQuality[] = [...byChannel.entries()].map(([channel, list]) => {
    const candidates = list.reduce((s, r) => s + num(r.applications), 0);
    const shortlisted = list.reduce((s, r) => s + num(r.shortlisted), 0);
    const interviewed = list.reduce((s, r) => s + num(r.interviewed), 0);
    const hired = list.reduce((s, r) => s + num(r.hired), 0);
    const spend_cents = list.reduce((s, r) => s + num(r.total_cost_cents), 0);
    return {
      channel,
      kinds: [...new Set(list.map((r) => r.kind).filter((k): k is string => !!k))].sort(),
      candidates,
      submitted: shortlisted,
      accepted: interviewed,
      hired,
      spend_cents,
      has_spend: spend_cents > 0,
      submitted_rate: rate(shortlisted, candidates),
      accepted_rate: rate(interviewed, shortlisted),
      hire_rate: rate(hired, interviewed),
    };
  });

  channels.sort((a, b) => b.candidates - a.candidates || a.channel.localeCompare(b.channel));

  const sum = (pick: (c: ChannelQuality) => number) =>
    channels.reduce((acc, c) => acc + pick(c), 0);

  return {
    channels,
    totals: {
      candidates: sum((c) => c.candidates),
      submitted: sum((c) => c.submitted),
      accepted: sum((c) => c.accepted),
      hired: sum((c) => c.hired),
      spend_cents: sum((c) => c.spend_cents),
      has_spend: channels.some((c) => c.has_spend),
    },
    min_rate_denominator: MIN_RATE_DENOMINATOR,
  };
}

export function formatRate(r: Rate): string {
  if (r.value == null) return "—";
  return `${Math.round(r.value * 100)}%`;
}
