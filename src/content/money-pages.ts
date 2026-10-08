/**
 * Content for the buyer-intent pages: flat-fee recruiting, subscription
 * recruiting, the recruitment-agency alternative, the AI recruiting agency
 * definition and recruiting as a service.
 *
 * Numbers on these pages come from exactly three places and nowhere else:
 *   - TaaSFlow's own prices, from `pricing-core.ts`
 *   - the offer facts (timing, shortlist size, call length), from `offer-facts.ts`
 *   - the audit's agency range, defined once below and used to compute the
 *     single illustrative example. It is guidance, not a benchmark.
 *
 * No competitor prices, no testimonials, no outcome statistics.
 */
import {
  ANNUAL_DISCOUNT_DISPLAY,
  PACKAGE_10,
  PACKAGE_20,
  PRICE_PILOT_USD,
  formatUsdExact,
} from "@/config/pricing-core";
import {
  FIRST_SHORTLIST_BUSINESS_DAYS,
  FIRST_SHORTLIST_TIMING,
  HUMAN_OVERSIGHT_NOTE,
  OFFER_CATEGORY,
  PILOT_IS_PAID_NOTE,
  RECORDS_NOTE,
  SEATS_NOTE,
  SHORTLIST_SIZE,
  TIMING_FINE_PRINT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";

export const MONEY_PAGES_LAST_UPDATED = "7 October 2026" as const;

/* ------------------------------------------------------------------ */
/* The one agency range and its illustrative example                   */
/* ------------------------------------------------------------------ */

/** Agencies commonly charge this share of first-year salary. Illustrative range. */
export const AGENCY_FEE_RANGE_PCT = { low: 20, high: 25 } as const;
/** Example salary used only to show the arithmetic. Not a benchmark. */
export const AGENCY_EXAMPLE_SALARY_USD = 85_000;

export function agencyFeeExample(
  salary: number = AGENCY_EXAMPLE_SALARY_USD,
  range: { low: number; high: number } = AGENCY_FEE_RANGE_PCT,
) {
  const low = Math.round((salary * range.low) / 100);
  const high = Math.round((salary * range.high) / 100);
  return {
    salary,
    low,
    high,
    rangeLabel: `${range.low}–${range.high}%`,
    salaryDisplay: formatUsdExact(salary),
    spanDisplay: `${formatUsdExact(low)}–${formatUsdExact(high)}`,
  };
}

const AGENCY = agencyFeeExample();
const AGENCY_SENTENCE = `Agencies commonly charge ${AGENCY.rangeLabel} of first-year salary. As an illustration only, a ${AGENCY.salaryDisplay} salary at that range comes to ${AGENCY.spanDisplay}. The salary is an example, not a benchmark, and agency terms vary.`;

const PILOT = formatUsdExact(PRICE_PILOT_USD);

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ModelId = "in-house" | "job-boards" | "contingency" | "subscription" | "taasflow";
export type DimensionId = "cost" | "work" | "speed" | "keep" | "effort" | "fit";

export type MoneySection = {
  /** Always phrased as a question. */
  h2: string;
  paragraphs: string[];
  bullets?: string[];
};

export type MoneyPageContent = {
  slug: string;
  path: `/${string}`;
  /** <title>. */
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  /** 40 to 60 words, shown first. */
  directAnswer: string;
  serviceName: string;
  serviceType: string;
  breadcrumbLabel: string;
  sections: MoneySection[];
  comparison: {
    h2: string;
    intro: string;
    dimensions: DimensionId[];
    note?: string;
  };
  sectionsAfter: MoneySection[];
  faqs: { q: string; a: string }[];
  related: { to: string; label: string; desc: string }[];
};

/* ------------------------------------------------------------------ */
/* Operating-model comparison (qualitative)                            */
/* ------------------------------------------------------------------ */

export const MODEL_LABELS: Record<ModelId, string> = {
  "in-house": "In-house recruiter",
  "job-boards": "Job boards",
  contingency: "Agency on contingency",
  subscription: "Subscription recruiting",
  taasflow: "TaaSFlow flat fee",
};

export const MODEL_ORDER: ModelId[] = ["in-house", "job-boards", "contingency", "subscription", "taasflow"];

export const DIMENSION_LABELS: Record<DimensionId, string> = {
  cost: "How you pay",
  work: "Who does the work",
  speed: "Speed to first candidates",
  keep: "What you keep",
  effort: "Effort from you",
  fit: "Best fit",
};

export const MODEL_CELLS: Record<ModelId, Record<DimensionId, string>> = {
  "in-house": {
    cost: "Salary, benefits and tools for a recruiter you employ",
    work: "Your own recruiter",
    speed: "Depends on the recruiter's workload and network",
    keep: "Everything, in your own systems",
    effort: "You hire, manage and support the recruiter",
    fit: "Steady hiring across many roles",
  },
  "job-boards": {
    cost: "Posting or subscription fees",
    work: "You, reviewing the applicants",
    speed: "Applications can arrive quickly, but the screening is yours",
    keep: "The applicant data you collect",
    effort: "High: write the ad, post, filter and reply",
    fit: "Roles with a wide pool of applicants",
  },
  contingency: {
    cost: `A share of first-year salary when you hire; agencies commonly charge ${AGENCY.rangeLabel}`,
    work: "The agency's recruiters",
    speed: "Varies by agency and by search",
    keep: "Usually the agency keeps its candidate relationships",
    effort: "Moderate: brief the agency, then interview",
    fit: "A single hard-to-fill role where you want an agency's network",
  },
  subscription: {
    cost: "A recurring fee for hiring capacity",
    work: "The provider's team and tools",
    speed: "Varies by provider",
    keep: "Varies by provider, so ask",
    effort: "Moderate: agree criteria, then review and interview",
    fit: "Continuous hiring across several roles",
  },
  taasflow: {
    cost: `A published total: ${PILOT} for the one-role pilot, and package totals for more positions`,
    work: "Agents source and score; a recruiter reviews; you decide",
    speed: `Usually ${FIRST_SHORTLIST_BUSINESS_DAYS} business days from an approved brief to a first ranked shortlist; not a guarantee`,
    keep: "Your workspace and records, which you can export at any time",
    effort: "Approve the brief, review the shortlist, run the interviews",
    fit: "Defined roles where you want a ranked shortlist at a known price",
  },
};

/* ------------------------------------------------------------------ */
/* Shared related links                                                */
/* ------------------------------------------------------------------ */

const LINK_PRICING = { to: "/pricing", label: "Pricing", desc: "The pilot and every package total." };
const LINK_PILOT = { to: "/pilot", label: "The pilot", desc: "One role, one time per company." };
const LINK_HOW = { to: "/how-it-works", label: "How it works", desc: "The four steps from brief to shortlist." };
const LINK_HOSPITALITY = { to: "/industries/hospitality", label: "Hospitality recruiting", desc: "Hotels, restaurants and events." };
const LINK_HEALTHCARE = { to: "/industries/healthcare", label: "Healthcare recruiting", desc: "What TaaSFlow does and does not cover." };

/* ------------------------------------------------------------------ */
/* Page 1 — flat-fee recruiting                                        */
/* ------------------------------------------------------------------ */

export const FLAT_FEE_PAGE: MoneyPageContent = {
  slug: "flat-fee-recruiting",
  path: "/flat-fee-recruiting",
  title: `Flat-Fee Recruiting: ${PILOT} for One Role | TaaSFlow`,
  description: `Flat-fee recruiting from TaaSFlow: a ${PILOT} pilot for one role with a ranked shortlist, recruiter review and no percentage of salary.`,
  h1: "Flat-fee recruiting for one role, at a price you can read first",
  eyebrow: "Flat-fee recruiting",
  directAnswer: `Flat-fee recruiting means you know the price before the search starts. With TaaSFlow, the pilot costs ${PILOT} for one role, once per company. Agents source and score candidates, a recruiter reviews the shortlist, and you receive a ranked list of up to ${SHORTLIST_SIZE} candidates. You make every hiring decision.`,
  serviceName: "Flat-fee recruiting pilot",
  serviceType: "Recruiting",
  breadcrumbLabel: "Flat-fee recruiting",
  sections: [
    {
      h2: "What does flat-fee recruiting mean?",
      paragraphs: [
        "A flat fee is a price you can read before anything starts. It does not change with the salary of the person you hire, and it does not wait for an offer to be accepted. You decide whether the price is worth the work, and then you decide who to interview.",
        "Most agencies price the other way. They charge a share of first-year salary once you hire, so the cost depends on an outcome nobody can see in advance. A flat fee takes that uncertainty out of the price. It also changes what you are buying: a defined piece of work rather than a placement.",
      ],
    },
    {
      h2: `What do you get for the ${PILOT} pilot?`,
      paragraphs: [
        `The pilot covers one role, one time per company, for ${PILOT}. ${PILOT_IS_PAID_NOTE} Here is what is included.`,
      ],
      bullets: [
        `A ranked shortlist of up to ${SHORTLIST_SIZE} candidates for the role`,
        "The evidence behind each score, so you can see why a candidate ranks where they do",
        "A recruiter's review of the shortlist before you see it",
        `A workspace for the role. ${SEATS_NOTE}`,
        "Export of your candidate records at any time",
      ],
    },
    {
      h2: "How is a flat fee different from a percentage of salary?",
      paragraphs: [
        AGENCY_SENTENCE,
        "The comparison is not like for like. An agency fee usually covers a placement, including the agency's work on the final stages of the hire. The TaaSFlow pilot delivers a ranked shortlist. You run the interviews, you make the offer, and you handle the checks your role needs. Compare the scope of the work before you compare the numbers.",
      ],
    },
    {
      h2: "Who is flat-fee recruiting for, and who is it not for?",
      paragraphs: [
        "It suits teams that know the role they need and want to see the evidence before they commit more budget. It does not suit every search.",
      ],
      bullets: [
        "A good fit: a founder or hiring manager with no recruiter, an HR lead who wants to test the approach on one role, or a team that wants a shortlist with its reasoning attached",
        "Not a fit: a confidential senior search that needs a retained partner, or a role where you need someone else to carry out licensure verification, credentialing or background checks",
        "Not a fit: hiring where you need a guaranteed outcome or a guaranteed start date, because TaaSFlow does not promise either",
      ],
    },
    {
      h2: "What happens after the pilot?",
      paragraphs: [
        `After the pilot you decide. Some teams hire from the shortlist. Others adjust the criteria and run another search. If you are hiring for several roles, packages cover a set number of positions for one total: ${PACKAGE_10.capacityLabel.toLowerCase()} is ${PACKAGE_10.totalDisplay} and ${PACKAGE_20.capacityLabel.toLowerCase()} is ${PACKAGE_20.totalDisplay}. The pricing page lists every total.`,
        `${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
      ],
    },
  ],
  comparison: {
    h2: "How does flat-fee recruiting compare with other ways to hire?",
    intro:
      "This table describes how each operating model works in general terms. It contains no competitor prices, and your own experience with any provider may differ.",
    dimensions: ["cost", "work", "effort"],
  },
  sectionsAfter: [],
  faqs: [
    {
      q: "How much does flat-fee recruiting cost with TaaSFlow?",
      a: `The pilot costs ${PILOT} for one role, once per company. For more positions, packages start at ${PACKAGE_10.capacityLabel.toLowerCase()} for ${PACKAGE_10.totalDisplay}. The pricing page lists every total.`,
    },
    {
      q: `Is ${PILOT} the price of a hire?`,
      a: `No. ${PILOT} pays for the pilot, which delivers a ranked shortlist of up to ${SHORTLIST_SIZE} candidates for one role. It is not a placement fee. You interview, you decide and you make the offer.`,
    },
    {
      q: "How fast does the first shortlist arrive?",
      a: `${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
    },
    {
      q: "Is there a free trial?",
      a: `${PILOT_IS_PAID_NOTE} Request the pilot and we confirm the scope with you before any sourcing starts.`,
    },
    {
      q: "Does TaaSFlow guarantee a hire or refund the fee?",
      a: "No. TaaSFlow does not promise a hire, a start date or a refund. The pilot is a paid evaluation of one role, so read what is included before you request it, and ask us if you want to talk through terms first.",
    },
    {
      q: "Who does the work on my role?",
      a: WHO_RUNS_THE_SEARCH,
    },
    {
      q: "Can I talk to someone before I request the pilot?",
      a: "Yes. Send us a message and we will contact you within one business day. If you request the pilot, we confirm the role and the criteria with you before sourcing starts.",
    },
    {
      q: "Can I use the pilot for hospitality or healthcare roles?",
      a: "Yes, for recruiting support. The hospitality and healthcare pages explain how each sector is handled. For healthcare, TaaSFlow supports sourcing, screening and ranking; it does not verify licensure, perform clinical credentialing or run background checks unless separately agreed.",
    },
  ],
  related: [LINK_PRICING, LINK_PILOT, LINK_HOW, LINK_HOSPITALITY, LINK_HEALTHCARE],
};

/* ------------------------------------------------------------------ */
/* Page 2 — subscription recruiting                                    */
/* ------------------------------------------------------------------ */

export const SUBSCRIPTION_PAGE: MoneyPageContent = {
  slug: "subscription-recruiting",
  path: "/subscription-recruiting",
  title: "Subscription Recruiting for Ongoing Hiring | TaaSFlow",
  description:
    "Subscription recruiting replaces a fee on every hire with a recurring fee for hiring capacity. See how TaaSFlow subscriptions work and when they fit.",
  h1: "Subscription recruiting for teams that hire through the year",
  eyebrow: "Subscription recruiting",
  directAnswer: `Subscription recruiting replaces a fee on each hire with a recurring fee for hiring capacity. It suits teams with several roles open, or hiring that repeats through the year. TaaSFlow subscriptions use the same package totals as one-off packages, billed monthly, and a recruiter reviews every shortlist before you see it.`,
  serviceName: "Subscription recruiting",
  serviceType: "Recruiting",
  breadcrumbLabel: "Subscription recruiting",
  sections: [
    {
      h2: "What is subscription recruiting?",
      paragraphs: [
        "Subscription recruiting is a commercial model, not a different kind of recruiting. Instead of paying a fee each time a hire closes, you pay a recurring fee that covers a set amount of hiring work. The provider's incentive moves from closing one placement to keeping your open roles moving.",
        "That change matters most when hiring is continuous. A team that opens a new role every few weeks pays a contingency fee again each time. A subscription turns that stream of separate fees into one forecastable line in the budget.",
      ],
    },
    {
      h2: "When does a subscription make more sense than a one-off package?",
      paragraphs: [
        "A one-off package fits a defined burst of hiring: a set of roles, one time. A subscription fits hiring that does not stop. Ask how many roles you expect to open over the next year, including backfills, and whether the same role families repeat.",
        `For comparison, ${AGENCY_SENTENCE} If you hire repeatedly through a contingency agency, that percentage applies to every hire. A subscription is priced on capacity instead, so the cost of an additional role within your package does not repeat in full. Check the scope of work on both sides before you decide, because the services are not identical.`,
      ],
      bullets: [
        "Subscribe if you have several roles open, repeating role families, or a need to forecast spend",
        "Buy a one-off package if you have a fixed set of roles and no plan to hire after them",
        "Start with the pilot if you have not yet seen how the shortlists look for your roles",
      ],
    },
    {
      h2: "How do TaaSFlow subscriptions work?",
      paragraphs: [
        `Subscriptions use exactly the same packages at exactly the same prices as one-off packages, billed monthly instead of once. The monthly total for ${PACKAGE_10.capacityLabel.toLowerCase()} is ${PACKAGE_10.totalDisplay}, and for ${PACKAGE_20.capacityLabel.toLowerCase()} it is ${PACKAGE_20.totalDisplay}. Paying twelve months up front takes ${ANNUAL_DISCOUNT_DISPLAY} off the annual total, which is the one discount we publish.`,
        `Each position gets a ranked shortlist of up to ${SHORTLIST_SIZE} candidates. ${WHO_RUNS_THE_SEARCH} You request first, and we confirm the scope with you before any sourcing starts.`,
      ],
    },
    {
      h2: "What should you check before subscribing to any recruiting service?",
      paragraphs: [
        "Whatever provider you consider, put these questions in writing before you sign.",
      ],
      bullets: [
        "What counts as a role or position, and what happens when a role is reopened",
        "Who keeps the candidate records when the subscription ends",
        "Which parts of the work are done by software and which by a person",
        "How you cancel, and what notice is needed",
        "What the provider does not do, such as background checks or licensure verification",
      ],
    },
    {
      h2: "What does a subscription not do?",
      paragraphs: [
        "A subscription does not fix an unclear role or an absent decision maker. If nobody owns the interview schedule, shortlists wait and candidates take other offers. It also does not guarantee a hire or a timeline.",
        `${RECORDS_NOTE} ${TIMING_FINE_PRINT}`,
      ],
    },
  ],
  comparison: {
    h2: "How does subscription recruiting compare with other operating models?",
    intro:
      "The comparison below is qualitative. It describes how each model usually works and leaves out competitor prices.",
    dimensions: ["cost", "keep", "fit"],
  },
  sectionsAfter: [],
  faqs: [
    {
      q: "Is a TaaSFlow subscription the same price as a one-off package?",
      a: `Yes. Subscriptions use the same packages and totals as one-off packages, billed monthly instead of once. Paying twelve months up front takes ${ANNUAL_DISCOUNT_DISPLAY} off the annual total.`,
    },
    {
      q: "Can I start with the pilot and subscribe later?",
      a: `Yes. The pilot costs ${PILOT} for one role, once per company. After it, you can choose a package or a subscription, or stop.`,
    },
    {
      q: "How many roles does a subscription cover?",
      a: `That depends on the package. Each package states a capacity, for example ${PACKAGE_10.capacityLabel.toLowerCase()}, and one total price. Above the largest package, we quote through a conversation instead of a list price.`,
    },
    {
      q: "How fast does each shortlist arrive?",
      a: `${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
    },
    {
      q: "Who reviews the shortlists?",
      a: `${WHO_RUNS_THE_SEARCH} ${HUMAN_OVERSIGHT_NOTE}`,
    },
    {
      q: "What happens to my candidate records if I cancel?",
      a: RECORDS_NOTE,
    },
    {
      q: "Is a subscription better than a recruitment agency?",
      a: "It depends on the search. For one hard-to-fill senior role, an agency with the right network may suit you better. For several roles or hiring that repeats, a capacity-based fee can be easier to plan for. Compare scope as well as price.",
    },
    {
      q: "Do subscriptions cover hospitality and healthcare hiring?",
      a: "Yes, as recruiting support. See the hospitality and healthcare pages for how each sector works. TaaSFlow does not perform licensure verification, credentialing or background checks unless separately agreed.",
    },
  ],
  related: [LINK_PRICING, LINK_PILOT, LINK_HOW, LINK_HOSPITALITY, LINK_HEALTHCARE],
};

/* ------------------------------------------------------------------ */
/* Page 3 — recruitment agency alternative                             */
/* ------------------------------------------------------------------ */

export const AGENCY_ALTERNATIVE_PAGE: MoneyPageContent = {
  slug: "recruitment-agency-alternative",
  path: "/recruitment-agency-alternative",
  title: "Recruitment Agency Alternative With a Flat Fee | TaaSFlow",
  description:
    "Looking for a recruitment agency alternative? See how TaaSFlow differs from a contingency agency on price, process and who keeps the records.",
  h1: "A recruitment agency alternative with a published price",
  eyebrow: "Recruitment agency alternative",
  directAnswer: `A recruitment agency alternative gives you candidates without a fee that scales with salary. TaaSFlow publishes its prices: ${PILOT} for a one-role pilot and fixed package totals beyond it. Agents source and score candidates, a recruiter reviews each shortlist, and you keep the interviews and the decision.`,
  serviceName: "Recruitment agency alternative",
  serviceType: "Recruiting",
  breadcrumbLabel: "Recruitment agency alternative",
  sections: [
    {
      h2: "Why do hiring teams look for an alternative to a recruitment agency?",
      paragraphs: [
        "The reasons are usually practical. Fees that depend on salary are hard to forecast. The reasoning behind a shortlist is often invisible: you receive names, not the evidence. And the candidate relationships built during a search commonly stay with the agency, so the next search starts from zero.",
        "Speed is the other reason. A search can stall while you wait for updates. Teams want to see what is happening to a role while it is open, not only at the end.",
      ],
    },
    {
      h2: "What does a recruitment agency do well?",
      paragraphs: [
        "An agency is not the wrong choice by default. A good one brings a network, market knowledge and a person who will phone a passive candidate on your behalf. For a confidential senior search, or a niche role where relationships matter more than process, that can be worth the fee.",
        "Treat this page as a way to decide, not a way to avoid agencies. Some teams use both: an agency for rare senior roles, and a flat-fee service for defined roles that repeat.",
      ],
    },
    {
      h2: "How does TaaSFlow work differently from an agency?",
      paragraphs: [
        `${OFFER_CATEGORY} describes the model. ${WHO_RUNS_THE_SEARCH}`,
        "You see the evidence behind each score, in your workspace, so a shortlist comes with its reasoning. Your candidate records are yours to export. The price is published, so you do not have to wait for a quote to know what a search costs.",
      ],
      bullets: [
        "Pricing: a published pilot total and published package totals, with no percentage of salary",
        "Process: four steps, with scope confirmed before sourcing starts",
        "Control: you interview and you make every hiring decision",
      ],
    },
    {
      h2: "What does an agency fee look like next to a flat fee?",
      paragraphs: [
        AGENCY_SENTENCE,
        `The TaaSFlow pilot costs ${PILOT} for one role. Do not read the two figures as the price of the same thing. The agency fee usually covers a placement, and the pilot delivers a ranked shortlist of up to ${SHORTLIST_SIZE} candidates that you take through interviews yourself. A fair comparison puts the work you still do on your side of the ledger.`,
      ],
    },
    {
      h2: "When should you stay with an agency?",
      paragraphs: [
        "Stay with an agency, or add one, when the search is confidential, when the role is rare enough that a personal network decides the outcome, or when you want someone to manage the candidate through to a signed offer. TaaSFlow is better suited to defined roles where a ranked shortlist and a known price matter more than a relationship.",
        "TaaSFlow also does not guarantee a hire or a timeline. Timing is usually quick for an approved brief, but it depends on the role and the market.",
      ],
    },
  ],
  comparison: {
    h2: "How do the operating models differ?",
    intro:
      "A qualitative view of five ways to hire. It has no competitor prices, because rates vary by agency and by search.",
    dimensions: ["cost", "work", "keep"],
  },
  sectionsAfter: [],
  faqs: [
    {
      q: "Is TaaSFlow a recruitment agency?",
      a: `No. TaaSFlow is a ${OFFER_CATEGORY.toLowerCase()}. Agents source and score candidates, and a recruiter reviews every shortlist, but you run the interviews and make the hiring decision.`,
    },
    {
      q: "Does TaaSFlow charge a percentage of first-year salary?",
      a: `No. The pilot is ${PILOT} for one role, and larger packages have fixed totals. Nothing is charged as a share of salary.`,
    },
    {
      q: "Who keeps the candidate records?",
      a: RECORDS_NOTE,
    },
    {
      q: "How quickly will I see candidates?",
      a: `${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
    },
    {
      q: "Can TaaSFlow handle a confidential executive search?",
      a: "It is not designed for retained executive search. If a role is confidential and relationship-driven, an agency with the right network may be a better choice. You can use both.",
    },
    {
      q: "Does TaaSFlow guarantee a hire or a refund?",
      a: "No. TaaSFlow does not promise a hire, a timeline or a refund. The pilot is a paid evaluation of one role.",
    },
    {
      q: "What does TaaSFlow not do for regulated roles?",
      a: "TaaSFlow supports sourcing, screening and ranking. It does not perform licensure verification, clinical credentialing or background checks unless separately agreed. Your team verifies those before an offer.",
    },
    {
      q: "How do I try it before I commit?",
      a: `Request the ${PILOT} pilot for one role. It is a paid evaluation, available once per company, and the scope is confirmed with you before sourcing starts.`,
    },
  ],
  related: [LINK_PRICING, LINK_PILOT, LINK_HOW, LINK_HOSPITALITY, LINK_HEALTHCARE],
};

/* ------------------------------------------------------------------ */
/* Page 4 — AI recruiting agency                                       */
/* ------------------------------------------------------------------ */

export const AI_RECRUITING_AGENCY_PAGE: MoneyPageContent = {
  slug: "ai-recruiting-agency",
  path: "/ai-recruiting-agency",
  title: "AI Recruiting Agency: What It Is and How It Works | TaaSFlow",
  description:
    "What an AI recruiting agency is, how it differs from AI recruiting software and from a traditional agency, and how TaaSFlow keeps people in charge.",
  h1: "What an AI recruiting agency is, and how TaaSFlow works",
  eyebrow: "AI recruiting agency",
  directAnswer:
    "An AI recruiting agency is a recruiting service where software agents do the high-volume work, such as finding and scoring candidates, and people review the results and own the decisions. It differs from AI software, which you operate yourself, and from a traditional agency, which relies mainly on recruiters.",
  serviceName: "AI-assisted recruiting with managed execution",
  serviceType: "Recruiting",
  breadcrumbLabel: "AI recruiting agency",
  sections: [
    {
      h2: "What is an AI recruiting agency?",
      paragraphs: [
        "The phrase describes a service, not a piece of software. You hand over a role; the provider returns candidates. What makes it an AI service is how the work is divided: software agents handle sourcing and first-pass scoring, and humans handle review, judgment and the relationship with your team.",
        `TaaSFlow describes its own model as a ${OFFER_CATEGORY.toLowerCase()}. That wording is deliberate. It signals that there is a platform you can see into, and managed work done on your behalf.`,
      ],
    },
    {
      h2: "How is it different from AI recruiting software?",
      paragraphs: [
        "AI recruiting software gives you tools. You configure them, feed them roles, watch the output and fix what goes wrong. That can work well for a team with recruiters who have the time to run it.",
        "A service takes responsibility for the execution. With TaaSFlow, the agents run inside the platform and a recruiter reviews the result, so you receive a ranked shortlist rather than a dashboard to operate. The trade-off is control over the mechanics: you approve the criteria, and the provider runs the process.",
      ],
    },
    {
      h2: "How is it different from a traditional recruitment agency?",
      paragraphs: [
        `A traditional agency relies mainly on recruiters working their own networks and is usually paid when a hire closes. Agencies commonly charge ${AGENCY.rangeLabel} of first-year salary. An AI recruiting service does much of the first-pass work with software, which is why a flat price is possible. TaaSFlow's pilot costs ${PILOT} for one role.`,
        "The two are not interchangeable. Software can search and score at volume; it cannot replace a trusted relationship with a passive candidate. Choose the model that fits the role.",
      ],
    },
    {
      h2: "What do the agents do, and what do people do?",
      paragraphs: [
        WHO_RUNS_THE_SEARCH,
        HUMAN_OVERSIGHT_NOTE,
      ],
      bullets: [
        "Agents: find candidates, read CVs, and score them against the criteria you approved, with the evidence attached",
        "A recruiter: reviews every shortlist before you see it and checks that it matches the brief",
        "You: approve the criteria, interview, and decide who moves forward",
      ],
    },
    {
      h2: "What are the limits of AI in recruiting?",
      paragraphs: [
        "Scores summarize what a CV states. They are not a verdict on a person, and they can reflect gaps or biases in the information they read. That is why a person reviews the shortlist, and why you remain the decision maker.",
        "The limits also apply to the provider. TaaSFlow does not claim certifications it does not hold, and it does not perform licensure verification, credentialing or background checks unless separately agreed. See the security page for what is and is not in place.",
      ],
    },
  ],
  comparison: {
    h2: "How does an AI recruiting service compare with other ways to hire?",
    intro:
      "A qualitative comparison of how the work is shared in each model. It has no competitor prices.",
    dimensions: ["work", "speed", "effort"],
  },
  sectionsAfter: [],
  faqs: [
    {
      q: "Is TaaSFlow an AI recruiting agency?",
      a: `TaaSFlow is a ${OFFER_CATEGORY.toLowerCase()}. Agents source and score candidates, a recruiter reviews every shortlist, and you make the hiring decisions. If you use the phrase "AI recruiting agency" for that kind of service, then yes.`,
    },
    {
      q: "Does software decide who gets hired?",
      a: HUMAN_OVERSIGHT_NOTE,
    },
    {
      q: "How long does the first shortlist take?",
      a: `${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
    },
    {
      q: "How much does it cost?",
      a: `The pilot is ${PILOT} for one role, once per company. Packages for more positions have fixed totals, starting at ${PACKAGE_10.capacityLabel.toLowerCase()} for ${PACKAGE_10.totalDisplay}.`,
    },
    {
      q: "Can I see why a candidate was ranked where they were?",
      a: "Yes. Each score comes with the evidence behind it in your workspace, so you can check the reasoning rather than accept a number.",
    },
    {
      q: "Does TaaSFlow integrate with my applicant tracking system?",
      a: "The TaaSFlow workspace includes its own applicant tracking. Direct sync with an external applicant tracking system is planned, not built.",
    },
    {
      q: "Is TaaSFlow certified for security or privacy standards?",
      a: "TaaSFlow does not claim SOC 2, ISO 27001, HIPAA or full GDPR, CCPA or PDPL compliance. The security page states what we do and do not hold.",
    },
    {
      q: "Does it work for hospitality and healthcare hiring?",
      a: "Yes, as recruiting support. For healthcare, your team verifies licences, credentials and background checks. See the sector pages for detail.",
    },
  ],
  related: [LINK_PRICING, LINK_PILOT, LINK_HOW, LINK_HOSPITALITY, LINK_HEALTHCARE],
};

/* ------------------------------------------------------------------ */
/* Page 5 — recruiting as a service                                    */
/* ------------------------------------------------------------------ */

export const RECRUITING_AS_A_SERVICE_PAGE: MoneyPageContent = {
  slug: "recruiting-as-a-service",
  path: "/recruiting-as-a-service",
  title: "Recruiting as a Service: How It Works | TaaSFlow",
  description:
    "What recruiting as a service is, how the subscription model works, where it fits against agencies and in-house teams, and how to run it well.",
  h1: "Recruiting as a service: how it works and where it fits",
  eyebrow: "Recruiting as a service",
  directAnswer:
    "Recruiting as a service replaces a fee on each hire with a defined service: hiring capacity and infrastructure bought for a period, not a single placement. You get sourcing, structured screening and a place to make decisions. TaaSFlow offers it as a pilot, one-off packages and subscriptions with published totals.",
  serviceName: "Recruiting as a service",
  serviceType: "Recruiting",
  breadcrumbLabel: "Recruiting as a service",
  sections: [
    {
      h2: "What does recruiting as a service mean?",
      paragraphs: [
        "Recruiting as a service, often shortened to RaaS, treats hiring as an operating capability you buy rather than an event you pay for at the end. You pay for search capacity and hiring infrastructure for a period of time, not for one placement.",
        "In practice that means a cost you can forecast, work that covers every open role rather than one requisition at a time, and a record of candidates, evidence and decisions that you can keep.",
      ],
      bullets: [
        "A defined, forecastable cost instead of a percentage of salary",
        "Search that covers every open role in scope, not one requisition at a time",
        "Candidate records and evidence that stay in your workspace",
      ],
    },
    {
      h2: "What are the three components you are buying?",
      paragraphs: [
        "Every recruiting-as-a-service offer can be broken into the same three parts. Ask a provider to describe each one.",
      ],
      bullets: [
        "Search capacity: sourcing and outreach against criteria you approve, rather than a single job board",
        "Screening and evidence: structured review against the role, so each recommendation carries its reasoning",
        "A decision surface: one place where shortlists, interviews, feedback and decisions are tracked and stay searchable afterward",
      ],
    },
    {
      h2: "How does TaaSFlow deliver recruiting as a service?",
      paragraphs: [
        `${WHO_RUNS_THE_SEARCH} Each position receives a ranked shortlist of up to ${SHORTLIST_SIZE} candidates, with the evidence behind every score, in your workspace.`,
        `You can start with the ${PILOT} pilot for one role, buy a one-off package for a set of roles, or subscribe with the same package totals billed monthly. ${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
      ],
    },
    {
      h2: "How is it different from recruitment process outsourcing?",
      paragraphs: [
        "Recruitment process outsourcing usually hands an entire hiring function to a provider on a long contract. Recruiting as a service is narrower and shorter-cycle. You buy capacity and tools for defined roles, keep your own process, and keep the pipeline.",
        "That makes it easier to start small and easier to stop, but it also means your team still owns the interviews, the offers and the decisions.",
      ],
    },
    {
      h2: "How do you run it well in the first weeks?",
      paragraphs: [
        "Three habits decide whether the service works.",
      ],
      bullets: [
        "Define the bar first. Write requirements as observable evidence, meaning what a candidate must have done, rather than adjectives.",
        "Calibrate on real profiles. Review the first shortlist and correct the criteria. It is the most useful hour you will spend.",
        "Protect decision speed. Name one decision owner per role and hold a standing slot for interviews, because most lost candidates are lost to waiting.",
      ],
    },
    {
      h2: "Where does it fit, and where does it not?",
      paragraphs: [
        "Recruiting as a service works best with several roles open at once, or role families you hire repeatedly. It is a weaker fit for a single junior hire once a year, where a one-off package or the pilot costs less, and for a confidential senior search that needs a retained partner.",
        "It cannot fix an undefined bar or an absent decision maker. Fix those first, because they affect every other variable.",
      ],
    },
  ],
  comparison: {
    h2: "How does recruiting as a service compare with other operating models?",
    intro:
      "A qualitative comparison across five ways to hire. It includes no competitor prices.",
    dimensions: ["cost", "speed", "fit"],
  },
  sectionsAfter: [],
  faqs: [
    {
      q: "Is recruiting as a service the same as recruitment process outsourcing?",
      a: "No. Recruitment process outsourcing usually outsources an entire hiring function on a long contract. Recruiting as a service is a shorter-cycle service for search capacity and hiring infrastructure, and you keep the pipeline.",
    },
    {
      q: "Do I still pay a placement fee?",
      a: `No percentage of salary is charged at offer stage. TaaSFlow prices by package: ${PILOT} for the one-role pilot, then fixed totals for larger packages.`,
    },
    {
      q: "What happens to candidates I do not hire?",
      a: `They stay in your workspace with the evidence attached, so a similar role starts from a record rather than from zero. ${RECORDS_NOTE}`,
    },
    {
      q: "How many roles can one package cover?",
      a: `Each package states a capacity, such as ${PACKAGE_10.capacityLabel.toLowerCase()}, with one total price. The pilot covers one role.`,
    },
    {
      q: "How fast does the first shortlist arrive?",
      a: `${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
    },
    {
      q: "Who makes the hiring decision?",
      a: `You do. ${HUMAN_OVERSIGHT_NOTE}`,
    },
    {
      q: "Does the service include background checks or licensure verification?",
      a: "No, not unless separately agreed. TaaSFlow supports sourcing, screening and ranking. Your team verifies licences, credentials and clearances.",
    },
    {
      q: "Can I try it on one role first?",
      a: `Yes. The pilot is ${PILOT} for one role, once per company. It is a paid evaluation, not a free trial.`,
    },
  ],
  related: [LINK_PRICING, LINK_PILOT, LINK_HOW, LINK_HOSPITALITY, LINK_HEALTHCARE],
};

export const MONEY_PAGES: MoneyPageContent[] = [
  FLAT_FEE_PAGE,
  SUBSCRIPTION_PAGE,
  AGENCY_ALTERNATIVE_PAGE,
  AI_RECRUITING_AGENCY_PAGE,
  RECRUITING_AS_A_SERVICE_PAGE,
];
