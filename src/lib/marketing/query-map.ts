/**
 * Target query map — Part 8, prompt 51.
 *
 * Source: Semrush (US database), pulled for this domain before any article
 * was written. Volumes are Semrush estimates, not measured traffic.
 * Difficulty (KD) is 0-100. Our domain currently has 7 ranking keywords and
 * effectively no organic traffic, so everything here is chosen to be winnable
 * from a standing start: KD under ~35, long-tail, buyer intent first.
 *
 * Rules this file enforces:
 *  - One page per distinct intent. Two entries must never target the same
 *    query — that is cannibalisation, and `assertNoDuplicateQueries` fails.
 *  - Every entry names the vertical or service page it must link to, so the
 *    internal linking system (prompt 56) has a source of truth.
 *  - `evidence: "own-data"` means the article is built on TaaSFlow delivery
 *    data with the sample size stated. Those are the flagship pieces.
 */

export type QueryIntent =
  | "commercial" // comparing vendors / ready to buy
  | "cost" // price and budget research
  | "benchmark" // "what is normal?" — our data advantage
  | "operational" // how to run the process
  | "definition"; // category education

export type QueryTarget = {
  /** Primary query the page targets. */
  query: string;
  /** Semrush US monthly search volume estimate. */
  volume: number;
  /** Semrush keyword difficulty, 0-100. */
  kd: number;
  /** Semrush CPC in USD — a proxy for commercial value. */
  cpc: number;
  intent: QueryIntent;
  /** Secondary queries the same page should also satisfy. */
  supporting: string[];
  /** Planned article slug under /blog. */
  slug: string;
  workingTitle: string;
  /** Where the article's evidence comes from. */
  evidence: "own-data" | "editorial";
  /** Internal links this article must carry (prompt 56). */
  linksTo: {
    /** Vertical page slugs under /industries. */
    verticals: string[];
    /** Service/product routes. */
    services: string[];
  };
  priority: 1 | 2 | 3;
};

/**
 * Wave 1 — buyer-intent, low difficulty, winnable now.
 * These are the pages that should exist before anything else.
 */
