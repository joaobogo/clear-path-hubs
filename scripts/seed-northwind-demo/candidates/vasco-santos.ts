import type { Dossier } from "../types";

const R1 =
  "Seven years building production React and TypeScript applications for insurance brokers.";
const R3 =
  "Owned the claims intake feature end to end, from schema design to shipped UI used in branches.";
const R2 =
  "Responsible for the SQL and relational data modelling of policies in Postgres, including the migrations behind two product launches.";
const P4 =
  "Delivered the broker workspace on Remix, a full-stack React framework similar to TanStack Start, halving time to first render.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2018.";

export const dossier: Dossier = {
  slug: "vasco-santos",
  full_name: "Vasco Santos",
  email: "vasco.santos.eng@gmail.com",
  phone: "+351 917 552 604",
  city: "Setúbal",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: "https://www.linkedin.com/in/vasco-santos-vsn",
  portfolio_url: null,

  headline: "Senior Full-Stack Engineer",
  years_experience: 7,
  react_ts_years: 7,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: ["Database migrations in production"],
  q4: "At Segura Digital I owned claims intake. I modelled claims, documents and decision history in Postgres, wrote the migrations that merged two legacy claim shapes into one, and built the intake screen a branch clerk now completes with the customer on the phone. The work I am proudest of is the evidence checklist: the screen refuses to submit a claim missing a required document, which is what removed most of the back and forth with the assessment team. Average time to a first decision fell from eleven days to four across 90 branches.",
  cover_letter:
    "Insurance is unglamorous and precise, which suits me. I have spent four years owning claims intake for 90 branches, from the tables through to the screen a clerk uses while a customer waits on the line.\n\nI live in Setúbal and travel into Lisbon comfortably. I am looking for a product team where engineers see the consequences of their own releases, and I can start in a month.",

  availability: "1 month",
  compensation: {
    target: 68000,
    expected_min: 64000,
    expected_max: 72000,
    display: "EUR 68,000 per year (base)",
  },

  skills: ["React", "TypeScript", "PostgreSQL", "Remix", "Node.js", "Azure", "SQL"],
  languages: ["Portuguese - native", "English - fluent (C1)", "Spanish - intermediate"],
  education: [
    {
      institution: "Instituto Politécnico de Setúbal",
      degree: "BSc Computer Engineering",
      end: "2018",
    },
  ],
  certifications: ["Microsoft Certified: Azure Developer Associate (2022)"],
  experience: [
    {
      company: "Segura Digital",
      title: "Senior Full-Stack Engineer",
      start: "2021-09",
      end: null,
      summary:
        "Owns claims intake and the policy data model for an insurtech serving 90 broker branches.",
      location: "Setúbal, Portugal",
    },
    {
      company: "Sado Consulting",
      title: "Software Engineer",
      start: "2018-06",
      end: "2021-08",
      summary:
        "Delivered internal systems for insurance and utility clients, mostly line-of-business web applications.",
      location: "Setúbal, Portugal",
    },
  ],
  recruiter_summary:
    "Vasco owns claims intake at an insurtech, from the Postgres policy model and its migrations to the screen 90 branches use with customers on the phone. His evidence checklist cut time to a first decision from eleven days to four. Seven years with React and TypeScript, available in a month.",

  cv_filename: "CV_VascoSantos.pdf",

  cv: {
    layout: "T1",
    targetPages: 2,
    dateStyle: "numeric",
    name: "Vasco Santos",
    title: "Senior Full-Stack Engineer",
    contact:
      "Setúbal, Portugal · vasco.santos.eng@gmail.com · +351 917 552 604 · linkedin.com/in/vasco-santos-vsn",
    summary: `${R1} ${R3} Claims work rewards people who read the small print, and I have become one of them. I prefer owning a narrow part of a product deeply over touching everything shallowly.`,
    coreSkills:
      "Core skills: Node.js, Azure, SQL Server, Redis, Azure DevOps, document workflows, regulatory reporting.",
    experience: [
      {
        heading: "Senior Full-Stack Engineer - Segura Digital, Setúbal",
        dates: "Sep 2021 - Present",
        bullets: [
          R2,
          "Brought average time to a first claim decision from eleven days to four across 90 branches.",
          "Built the evidence checklist that removed 40% of the queries going back to assessment staff.",
          "Contributed to the Playwright suite covering the claims intake journey.",
          "Some hands-on time with multi-tenant setups when we opened a partner-branded quote page.",
          "Reviewed an AI document-reading trial for two weeks and recommended against adopting it.",
          "Cut the release pipeline from 14 minutes to 7 and removed two checks that never failed usefully.",
          "Ran a monthly bug review with the support desk and closed 30 old tickets in three months.",
          "Wrote the runbook that let a colleague take her first on-call week without escalating.",
          "Paired with a new joiner for three months; he shipped his first change in the second week.",
          "Reduced repeat questions from the operations team by rewriting the three most confusing screens.",
        ],
      },
      {
        heading: "Software Engineer - Sado Consulting, Setúbal",
        dates: "Jun 2018 - Aug 2021",
        bullets: [
          P4,
          "Replaced a paper renewal process for an insurer, moving 22,000 renewals a year online.",
          "Cut a regulatory report from two days of manual work to a 20-minute scheduled job.",
          "Rewrote the PostgreSQL queries behind a broker dashboard, taking load time under one second.",
          "Delivered a client intranet used daily by 700 staff across three offices.",
          "Reduced a weekly reporting job from two hours to 12 minutes by rewriting its queries.",
          "Added the project's first automated checks after two releases broke the same screen.",
          "Wrote the setup guide that took new consultants from zero to running the app in an hour.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Claim shape merge (Segura Digital)",
        body: "Two legacy claim structures brought onto one model over eight weeks, with a reconciliation report run daily until the numbers matched.",
      },
      {
        heading: "Branch intake screen (Segura Digital)",
        body: "A guided form built around what a clerk can realistically ask while a customer waits, now used for 4,000 claims a month.",
      },
    ],
    education: ["BSc Computer Engineering, Instituto Politécnico de Setúbal, 2018"],
    certifications: ["Microsoft Certified: Azure Developer Associate, 2022"],
    languages: [
      "Portuguese - native speaker, born and educated in Setúbal.",
      R6,
      "Spanish - intermediate, used with a Seville broker network.",
    ],
  },

  evidence_sentences: [R1, R2, R3, R6, P4],

  targets: {
    band: "strong",
    verdicts: {
      R1: "M",
      R2: "M",
      R3: "M",
      R4: "P",
      R5: "P",
      R6: "M",
      P1: "X",
      P2: "X",
      P3: "P",
      P4: "M",
    },
  },
};

export default dossier;
