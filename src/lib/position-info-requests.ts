/**
 * Missing-information requests as queue work.
 *
 * When the recruiting team needs one detail to keep sourcing, that gap used to
 * go out as an email and sit for days. Here it is a queue item that names the
 * exact brief field, why it is needed and what it unblocks — and it is
 * answerable in the product, which is the whole point.
 *
 * This module is pure. It owns:
 *  - the closed set of brief fields a request may point at,
 *  - the validation for each one, reusing the intake rules so an answer that
 *    would be rejected at intake is rejected here too,
 *  - the patch that writes the answer back into the brief,
 *  - the plain-English wait and impact lines.
 *
 * A request that cannot be answered here does not exist: an unknown field key
 * is treated as an error, never rendered as "your recruiter has a question".
 */

import { MAX_REQUIREMENT_CHARS, MIN_JD_TEXT } from "./express-intake-schema";
import { MAX_DEAL_BREAKER_CHARS } from "./client-deal-breakers";

export type InfoRequestStatus = "open" | "answered" | "cancelled";

/** Where an answer lands in the stored brief. */
export type BriefTarget =
  | { kind: "column"; column: string }
  | { kind: "context"; key: string }
  | { kind: "compensation"; key: string }
  | { kind: "requirements"; tag: "must_have" | "nice_to_have" | "trainable" }
  | { kind: "deal_breakers" };

export type BriefFieldSpec = {
  /** Stable key stored on the request row. */
  key: string;
  /** How the field is named to the client, matching the intake wording. */
  label: string;
  /** What the recruiting team cannot do until this is answered. */
  unblocks: string;
  /** The kind of control the answer form should show. */
  input: "text" | "textarea" | "number" | "choice";
  choices?: Array<{ value: string; label: string }>;
  placeholder?: string;
  target: BriefTarget;
  /** Same rules as the intake field this updates. */
  validate: (raw: string) => { ok: true; value: unknown } | { ok: false; error: string };
};

const text =
  (min: number, max: number, error: string) =>
  (raw: string): { ok: true; value: unknown } | { ok: false; error: string } => {
    const v = raw.trim();
    if (v.length < min) return { ok: false, error: error };
    if (v.length > max) return { ok: false, error: `Keep it under ${max} characters` };
    return { ok: true, value: v };
  };

const choice =
  (values: string[]) =>
  (raw: string): { ok: true; value: unknown } | { ok: false; error: string } => {
    const v = raw.trim();
    if (!values.includes(v)) return { ok: false, error: "Choose one of the options" };
    return { ok: true, value: v };
  };

const wholeNumber =
  (min: number, max: number) =>
  (raw: string): { ok: true; value: unknown } | { ok: false; error: string } => {
    const v = raw.trim().replace(/[,\s]/g, "");
    if (v === "") return { ok: false, error: "Enter a number" };
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, error: "Enter a whole number" };
    if (n < min || n > max) return { ok: false, error: `Enter a number between ${min} and ${max}` };
    return { ok: true, value: n };
  };

const list =
  (maxChars: number, maxItems: number) =>
  (raw: string): { ok: true; value: unknown } | { ok: false; error: string } => {
    const items = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (items.length === 0) return { ok: false, error: "Add at least one line" };
    if (items.length > maxItems) return { ok: false, error: `Keep it to ${maxItems} lines or fewer` };
    const tooLong = items.find((i) => i.length > maxChars);
    if (tooLong) return { ok: false, error: `Keep each line under ${maxChars} characters` };
    return { ok: true, value: items };
  };

/**
 * The fields a request may point at. Adding a field here is what makes it
 * requestable — and answerable — anywhere in the product.
 */