export const QUERY_MAP: QueryTarget[] = [
  {
    query: "recruitment process outsourcing cost",
    volume: 90,
    kd: 9,
    cpc: 0,
    intent: "cost",
    supporting: [
      "rpo pricing", // 50/mo, KD 12
      "recruitment process outsourcing pricing models", // 50/mo, KD 10
      "recruitment agency fees percentage", // 10/mo, KD 0
    ],
    slug: "recruitment-process-outsourcing-cost",
    workingTitle: "What recruitment process outsourcing actually costs in 2026",
    evidence: "own-data",
    linksTo: { verticals: [], services: ["/pricing", "/how-it-works"] },
    priority: 1,
  },
  {
    query: "how much do recruiters charge",
    volume: 70,
    kd: 20,
    cpc: 12.79,
    intent: "cost",
    supporting: ["recruitment agency fees percentage", "recruitment agency fees uk"],
    slug: "how-much-do-recruiters-charge",
    workingTitle: "How much recruiters charge, and what you get for it",
    evidence: "editorial",
    linksTo: { verticals: [], services: ["/pricing"] },
    priority: 1,
  },
  {
    query: "embedded recruitment",
    volume: 110,
    kd: 4,
    cpc: 22.16,
    intent: "definition",
    supporting: ["recruiting as a service", "subscription recruiting"],
    slug: "embedded-recruitment-explained",
    workingTitle: "Embedded recruitment: what it is and when it beats an agency",
    evidence: "editorial",
    linksTo: { verticals: [], services: ["/platform", "/how-it-works"] },
    priority: 1,
  },
  {
    query: "talent as a service",
    volume: 140,
    kd: 0,
    cpc: 16.39,
    intent: "definition",
    supporting: ["taas team", "recruiting as a service"],
    slug: "talent-as-a-service",
    workingTitle: "Talent as a service: the model, the maths, the limits",
    evidence: "editorial",
    linksTo: { verticals: [], services: ["/platform", "/pricing"] },
    priority: 1,
  },
  {
    query: "rpo vs staffing agency",
    volume: 40,
    kd: 1,
    cpc: 0,
    intent: "commercial",
    supporting: ["in house recruitment vs agency", "recruitment outsourcing for startups"],
    slug: "rpo-vs-staffing-agency",
    workingTitle: "RPO vs staffing agency vs in-house: an honest comparison",
    evidence: "editorial",
    linksTo: { verticals: [], services: ["/pricing", "/solutions"] },
    priority: 1,
  },
  {
    query: "flat fee recruitment",
    volume: 70,
    kd: 19,
    cpc: 12.88,
    intent: "commercial",
    supporting: ["subscription recruiting", "recruitment agency alternative"],
    slug: "flat-fee-recruitment",
    workingTitle: "Flat fee recruitment: where percentage pricing breaks down",
    evidence: "own-data",
    linksTo: { verticals: [], services: ["/pricing"] },
    priority: 2,
  },

  /* ---- Benchmark set: our data advantage (prompt 54) ---- */
  {
    query: "recruiting metrics benchmarks",
    volume: 110,
    kd: 28,
    cpc: 14.73,
    intent: "benchmark",
    supporting: ["cost per hire benchmark", "cost per hire by industry", "hiring benchmarks by industry"],
    slug: "hiring-benchmarks-by-sector",
    workingTitle: "Hiring benchmarks by sector, from our own delivery data",
    evidence: "own-data",
    linksTo: { verticals: ["healthcare", "hospitality", "finance"], services: ["/platform"] },
    priority: 1,
  },
  {
    query: "time to hire vs time to fill",
    volume: 210,
    kd: 38,
    cpc: 4.53,
    intent: "benchmark",
    supporting: ["time to hire benchmark", "how to reduce time to hire", "time to fill by industry"],
    slug: "time-to-hire-vs-time-to-fill",
    workingTitle: "Time to hire vs time to fill: which one your board should track",
    evidence: "own-data",
    linksTo: { verticals: [], services: ["/platform", "/how-it-works"] },
    priority: 2,
  },
  {
    query: "candidate drop off rate",
    volume: 30,
    kd: 0,
    cpc: 0,
    intent: "benchmark",
    supporting: ["why candidates drop out of hiring process", "hiring funnel conversion rates"],
    slug: "where-candidates-drop-out",
    workingTitle: "Where candidates actually drop out, stage by stage",
    evidence: "own-data",
    linksTo: { verticals: [], services: ["/platform"] },
    priority: 1,
  },
  {
    query: "offer acceptance rate benchmark",
    volume: 30,
    kd: 0,
    cpc: 0,
    intent: "benchmark",
    supporting: ["salary expectations vs budget", "job offer negotiation employer"],
    slug: "offer-acceptance-rate-benchmark",
    workingTitle: "Offer acceptance: what we see when salary meets expectation",
    evidence: "own-data",
    linksTo: { verticals: [], services: ["/platform"] },
    priority: 2,
  },
  {
    query: "cost of vacancy calculator",
    volume: 30,
    kd: 0,
    cpc: 0,
    intent: "cost",
    supporting: ["how to reduce cost per hire", "cost of a bad hire"],
    slug: "cost-of-vacancy-calculator",
    workingTitle: "What an open role costs you per week (with the calculator)",
    evidence: "own-data",
    linksTo: { verticals: [], services: ["/pricing", "/intake"] },
    priority: 2,
  },

  /* ---- Operational set: earns links, feeds the product story ---- */
  {
    query: "interview scorecard",
    volume: 390,
    kd: 30,
    cpc: 5.04,
    intent: "operational",
    supporting: ["structured interview scorecard template", "hiring manager scorecard", "interview scoring matrix"],
    slug: "interview-scorecards-guide",
    workingTitle: "The interview scorecard, and how to score without theatre",
    evidence: "editorial",
    linksTo: { verticals: [], services: ["/platform"] },
    priority: 2,
  },
  {
    query: "quality of hire metrics",
    volume: 170,
    kd: 30,
    cpc: 3.76,
    intent: "benchmark",
    supporting: ["recruitment metrics that matter", "recruitment kpi dashboard"],
    slug: "quality-of-hire-metrics",
    workingTitle: "Quality of hire: the only four measures that survive contact",
    evidence: "own-data",
    linksTo: { verticals: [], services: ["/platform"] },
    priority: 3,
  },
  {
    query: "candidate experience survey questions",
    volume: 320,
    kd: 14,
    cpc: 0,
    intent: "operational",
    supporting: ["candidate drop off rate"],
    slug: "candidate-experience-survey-questions",
    workingTitle: "Candidate experience questions worth asking (and acting on)",
    evidence: "editorial",
    linksTo: { verticals: [], services: ["/journey"] },
    priority: 3,
  },
  {
    query: "applicant tracking system for small business",
    volume: 480,
    kd: 24,
    cpc: 72.67,
    intent: "commercial",
    supporting: ["recruitment kpi dashboard", "recruitment agency alternative"],
    slug: "ats-for-small-business",
    workingTitle: "Choosing an ATS when you hire fewer than twenty people a year",
    evidence: "editorial",
    linksTo: { verticals: [], services: ["/platform", "/pricing"] },
    priority: 2,
  },
  {
    query: "rpo companies",
    volume: 720,
    kd: 20,
    cpc: 12.94,
    intent: "commercial",
    supporting: ["rpo vs staffing agency", "recruitment process outsourcing cost"],
    slug: "how-to-choose-an-rpo",
    workingTitle: "How to choose an RPO partner without regretting it in month three",
    evidence: "editorial",
    linksTo: { verticals: [], services: ["/solutions", "/pricing"] },
    priority: 3,
  },
];

