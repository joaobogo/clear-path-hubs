import {
  addBusinessDays,
  type SourcingMetrics,
  type LaunchChannel,
  type LaunchStage,
  type RoleLaunchState,
} from "@/lib/role-launch";

/**
 * Derives the Role Setup timeline and Search Channels panel from real rows.
 *
 * The caller passes records it has already fetched under RLS, so this stays a
 * pure function: easy to test and impossible to use for a privilege escape.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/** Business days from live activation to the first candidate batch. */
const FIRST_BATCH_BUSINESS_DAYS = 3;

export interface RoleLaunchInputs {
  position: AnyRow;
  campaigns: AnyRow[];
  matchCount: number;
  deliveredAt: string | null;
  applicationCount: number;
  /** outreach_touches rows for this position (already RLS-scoped). */
  touches?: AnyRow[];
  /** Where the delivered candidates came from: source_kind -> count. */
  attribution?: Array<{ label: string; count: number }>;
}

export function computeRoleLaunchState({
  position,
  campaigns,
  matchCount,
  deliveredAt,
  applicationCount,
  touches = [],
  attribution = [],
}: RoleLaunchInputs): RoleLaunchState {
  const status = String(position?.status ?? "draft");
  const bpStatus = String(position?.blueprint_status ?? "none");
  const createdAt: string | null = position?.created_at ?? null;
  const publishedAt: string | null = position?.published_at ?? null;
  const approvedAt: string | null = position?.approved_at ?? null;
  const confirmedAt: string | null = position?.blueprint_confirmed_at ?? null;
  const generatedAt: string | null = position?.blueprint_generated_at ?? null;

  const isLive = status === "active";
  const isPaused = status === "paused";
  const isClosed = status === "filled" || status === "closed" || status === "archived";
  const liveAt = publishedAt ?? (isLive ? approvedAt : null);

  // ── Role Setup timeline ───────────────────────────────────────────────────
  const stages: LaunchStage[] = [];

  stages.push({
    key: "received",
    label: "Role received",
    state: "done",
    at: createdAt,
    detail: "We have your requisition.",
  });

  stages.push({
    key: "analyzing",
    label: "Analysing the job description",
    state:
      bpStatus === "failed"
        ? "attention"
        : bpStatus === "ready"
          ? "done"
          : bpStatus === "none"
            ? "done"
            : "active",
    at: generatedAt,
    detail:
      bpStatus === "failed"
        ? "Automatic reading didn't complete — TaaSFlow is processing this brief in the background."
        : bpStatus === "ready"
          ? "Blueprint generated from your job description."
          : bpStatus === "none"
            ? "Built from the details you entered."
            : "TaaSFlow is analysing this talent market.",
  });

  const briefDone = Boolean(confirmedAt) || Boolean(approvedAt) || isLive;
  stages.push({
    key: "brief",
    label: "Search brief confirmed",
    state: briefDone ? "done" : bpStatus === "ready" ? "active" : "pending",
    at: confirmedAt ?? approvedAt,
    detail: briefDone
      ? "Targeting, must-haves and dealbreakers are locked in."
      : "Review the blueprint and confirm so sourcing can start.",
  });

  const hasCampaign = campaigns.length > 0;
  stages.push({
    key: "channels",
    label: "Channel mix selected",
    state: hasCampaign ? "done" : briefDone ? "active" : "pending",
    at: hasCampaign ? earliest(campaigns.map((c) => c.started_at ?? c.created_at)) : null,
    detail: hasCampaign
      ? `${campaigns.length} channel${campaigns.length === 1 ? "" : "s"} activated for this role.`
      : "The channel mix is being optimised for this role.",
  });

  const qualityDone = Boolean(approvedAt) || isLive;
  stages.push({
    key: "quality",
    label: "Strategy quality check",
    state: qualityDone ? "done" : briefDone ? "active" : "pending",
    at: approvedAt,
    detail: qualityDone
      ? "Your sourcing strategy is ready."
      : "TaaSFlow validates every sourcing strategy before activation.",
  });

  stages.push({
    key: "live",
    label: isClosed ? "Role closed" : isPaused ? "Role paused" : "Role live",
    state: isClosed ? "done" : isPaused ? "attention" : isLive ? "done" : "pending",
    at: liveAt ?? position?.closed_at ?? null,
    detail: isClosed
      ? "This search is complete."
      : isPaused
        ? "Sourcing is on hold. Resume it whenever you're ready."
        : isLive
          ? "Candidate discovery is active."
          : "Starts as soon as the quality check passes.",
  });

  stages.push({
    key: "discovery",
    label: "Candidate discovery",
    state: isPaused ? "attention" : isLive ? (matchCount > 0 ? "done" : "active") : "pending",
    at: liveAt,
    detail:
      applicationCount > 0
        ? `${applicationCount} application${applicationCount === 1 ? "" : "s"} received so far.`
        : "Discovery, outreach and screening are running.",
  });

  const expected = liveAt ? (addBusinessDays(new Date(liveAt), FIRST_BATCH_BUSINESS_DAYS)?.toISOString() ?? null) : null;
  const overdue = Boolean(expected) && !deliveredAt && new Date(expected!) < new Date();
  stages.push({
    key: "first_expected",
    label: "First candidates expected",
    state: deliveredAt ? "done" : overdue ? "attention" : expected ? "active" : "pending",
    at: expected,
    detail: deliveredAt
      ? "Delivered."
      : overdue
        ? "Running longer than planned — the channel mix is being re-optimised."
        : "Typically within three business days of going live.",
  });

  stages.push({
    key: "candidates",
    label: "Candidates delivered",
    state: matchCount > 0 ? "done" : "pending",
    at: deliveredAt,
    detail:
      matchCount > 0
        ? `${matchCount} candidate${matchCount === 1 ? "" : "s"} in your pipeline.`
        : "You'll be notified the moment the first batch lands.",
  });

  // ── Search channels ───────────────────────────────────────────────────────
  const channels: LaunchChannel[] = [];

  const CHANNEL_LABELS: Record<string, string> = {
    linkedin: "Professional network sourcing",
    email: "Direct email outreach",
    phone: "Direct calls",
    sms: "SMS outreach",
    referral: "Referral network",
    event: "Events and communities",
    other: "Additional channels",
  };

  for (const c of campaigns) {
    const st = String(c.status ?? "draft");
    channels.push({
      key: `campaign:${c.id}`,
      label: c.name || CHANNEL_LABELS[String(c.channel)] || "Sourcing channel",
      state:
        st === "active"
          ? "active"
          : st === "paused"
            ? "paused"
            : st === "completed" || st === "archived"
              ? "connected"
              : "preparing",
      evidence:
        st === "active"
          ? "Outreach is running on this channel."
          : st === "paused"
            ? "Paused for this role."
            : st === "completed" || st === "archived"
              ? "This channel has finished its run."
              : "Being activated by the engine.",
      at: c.started_at ?? c.created_at ?? null,
    });
  }

  // TaaSFlow talent database — evidenced by matches, or by the role being live.
  channels.push({
    key: "talent_database",
    label: "TaaSFlow talent database",
    state: matchCount > 0 ? "active" : isPaused ? "paused" : isLive ? "preparing" : "planned",
    evidence:
      matchCount > 0
        ? `${matchCount} matched profile${matchCount === 1 ? "" : "s"} from our database.`
        : isLive
          ? "Matching our talent datasets against your brief."
          : "Starts when your role goes live.",
    at: liveAt,
  });

  // Public job board — evidenced by an actual publication.
  const publiclyListed = String(position?.visibility ?? "public") === "public" && Boolean(publishedAt);
  channels.push({
    key: "job_board",
    label: "TaaSFlow job board and inbound",
    state: publiclyListed ? "active" : isLive ? "preparing" : "planned",
    evidence: publiclyListed
      ? applicationCount > 0
        ? `Listed publicly · ${applicationCount} application${applicationCount === 1 ? "" : "s"}.`
        : "Listed publicly and accepting applications."
      : "Your role is not published publicly yet.",
    at: publishedAt,
  });

  const headline = isClosed
    ? "This search is closed."
    : isPaused
      ? "Sourcing is paused."
      : matchCount > 0
        ? "New candidates require review."
        : isLive
          ? "Candidate discovery is active."
          : briefDone
            ? "Your sourcing strategy is in final validation."
            : "TaaSFlow is analysing this talent market.";

  const metrics = computeSourcingMetrics({
    touches,
    matchCount,
    applicationCount,
    isLive,
    isPaused,
    isClosed,
    attribution,
    campaignCount: campaigns.length,
    campaigns,
  });

  return {
    stages,
    channels,
    metrics,
    firstCandidatesExpected: expected,
    delayed: overdue,
    headline,
  };
}