export const ANSWERABLE_BRIEF_FIELDS: BriefFieldSpec[] = [
  {
    key: "salary_range",
    label: "Compensation range",
    unblocks: "approaching candidates, who ask about pay in the first conversation",
    input: "text",
    placeholder: "e.g. 55000-70000",
    target: { kind: "compensation", key: "range" },
    validate: (raw) => {
      const parts = raw.split(/[-–to]+/i).map((p) => p.trim().replace(/[,\s]/g, ""));
      const [minRaw, maxRaw] = [parts[0] ?? "", parts[1] ?? ""];
      const min = Number(minRaw);
      const max = Number(maxRaw);
      if (!minRaw || !maxRaw || !Number.isFinite(min) || !Number.isFinite(max)) {
        return { ok: false, error: "Give a bottom and a top, for example 55000-70000" };
      }
      if (min <= 0 || max <= 0) return { ok: false, error: "Use figures above zero" };
      if (max < min) return { ok: false, error: "The top of the range must be at least the bottom" };
      return { ok: true, value: { min, max } };
    },
  },
  {
    key: "location",
    label: "Where the role is based",
    unblocks: "filtering candidates by where they can actually work",
    input: "text",
    placeholder: "e.g. London, or Lisbon (remote within Portugal)",
    target: { kind: "column", column: "location" },
    validate: text(2, 120, "Name a city, region or country"),
  },
  {
    key: "work_model",
    label: "How the role works",
    unblocks: "telling candidates whether they need to be on site",
    input: "choice",
    choices: [
      { value: "onsite", label: "On site" },
      { value: "hybrid", label: "Hybrid" },
      { value: "remote", label: "Remote" },
    ],
    target: { kind: "column", column: "work_model" },
    validate: choice(["onsite", "hybrid", "remote"]),
  },
  {
    key: "onsite_days",
    label: "Days on site each week",
    unblocks: "screening out candidates who cannot commute that often",
    input: "number",
    target: { kind: "context", key: "onsite_days" },
    validate: wholeNumber(0, 5),
  },
  {
    key: "sponsorship_available",
    label: "Visa sponsorship",
    unblocks: "deciding which candidates are eligible before we contact them",
    input: "choice",
    choices: [
      { value: "yes", label: "Yes, we can sponsor" },
      { value: "no", label: "No, candidates need existing authorisation" },
    ],
    target: { kind: "context", key: "sponsorship_available" },
    validate: choice(["yes", "no"]),
  },
  {
    key: "must_haves",
    label: "Must-have requirements",
    unblocks: "scoring candidates against what actually matters to you",
    input: "textarea",
    placeholder: "One per line",
    target: { kind: "requirements", tag: "must_have" },
    validate: list(MAX_REQUIREMENT_CHARS, 6),
  },
  {
    key: "deal_breakers",
    label: "Deal-breakers",
    unblocks: "rejecting the wrong profiles before they reach you",
    input: "textarea",
    placeholder: "One per line",
    target: { kind: "deal_breakers" },
    validate: list(MAX_DEAL_BREAKER_CHARS, 5),
  },
  {
    key: "interview_process",
    label: "Interview process",
    unblocks: "telling candidates what to expect and booking your team in",
    input: "textarea",
    placeholder: "Stages, who is involved, and roughly how long each takes",
    target: { kind: "context", key: "interview_process" },
    validate: text(10, 1200, "Describe the stages in a sentence or two"),
  },
  {
    key: "decision_maker",
    label: "Who makes the final decision",
    unblocks: "getting an offer signed off without chasing",
    input: "text",
    target: { kind: "context", key: "decision_maker" },
    validate: text(2, 120, "Name the person who signs off the hire"),
  },
  {
    key: "target_start_date",
    label: "Ideal start date",
    unblocks: "prioritising candidates who can start when you need them",
    input: "text",
    placeholder: "e.g. 1 September, or as soon as possible",
    target: { kind: "context", key: "target_start_date_note" },
    validate: text(2, 60, "Give a date or a rough timeframe"),
  },
  {
    key: "why_open",
    label: "Why the role is open",
    unblocks: "pitching the role honestly to strong candidates",
    input: "textarea",
    target: { kind: "context", key: "why_open" },
    validate: text(10, 600, "A sentence is enough"),
  },
  {
    key: "job_description",
    label: "Job description",
    unblocks: "building the scoring rubric for this role",
    input: "textarea",
    target: { kind: "column", column: "description" },
    validate: text(MIN_JD_TEXT, 20000, `Paste at least ${MIN_JD_TEXT} characters`),
  },
];

const BY_KEY = new Map(ANSWERABLE_BRIEF_FIELDS.map((f) => [f.key, f]));

