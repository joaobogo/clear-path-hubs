/**
 * Content for /compare, /compare/recruiting-agencies and /recruiter-fees.
 *
 * Numbers on these pages come from three places only:
 *   - TaaSFlow prices, from `pricing-core.ts`
 *   - offer facts, from `offer-facts.ts`
 *   - the hypothetical worked example defined below, labelled illustrative
 * Competitor facts live in `competitor-facts.ts` and nowhere else. That file
 * is empty today, so these pages describe operating models, not companies.
 */
import { PACKAGE_10, PACKAGE_20, PRICE_PILOT_USD, formatUsdExact } from "@/config/pricing-core";
import {
  FIRST_SHORTLIST_TIMING,
  HUMAN_OVERSIGHT_NOTE,
  PILOT_IS_PAID_NOTE,
  SHORTLIST_SIZE,
  TIMING_FINE_PRINT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";
import { COMPETITOR_FACTS } from "@/content/competitor-facts";

export const COMPARE_LAST_UPDATED = "7 October 2026" as const;

const PILOT = formatUsdExact(PRICE_PILOT_USD);

/* Hypothetical worked example. Inputs are assumptions, not market data. */
export const EXAMPLE_SALARY_USD = 60_000;
export const EXAMPLE_PERCENTAGES = [10, 15, 20, 25] as const;
export function exampleFee(salary: number, pct: number): number {
  return Math.round((salary * pct) / 100);
}
export const EXAMPLE_ROWS = EXAMPLE_PERCENTAGES.map((pct) => ({
  pct,
  fee: exampleFee(EXAMPLE_SALARY_USD, pct),
}));

export type CompareTable = { caption: string; headers: string[]; rows: string[][]; note?: string };
export type CompareSection = {
  /** Always a question. */
  h2: string;
  paragraphs: string[];
  bullets?: string[];
  table?: CompareTable;
};
export type ComparePageContent = {
  slug: string;
  path: `/${string}`;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  directAnswer: string;
  breadcrumbLabel: string;
  sections: CompareSection[];
  faqs: { q: string; a: string }[];
  related: { to: string; label: string; desc: string }[];
  /** Competitor names whose verified facts appear on the page. */
  competitorsCited: string[];
};

const L_PRICING = { to: "/pricing", label: "Pricing", desc: "The pilot and every package total." };
const L_FLAT = { to: "/flat-fee-recruiting", label: "Flat-fee recruiting", desc: "What a flat fee covers." };
const L_SUB = { to: "/subscription-recruiting", label: "Subscription recruiting", desc: "A recurring fee for hiring capacity." };
const L_ALT = { to: "/recruitment-agency-alternative", label: "Recruitment agency alternative", desc: "When a flat fee replaces an agency." };
const L_COMPARE = { to: "/compare", label: "Compare hiring models", desc: "Every comparison in one place." };
const L_FEES = { to: "/recruiter-fees", label: "How much do recruiters charge?", desc: "Fee models explained." };
const L_HOSP = { to: "/industries/hospitality", label: "Hospitality recruiting", desc: "Hotels, restaurants and events." };
const L_HEALTH = { to: "/industries/healthcare", label: "Healthcare recruiting", desc: "What TaaSFlow does and does not cover." };

/* ------------------------------------------------------------------ */
/* /compare/recruiting-agencies                                        */
/* ------------------------------------------------------------------ */

export const AGENCIES_PAGE: ComparePageContent = {
  slug: "recruiting-agencies",
  path: "/compare/recruiting-agencies",
  title: "TaaSFlow vs Recruiting Agencies on Contingency | TaaSFlow",
  description: `Compare a contingency recruiting agency with TaaSFlow's ${PILOT} one-role pilot: how you pay, who does the work, what you keep and when an agency is the better choice.`,
  h1: "TaaSFlow vs recruiting agencies on contingency",
  eyebrow: "Compare",
  directAnswer: `A contingency agency is paid when you hire, usually as a share of the new hire's first-year salary. TaaSFlow sells a defined piece of work at a published total: ${PILOT} for a one-role pilot that delivers a ranked shortlist. The two models cover different scopes, so compare the work before the price.`,
  breadcrumbLabel: "Recruiting agencies",
  competitorsCited: [],
  sections: [
    {
      h2: "How do the two models charge?",
      paragraphs: [
        "On contingency, the agency invoices after you hire. The invoice is normally worked out from the candidate's first-year pay, so a higher salary means a higher fee. Terms differ between agencies, and the agreement you sign is the only reliable source for yours.",
        `TaaSFlow charges for the search work, not the outcome. The pilot is ${PILOT} for one role, once per company, and larger packages are one total for a stated number of positions. ${PILOT_IS_PAID_NOTE}`,
      ],
    },
    {
      h2: "What does the comparison look like side by side?",
      paragraphs: [
        "The table describes each model in general terms. It deliberately names no agency and states no agency price, because agency terms are private and vary. TaaSFlow figures are from our published pricing, as of 7 October 2026.",
      ],
      table: {
        caption: "Contingency agency and TaaSFlow compared in general terms",
        headers: ["", "Contingency agency", "TaaSFlow"],
        rows: [
          ["Pricing model", "A share of first-year salary, due on a successful hire; terms vary by agency", "A flat published total for a stated scope"],
          ["Public price", "Usually agreed in a contract, not published", `${PILOT} for the one-role pilot; ${PACKAGE_10.totalDisplay} for ${PACKAGE_10.capacityLabel.toLowerCase()}`],
          ["What you receive", "Candidates presented by the agency, often through to offer", `A ranked shortlist of up to ${SHORTLIST_SIZE} candidates with the evidence behind each score`],
          ["Who does the work", "The agency's recruiters", "Agents source and score; a recruiter reviews; you decide"],
          ["Who runs interviews and offers", "Shared, depending on the agreement", "You"],
          ["Timing", "Varies by agency and search", FIRST_SHORTLIST_TIMING],
        ],
        note: "Read the scope on both sides. A fee that includes help through to the offer and a fee for a shortlist are not the same product.",
      },
    },
    {
      h2: "When is a contingency agency the better choice?",
      paragraphs: [
        "An agency can be the right call when the work is as much relationship as research. TaaSFlow does not try to be everything, and saying so plainly is part of a fair comparison.",
      ],
      bullets: [
        "You want one person to manage candidates and negotiation through to a signed offer",
        "The role is senior, confidential or heavily dependent on a personal network",
        "You are filling one role and prefer to pay only if it is filled",
      ],
    },
    {
      h2: "When should you not choose TaaSFlow?",
      paragraphs: [
        "These are the cases where we would tell you to look elsewhere.",
      ],
      bullets: [
        "You need a confidential or retained senior search handled end to end",
        "You need someone else to run interviews, negotiate and close the offer",
        "You need licensure verification, clinical credentialing or background checks carried out for you",
        "You need a promised outcome or start date; TaaSFlow promises neither",
        "You need direct sync with an external applicant tracking system today; it is planned, not built",
      ],
    },
    {
      h2: "How should you decide between them?",
      paragraphs: [
        `Ask both for the same three things: the scope in writing, the total you would pay for your own role, and what you keep afterwards. With TaaSFlow the answers are on the pricing page and in the workspace terms. ${WHO_RUNS_THE_SEARCH}`,
        `${HUMAN_OVERSIGHT_NOTE} ${TIMING_FINE_PRINT}`,
      ],
    },
  ],
  faqs: [
    { q: "Does TaaSFlow replace a recruiting agency?", a: "For a defined role where you want a ranked shortlist, it can. For a search that needs someone to manage candidates through to the offer, an agency may fit better. Both can be used in the same company for different roles." },
    { q: "Why does this page name no agencies or agency prices?", a: "Agency terms are private and differ by firm. We publish a competitor fact only when we have read it on that company's own public page and can link to it. Until then we describe the model, not the company." },
    { q: "How much is the TaaSFlow pilot?", a: `${PILOT} for one role, once per company. The pricing page lists every package total, for example ${PACKAGE_20.totalDisplay} for ${PACKAGE_20.capacityLabel.toLowerCase()}.` },
    { q: "Is the TaaSFlow fee refundable if I do not hire?", a: "TaaSFlow does not promise a hire or a refund. The pilot is a paid evaluation of one role, so read what it includes before you request it." },
    { q: "How fast would I see candidates?", a: `${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}` },
  ],
  related: [L_COMPARE, L_FEES, L_ALT, L_FLAT, L_PRICING],
};

/* ------------------------------------------------------------------ */
/* /recruiter-fees                                                     */
/* ------------------------------------------------------------------ */

const EX = EXAMPLE_ROWS.map((r) => [`${r.pct}%`, formatUsdExact(r.fee)]);

export const FEES_PAGE: ComparePageContent = {
  slug: "recruiter-fees",
  path: "/recruiter-fees",
  title: "How Much Do Recruiters Charge? Fee Models Explained | TaaSFlow",
  description: "How recruiters charge: contingency, retained, flat fee, subscription and hourly models explained, with a worked example you can adapt to your own salary.",
  h1: "How much do recruiters charge?",
  eyebrow: "Recruiter fees",
  directAnswer: "It depends on the model. Many agencies charge a percentage of the hire's first-year salary, some split the fee into stages, and some charge a flat or recurring fee instead. The only reliable figure for your search is the one in the agreement, so this page explains the models and shows the arithmetic.",
  breadcrumbLabel: "Recruiter fees",
  competitorsCited: [],
  sections: [
    {
      h2: "What are the main ways recruiters charge?",
      paragraphs: [
        "Fee models differ in when you pay and what the payment is based on. Knowing which model you are signing matters more than any headline percentage.",
      ],
      bullets: [
        "Contingency: you pay when you hire, usually a percentage of first-year salary",
        "Retained: you pay in stages, often starting before any candidate is presented, for an exclusive search",
        "Flat fee: one stated total for a defined piece of work, whatever the salary",
        "Subscription: a recurring fee for hiring capacity across several roles",
        "Hourly or fractional: you pay for a recruiter's time, often alongside your own team",
      ],
    },
    {
      h2: "How do you work out a percentage fee?",
      paragraphs: [
        "Multiply the first-year salary by the percentage in the agreement. The table does this for a salary of $60,000 at four percentages. Both inputs are assumptions chosen to show the arithmetic. They are not market rates and not a claim about any agency.",
      ],
      table: {
        caption: "Illustrative percentage fee on a $60,000 salary (hypothetical inputs)",
        headers: ["Hypothetical percentage", "Fee on a $60,000 salary"],
        rows: EX,
        note: "Illustrative only. Replace the salary and the percentage with the numbers in your own agreement.",
      },
    },
    {
      h2: "How does a flat fee compare with that arithmetic?",
      paragraphs: [
        `A flat fee does not move with salary. The TaaSFlow pilot is ${PILOT} for one role, and ${PACKAGE_10.capacityLabel.toLowerCase()} is ${PACKAGE_10.totalDisplay}, as of ${COMPARE_LAST_UPDATED}. The comparison is not like for like: the pilot delivers a ranked shortlist, not a placement, and you run the interviews and the offer.`,
      ],
    },
    {
      h2: "What changes the price in hospitality and healthcare?",
      paragraphs: [
        "In hospitality, hiring is often high-volume and seasonal, so a fee tied to each hire can add up across a season, while a capacity-based price is easier to forecast. In healthcare, extra work such as licence checks and credentialing is usually separate from sourcing, so ask what the quote leaves out.",
        "We give no figures for either sector because we have not verified a published source for one.",
      ],
    },
    {
      h2: "What should you ask before you sign?",
      paragraphs: ["A short list of questions removes most surprises."],
      bullets: [
        "What exactly triggers the fee, and when is it due?",
        "Is the percentage based on base salary or total pay?",
        "What happens if the hire leaves early?",
        "Who owns the candidate records afterwards?",
        "What is not included?",
      ],
    },
    {
      h2: "Are there country-level fee norms on this page?",
      paragraphs: [
        "No. Fee norms differ by country and sector, and we publish one only when we have read it on a public page that says so. We have not yet verified such a source, so there are no country sections.",
      ],
    },
    {
      h2: "When should you not choose TaaSFlow?",
      paragraphs: [
        "If you need a recruiter to carry a confidential senior search to a signed offer, or to run background checks and credentialing, a retained or specialist firm fits better. TaaSFlow delivers a ranked shortlist, and you make every hiring decision.",
      ],
    },
  ],
  faqs: [
    { q: "What is a contingency fee?", a: "A fee paid only when you hire. It is usually calculated as a percentage of the hire's first-year salary, though terms vary by agency." },
    { q: "What is the difference between contingency and retained?", a: "Contingency is paid on a successful hire. Retained is paid in stages for an exclusive search, often starting before candidates are presented." },
    { q: "Do the percentages on this page reflect market rates?", a: "No. They are hypothetical inputs for a worked example. Use the percentage in your own agreement." },
    { q: "What does TaaSFlow charge?", a: `${PILOT} for the one-role pilot, once per company. Packages for more positions are one total each; ${PACKAGE_10.capacityLabel.toLowerCase()} is ${PACKAGE_10.totalDisplay}.` },
    { q: "Is the TaaSFlow pilot the cost of a hire?", a: "No. It pays for a ranked shortlist for one role. You interview, decide and make the offer." },
  ],
  related: [L_COMPARE, { to: "/compare/recruiting-agencies", label: "TaaSFlow vs recruiting agencies", desc: "Contingency compared in general terms." }, L_FLAT, L_SUB, L_HOSP, L_HEALTH],
};

/* ------------------------------------------------------------------ */
/* /compare hub                                                        */
/* ------------------------------------------------------------------ */

export const HUB_PAGE: ComparePageContent = {
  slug: "compare",
  path: "/compare",
  title: "Compare Hiring Models and Recruiting Fees | TaaSFlow",
  description: "Fair, sourced comparisons of how to hire: contingency agencies, flat fees and subscriptions, plus a guide to recruiter fees. Facts are cited or left out.",
  h1: "Compare hiring models and recruiting fees",
  eyebrow: "Compare",
  directAnswer: "These pages compare ways to hire, not just products. We state a competitor fact only after reading it on that company's own public page, and we link the source with the date. Where we could not verify something, we leave it out.",
  breadcrumbLabel: "Compare",
  competitorsCited: [],
  sections: [
    {
      h2: "Which comparisons are available?",
      paragraphs: [
        "Two guides are live. Each is written to be useful even if you never choose TaaSFlow, and each has a section on when not to choose us.",
      ],
      bullets: [
        "TaaSFlow vs recruiting agencies on contingency: how the fee, the scope and the work differ",
        "How much do recruiters charge: the main fee models and a worked example you can adapt",
      ],
    },
    {
      h2: "How do we keep comparisons fair?",
      paragraphs: [
        "Every competitor fact needs a link to the company's own page and the date we read it. Anything we cannot confirm that way is omitted, including figures from reviews, forums and third-party summaries. Our own numbers come from our published pricing.",
        `As of ${COMPARE_LAST_UPDATED}, we have not published any named-company comparison, because we could not yet open and confirm the relevant pages. We would rather add one late than add one wrong.`,
      ],
    },
    {
      h2: "What will not appear on these pages?",
      paragraphs: [
        "No ratings or reviews we did not collect ourselves, no estimated competitor prices, no claims about another company's quality, and no promised outcomes of our own.",
      ],
    },
    {
      h2: "Where should you start?",
      paragraphs: [
        `If you are choosing between an agency and a flat fee, read the agency comparison first. If you are budgeting, start with the fee guide. The pilot is ${PILOT} for one role, once per company. ${FIRST_SHORTLIST_TIMING}`,
      ],
    },
  ],
  faqs: [
    { q: "Why are there no named competitor pages yet?", a: "We publish a named comparison only when we have read the company's own public pricing page and can cite it. Until then we compare models instead." },
    { q: "Can a company ask us to correct a fact?", a: "Yes. Send a message with the page that shows the correct fact and we will review it and update the page and its date." },
    { q: "Where do TaaSFlow's own numbers come from?", a: `From the published pricing page. The pilot is ${PILOT} for one role, once per company.` },
  ],
  related: [
    { to: "/compare/recruiting-agencies", label: "TaaSFlow vs recruiting agencies", desc: "Contingency compared in general terms." },
    L_FEES,
    L_PRICING,
    L_ALT,
  ],
};

export const COMPARE_PAGES = [HUB_PAGE, AGENCIES_PAGE, FEES_PAGE] as const;

/** Competitor facts that a page may cite; empty until verified facts exist. */
export function citedFacts(page: ComparePageContent) {
  return COMPETITOR_FACTS.filter((f) => page.competitorsCited.includes(f.competitor));
}
