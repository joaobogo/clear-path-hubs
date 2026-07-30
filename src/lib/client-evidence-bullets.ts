import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

export type EvidenceBullet = {
  /** The role requirement this evidence answers. */
  requirement: string;
  /** Verified snippet drawn from the candidate's own record. */
  detail: string;
  /** Verified = requirement fully met with evidence; partial = evidenced but incomplete. */
  strength: "verified" | "partial";
};

function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function truncate(s: string, max = 130): string {
  const t = clean(s);
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Three evidence bullets tied to the role's requirements, evidence-first.
 *
 * Only requirements backed by an actual snippet or explanation from the
 * candidate record qualify — nothing is inferred, and no scoring internals
 * (numbers, engine states, contradiction status) ever leak into the text.
 * Must-haves outrank preferred; fully met outranks partial.
 */
export function selectEvidenceBullets(
  c: Pick<ClientCandidateDTO, "requirement_rows" | "evidence" | "strengths">,
  limit = 3,
): EvidenceBullet[] {
  const rank = (r: ClientCandidateDTO["requirement_rows"][number]) =>
    (r.importance === "must_have" ? 0 : 2) + (r.status === "met" ? 0 : 1);

  const fromRequirements = c.requirement_rows
    .filter((r) => r.status === "met" || r.status === "partial")
    .map((r) => {
      const snippet = clean(r.evidence.find((e) => clean(e.snippet))?.snippet);
      const detail = snippet || clean(r.explanation);
      return { row: r, detail };
    })
    .filter((x) => x.detail.length > 0)
    .sort((a, b) => rank(a.row) - rank(b.row))
    .map<EvidenceBullet>((x) => ({
      requirement: clean(x.row.label),
      detail: truncate(x.detail),
      strength: x.row.status === "met" ? "verified" : "partial",
    }));

  const bullets = [...fromRequirements];

  // Fall back to labelled evidence captured against the role, then to
  // qualitative strengths — still evidence from the record, never a score.
  if (bullets.length < limit) {
    for (const e of c.evidence) {
      if (bullets.length >= limit) break;
      const detail = clean(e.snippet);
      const requirement = clean(e.label);
      if (!detail || !requirement) continue;
      if (bullets.some((b) => b.requirement.toLowerCase() === requirement.toLowerCase())) continue;
      bullets.push({ requirement, detail: truncate(detail), strength: "verified" });
    }
  }

  if (bullets.length < limit) {
    for (const s of c.strengths) {
      if (bullets.length >= limit) break;
      const detail = clean(s);
      if (!detail) continue;
      if (bullets.some((b) => b.detail.toLowerCase() === detail.toLowerCase())) continue;
      bullets.push({ requirement: "Strength", detail: truncate(detail), strength: "partial" });
    }
  }

  return bullets.slice(0, limit);
}

/** Must-haves with no evidence yet — shown as an honest gap, not a score. */
export function unevidencedMustHaves(
  c: Pick<ClientCandidateDTO, "requirement_rows">,
  limit = 2,
): string[] {
  return c.requirement_rows
    .filter(
      (r) =>
        r.importance === "must_have" &&
        (r.status === "not_evidenced" || r.status === "contradicted"),
    )
    .map((r) => clean(r.label))
    .filter(Boolean)
    .slice(0, limit);
}

export type FitChip = { label: string; value: string; tone: "good" | "watch" | "neutral" };

/** Availability, location and compensation fit — the three practical filters. */
export function fitChips(c: ClientCandidateDTO): FitChip[] {
  const chips: FitChip[] = [];

  const availability = clean(c.candidate.availability);
  if (availability) {
    chips.push({ label: "Available", value: availability, tone: "neutral" });
  }

  const location = clean(c.candidate.location);
  if (location) {
    const value = c.candidate.timezone ? `${location} · ${clean(c.candidate.timezone)}` : location;
    chips.push({ label: "Based in", value, tone: "neutral" });
  }

  const comp = c.compensation_alignment;
  const expectation = clean(comp.candidate_expectation);
  if (comp.verdict !== "unknown" || expectation) {
    const value =
      comp.verdict === "aligned"
        ? expectation
          ? `${expectation} · in range`
          : "In range"
        : comp.verdict === "over"
          ? expectation
            ? `${expectation} · above range`
            : "Above range"
          : comp.verdict === "under"
            ? expectation
              ? `${expectation} · below range`
              : "Below range"
            : expectation;
    if (value) {
      chips.push({
        label: "Comp",
        value,
        tone: comp.verdict === "aligned" ? "good" : comp.verdict === "over" ? "watch" : "neutral",
      });
    }
  }

  return chips;
}
