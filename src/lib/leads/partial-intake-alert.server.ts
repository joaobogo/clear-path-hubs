/**
 * Incomplete-intake alerts. SERVER ONLY.
 *
 * A client who starts the intake and stops is still a lead. As soon as an
 * autosave carries anything we can act on (a name, a work email, a company or
 * a role title) staff get the contact plus exactly how far the person got.
 *
 * Idempotency is per draft AND per step, so progress produces at most one
 * email per step reached — never one per keystroke or per autosave tick.
 */
import { processLeadEvent } from "./lead-pipeline.server";

const STEP_LABELS = [
  "Step 1 — company and contact",
  "Step 2 — the role",
  "Step 3 — requirements and process",
  "Step 4 — review and submit",
];

function text(value: unknown, max = 300): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return v.slice(0, max);
}

function joinName(payload: Record<string, unknown>): string | null {
  const name = [text(payload["firstName"], 80), text(payload["lastName"], 80)]
    .filter(Boolean)
    .join(" ");
  return name || text(payload["contactName"], 160);
}

export type PartialIntakeAlertInput = {
  /** Stable per-draft identifier (token hash or user id). */
  draftKey: string;
  payload: Record<string, unknown>;
  lastStep: number;
  /** "anonymous_draft" | "account_draft" */
  source: string;
  sourcePage?: string | null;
};

/**
 * Fires the alert when the draft has something actionable. Never throws — a
 * notification problem must not break the client's autosave.
 */
export async function alertPartialIntake(input: PartialIntakeAlertInput): Promise<void> {
  try {
    const p = input.payload ?? {};
    const fullName = joinName(p);
    const email = text(p["workEmail"], 255);
    const company = text(p["companyName"], 160);
    const roleTitle = text(p["roleTitle"], 160);

    // Nothing identifiable yet — no alert, no noise.
    if (!fullName && !email && !company && !roleTitle) return;

    const step = Math.max(0, Math.min(input.lastStep ?? 0, STEP_LABELS.length - 1));
    const stepLabel = STEP_LABELS[step] ?? `Step ${step + 1}`;

    await processLeadEvent({
      leadType: "partial_intake",
      sourceId: `${input.draftKey}:${step}`,
      source: input.source,
      sourcePage: input.sourcePage ?? "/intake",
      fullName,
      email,
      company,
      phone: text(p["phone"], 40),
      message:
        "This intake is still in progress and has not been submitted. The details below are what the client has entered so far.",
      facts: [
        { label: "Status", value: "Started, not submitted" },
        { label: "Furthest step reached", value: stepLabel },
        { label: "Role title", value: roleTitle },
        { label: "Company website", value: text(p["companyWebsite"], 255) },
        { label: "Contact title", value: text(p["contactTitle"], 120) },
        { label: "Work model", value: text(p["workModel"], 40) },
        { label: "Location", value: text(p["location"], 160) },
      ],
      recordTable: "intake_draft",
      recordId: input.draftKey.slice(0, 32),
      crmStatus: "not_applicable",
    });
  } catch (err) {
    console.error("[leads] partial intake alert failed", err);
  }
}
