/**
 * The fixture CV document, shared by the renderer and the scorer so both read
 * exactly the same text. Split out because scoring text that differs from the
 * text in the PDF would prove nothing.
 */
import type { CvDoc } from "./seed-northwind-demo/types";

export const cv: CvDoc = {
  layout: "T1",
  targetPages: 2,
  name: "João Kasprzak",
  title: "Principal Full-Stack Engineer",
  contact: "Lisbon, Portugal · joao.kasprzak@example.com · +351 913 002 118 · linkedin.com/in/joao-kasprzak",

  // R1, R2, R3, R4, R5 and P1 all stated plainly, each as a capability rather
  // than a mirror of the requirement's phrasing.
  summary:
    "Principal full-stack engineer with eleven years building production React and TypeScript applications for paying customers. " +
    "I own features end to end, from Postgres schema design and migrations through to the shipped UI a finance team signs off on. " +
    "I write the SQL and the relational data modelling myself, and I keep multi-tenant products honest with row-level security that is tested policy by policy. " +
    "I maintain the automated tests that protect that work — unit and end-to-end — and I have shipped language-model features to production as a working part of the product.",

  coreSkills:
    "TypeScript · React · Remix · Node.js · Postgres · row-level security · database migrations · Vitest · Playwright · multi-tenant SaaS · LLM product features",

  experience: [
    {
      heading: "Principal Engineer — Vantage Ledger, Lisbon",
      dates: "Feb 2021 – Present",
      bullets: [
        // R1 + R3
        "Lead the product engineering group on a React and TypeScript application used daily by 4,100 finance staff, owning each feature from the data model through to the screen a controller approves.",
        // R2
        "Wrote the SQL and the relational data modelling for the billing and ledger schema in Postgres, shipping 63 migrations that every one of them held in production.",
        // R4 + P1
        "Designed the multi-tenant isolation model: every table sits behind Postgres row-level security, so each of the 840 client workspaces reads only its own figures, and the policies are audited twice a year.",
        // R5
        "Maintain a suite of 2,400 automated tests — unit in Vitest, end-to-end in Playwright — kept green on every merge and required before any deploy.",
        // P3, the requirement Helena only partially evidences.
        "Shipped an AI feature into the product: a large language model drafts the narrative for each monthly close, reviewed in-app before publication, now used on 840 workspaces every month.",
      ],
    },
    {
      heading: "Senior Full-Stack Engineer — Corvo Payments, Lisbon",
      dates: "Aug 2017 – Jan 2021",
      bullets: [
        // P2
        "Joined an early-stage, founder-led team as engineer number three and grew the engineering group to 26 people over three years.",
        // P4 — the named-product gate needs the word itself, in prose.
        "Rebuilt the merchant administration console on Remix, the full-stack React framework, taking first contentful paint from 3.1 seconds to 840 milliseconds.",
        // R2 reinforced
        "Modelled the settlement and reconciliation tables in Postgres and owned the migration path as the ledger grew past 90 million rows.",
        // R5 reinforced
        "Introduced end-to-end tests in Playwright across the payment flows, taking release regressions from a weekly occurrence to a clean record across the final eleven months.",
      ],
    },
    {
      heading: "Full-Stack Engineer — Atlas Rota, Porto",
      dates: "Sep 2014 – Jul 2017",
      bullets: [
        "Built scheduling features in React and TypeScript for a workforce product serving 1,200 sites across Portugal and Spain.",
        "Designed the Postgres schema for shift patterns and their history, and wrote the migrations that carried three years of live data through it.",
      ],
    },
  ],

  selectedWork: [
    {
      heading: "Tenant isolation for a regulated ledger",
      // R4 + P1, restated as a narrative so the evidence has substance.
      body:
        "Vantage Ledger holds financial records for 840 client workspaces in one database. I designed the isolation model, putting every table behind Postgres row-level security with a policy per access path, and wrote the test suite that proves a workspace can read only its own rows. External auditors review the policies twice a year and have signed them off at every review since the model shipped.",
    },
    {
      heading: "Language-model narrative for the monthly close",
      // P3, restated. Named as a shipped product feature, in production.
      body:
        "Finance teams spent hours writing the commentary that accompanies a monthly close. I built the feature that drafts it with a large language model, grounded in the figures already in the ledger, with an in-app review step before anything is published. It shipped to all 840 workspaces and is used every month; the drafting step takes the commentary from roughly two hours to fifteen minutes.",
    },
    {
      heading: "Merchant console rebuild on Remix",
      // P4, restated with the product named again in prose.
      body:
        "The Corvo merchant console had grown slow enough that support fielded complaints about it. I rebuilt it on Remix, the full-stack React framework, moving data loading to the server and cutting first contentful paint from 3.1 seconds to 840 milliseconds. Support tickets about console performance stopped within a month of release.",
    },
    {
      heading: "End-to-end coverage as a release gate",
      // R5 restated.
      body:
        "I introduced the automated test suite that now gates every deploy: unit tests in Vitest for the domain logic and end-to-end tests in Playwright for the paths a customer actually walks. The suite runs on every merge, and a red run blocks release.",
    },
  ],

  education: [
    "MSc Software Engineering — Universidade do Porto, 2014",
    "BSc Computer Science — Universidade de Coimbra, 2012",
  ],

  certifications: [
    "AWS Certified Solutions Architect — Associate (2023)",
  ],

  // R6 — the English line carries the fluency evidence.
  languages: [
    "Portuguese — native.",
    "English — fluent, written and spoken (C2); my working language since 2014, including four years with a distributed team across the UK and Ireland.",
    "Spanish — professional working proficiency.",
  ],

  interests:
    "Volunteer mentor for a Lisbon programme that helps career-changers into their first engineering role.",
};
