import type { Dossier } from "../types";

const R1 =
  "Six years building and shipping React and TypeScript applications for a logistics marketplace.";
const R3 =
  "Owning carrier onboarding end to end, from schema design to the shipped UI 900 hauliers use every day.";
const R2 =
  "Write the SQL and relational data modelling for shipments in Postgres, including the migrations that split the routing tables.";
const R5 =
  "Wrote and keep maintaining the automated tests behind booking: unit coverage in Vitest and end-to-end runs in Playwright before every release.";
const P4 =
  "Rebuilt the carrier portal on Remix, a full-stack React framework similar to TanStack Start, cutting the first load from 4.1 s to 1.2 s.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2019.";

export const dossier: Dossier = {
  slug: "rui-almeida",
  full_name: "Rui Almeida",
  email: "rui.almeida.eng@outlook.com",
  phone: "+351 913 668 245",
  city: "Lisbon",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: null,
  portfolio_url: null,

  headline: "Full-Stack Engineer",
  years_experience: 6,
  react_ts_years: 6,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: ["Database migrations in production"],
  q4: "At Cargo Loop I owned carrier onboarding. I designed the Postgres tables for carriers, vehicles and insurance documents, wrote the migrations that moved 900 existing hauliers onto the new shape, and built the wizard a carrier now completes on their phone. The awkward part was document review: I added a queue where our operations team approves or rejects an upload with a reason, so nobody chases e-mail attachments any more. Onboarding time went from nine days to two, and 62% of carriers now finish without any help from us.",
  cover_letter:
    "I have spent four years on a marketplace where both sides of the transaction are demanding, and I have got used to owning a feature from the tables to the screen and then living with it in production.\n\nI am looking for a product team in Lisbon where I can keep that breadth and work with more senior engineers than I have around me today. I can start in a month.",

  availability: "1 month",
  compensation: {
    target: 65000,
    expected_min: 60000,
    expected_max: 68000,
    display: "EUR 65,000 per year (base)",
  },

  skills: ["React", "TypeScript", "PostgreSQL", "Remix", "Node.js", "Vitest", "Playwright"],
  languages: ["Portuguese - native", "English - fluent (C1)"],
  education: [
    {
      institution: "Universidade de Lisboa",
      degree: "BSc Computer Science",
      end: "2019",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Cargo Loop",
      title: "Full-Stack Engineer",
      start: "2021-04",
      end: null,
      summary:
        "Owns carrier onboarding and the booking flow on a logistics marketplace with 900 active hauliers.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Ponte Digital Agency",
      title: "Web Developer",
      start: "2019-06",
      end: "2021-03",
      summary:
        "Delivered client web applications and internal tools across retail and tourism accounts.",
      location: "Lisbon, Portugal",
    },
  ],
  recruiter_summary:
    "Rui owns carrier onboarding and booking at a Lisbon logistics marketplace, from the Postgres shipment model through the migrations to the wizard 900 hauliers use. He wrote the Vitest and Playwright suites that gate each release. Six years with React and TypeScript, available in a month.",

  cv: {
    layout: "T1",
    interests: 'Plays bass in a covers band; keeps a small allotment outside Porto.'.replace(/^/, ""),
    name: "Rui Almeida",
    title: "Full-Stack Engineer",
    contact: "Lisbon, Portugal · rui.almeida.eng@outlook.com · +351 913 668 245",
    summary: `${R1} ${R3} Marketplaces are where I have learned the most: two sets of users, both impatient, and every change visible the same afternoon. I prefer being the engineer who follows a feature all the way to release and then fixes what the first week reveals.`,
    coreSkills:
      "Core skills: Node.js, REST APIs, Redis, Docker, GitHub Actions, Google Cloud, mobile web performance.",
    experience: [
      {
        heading: "Full-Stack Engineer - Cargo Loop, Lisbon",
        dates: "Apr 2021 - Present",
        bullets: [
          R2,
          R5,
          P4,
          "Cut carrier onboarding from nine days to two, with 62% of hauliers finishing unaided.",
          "Built the document review queue that replaced a shared mailbox handling 300 uploads a month.",
          "Reduced booking abandonment by 18% after rewriting the price and availability step.",
          "Some hands-on time with multi-tenant setups while helping a colleague scope a partner sandbox.",
          "Cut the release pipeline from 15 minutes to 6 and removed the manual approval that blocked hotfixes.",
          "Ran a fortnightly review with support that closed 60 stale tickets in four months.",
          "Wrote the on-call runbook for two services after being the only person able to fix them.",
          "Mentored two junior engineers, one of whom now owns the reporting area end to end.",
          "Reduced repeat bug reports by a third by fixing the five screens support mentioned most.",
        ],
      },
      {
        heading: "Web Developer - Ponte Digital Agency, Lisbon",
        dates: "Jun 2019 - Mar 2021",
        bullets: [
          "Delivered 11 client projects in under two years, six of them still running unchanged.",
          "Rebuilt a tourism booking site that lifted mobile conversion by 24% in the first month.",
          "Set up the agency's shared component library, cutting new-project setup from a week to a day.",
          "Delivered a client booking site that handled 8,000 reservations in its first summer.",
          "Rebuilt an agency reporting page so the monthly report took minutes instead of a full afternoon.",
          "Wrote the deployment notes that let the agency release without waiting for one person.",
          "Trained two designers to make copy changes themselves, which removed about 30 small tickets a month.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Carrier onboarding wizard (Cargo Loop)",
        body: "A phone-first flow covering company details, vehicles and insurance documents, now completing 140 sign-ups a month with two operations staff instead of five.",
      },
      {
        heading: "Route price explainer (Cargo Loop)",
        body: "A small panel that shows a shipper why a quote costs what it does, which removed roughly 90 support tickets a month.",
      },
    ],
    education: ["BSc Computer Science, Universidade de Lisboa, 2019"],
    certifications: [],
    languages: [
      "Portuguese - native speaker, born and educated in Lisbon.",
      R6,
    ],
  },

  evidence_sentences: [R1, R2, R3, R5, R6, P4],

  targets: {
    band: "strong",
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
      P4: "M",
    },
  },
};

export default dossier;
