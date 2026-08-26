import type { Dossier } from "../types";

const R1 =
  "Seven years building production React and TypeScript applications for an online marketplace.";
const R3 =
  "Owned seller payouts end to end, from schema design to shipped UI used by 5,000 sellers.";
const R2 =
  "Own the SQL and relational data modelling for orders in Postgres, including the migrations behind two payout redesigns.";
const R5 =
  "Wrote the automated tests around payouts: unit specs in Vitest and end-to-end runs in Playwright.";
const P1 =
  "Mercado Nube is multi-tenant SaaS for 5,000 seller accounts with per-tenant data isolation.";
const P3 =
  "Daily exposure to AI work: shipped LLM-backed search as product features in production, live for 5,000 sellers since 2024.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2018.";

export const dossier: Dossier = {
  slug: "laura-fernandez",
  full_name: "Laura Fernández",
  email: "laura.fernandez.dev@gmail.com",
  phone: "+34 612 448 907",
  city: "Madrid",
  region: "",
  country: "Spain",
  timezone: "Europe/Madrid",
  linkedin_url: "https://www.linkedin.com/in/laura-fernandez-lfz",
  portfolio_url: null,

  headline: "Senior Full-Stack Engineer",
  years_experience: 7,
  react_ts_years: 7,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Spanish national; EU right to work, no sponsorship needed.",
  multi_choice: [
    "Multi-tenant SaaS data isolation",
    "Database migrations in production",
    "AI or LLM product features",
  ],
  q4: "At Mercado Nube I owned seller payouts. I modelled orders, fees and payout batches in Postgres, wrote the migrations for two redesigns, and built the screen where a seller sees exactly what they will be paid and why. The detail that mattered was the breakdown: every deduction is named and linked to the order that caused it, which is what stopped the weekly arguments with our support team. Payout queries dropped by about 60% and 5,000 sellers now get a statement they can reconcile themselves without contacting us.",
  cover_letter:
    "I am in Madrid and looking for a fully remote role in the same time zone, which is why this one caught my attention. My last four years have been payouts and search on a marketplace with 5,000 sellers.\n\nI have shipped a language-model search feature to production and learned where it helps and where it quietly makes things worse. I can start in a month and work Portuguese business hours without difficulty.",

  availability: "1 month",
  compensation: {
    target: 70000,
    expected_min: 66000,
    expected_max: 74000,
    display: "EUR 70,000 per year (base)",
  },

  skills: [
    "React",
    "TypeScript",
    "PostgreSQL",
    "Node.js",
    "multi-tenant SaaS",
    "Vitest",
    "Playwright",
    "pgvector",
  ],
  languages: ["Spanish - native", "English - fluent (C1)", "Portuguese - intermediate"],
  education: [
    {
      institution: "Universidad Politécnica de Madrid",
      degree: "BSc Software Engineering",
      end: "2018",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Mercado Nube",
      title: "Senior Full-Stack Engineer",
      start: "2021-03",
      end: null,
      summary:
        "Owns seller payouts and marketplace search on a multi-tenant marketplace with 5,000 seller accounts.",
      location: "Madrid, Spain",
    },
    {
      company: "Castilla Software",
      title: "Software Engineer",
      start: "2018-07",
      end: "2021-02",
      summary:
        "Built retail and logistics web applications, mostly order management and warehouse tooling.",
      location: "Madrid, Spain",
    },
  ],
  recruiter_summary:
    "Laura owns seller payouts and search at a Madrid marketplace with 5,000 seller accounts, from the Postgres order model to the statement a seller reconciles alone. Her payout breakdown cut support queries by about 60%, and she shipped the marketplace's language-model search to production. Seven years with React and TypeScript, looking for fully remote work in the same time zone.",

  cv_filename: "laura_fernandez_resume.pdf",

  cv: {
    layout: "T2",
    targetPages: 2,
    dateStyle: "numeric",
    name: "Laura Fernández",
    title: "Senior Full-Stack Engineer",
    contact:
      "Madrid, Spain · laura.fernandez.dev@gmail.com · +34 612 448 907 · linkedin.com/in/laura-fernandez-lfz",
    summary: `${R1} ${R3} Payouts taught me that clarity is a feature: a seller who understands their statement does not open a ticket. I work remotely and prefer written decisions over meetings.`,
    coreSkills:
      "Core skills: Node.js, pgvector, Redis, Docker, GitHub Actions, AWS, search relevance, payment reconciliation.",
    experience: [
      {
        heading: "Senior Full-Stack Engineer - Mercado Nube, Madrid",
        dates: "Mar 2021 - Present",
        bullets: [
          R2,
          R5,
          P1,
          P3,
          "Cut payout support queries by about 60% after naming and linking every deduction.",
          "Lifted search-to-purchase conversion by 9% in the quarter after the search rewrite.",
          "Reduced the payout batch run from 90 minutes to 12 by reshaping its queries.",
          "Cut the release pipeline from 13 minutes to 5 by parallelising the checks.",
          "Ran a monthly triage with the support desk and closed 34 old tickets in a quarter.",
          "Wrote the runbook that let two colleagues share on-call without escalating.",
          "Mentored a junior engineer for nine months; she now leads her own small project.",
          "Halved rework by writing acceptance notes with the product lead before each piece of work.",
        ],
      },
      {
        heading: "Software Engineer - Castilla Software, Madrid",
        dates: "Jul 2018 - Feb 2021",
        bullets: [
          "Rebuilt order management for a retailer handling 12,000 orders a week.",
          "Delivered warehouse scanning screens that cut picking errors from 3.1% to 0.7%.",
          "Replaced a nightly PostgreSQL export with an incremental feed, ending a recurring 6 a.m. failure.",
          "Shipped a merchant catalogue tool used by 2,100 sellers in its first year.",
          "Reduced a nightly sync from four hours to 40 minutes by batching the updates.",
          "Added the project's first automated checks after two consecutive broken releases.",
          "Wrote the onboarding guide that halved the time new engineers took to their first change.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Payout statement (Mercado Nube)",
        body: "Every deduction named and linked to the order behind it, which turned a weekly support argument into a screen sellers read on their own.",
      },
      {
        heading: "Search rewrite (Mercado Nube)",
        body: "Semantic ranking over 400,000 listings, launched behind a flag and compared against the old ranking for six weeks before it replaced it.",
      },
    ],
    education: ["BSc Software Engineering, Universidad Politécnica de Madrid, 2018"],
    certifications: [],
    languages: [
      "Spanish - native speaker, born and educated in Madrid.",
      R6,
      "Portuguese - intermediate, studied for three years and used weekly.",
    ],
  },

  evidence_sentences: [R1, R2, R3, R5, R6, P1, P3],

  targets: {
    band: "top",
    verdicts: {
      R1: "M",
      R2: "M",
      R3: "M",
      R4: "P",
      R5: "M",
      R6: "M",
      P1: "M",
      P2: "X",
      P3: "M",
      P4: "X",
    },
  },
};

export default dossier;