export function briefField(key: string): BriefFieldSpec | null {
  return BY_KEY.get(key) ?? null;
}

export function isAnswerableField(key: string): boolean {
  return BY_KEY.has(key);
}

export type InfoRequestRow = {
  id: string;
  position_id: string | null;
  brief_field: string;
  question: string;
  why_needed: string | null;
  unblocks: string | null;
  asked_by_name: string | null;
  created_at: string;
  status: InfoRequestStatus;
};

/**
 * The serializable shape a card renders from. It deliberately carries no field
 * spec: the client resolves that from `brief_field` with `briefField()`, so
 * nothing unserializable crosses the wire.
 */
export type InfoRequestCard = InfoRequestRow & {
  /** Field name in the client's words, even when the key is unknown to this build. */
  field_label: string;
  /** "Waiting on you since 3 March" — never a bare timestamp. */
  waiting_label: string;
  days_waiting: number;
  /** The delivery effect, in plain words. */
  impact: string;
  /** False when this build cannot render an answer form for the field. */
  answerable: boolean;
};

const DAY = 86_400_000;

export function daysWaiting(since: string, now: Date = new Date()): number {
  const t = new Date(since).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY));
}

export function waitingSinceLabel(since: string, now: Date = new Date()): string {
  const t = new Date(since);
  if (!Number.isFinite(t.getTime())) return "Waiting on you";
  const date = t.toLocaleDateString(undefined, { day: "numeric", month: "long" });
  const d = daysWaiting(since, now);
  if (d <= 0) return `Waiting on you since today`;
  return `Waiting on you since ${date} — ${d} ${d === 1 ? "day" : "days"}`;
}

/** The delivery consequence, stated without drama and without vagueness. */
export function impactLine(row: InfoRequestRow, now: Date = new Date()): string {
  const field = briefField(row.brief_field);
  const unblocks = row.unblocks?.trim() || field?.unblocks || null;
  const d = daysWaiting(row.created_at, now);
  const held = d >= 1 ? ` Sourcing has been held for ${d} ${d === 1 ? "day" : "days"}.` : "";
  return unblocks
    ? `Your answer unblocks ${unblocks}.${held}`
    : `Your answer lets the recruiting team keep sourcing.${held}`;
}

export function toInfoRequestCard(row: InfoRequestRow, now: Date = new Date()): InfoRequestCard {
  const field = briefField(row.brief_field);
  return {
    ...row,
    field_label: field?.label ?? row.brief_field.replace(/_/g, " "),
    waiting_label: waitingSinceLabel(row.created_at, now),
    days_waiting: daysWaiting(row.created_at, now),
    impact: impactLine(row, now),
    answerable: field !== null,
  };
}

/**
 * Turn a validated answer into the patch that updates the brief.
 *
 * Returns the pieces to merge, never a whole row, so an answer can only ever
 * touch the field it was asked about.
 */
export function briefPatch(
  field: BriefFieldSpec,
  value: unknown,
  current: {
    compensation?: unknown;
    intake_context?: unknown;
    requirements?: unknown;
    preferred_requirements?: unknown;
    dealbreakers?: unknown;
  },
): Record<string, unknown> {
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};

  switch (field.target.kind) {
    case "column":
      return { [field.target.column]: value };
    case "context":
      return { intake_context: { ...obj(current.intake_context), [field.target.key]: value } };
    case "compensation": {
      const comp = obj(current.compensation);
      if (field.key === "salary_range" && value && typeof value === "object") {
        const { min, max } = value as { min: number; max: number };
        return {
          compensation: { ...comp, min, max, undecided: false, collected_at: new Date().toISOString() },
        };
      }
      return { compensation: { ...comp, [field.target.key]: value } };
    }
    case "requirements": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      const rows = items.map((label, i) => ({ label, kind: field.target.kind === "requirements" ? (field.target as { tag: string }).tag : "must_have", rank: i + 1 }));
      return field.target.tag === "must_have"
        ? { requirements: rows }
        : { preferred_requirements: rows };
    }
    case "deal_breakers": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      return {
        dealbreakers: items,
        intake_context: { ...obj(current.intake_context), deal_breaker_list: items },
      };
    }
  }
}
