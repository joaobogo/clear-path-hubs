/**
 * Side-by-side candidate comparison (max three columns).
 *
 * Hard rules:
 *  - Only client-visible fields. No score, band, percentile, rank or any
 *    "recommended winner" — the builder deliberately has no ranking output.
 *  - Rows where every candidate reads identically collapse under "Same for all".
 */

export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;

export type CompareCandidate = {
  match_id: string;
  stage: string;
  candidate: {
    display_name: string;
    location: string | null;
    availability: string | null;
    years_experience: number | null;
    current_role: string | null;
    current_company: string | null;
  };
  requirement_rows: Array<{
    label: string;
    importance: "must_have" | "preferred";
    status: string;
  }>;
  experience: Array<{ title: string; company: string | null; period: string | null }>;
  work_authorization: string | null;
};

export type CompareCellKind = "list" | "text";

export type CompareRow = {
  key: string;
  label: string;
  kind: CompareCellKind;
  /** One entry per candidate, in the same order as the input. */
  values: Array<{ matchId: string; lines: string[] }>;
  /** True when every candidate reads identically. */
  same: boolean;
};

export type Comparison = {
  candidates: Array<{ matchId: string; name: string; subtitle: string | null }>;
  /** Rows that differ between candidates — shown first. */
  differing: CompareRow[];
  /** Rows identical across candidates — collapsed under "Same for all". */
  identical: CompareRow[];
};

const MET_STATUSES = new Set(["met", "strong", "evidenced", "partial"]);
const MISSING_STATUSES = new Set(["missing", "not_evidenced", "gap", "contradicted"]);

function clean(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function stageLabel(stage: string): string {
  const s = clean(stage).toLowerCase();
  const map: Record<string, string> = {
    delivered: "Awaiting your review",
    shortlisted: "Shortlisted",
    interview_process: "Interviewing",
    interview: "Interviewing",
    offer: "Offer out",
    hired: "Hired",
    not_moving_forward: "Not moving forward",
  };
  return map[s] ?? (s ? s.replace(/_/g, " ") : "In progress");
}

function mustHaves(c: CompareCandidate, met: boolean): string[] {
  const set = met ? MET_STATUSES : MISSING_STATUSES;
  return c.requirement_rows
    .filter((r) => r.importance === "must_have" && set.has(clean(r.status).toLowerCase()))
    .map((r) => clean(r.label))
    .filter(Boolean);
}

function relevantExperience(c: CompareCandidate): string[] {
  const lines = c.experience.slice(0, 3).map((e) => {
    const head = [clean(e.title), clean(e.company)].filter(Boolean).join(" · ");
    const period = clean(e.period);
    return period ? `${head} (${period})` : head;
  });
  const years = c.candidate.years_experience;
  if (years != null && Number.isFinite(years)) {
    lines.unshift(`${years} years total experience`);
  }
  return lines.filter(Boolean);
}

function fingerprint(lines: string[]): string {
  return lines.map((l) => l.toLowerCase()).join("|");
}

/**
 * Build the comparison view for two or three candidates. Extra candidates
 * beyond MAX_COMPARE are ignored rather than silently ranked.
 */
export function buildComparison(input: CompareCandidate[]): Comparison {
  const candidates = input.slice(0, MAX_COMPARE);

  const rowDefs: Array<{ key: string; label: string; kind: CompareCellKind; get: (c: CompareCandidate) => string[] }> = [
    {
      key: "must_met",
      label: "Must-haves met",
      kind: "list",
      get: (c) => {
        const v = mustHaves(c, true);
        return v.length ? v : ["None recorded yet"];
      },
    },
    {
      key: "must_missing",
      label: "Must-haves missing",
      kind: "list",
      get: (c) => {
        const v = mustHaves(c, false);
        return v.length ? v : ["None"];
      },
    },
    {
      key: "experience",
      label: "Relevant experience",
      kind: "list",
      get: (c) => {
        const v = relevantExperience(c);
        return v.length ? v : ["Not recorded"];
      },
    },
    {
      key: "availability",
      label: "Availability",
      kind: "text",
      get: (c) => [clean(c.candidate.availability) || "Not confirmed"],
    },
    {
      key: "location",
      label: "Location",
      kind: "text",
      get: (c) => [clean(c.candidate.location) || "Not recorded"],
    },
    {
      key: "work_auth",
      label: "Work authorisation",
      kind: "text",
      get: (c) => [clean(c.work_authorization) || "Not recorded"],
    },
    {
      key: "stage",
      label: "Current stage",
      kind: "text",
      get: (c) => [stageLabel(c.stage)],
    },
  ];

  const rows: CompareRow[] = rowDefs.map((def) => {
    const values = candidates.map((c) => ({ matchId: c.match_id, lines: def.get(c) }));
    const first = values.length > 0 ? fingerprint(values[0].lines) : "";
    const same = values.length > 1 && values.every((v) => fingerprint(v.lines) === first);
    return { key: def.key, label: def.label, kind: def.kind, values, same };
  });

  return {
    candidates: candidates.map((c) => ({
      matchId: c.match_id,
      name: c.candidate.display_name,
      subtitle:
        [clean(c.candidate.current_role), clean(c.candidate.current_company)]
          .filter(Boolean)
          .join(" · ") || null,
    })),
    differing: rows.filter((r) => !r.same),
    identical: rows.filter((r) => r.same),
  };
}
