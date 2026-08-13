import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { RequirementRow, RequirementStatus } from "@/lib/client-fit-presentation";

/**
 * Where a claim came from, in the client's own vocabulary. Every bullet we
 * show a client must carry one of these — no unattributed assertions.
 */
export type ClaimSource =
  | "CV"
  | "Screening call"
  | "Verified reference"
  | "Application answers"
  | "Recruiter notes";

export type RationaleVerdict = "met" | "partial" | "gap" | "not_applicable";

export type RationaleLine = {
  id: string;
  /** The requirement exactly as captured at intake. */
  requirement: string;
  importance: "must_have" | "preferred";
  verdict: RationaleVerdict;
  /** Plain-language outcome for this single requirement. */
  verdictLabel: string;
  /** The claim itself — quoted or paraphrased from the record. Null when nothing is evidenced. */
  claim: string | null;
  /** True when a claim was found but only repeats the requirement; no quote is rendered. */
  underReview: boolean;
  /** Attribution for the claim; empty when there is nothing to attribute. */
  sources: ClaimSource[];
};

export type ShortlistRationale = {
  /** One line per requirement captured at intake, must-haves first. */
  lines: RationaleLine[];
  /** Lines that carry a claim and a source — the "why". */
  evidenced: RationaleLine[];
  /** Must-haves with nothing behind them yet — stated openly, never hidden. */
  gaps: RationaleLine[];
  /** e.g. "5 of 7 requirements evidenced" — counts, not scores. */
  summary: string;
};

function clean(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function truncate(s: string, max = 160): string {
  const t = clean(s);
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Normalise text for comparison, ignoring case, punctuation and spacing. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** A claim that only restates the requirement is not evidence. */
function isClaimEcho(requirement: string, claim: string): boolean {
  const req = norm(requirement);
  const cl = norm(claim);
  return !req || !cl || cl === req || cl.startsWith(`${req} `);
}

/**
 * Map whatever the record labelled a source as onto the four things a client
 * recognises. Unknown provenance is attributed to recruiter notes rather than
 * silently upgraded to "verified".
 */
export function normaliseSource(raw: string | null | undefined): ClaimSource {
  const s = clean(raw).toLowerCase();
  if (!s) return "Recruiter notes";
  if (/(reference|referee|backchannel|verified by)/.test(s)) return "Verified reference";
  if (/(screen|call|interview|conversation|phone)/.test(s)) return "Screening call";
  if (/(applica|questionnaire|form|answer)/.test(s)) return "Application answers";
  if (/(cv|resume|résumé|profile|document|experience|employment|education)/.test(s)) return "CV";
  return "Recruiter notes";
}

const VERDICT_LABEL: Record<RationaleVerdict, string> = {
  met: "Meets this",
  partial: "Partly meets this",
  gap: "Not evidenced yet",
  not_applicable: "Not applicable",
};

function toVerdict(status: RequirementStatus): RationaleVerdict {
  if (status === "met") return "met";
  if (status === "partial") return "partial";
  if (status === "not_applicable") return "not_applicable";
  return "gap"; // not_evidenced + contradicted both read as "not evidenced" to clients
}

/** Screening answers that mention the requirement, used as a secondary source. */
function screeningClaim(
  requirement: string,
  answers: Array<{ question: string; answer: string }>,
): string | null {
  const needle = clean(requirement).toLowerCase();
  if (needle.length < 3) return null;
  const hit = answers.find(
    (a) =>
      clean(a.answer).length > 0 &&
      (clean(a.question).toLowerCase().includes(needle) ||
        clean(a.answer).toLowerCase().includes(needle)),
  );
  return hit ? clean(hit.answer) : null;
}

/**
 * Explain a recommendation strictly in the client's own criteria.
 *
 * One line per requirement captured at intake — nothing invented, nothing
 * omitted — each carrying the claim and where it came from. Scores, engine
 * states and ranking internals never appear here.
 */
export function buildShortlistRationale(
  c: Pick<ClientCandidateDTO, "requirement_rows" | "screening_answers" | "evidence">,
): ShortlistRationale {
  const answers = c.screening_answers ?? [];

  // Run-level evidence indexed by label, used only when a requirement row has none.
  const evidenceIndex = new Map<string, string>();
  for (const e of c.evidence ?? []) {
    const key = clean(e.label).toLowerCase();
    if (key && clean(e.snippet) && !evidenceIndex.has(key)) {
      evidenceIndex.set(key, clean(e.snippet));
    }
  }

  const toLine = (r: RequirementRow): RationaleLine => {
    const verdict = toVerdict(r.status);
    const sources = new Set<ClaimSource>();

    let claim = "";
    const withSnippet = (r.evidence ?? []).filter((e) => clean(e.snippet));
    for (const e of withSnippet) {
      sources.add(normaliseSource(e.source));
      if (!claim) claim = clean(e.snippet);
    }

    if (!claim) {
      const fromRun = evidenceIndex.get(clean(r.label).toLowerCase());
      if (fromRun) {
        claim = fromRun;
        sources.add("CV");
      }
    }

    const fromScreening = screeningClaim(r.label, answers);
    if (fromScreening) {
      sources.add("Application answers");
      if (!claim) claim = fromScreening;
    }

    if (!claim && clean(r.explanation)) {
      claim = clean(r.explanation);
      sources.add("Recruiter notes");
    }

    return {
      id: r.id,
      requirement: clean(r.label),
      importance: r.importance,
      verdict,
      verdictLabel: VERDICT_LABEL[verdict],
      claim: claim ? truncate(claim) : null,
      sources: claim ? [...sources] : [],
    };
  };

  const order = (l: RationaleLine) =>
    (l.importance === "must_have" ? 0 : 4) +
    ({ met: 0, partial: 1, gap: 2, not_applicable: 3 } as const)[l.verdict];

  const lines = (c.requirement_rows ?? [])
    .filter((r) => clean(r.label))
    .map(toLine)
    .sort((a, b) => order(a) - order(b));

  const evidenced = lines.filter((l) => l.claim !== null && l.verdict !== "gap");
  const gaps = lines.filter((l) => l.verdict === "gap" && l.importance === "must_have");

  const counted = lines.filter((l) => l.verdict !== "not_applicable");
  const summary =
    counted.length === 0
      ? "Your requirements are still being mapped for this candidate."
      : `${evidenced.length} of ${counted.length} of your requirements evidenced`;

  return { lines, evidenced, gaps, summary };
}
