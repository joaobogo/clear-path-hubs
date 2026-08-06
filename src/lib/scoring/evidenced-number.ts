/**
 * No number without its evidence — Prompt 23.
 *
 * Every surface that shows a score, a coverage figure or a count must also
 * carry the criteria behind it and a path to the evidence. This makes that
 * structural: a bare number has no way to be rendered, including in exports,
 * digests and emails.
 */

export type EvidencePath =
  | { kind: "route"; to: string }
  | { kind: "absolute_url"; url: string };

export type EvidencedNumber = {
  /** The figure itself. */
  value: number;
  /** How to read it: "Fit", "Must-haves met", etc. */
  label: string;
  /** One line naming the criteria behind the figure. */
  criteria_summary: string;
  /** Where a human goes to see the evidence. Never optional. */
  evidence: EvidencePath;
  /** Named uncertainty travelling with the figure, when any. */
  caveat?: string | null;
};

export class NumberWithoutEvidence extends Error {
  constructor(label: string) {
    super(
      `"${label}" cannot be shown as a bare number. Attach the criteria summary and a path to its evidence.`,
    );
    this.name = "NumberWithoutEvidence";
  }
}

export function evidencedNumber(input: {
  value: number | null | undefined;
  label: string;
  criteria_summary: string;
  evidence: EvidencePath | null | undefined;
  caveat?: string | null;
}): EvidencedNumber | null {
  if (typeof input.value !== "number" || !Number.isFinite(input.value)) return null;
  if (!input.criteria_summary.trim() || !input.evidence) {
    throw new NumberWithoutEvidence(input.label);
  }
  return {
    value: input.value,
    label: input.label,
    criteria_summary: input.criteria_summary.trim(),
    evidence: input.evidence,
    caveat: input.caveat?.trim() || null,
  };
}

/** Resolves an evidence path to something an email or CSV can carry. */
export function evidenceHref(path: EvidencePath, origin?: string): string {
  if (path.kind === "absolute_url") return path.url;
  return origin ? `${origin.replace(/\/$/, "")}${path.to}` : path.to;
}

/** Spreadsheet cell text: the figure never travels alone. */
export function csvCells(
  n: EvidencedNumber,
  origin?: string,
): { value: string; criteria: string; evidence: string } {
  return {
    value: String(n.value),
    criteria: n.caveat ? `${n.criteria_summary} (${n.caveat})` : n.criteria_summary,
    evidence: evidenceHref(n.evidence, origin),
  };
}

/** Email and digest line: figure, criteria and link in one readable sentence. */
export function emailLine(n: EvidencedNumber, origin?: string): string {
  const caveat = n.caveat ? ` ${n.caveat}.` : "";
  return `${n.label}: ${n.value} — ${n.criteria_summary}.${caveat} See the evidence: ${evidenceHref(n.evidence, origin)}`;
}
