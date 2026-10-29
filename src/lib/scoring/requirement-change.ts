/**
 * What changed in a role's criteria, and which matches a change re-queues.
 *
 * Pure, so the rules are tested without a database. The server half
 * (requirement-change-rescore.server.ts) reads the rows, calls these, and
 * writes the queue, the audit trail and the admin notification.
 */
import { criteriaLabels } from "./protected-attributes";

export type ScreeningQuestionSnapshot = {
  id?: string | null;
  question?: string | null;
  answer_type?: string | null;
  required?: boolean | null;
  dealbreaker?: boolean | null;
  must_have?: string | null;
  preferred_answer?: unknown;
};

export type CriteriaSnapshot = {
  requirements?: unknown;
  preferred_requirements?: unknown;
  dealbreakers?: unknown;
  screening_questions?: ScreeningQuestionSnapshot[] | null;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function labels(v: unknown): string[] {
  return criteriaLabels(v).map(norm);
}

/** What a stored requirement row means to the scorer: its wording and its kind. */
function requirementRows(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r) => {
      if (typeof r === "string") return norm(r);
      if (!r || typeof r !== "object") return "";
      const o = r as Record<string, unknown>;
      const label = norm(String(o.label ?? o.text ?? ""));
      if (!label) return "";
      return `${label}|${String(o.kind ?? "")}|${o.filters === false ? "nf" : ""}`;
    })
    .filter(Boolean);
}

function questionRows(qs: ScreeningQuestionSnapshot[] | null | undefined): string[] {
  return (qs ?? [])
    .map((q) =>
      [
        norm(String(q.question ?? "")),
        q.answer_type ?? "",
        q.required ? "req" : "",
        q.dealbreaker ? "db" : "",
        norm(String(q.must_have ?? "")),
        JSON.stringify(q.preferred_answer ?? null),
      ].join("|"),
    )
    .filter((r) => !r.startsWith("|"));
}

/**
 * A stable fingerprint of everything that changes a score or an eligibility
 * decision. Two saves with the same fingerprint are the same change, so the
 * rescore and the notification happen once.
 */
export function criteriaSignature(s: CriteriaSnapshot): string {
  const body = JSON.stringify({
    r: requirementRows(s.requirements).sort(),
    p: requirementRows(s.preferred_requirements).sort(),
    d: labels(s.dealbreakers).sort(),
    q: questionRows(s.screening_questions).sort(),
  });
  // FNV-1a, 32-bit: short, stable, no crypto needed for an idempotency key.
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function diff(before: string[], after: string[]): { added: number; removed: number } {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: [...a].filter((x) => !b.has(x)).length,
    removed: [...b].filter((x) => !a.has(x)).length,
  };
}

export type CriteriaChange = {
  changed: boolean;
  /** The parts that moved, as short phrases: "must-haves +1 −1". */
  parts: string[];
  /** True when a dealbreaker question changed, so eligibility must be recomputed. */
  eligibilityAffected: boolean;
  signature: string;
};

export function describeCriteriaChange(before: CriteriaSnapshot, after: CriteriaSnapshot): CriteriaChange {
  const parts: string[] = [];
  const phrase = (name: string, d: { added: number; removed: number }) => {
    if (d.added === 0 && d.removed === 0) return;
    const bits = [d.added ? `+${d.added}` : "", d.removed ? `−${d.removed}` : ""].filter(Boolean);
    parts.push(`${name} ${bits.join(" ")}`);
  };
  phrase("must-haves", diff(requirementRows(before.requirements), requirementRows(after.requirements)));
  phrase(
    "preferred requirements",
    diff(requirementRows(before.preferred_requirements), requirementRows(after.preferred_requirements)),
  );
  phrase("deal-breakers", diff(labels(before.dealbreakers), labels(after.dealbreakers)));
  const qBefore = questionRows(before.screening_questions);
  const qAfter = questionRows(after.screening_questions);
  phrase("screening questions", diff(qBefore, qAfter));
  const dbBefore = qBefore.filter((q) => q.includes("|db|")).sort();
  const dbAfter = qAfter.filter((q) => q.includes("|db|")).sort();
  const signature = criteriaSignature(after);
  return {
    changed: criteriaSignature(before) !== signature,
    parts,
    eligibilityAffected: JSON.stringify(dbBefore) !== JSON.stringify(dbAfter),
    signature,
  };
}

/** Matches still in flight are left to finish; their staleness flag covers them. */
const IN_FLIGHT = new Set(["parsing", "enriching", "scoring"]);
/**
 * A CV that could not be read waits for staff: re-queuing it would retry a
 * failed read (and possibly a billed OCR) automatically.
 */
const NEEDS_STAFF = new Set(["ocr_required", "failed", "provider_blocked"]);
/** Stages where a new score changes nothing anyone acts on. */
const CLOSED_STAGES = new Set(["hired", "archived"]);

export type MatchForRequeue = {
  id: string;
  processing_state?: string | null;
  stage?: string | null;
  rescore_queued_at?: string | null;
};

/**
 * The matches a criteria change re-queues, and why the rest are left. A match
 * already queued for this change (rescore_queued_at at or after the change)
 * is not queued twice.
 */
export function selectMatchesToRequeue(
  matches: MatchForRequeue[],
  changedAt: string,
): { queue: string[]; skipped: Array<{ id: string; reason: string }> } {
  const queue: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  for (const m of matches) {
    const state = String(m.processing_state ?? "");
    if (IN_FLIGHT.has(state)) skipped.push({ id: m.id, reason: "in_flight" });
    else if (NEEDS_STAFF.has(state)) skipped.push({ id: m.id, reason: "cv_needs_staff" });
    else if (CLOSED_STAGES.has(String(m.stage ?? ""))) skipped.push({ id: m.id, reason: "closed_stage" });
    else if (state === "ready_to_score" && m.rescore_queued_at && m.rescore_queued_at >= changedAt)
      skipped.push({ id: m.id, reason: "already_queued" });
    else queue.push(m.id);
  }
  return { queue, skipped };
}

/** The admin notification: one line a reviewer can act on. */
export function rescoreSummary(args: {
  title: string;
  parts: string[];
  queued: number;
  skipped: number;
}): { title: string; body: string } {
  const what = args.parts.length > 0 ? args.parts.join("; ") : "criteria edited";
  const who =
    args.queued === 0
      ? "No candidates needed rescoring."
      : `${args.queued} candidate${args.queued === 1 ? "" : "s"} queued for rescoring through the full pipeline.`;
  const left =
    args.skipped > 0
      ? ` ${args.skipped} left as they are (in progress, CV awaiting staff, or hired/archived).`
      : "";
  return {
    title: `Requirements changed — ${args.title}`,
    body: `${what}. ${who}${left} Scores stay as they are until the new run completes; nothing is approved or shown to the client by this.`,
  };
}
