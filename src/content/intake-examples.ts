/**
 * Worked examples for the four intake fields clients stall on.
 *
 * Static copy only — written the way a real hiring manager talks. Nothing here
 * is generated at request time, and nothing is pre-filled into a field: the
 * client has to press "Use this" before a single word lands in their brief.
 */

export type IntakeExampleField =
  | "must_haves"
  | "deal_breakers"
  | "why_open"
  | "interview_process";

export type JobFamily =
  | "operations"
  | "sales"
  | "engineering"
  | "finance"
  | "clinical"
  | "hospitality"
  | "generic";

/** Cheap, honest matching: a title we do not recognise gets the generic set. */
const FAMILY_KEYWORDS: Array<{ family: Exclude<JobFamily, "generic">; words: string[] }> = [
  {
    family: "clinical",
    words: ["nurse", "clinical", "care", "physician", "doctor", "medical", "patient", "pharmac"],
  },
  {
    family: "hospitality",
    words: ["hotel", "restaurant", "chef", "hospitality", "front desk", "guest", "housekeep", "food"],
  },
  {
    family: "engineering",
    words: ["engineer", "developer", "software", "devops", "data", "platform", "qa", "architect"],
  },
  {
    family: "finance",
    words: ["finance", "account", "controller", "audit", "treasury", "fp&a", "analyst", "payroll"],
  },
  {
    family: "sales",
    words: ["sales", "account executive", "business development", "revenue", "partnership", "bdr", "sdr"],
  },
  {
    family: "operations",
    words: ["operations", "ops", "supply", "logistics", "warehouse", "plant", "site manager", "general manager"],
  },
];

export function jobFamilyFromTitle(roleTitle: string): JobFamily {
  const title = (roleTitle ?? "").trim().toLowerCase();
  if (!title) return "generic";
  for (const { family, words } of FAMILY_KEYWORDS) {
    if (words.some((w) => title.includes(w))) return family;
  }
  return "generic";
}

type FieldExamples = Record<IntakeExampleField, string[]>;

const GENERIC: FieldExamples = {
  must_haves: [
    "Has done this job at a company our size, not only at a much larger one",
    "Has owned the number, not just reported on it",
    "Can start within six weeks",
  ],
  deal_breakers: [
    "Cannot be on site at least three days a week",
    "Needs more than eight weeks' notice — the gap is already hurting us",
    "No one currently at our two closest competitors",
  ],
  why_open: [
    "The person who held this left in March. Since then two people have been covering it badly and things are slipping.",
    "We grew 40% last year and the team is now the bottleneck. This hire takes half the workload off my plate.",
    "This is a new function. Nobody owns it today, which is exactly the problem.",
  ],
  interview_process: [
    "1. 30 min call with me. 2. 60 min with the team they'd work with. 3. Short task, discussed live. Offer within a week.",
    "1. 45 min with me. 2. Half-day on site meeting the wider team. Decision the same week — we do not drag this out.",
  ],
};