function earliest(values: Array<string | null | undefined>): string | null {
  const times = values
    .filter((v): v is string => typeof v === "string" && v !== "")
    .sort();
  return times[0] ?? null;
}


/**
 * Verified sourcing metrics. A metric is `null` — rendered as "No verified
 * data yet" — whenever no record exists to back it. Zero is only used when
 * the engine is running and the true count really is zero.
 */
function computeSourcingMetrics({
  touches,
  matchCount,
  applicationCount,
  isLive,
  isPaused,
  isClosed,
  attribution,
  campaignCount,
  campaigns = [],
}: {
  touches: AnyRow[];
  matchCount: number;
  applicationCount: number;
  isLive: boolean;
  isPaused: boolean;
  isClosed: boolean;
  attribution: Array<{ label: string; count: number }>;
  campaignCount: number;
  /** Campaign rows may carry admin-verified manual counters. */
  campaigns?: AnyRow[];
}): SourcingMetrics {
  const real = touches.filter((t) => !t.is_test_record);
  // Admin-entered counters for channels the platform cannot instrument
  // (offline media, partner sourcing). Only summed when a value is recorded.
  const manual = (key: string): number | null => {
    const vals = campaigns
      .filter((c) => !c.is_test_record)
      .map((c) => c[key] as number | null | undefined)
      .filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const manualIdentified = manual("manual_identified");
  const manualContacted = manual("manual_contacted");
  const manualEngaged = manual("manual_engaged");
  const manualReplied = manual("manual_replied");
  const hasOutreach = real.length > 0;

  const identifiedIds = new Set(
    real
      .map((t) => t.candidate_profile_id as string | null)
      .filter((v): v is string => Boolean(v)),
  );
  const contacted = real.filter((t) => Boolean(t.sent_at)).length;
  const engaged = real.filter(
    (t) => Boolean(t.engagement_state) || Boolean(t.delivered_at),
  ).length;
  const replied = real.filter((t) => Boolean(t.replied_at)).length;

  const running = isLive || hasOutreach;

  const timestamps = real
    .map((t) => (t.replied_at ?? t.delivered_at ?? t.sent_at ?? t.created_at) as string | null)
    .filter((v): v is string => Boolean(v))
    .sort();
  const lastUpdate = timestamps.length ? timestamps[timestamps.length - 1]! : null;

  const nextAction = isClosed
    ? "This search is closed. No further sourcing is scheduled."
    : isPaused
      ? "Sourcing is paused. Resume the role to restart discovery."
      : !isLive
        ? "TaaSFlow is finalising the sourcing strategy for this role."
        : matchCount > 0
          ? "New candidates require review; discovery continues in parallel."
          : hasOutreach
            ? "The channel mix is being optimised based on response data."
            : campaignCount > 0
              ? "Candidate discovery is activating across the selected channels."
              : "TaaSFlow is analysing this talent market to set the channel mix.";

  return {
    identified: manualIdentified ?? (hasOutreach ? identifiedIds.size : running ? 0 : null),
    contacted: manualContacted ?? (hasOutreach ? contacted : running ? 0 : null),
    engaged: manualEngaged ?? (hasOutreach ? engaged : running ? 0 : null),
    replied: manualReplied ?? (hasOutreach ? replied : running ? 0 : null),
    applicants: running || applicationCount > 0 ? applicationCount : null,
    qualified: running || matchCount > 0 ? matchCount : null,
    lastUpdate,
    nextAction,
    attribution,
  };
}
