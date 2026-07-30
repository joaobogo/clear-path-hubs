import {
  addBusinessDays,
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
}

export function computeRoleLaunchState({
  position,
  campaigns,
  matchCount,
  deliveredAt,
  applicationCount,
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
        ? "We could not read the file automatically — a specialist is doing it by hand."
        : bpStatus === "ready"
          ? "Blueprint generated from your job description."
          : bpStatus === "none"
            ? "Built from the details you entered."
            : "Reading your job description now.",
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
    label: "Search channels prepared",
    state: hasCampaign ? "done" : briefDone ? "active" : "pending",
    at: hasCampaign ? earliest(campaigns.map((c) => c.started_at ?? c.created_at)) : null,
    detail: hasCampaign
      ? `${campaigns.length} channel${campaigns.length === 1 ? "" : "s"} set up for this role.`
      : "Your recruiter is selecting the channels for this search.",
  });

  const qualityDone = Boolean(approvedAt) || isLive;
  stages.push({
    key: "quality",
    label: "Recruiter quality check",
    state: qualityDone ? "done" : briefDone ? "active" : "pending",
    at: approvedAt,
    detail: qualityDone
      ? "A TaaSFlow recruiter signed off on the brief."
      : "A recruiter reviews every role before it goes live.",
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
          ? "Sourcing and outreach are running."
          : "Starts as soon as the quality check passes.",
  });

  stages.push({
    key: "discovery",
    label: "Active sourcing and outreach",
    state: isPaused ? "attention" : isLive ? (matchCount > 0 ? "done" : "active") : "pending",
    at: liveAt,
    detail:
      applicationCount > 0
        ? `${applicationCount} application${applicationCount === 1 ? "" : "s"} received so far.`
        : "Searching, contacting and screening candidates.",
  });

  const expected = liveAt
    ? addBusinessDays(new Date(liveAt), FIRST_BATCH_BUSINESS_DAYS).toISOString()
    : null;
  const overdue = Boolean(expected) && !deliveredAt && new Date(expected!) < new Date();
  stages.push({
    key: "first_expected",
    label: "First candidates expected",
    state: deliveredAt ? "done" : overdue ? "attention" : expected ? "active" : "pending",
    at: expected,
    detail: deliveredAt
      ? "Delivered."
      : overdue
        ? "Taking longer than planned. Your recruiter has been notified."
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
            ? "Paused by your recruiter."
            : st === "completed" || st === "archived"
              ? "This channel has finished its run."
              : "Being set up by your recruiter.",
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
          ? "Screening our existing talent pool against your brief."
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
        ? "Candidates are in your pipeline."
        : isLive
          ? "Your role is live and sourcing is under way."
          : briefDone
            ? "Final recruiter check before your role goes live."
            : "We're preparing your search brief.";

  return {
    stages,
    channels,
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