/** Queries we deliberately are not chasing, and why. */
export const DECLINED_QUERIES: Array<{ query: string; volume: number | null; reason: string }> = [
  {
    query: "recruitment",
    volume: null,
    reason: "Head term. Our domain has no authority; a page here would never surface.",
  },
  {
    query: "subscription recruiting",
    volume: 0,
    reason: "Zero measured volume. Covered as a supporting term inside the embedded recruitment page.",
  },
  {
    query: "average time to hire 2026",
    volume: 0,
    reason: "Year-stamped queries die annually. Folded into the evergreen benchmark article.",
  },
  {
    query: "hospitality staffing agency cost",
    volume: null,
    reason: "No Semrush volume. Served by the hospitality vertical page, not a separate article.",
  },
];

export const OWN_DATA_SLUGS = QUERY_MAP.filter((q) => q.evidence === "own-data").map((q) => q.slug);

/** Every query claimed anywhere in the map, primary and supporting. */
export function allClaimedQueries(): string[] {
  return QUERY_MAP.flatMap((q) => [q.query, ...q.supporting]);
}

/**
 * Guard against two pages chasing the same phrase. Called by the content
 * tests; throws with the offending queries so it fails loudly, not quietly.
 */
export function assertNoDuplicateQueries(): void {
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const entry of QUERY_MAP) {
    for (const q of [entry.query, ...entry.supporting]) {
      const key = q.toLowerCase().trim();
      const owner = seen.get(key);
      // A supporting term may repeat across pages only if it is nobody's primary.
      const isPrimary = entry.query.toLowerCase().trim() === key;
      if (owner && (isPrimary || QUERY_MAP.some((e) => e.query.toLowerCase().trim() === key))) {
        clashes.push(`"${q}" claimed by both ${owner} and ${entry.slug}`);
      }
      if (!owner) seen.set(key, entry.slug);
    }
  }
  if (clashes.length > 0) {
    throw new Error(`Query map cannibalisation:\n- ${clashes.join("\n- ")}`);
  }
}

export function queryTargetForSlug(slug: string): QueryTarget | undefined {
  return QUERY_MAP.find((q) => q.slug === slug);
}
