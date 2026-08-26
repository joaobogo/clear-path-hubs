import type { Dossier } from "../types";

const R1 =
  "Six years building production React and TypeScript applications for payment products.";
const R3 =
  "Owned the merchant dashboard end to end, from schema design to shipped UI used by 1,200 merchants.";
const R2 =
  "Handle the SQL and relational data modelling for transactions in Postgres, including the migrations behind the settlement rewrite.";
const R5 =
  "Wrote the automated tests for settlement: unit specs in Vitest and end-to-end runs in Playwright.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2020.";

export const dossier: Dossier = {
  slug: "gabriel-souza",
  full_name: "Gabriel Souza",
  email: "gabriel.souza.dev@gmail.com",
  phone: "+55 11 98442-7130",
  city: "São Paulo",
  region: "SP",
  country: "Brazil",
  timezone: "America/Sao_Paulo",
  linkedin_url: null,
  portfolio_url: null,

  headline: "Full-Stack Engineer",
  years_experience: 6,
  react_ts_years: 6,
  eu_right_to_work: false,
  visa_required: true,
  work_authorization_notes:
    "Brazilian national living in São Paulo; would need a work visa and sponsorship for Portugal.",
  multi_choice: ["Database migrations in production"],
  q4: "At Paulista Pay I owned the merchant dashboard. I modelled transactions, settlements and disputes in Postgres, wrote the migrations for the settlement rewrite, and built the screen where a merchant sees what has been paid, what is held and why. The part that changed behaviour was the dispute panel: the reason, the deadline and the documents needed are all on one screen, so merchants stopped calling to ask what to send. Around 1,200 merchants use it daily and disputes answered within the deadline went from 58% to 86% in two quarters.",
  cover_letter: null,

  availability: "2 months (would need a visa)",
  compensation: {
    target: 60000,
    expected_min: 55000,
    expected_max: 64000,
    display: "EUR 60,000 per year (base)",
  },

  skills: ["React", "TypeScript", "PostgreSQL", "Node.js", "Vitest", "Playwright", "SQL"],
  languages: ["Portuguese - native", "English - fluent (C1)", "Spanish - intermediate"],
  education: [
    {
      institution: "Universidade de São Paulo",
      degree: "BSc Computer Engineering",
      end: "2019",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Paulista Pay",
      title: "Full-Stack Engineer",
      start: "2021-08",
      end: null,
      summary:
        "Owns the merchant dashboard and the settlement data model at a Brazilian payments company.",
      location: "São Paulo, Brazil",
    },
    {
      company: "Ipiranga Digital",
      title: "Software Engineer",
      start: "2019-06",
      end: "2021-07",
      summary: "Built commerce and logistics web applications for retail clients.",
      location: "São Paulo, Brazil",
    },
  ],
  recruiter_summary:
    "Gabriel owns the merchant dashboard at a São Paulo payments company, from the Postgres settlement model to the screen 1,200 merchants use daily. His dispute panel raised on-time dispute responses from 58% to 86%. Six years with React and TypeScript; he is based in Brazil and would need a work visa for Portugal.",

  cv_filename: "Gabriel Souza - Curriculo 2026.pdf",

  cv: {
    layout: "T1",
    targetPages: 2,
    name: "Gabriel Souza",
    title: "Full-Stack Engineer",
    contact: "São Paulo, Brazil · gabriel.souza.dev@gmail.com · +55 11 98442-7130",
    summary: `${R1} ${R3} Payments in Brazil move quickly and break loudly, which has taught me to make failure states legible rather than hidden. I work well with product people and prefer shipping small changes often.`,
    coreSkills:
      "Core skills: Node.js, SQL, Redis, Docker, GitHub Actions, AWS, observability, payment integrations.",
    experience: [
      {
        heading: "Full-Stack Engineer - Paulista Pay, São Paulo",
        dates: "Aug 2021 - Present",
        bullets: [
          R2,
          R5,
          "Raised disputes answered within the deadline from 58% to 86% in two quarters.",
          "Built the settlement view that removed about 500 support calls a month.",
          "Cut dashboard load time from 3.8 s to 1.1 s for 1,200 merchants.",
          "Helped scope a partner sandbox with some exposure to multi-tenant setups.",
          "Rebuilt the payout timeline so merchants could see each step of a transfer without calling support.",
          "Reduced duplicate transaction reports by a third by matching on the acquirer reference.",
          "Wrote the reconciliation checklist the finance team still uses at month end.",
          "Trained two support agents to read the settlement logs, which removed most escalations to engineering.",
          "Cut the dispute export from 40 minutes to under 2 by streaming the file instead of building it in memory.",
        ],
      },
      {
        heading: "Software Engineer - Ipiranga Digital, São Paulo",
        dates: "Jun 2019 - Jul 2021",
        bullets: [
          "Delivered order tracking for a retailer shipping 30,000 parcels a month.",
          "Rebuilt a returns flow that cut refund processing from nine days to three.",
          "Replaced hand-written PostgreSQL reports with a shared query layer used by two teams.",
          "Cut a nightly stock sync from three hours to 30 minutes by batching the writes.",
          "Added the project's first automated checks after two releases broke the checkout page.",
          "Wrote the deployment notes that let three engineers release instead of one.",
          "Trained two client staff to publish content changes themselves, removing 20 tickets a month.",
          "Reduced customer support emails about delivery dates by a third by showing the carrier estimate.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Dispute panel (Paulista Pay)",
        body: "Reason, deadline and required documents on one screen, built after listening to two weeks of support calls.",
      },
      {
        heading: "Settlement rewrite (Paulista Pay)",
        body: "A new settlement model rolled out over seven weeks with both calculations compared daily until they matched to the cent.",
      },
    ],
    education: ["BSc Computer Engineering, Universidade de São Paulo, 2019"],
    certifications: [],
    languages: [
      "Portuguese - native speaker, born and educated in São Paulo.",
      R6,
      "Spanish - intermediate, used with two Buenos Aires partners.",
    ],
  },

  evidence_sentences: [R1, R2, R3, R5, R6],

  targets: {
    band: "disqualified",
    verdicts: {
      R1: "M",
      R2: "M",
      R3: "M",
      R4: "P",
      R5: "M",
      R6: "M",
      P1: "P",
      P2: "X",
      P3: "X",
      P4: "X",
    },
  },
};

export default dossier;
