// "Where we are" role progress — a five-stage tracker in client language.
//
// Briefed > Sourcing > Screening > Shortlist > Offer
//
// RULES:
//  - Client vocabulary only. No canonical states, score runs, integrity status.
//  - A stage only gets a date when a real record proves it was entered.
//  - Pure module: no server imports, safe on both sides.

export const ROLE_PROGRESS_STAGES = [
  "briefed",
  "sourcing",
  "screening",
  "shortlist",
  "offer",
] as const;

export type RoleProgressStage = (typeof ROLE_PROGRESS_STAGES)[number];

export const ROLE_PROGRESS_LABELS: Record<RoleProgressStage, string> = {
  briefed: "Briefed",
  sourcing: "Sourcing",
  screening: "Screening",
  shortlist: "Shortlist",
  offer: "Offer",
};

export const ROLE_PROGRESS_HINTS: Record<RoleProgressStage, string> = {
  briefed: "Role details confirmed with your team",
  sourcing: "We're reaching out to candidates",
  screening: "Candidates are being reviewed against your brief",
  shortlist: "Shortlisted candidates are with you",
  offer: "An offer is in play",
};

export type RoleProgressInput = {
  /** Position status (active | approved | draft | paused | closed | archived). */
  status: string;
  /** When the role was created / brief captured. */
  briefedAt?: string | null;
  /** When sourcing started — published or first outreach. */
  sourcingStartedAt?: string | null;
  /** First time a candidate was screened for this role. */
  screeningStartedAt?: string | null;
  /** First time a candidate reached your shortlist. */
  shortlistStartedAt?: string | null;
  /** First time a candidate reached offer. */
  offerStartedAt?: string | null;
};

export type RoleProgressStep = {
  key: RoleProgressStage;
  label: string;
  hint: string;
  state: "done" | "current" | "upcoming";
  enteredAt: string | null;
};

export type RoleProgress = {
  steps: RoleProgressStep[];
  currentIndex: number;
  currentLabel: string;
  /** ISO date the current stage was entered, when known. */
  currentEnteredAt: string | null;
  /** True when the role is paused/closed — the tracker is frozen. */
  inactive: boolean;
  /** Short caption, e.g. "Screening since 12 Mar". */
  caption: string;
};

function earliest(...values: Array<string | null | undefined>): string | null {
  const list = values.filter((v): v is string => Boolean(v)).sort();
  return list[0] ?? null;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "12 Mar" for this year, "12 Mar 2025" otherwise. Empty string when unknown. */
export function formatStageDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function computeRoleProgress(
  input: RoleProgressInput,
  now: Date = new Date(),
): RoleProgress {
  const status = (input.status ?? "").toLowerCase();
  const inactive = ["paused", "closed", "archived"].includes(status);
  const isDraft = status === "draft";

  // Each stage inherits the earliest date of any later stage it must precede,
  // so the tracker never shows a later stage starting before an earlier one.
  const offerAt = input.offerStartedAt ?? null;
  const shortlistAt = earliest(input.shortlistStartedAt, offerAt);
  const screeningAt = earliest(input.screeningStartedAt, shortlistAt);
  const sourcingAt = earliest(input.sourcingStartedAt, screeningAt);
  const briefedAt = earliest(input.briefedAt, sourcingAt);

  const dates: Record<RoleProgressStage, string | null> = {
    briefed: briefedAt,
    sourcing: isDraft ? null : sourcingAt,
    screening: screeningAt,
    shortlist: shortlistAt,
    offer: offerAt,
  };

  // Current stage = furthest stage with a real date (draft roles stay on Briefed).
  let currentIndex = 0;
  if (!isDraft) {
    for (let i = ROLE_PROGRESS_STAGES.length - 1; i >= 0; i -= 1) {
      if (dates[ROLE_PROGRESS_STAGES[i]]) {
        currentIndex = i;
        break;
      }
    }
  }

  const steps: RoleProgressStep[] = ROLE_PROGRESS_STAGES.map((key, i) => ({
    key,
    label: ROLE_PROGRESS_LABELS[key],
    hint: ROLE_PROGRESS_HINTS[key],
    state: i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
    enteredAt: i <= currentIndex ? dates[key] : null,
  }));

  const currentLabel = ROLE_PROGRESS_LABELS[ROLE_PROGRESS_STAGES[currentIndex]];
  const currentEnteredAt = dates[ROLE_PROGRESS_STAGES[currentIndex]];
  const since = formatStageDate(currentEnteredAt, now);

  let caption: string;
  if (status === "paused") caption = `Paused at ${currentLabel.toLowerCase()}`;
  else if (status === "closed" || status === "archived") caption = "Role closed";
  else if (isDraft) caption = "Brief in progress";
  else caption = since ? `${currentLabel} since ${since}` : currentLabel;

  return { steps, currentIndex, currentLabel, currentEnteredAt, inactive, caption };
}
