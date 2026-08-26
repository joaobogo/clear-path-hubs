import type { Dossier } from "../types";

const R1 =
  "Eight years building production React and TypeScript applications for regulated payment products.";
const R3 =
  "Owned the reconciliation feature end to end, from schema design to the shipped UI operations staff use daily.";
const R2 =
  "Handle the SQL and relational data modelling for the ledger in Postgres, with 60 forward-only migrations in two years.";
const R4 =
  "Wrote the row-level security policies that hold 180 multi-tenant merchant books in isolation.";
const R5 =
  "Keep maintaining 1,400 automated tests green: unit suites in Vitest and end-to-end journeys in Playwright.";
const P1 =
  "Ledgerly is multi-tenant SaaS for 180 merchants, each book kept apart by per-tenant data isolation.";
const P4 =
  "Ported the merchant portal to Next.js, a full-stack React framework similar to TanStack Start, taking server response time to 120 ms.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2017.";

export const dossier: Dossier = {
  slug: "tomas-ferreira",
  full_name: "Tomás Ferreira",
  email: "tomas.ferreira.dev@gmail.com",
  phone: "+351 936 118 204",
  city: "Porto",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: "https://www.linkedin.com/in/tomas-ferreira-tfr",
  portfolio_url: null,

  headline: "Senior Software Engineer",
  years_experience: 8,
  react_ts_years: 8,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: [
    "Postgres row-level security",
    "Multi-tenant SaaS data isolation",
    "Database migrations in production",
  ],
  q4: "At Ledgerly I owned merchant reconciliation from the ledger tables outwards. I modelled the double-entry rows in Postgres, wrote the migrations that moved four years of history onto the new shape, and then built the screen where an operations analyst matches a payout against a bank statement. Each merchant book had to stay invisible to every other merchant, so the queries sit behind row-level security policies with a test per policy. It went live for 180 merchants and cut month-end reconciliation from two full days to about three hours.",
  cover_letter:
    "I have spent four years on a payments ledger where a wrong number is a real problem, and I have learned to like that pressure. The part of this role I want most is the ownership: schema, API, screen and whatever happens after release.\n\nI am in Porto and can be in Lisbon two days a week without difficulty. A senior product team where engineers talk to the people using the software is what I am looking for next.",

  availability: "6 weeks' notice",
  compensation: {
    target: 74000,
    expected_min: 70000,
    expected_max: 78000,
    display: "EUR 74,000 per year (base)",
  },

  skills: [
    "React",
    "TypeScript",
    "PostgreSQL",
    "Next.js",
    "row-level security",
    "Vitest",
    "Playwright",
    "Kafka",
  ],
  languages: ["Portuguese - native", "English - fluent (C1)", "French - basic"],
  education: [
    {
      institution: "Universidade do Porto",
      degree: "BSc Informatics Engineering",
      end: "2017",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Ledgerly",
      title: "Senior Software Engineer",
      start: "2022-05",
      end: null,
      summary:
        "Owns the merchant ledger and reconciliation surface for 180 merchant books on a fintech scale-up.",
      location: "Porto, Portugal",
    },
    {
      company: "Douro Analytics",
      title: "Software Engineer",
      start: "2019-06",
      end: "2022-04",
      summary:
        "Built reporting products and the query layer behind a customer-facing analytics dashboard.",
      location: "Porto, Portugal",
    },
    {
      company: "Atlantic Retail Group",
      title: "Junior Software Engineer",
      start: "2017-09",
      end: "2019-05",
      summary: "Worked on stock and pricing tools for 240 retail stores.",
      location: "Matosinhos, Portugal",
    },
  ],
  recruiter_summary:
    "Tomás owns the ledger and reconciliation surface at a payments scale-up, where he modelled the double-entry data in Postgres and shipped the screen operations analysts use to close the month. He wrote the row-level security policies separating 180 merchant books and keeps 1,400 tests green in Vitest and Playwright. Eight years with React and TypeScript, six weeks' notice.",

  cv: {
    name: "Tomás Ferreira",
    title: "Senior Software Engineer",
    contact:
      "Porto, Portugal · tomas.ferreira.dev@gmail.com · +351 936 118 204 · linkedin.com/in/tomas-ferreira-tfr",
    summary: `${R1} ${R3} I gravitate to systems where money moves and the numbers have to reconcile at the end of the day. I am equally happy in a migration file and in a design review with the people who will use the screen.`,
    coreSkills:
      "Core skills: Node.js, Kafka, Redis, Terraform, GitLab CI, observability, incident review, payments domain.",
    experience: [
      {
        heading: "Senior Software Engineer - Ledgerly, Porto",
        dates: "May 2022 - Present",
        bullets: [
          R2,
          R4,
          R5,
          P1,
          "Rebuilt payout scheduling so a failed batch retries itself, removing 20 manual interventions a month.",
          "Cut month-end reconciliation for 180 merchants from two days to three hours after the ledger rewrite.",
          "Sat in on a two-day AI vendor evaluation for support triage and wrote up the trade-offs.",
          "Kept a weekly changelog for operations colleagues, which cut repeat questions about releases by half.",
          "Reduced flaky checks in the delivery pipeline from 11 to 2, so releases stopped waiting on reruns.",
          "Paired weekly with a junior engineer for six months; she now owns the billing screens.",
          "Cut the build from 9 minutes to 4, which moved us from two releases a week to daily.",
          "Wrote the incident notes for three outages and drove the follow-up work to completion.",
        ],
      },
      {
        heading: "Software Engineer - Douro Analytics, Porto",
        dates: "Jun 2019 - Apr 2022",
        bullets: [
          P4,
          "Replaced a nightly export with an incremental pipeline, bringing data freshness from 24 hours to 15 minutes.",
          "Tuned the 12 slowest PostgreSQL queries behind the customer dashboard, halving median load time.",
          "Introduced review checklists that took production defects from 14 a quarter to 4.",
        ],
      },
      {
        heading: "Junior Software Engineer - Atlantic Retail Group, Matosinhos",
        dates: "Sep 2017 - May 2019",
        bullets: [
          "Built the price-change tool used by 240 stores, replacing a weekly spreadsheet cycle.",
          "Automated stock reports that had cost finance six hours every Monday.",
          "Shipped the first component set used across three internal applications.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Ledger rewrite (Ledgerly)",
        body: "Moved four years of payment history onto a double-entry model over nine weeks, running old and new balances side by side until they agreed to the cent.",
      },
      {
        heading: "Payout scheduler (Ledgerly)",
        body: "A retry-aware batch runner with an operator console showing exactly why a payout is held, now handling 40,000 payouts a month.",
      },
    ],
    education: ["BSc Informatics Engineering, Universidade do Porto, 2017"],
    certifications: [],
    languages: [
      "Portuguese - native speaker, born and educated in Porto.",
      R6,
      "French - basic reading knowledge from school.",
    ],
  },

  evidence_sentences: [R1, R2, R3, R4, R5, R6, P1, P4],

  targets: {
    band: "top",
    verdicts: {
      R1: "M",
      R2: "M",
      R3: "M",
      R4: "M",
      R5: "M",
      R6: "M",
      P1: "M",
      P2: "X",
      P3: "P",
      P4: "M",
    },
  },
};

export default dossier;
