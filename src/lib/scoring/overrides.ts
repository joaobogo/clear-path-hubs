/**
 * Overrides — Prompt 28.
 *
 * A human can disagree with any machine outcome. The machine value is never
 * overwritten: the override sits on top, both are retained, a reason is
 * required, and it can be reverted by a named person.
 */

export type OverrideTarget =
  | "criterion_result"
  | "eligibility"
  | "recommendation"
  | "extracted_field";

export type OverrideRecord = {
  target: OverrideTarget;
  /** Which criterion, field or status was overridden. */
  key: string;
  /** What the engine produced. Kept verbatim, forever. */
  machine_value: string;
  /** What the human says instead. */
  human_value: string;
  /** Required. Free text, shown wherever the override is shown. */
  reason: string;
  overridden_by: string;
  overridden_by_name: string;
  overridden_at: string;
  reverted_at?: string | null;
  reverted_by_name?: string | null;
};

export class OverrideReasonRequired extends Error {
  constructor() {
    super("An override needs a reason. Say why the machine value is wrong.");
    this.name = "OverrideReasonRequired";
  }
}

const MIN_REASON = 8;

export function createOverride(input: {
  target: OverrideTarget;
  key: string;
  machine_value: string;
  human_value: string;
  reason: string;
  user_id: string;
  user_name: string;
  now?: Date;
}): OverrideRecord {
  const reason = input.reason.trim();
  if (reason.length < MIN_REASON) throw new OverrideReasonRequired();
  return {
    target: input.target,
    key: input.key,
    machine_value: input.machine_value,
    human_value: input.human_value,
    reason,
    overridden_by: input.user_id,
    overridden_by_name: input.user_name,
    overridden_at: (input.now ?? new Date()).toISOString(),
    reverted_at: null,
    reverted_by_name: null,
  };
}

/** Reverting restores the machine value. It never deletes the override record. */
export function revertOverride(
  record: OverrideRecord,
  user_name: string,
  now = new Date(),
): OverrideRecord {
  return { ...record, reverted_at: now.toISOString(), reverted_by_name: user_name };
}

export function isActive(record: OverrideRecord): boolean {
  return !record.reverted_at;
}

/** The value in force: the human's while active, otherwise the engine's. */
export function effectiveValue(record: OverrideRecord): string {
  return isActive(record) ? record.human_value : record.machine_value;
}

/** Attribution line shown beside any overridden value. */
export function overrideCaption(record: OverrideRecord): string {
  if (!isActive(record)) {
    return `Override reverted by ${record.reverted_by_name ?? "a reviewer"} — showing the assessed value again.`;
  }
  return `Changed from "${record.machine_value}" by ${record.overridden_by_name} — ${record.reason}`;
}

export function activeOverride(
  records: OverrideRecord[],
  target: OverrideTarget,
  key: string,
): OverrideRecord | null {
  return (
    records.find((r) => r.target === target && r.key === key && isActive(r)) ?? null
  );
}