const BY_FAMILY: Record<Exclude<JobFamily, "generic">, FieldExamples> = {
  operations: {
    must_haves: [
      "Has run a site or a shift pattern with 30+ people reporting in",
      "Has cut cost or waste and can say by how much",
      "Comfortable in a business where the process is not written down yet",
    ],
    deal_breakers: [
      "Only ever worked in a head-office role, never on the floor",
      "Cannot cover the occasional weekend escalation",
      "No experience with unionised teams",
    ],
    why_open: [
      "Our two ops leads are covering three sites. This hire owns one site so they can stop firefighting.",
      "We are opening a fourth location in the autumn and nobody has capacity to stand it up.",
    ],
    interview_process: [
      "1. 30 min with me. 2. Site walkaround with the shift leads. 3. 45 min with the MD. Offer same week.",
      "1. 30 min call. 2. Half-day on site, including one shift handover. Decision within two days.",
    ],
  },
  sales: {
    must_haves: [
      "Has carried a quota of $1M+ and hit it two years running",
      "Has sold to the same buyer we sell to, not just the same industry",
      "Has closed deals without a marketing team feeding them leads",
    ],
    deal_breakers: [
      "Only ever worked inbound — we have very few inbound leads",
      "Non-compete that covers our core market",
      "Has never sold a deal above $50k",
    ],
    why_open: [
      "Two reps left within a quarter and pipeline coverage dropped below 2x. We need the territory covered before renewals.",
      "We have proven the motion with founders selling. This hire is the first person whose whole job is selling it.",
    ],
    interview_process: [
      "1. 30 min with me. 2. Live discovery call role-play with a real prospect profile. 3. 30 min with the CEO. Offer within a week.",
      "1. 30 min screen. 2. 60 min territory plan walkthrough. 3. Two customer-facing references. Decision same week.",
    ],
  },
  engineering: {
    must_haves: [
      "Has shipped and then owned a production service on call, not only built features",
      "Strong in TypeScript or Python — we will not retrain the core language",
      "Has worked in a team of five or fewer engineers",
    ],
    deal_breakers: [
      "Wants a purely architectural role with no hands-on code",
      "Cannot overlap at least four hours with UTC+1",
      "No experience with cloud infrastructure at all",
    ],
    why_open: [
      "Our two engineers are spending most of their week on support. This hire takes the platform work so the roadmap moves again.",
      "We built the first version with contractors. This is the first permanent engineer who will own it.",
    ],
    interview_process: [
      "1. 30 min with me. 2. 90 min pairing on a real bug from our backlog, paid. 3. 30 min with the founders. Offer within a week.",
      "1. 30 min screen. 2. System design conversation, no whiteboard puzzles. 3. Team chat. Decision in three days.",
    ],
  },
  finance: {
    must_haves: [
      "Has closed the month end start to finish, not just contributed to it",
      "Qualified (ACA, ACCA, CPA or local equivalent)",
      "Has built a forecast the board actually used",
    ],
    deal_breakers: [
      "Audit practice only, never in-house",
      "Cannot be in the office for month-end week",
      "No experience with multi-currency consolidation",
    ],
    why_open: [
      "Our controller left in February. I have been closing the books myself and it is not sustainable.",
      "We raised in January and reporting expectations changed overnight. Nobody here owns board reporting.",
    ],
    interview_process: [
      "1. 30 min with me. 2. 60 min technical conversation with our external accountants. 3. 30 min with the CEO. Offer within a week.",
      "1. 30 min screen. 2. Short reconciliation exercise using anonymised numbers. 3. Team chat. Decision same week.",
    ],
  },
  clinical: {
    must_haves: [
      "Current registration with the relevant regulator, no gaps",
      "Two years' post-qualification experience in a comparable setting",
      "Has worked a rota that includes nights or weekends",
    ],
    deal_breakers: [
      "Registration lapsed or under review",
      "Cannot work any weekend shifts — the rota does not allow it",
      "No experience with our patient group",
    ],
    why_open: [
      "We are covering three shifts a week with agency staff. This hire replaces that spend with someone permanent.",
      "A new service line opens in September and the rota does not currently cover it.",
    ],
    interview_process: [
      "1. 20 min call with the ward lead. 2. Clinical scenario conversation with two colleagues. 3. Compliance and registration checks. Offer within a week.",
      "1. 30 min screen. 2. Half shift shadowing so both sides know what they are getting. Decision in two days.",
    ],
  },
  hospitality: {
    must_haves: [
      "Has run a property or outlet at our scale — rooms or covers, say the number",
      "Has recruited and kept a team through a full season",
      "Has owned guest scores or reviews and improved them",
    ],
    deal_breakers: [
      "Cannot work weekends or peak season",
      "Only corporate or head-office experience, never on property",
      "No experience with our service level (luxury versus limited service)",
    ],
    why_open: [
      "Our GM left before the summer season. The assistant manager is covering and we are losing guest scores.",
      "We are opening a second property in spring and need someone who has done a pre-opening before.",
    ],
    interview_process: [
      "1. 20 min call with me. 2. Property walkthrough with the head of ops. 3. Trial shift, paid. Offer same week.",
      "1. 30 min screen. 2. 60 min with the ownership group. 3. Two references from previous properties. Decision in three days.",
    ],
  },
};

/**
 * Two or three examples for one field, chosen by job family, falling back to the
 * generic set whenever the title is empty or unrecognised.
 */
export function intakeExamples(field: IntakeExampleField, roleTitle: string): string[] {
  const family = jobFamilyFromTitle(roleTitle);
  const set = family === "generic" ? GENERIC : BY_FAMILY[family];
  const items = set[field];
  return items && items.length > 0 ? items.slice(0, 3) : GENERIC[field].slice(0, 3);
}
