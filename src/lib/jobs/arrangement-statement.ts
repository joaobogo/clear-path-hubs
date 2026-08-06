/**
 * Location, work model and time zone as ONE honest sentence.
 *
 * The same sentence is used on the job page, the role brief and every channel
 * variant, so a candidate never reads two different versions of the same
 * arrangement. "Remote" alone is never publishable when a country or overlap
 * restriction exists, and hybrid without a day count is incomplete.
 */

export type ArrangementInput = {
  work_model?: string | null;
  /** Hybrid only: required on-site days a week. */
  onsite_days?: number | null;
  /** Office or base locations, in the client's own words. */
  location?: string | null;
  /** Countries or regions the employer can actually employ in. */
  eligible_locations?: string[] | null;
  /** Named zone the overlap is measured against, e.g. "CET". */
  primary_timezone?: string | null;
  /** Hours of overlap required against that zone. */
  timezone_overlap_hours?: number | null;
  /** Travel expectation, stated by the client only. */
  travel_expectation?: string | null;
};

export type ArrangementGap = {
  key: "work_model" | "onsite_days" | "eligible_locations" | "overlap_zone" | "location";
  /** What the client reads. One question, no jargon. */
  question: string;
};

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * What still has to be answered before this arrangement can be published.
 * Missing stays missing — nothing here is inferred from the company address,
 * the industry or the title.
 */
export function arrangementGaps(input: ArrangementInput): ArrangementGap[] {
  const gaps: ArrangementGap[] = [];
  const model = text(input.work_model);
  const overlap = num(input.timezone_overlap_hours);

  if (!model) {
    gaps.push({
      key: "work_model",
      question: "Is this role remote, hybrid or on-site?",
    });
  }
  if (model === "hybrid" && num(input.onsite_days) === null) {
    gaps.push({
      key: "onsite_days",
      question: "How many days a week are required on-site?",
    });
  }
  if (model === "remote" && list(input.eligible_locations).length === 0) {
    gaps.push({
      key: "eligible_locations",
      question: "Which countries or regions can you employ someone in?",
    });
  }
  if ((model === "hybrid" || model === "onsite") && !text(input.location)) {
    gaps.push({ key: "location", question: "Which office or city is this role based in?" });
  }
  if (overlap !== null && overlap > 0 && !text(input.primary_timezone)) {
    gaps.push({
      key: "overlap_zone",
      question: "Which time zone should those overlap hours be measured against?",
    });
  }
  return gaps;
}

/**
 * The publishable sentence. Returns null when a gap remains — callers show
 * the gaps rather than a half-true statement.
 */
export function arrangementStatement(input: ArrangementInput): string | null {
  if (arrangementGaps(input).length > 0) return null;

  const model = text(input.work_model);
  const place = text(input.location);
  const eligible = list(input.eligible_locations);
  const zone = text(input.primary_timezone);
  const overlap = num(input.timezone_overlap_hours);
  const travel = text(input.travel_expectation);
  const days = num(input.onsite_days);

  const clauses: string[] = [];

  if (model === "remote") {
    clauses.push(
      eligible.length === 1
        ? `Remote, and we can only employ someone in ${eligible[0]}`
        : `Remote, and we can only employ someone in ${eligible.slice(0, -1).join(", ")} or ${eligible[eligible.length - 1]}`,
    );
  } else if (model === "hybrid") {
    clauses.push(
      `Hybrid — ${days} ${days === 1 ? "day" : "days"} a week on-site in ${place}`,
    );
  } else if (model === "onsite") {
    clauses.push(`On-site in ${place}, full time`);
  }

  if (overlap !== null && overlap > 0 && zone) {
    clauses.push(`with ${overlap} ${overlap === 1 ? "hour" : "hours"} of daily overlap with ${zone}`);
  }
  if (travel) clauses.push(`Travel: ${travel}`);

  const [first, ...rest] = clauses;
  const head = rest.length > 0 && rest[0].startsWith("with") ? `${first} ${rest[0]}` : first;
  const tail = rest.filter((c) => !c.startsWith("with"));
  return [head, ...tail].join(". ").replace(/\.\.$/, ".").concat(".").replace(/\.\.$/, ".");
}
