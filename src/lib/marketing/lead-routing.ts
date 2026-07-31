/**
 * Lead routing and scoring — Part 7, prompt 50.
 *
 * Pure functions shared by the public capture path (scores a lead at the
 * moment it lands) and the staff queue (recomputes nothing, just reads).
 *
 * The rule is deliberately legible: vertical, seniority, volume and urgency
 * decide the owner, the follow-up window and the opening message. No hidden
 * weighting, no invented "AI lead score".
 */

export type LeadSeniority = "junior" | "mid" | "senior" | "executive" | "unknown";
export type LeadVolume = "one" | "two_to_five" | "six_to_ten" | "eleven_plus" | "unknown";
export type LeadUrgency = "immediate" | "this_quarter" | "exploring" | "unknown";

export type LeadPriority = "p1" | "p2" | "p3";

export type LeadSignals = {
  verticalSlug?: string | null;
  seniority?: LeadSeniority | null;
  volume?: LeadVolume | null;
  urgency?: LeadUrgency | null;
  /** "call" outranks a passive download. */
  kind?: string | null;
  email?: string | null;
};

export type LeadRouting = {
  score: number;
  priority: LeadPriority;
  ownerDesk: string;
  /** Minutes from arrival until a first human reply is late. */
  responseMinutes: number;
  firstResponseDueAt: string;
  suggestedFirstMessage: string;
  reasons: string[];
};

export const SENIORITY_LABEL: Record<Exclude<LeadSeniority, "unknown">, string> = {
  junior: "Junior / early career",
  mid: "Mid-level",
  senior: "Senior / lead",
  executive: "Director or above",
};

export const VOLUME_LABEL: Record<Exclude<LeadVolume, "unknown">, string> = {
  one: "1 role",
  two_to_five: "2–5 roles",
  six_to_ten: "6–10 roles",
  eleven_plus: "11+ roles",
};

export const URGENCY_LABEL: Record<Exclude<LeadUrgency, "unknown">, string> = {
  immediate: "Need to start now",
  this_quarter: "This quarter",
  exploring: "Exploring options",
};

/** Verticals where a mis-hire carries regulatory or safety weight. */
const REGULATED = new Set([
  "healthcare",
  "healthtech",
  "pharmaceutical",
  "biotech",
  "medical-devices",
  "finance",
  "fintech",
  "investment-banking",
  "insurance",
  "accounting",
  "legal",
  "aviation",
  "energy",
  "oil-gas",
  "utilities",
  "construction",
  "government",
  "defence",
  "defense",
  "education",
]);

const FREE_EMAIL = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "live.com",
  "aol.com",
  "gmx.com",
  "mail.com",
]);

const SENIORITY_POINTS: Record<LeadSeniority, number> = {
  executive: 30,
  senior: 22,
  mid: 12,
  junior: 6,
  unknown: 8,
};

const VOLUME_POINTS: Record<LeadVolume, number> = {
  eleven_plus: 30,
  six_to_ten: 24,
  two_to_five: 16,
  one: 8,
  unknown: 8,
};

const URGENCY_POINTS: Record<LeadUrgency, number> = {
  immediate: 25,
  this_quarter: 15,
  exploring: 5,
  unknown: 8,
};

export function isWorkEmail(email?: string | null): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return !FREE_EMAIL.has(domain);
}

export function priorityFromScore(score: number): LeadPriority {
  if (score >= 70) return "p1";
  if (score >= 45) return "p2";
  return "p3";
}

export function responseMinutesFor(priority: LeadPriority): number {
  if (priority === "p1") return 60;
  if (priority === "p2") return 4 * 60;
  return 24 * 60;
}

export const PRIORITY_LABEL: Record<LeadPriority, string> = {
  p1: "Reply within the hour",
  p2: "Reply within 4 hours",
  p3: "Reply within one business day",
};

function deskFor(signals: LeadSignals, verticalName: string): string {
  if (signals.seniority === "executive") return "Executive search desk";
  if (signals.volume === "eleven_plus" || signals.volume === "six_to_ten") {
    return "Volume hiring desk";
  }
  if (signals.verticalSlug && REGULATED.has(signals.verticalSlug)) {
    return `${verticalName} regulated desk`;
  }
  return `${verticalName} desk`;
}

function titleCaseSlug(slug?: string | null): string {
  if (!slug) return "Core";
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function openingMessage(
  signals: LeadSignals,
  verticalName: string,
  priority: LeadPriority,
): string {
  const bits: string[] = [];
  const who = signals.seniority && signals.seniority !== "unknown"
    ? SENIORITY_LABEL[signals.seniority].toLowerCase()
    : null;
  const many = signals.volume && signals.volume !== "unknown"
    ? VOLUME_LABEL[signals.volume].toLowerCase()
    : null;

  bits.push(
    `Thanks for getting in touch about ${verticalName.toLowerCase()} hiring${
      many ? ` — ${many}` : ""
    }${who ? ` at ${who} level` : ""}.`,
  );

  if (signals.urgency === "immediate") {
    bits.push("You said you need to start now, so I've held time today to scope it with you.");
  } else if (signals.urgency === "this_quarter") {
    bits.push("You're planning for this quarter, so let's shape the brief before the window closes.");
  } else {
    bits.push("You're still weighing options, so no pitch — just the honest picture of what we can and can't do here.");
  }

  bits.push(
    priority === "p1"
      ? "Two questions so we don't waste your time: what does the role have to deliver in the first 90 days, and what has stopped the hire so far?"
      : "One question to start: what does this role have to deliver in the first 90 days?",
  );

  return bits.join(" ");
}

export function routeLead(signals: LeadSignals, now: Date = new Date()): LeadRouting {
  const seniority = signals.seniority ?? "unknown";
  const volume = signals.volume ?? "unknown";
  const urgency = signals.urgency ?? "unknown";
  const verticalName = titleCaseSlug(signals.verticalSlug);

  const reasons: string[] = [];
  let score =
    SENIORITY_POINTS[seniority] + VOLUME_POINTS[volume] + URGENCY_POINTS[urgency];

  reasons.push(`Seniority ${seniority} (+${SENIORITY_POINTS[seniority]})`);
  reasons.push(`Volume ${volume} (+${VOLUME_POINTS[volume]})`);
  reasons.push(`Urgency ${urgency} (+${URGENCY_POINTS[urgency]})`);

  if (signals.verticalSlug && REGULATED.has(signals.verticalSlug)) {
    score += 8;
    reasons.push("Regulated vertical (+8)");
  }
  if (isWorkEmail(signals.email)) {
    score += 5;
    reasons.push("Company email address (+5)");
  }
  if (signals.kind === "call") {
    score += 5;
    reasons.push("Asked for a call (+5)");
  }

  score = Math.max(0, Math.min(100, score));
  const priority = priorityFromScore(score);
  const responseMinutes = responseMinutesFor(priority);

  return {
    score,
    priority,
    ownerDesk: deskFor(signals, verticalName),
    responseMinutes,
    firstResponseDueAt: new Date(now.getTime() + responseMinutes * 60_000).toISOString(),
    suggestedFirstMessage: openingMessage(signals, verticalName, priority),
    reasons,
  };
}
