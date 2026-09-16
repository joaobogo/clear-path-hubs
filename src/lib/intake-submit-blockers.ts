/**
 * Everything that would stop an intake submit, in the client's own words.
 *
 * The review panel models what the client has ANSWERED: a required field with
 * no value goes in `missing`, gets named at the top of the panel and disables
 * submit. That shape cannot describe a CONFLICT — two fields that are each
 * filled in and cannot both be true. So when "Not decided yet" was ticked
 * while a salary range was still filled in, the review counted zero missing
 * answers, the button rendered enabled, and clicking it auto-saved and did
 * nothing else; the only trace was a small inline note beside the button
 * (audit 16 Sep, INT-001).
 *
 * The fix is not another list of rules. It is to ask the SAME validator submit
 * asks, about the SAME payload, and render whatever it says. A rule cannot be
 * added to the schema and forgotten here, because there is nothing here to
 * forget — the rules all live in `expressIntakeSchema`.
 *
 * Pure: no React, no DOM.
 */
import { expressIntakeSchema } from "@/lib/express-intake-schema";

export type IntakeSubmitBlocker = {
  /** Form field key, for focus and for de-duplicating against `missing`. */
  field: string;
  /** The message shown to the client, straight from the rule that failed. */
  message: string;
};

/**
 * @param payload      Exactly what submit would send.
 * @param alreadyNamed Fields the review already lists as missing answers. They
 *                     are skipped so a client is not told the same thing twice.
 * @param extraErrors  Checks the form applies on top of the schema (placement
 *                     and interview-process rules). Undefined values are
 *                     ignored, so callers can pass their raw result.
 */
export function intakeSubmitBlockers(
  payload: unknown,
  alreadyNamed: readonly string[] = [],
  extraErrors: Record<string, string | undefined> = {},
): IntakeSubmitBlocker[] {
  const out: IntakeSubmitBlocker[] = [];
  const seen = new Set<string>(alreadyNamed);

  const add = (field: string, message: string | undefined) => {
    if (!message || seen.has(field)) return;
    seen.add(field);
    out.push({ field, message });
  };

  const parsed = expressIntakeSchema.safeParse(payload);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      add(String(issue.path[0] ?? "form"), issue.message);
    }
  }

  for (const [field, message] of Object.entries(extraErrors)) add(field, message);

  return out;
}
