import type { Dossier } from "../types";

const R1 =
  "Nine years building production React and TypeScript applications for paying customers.";
const R3 =
  "Owned pricing and payroll features end to end, from schema design to shipped UI reviewed by finance.";
const R2 =
  "Wrote the SQL and relational data modelling for tenant billing in Postgres, shipping 40 migrations without a rollback.";
const R4 =
  "Practical experience of the row-level security model that keeps 620 multi-tenant workspaces in strict isolation.";
const R5 =
  "Maintain 1,900 automated tests, unit in Vitest and end-to-end in Playwright, green on every merge.";
const P1 =
  "Built multi-tenant SaaS for 620 payroll clients with per-tenant data isolation audited twice a year.";
const P2 =
  "Joined an early-stage, founder-led team as engineer number four and grew it to 22 people.";
const P4 =
  "Rebuilt and shipped the merchant admin console on Remix, the full-stack React framework, cutting first paint to 900 ms.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2016.";

export const dossier: Dossier = {
  slug: "helena-carvalho",
  full_name: "Helena Carvalho",
  email: "helena.carvalho91@gmail.com",
  phone: "+351 912 447 802",
  city: "Lisbon",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: "https://www.linkedin.com/in/helena-carvalho-hcv",
  portfolio_url: null,

  headline: "Lead Full-Stack Engineer",
  years_experience: 9,
  react_ts_years: 9,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: [
    "Postgres row-level security",
    "Multi-tenant SaaS data isolation",
    "Database migrations in production",
  ],
  q4: "At Pluma HR I owned the variable pay run, from the data model to the screen finance signs off on. I designed the Postgres tables for pay components and their history, wrote the migrations, then built the review UI where a payroll manager approves a run line by line. The hard part was proving each workspace only ever reads its own figures, so the model went in behind row-level security with tests for every policy. It shipped to 620 workspaces and cut the monthly payroll close from three days to four hours, with no correction runs since launch.",
  cover_letter:
    "I have spent the last four years turning a four-person product into a payroll platform 620 companies run their month on, and the work I enjoy most is exactly what this role describes: taking a feature from the schema to the screen and owning what happens after it ships.\n\nI am ready for a hands-on lead role again in Lisbon, mentoring a small senior team rather than managing a large one. Northwind's shortlist promise and the way the role is written suggest a team that cares about the same things I do.",

  availability: "4 weeks' notice",
  compensation: {
    target: 72000,
    expected_min: 68000,
    expected_max: 76000,
    display: "EUR 72,000 per year (base)",
  },

  skills: [
    "React",
    "TypeScript",
    "Node.js",
    "PostgreSQL",
    "row-level security",
    "Remix",
    "Vitest",
    "Playwright",
  ],
  languages: ["Portuguese - native", "English - fluent (C2)", "Spanish - conversational"],
  education: [
    {
      institution: "Universidade Nova de Lisboa",
      degree: "MSc Computer Engineering",
      end: "2015",
    },
  ],
  certifications: ["AWS Certified Solutions Architect - Associate (2021)"],
  experience: [
    {
      company: "Pluma HR",
      title: "Lead Full-Stack Engineer",
      start: "2022-03",
      end: null,
      summary:
        "Fourth engineer on a founder-led HR SaaS; owns billing, payroll and the tenant isolation model for 620 workspaces.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Orbital Commerce",
      title: "Senior Software Engineer",
      start: "2019-01",
      end: "2022-02",
      summary:
        "Rebuilt the merchant admin console and the order search that serves 4,200 stores.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Tagus Systems",
      title: "Software Engineer",
      start: "2016-09",
      end: "2018-12",
      summary:
        "Built internal tools and reporting for logistics clients; first exposure to relational modelling at scale.",
      location: "Lisbon, Portugal",
    },
  ],
  recruiter_summary:
    "Helena leads engineering on a founder-led HR SaaS in Lisbon, where she owns billing and payroll from the data model to the reviewed screen for 620 client workspaces. She designed the tenant isolation model behind row-level security and keeps a 1,900-test suite green across Vitest and Playwright. Nine years with React and TypeScript, available on four weeks' notice.",

  cv: {
    name: "Helena Carvalho",
    title: "Lead Full-Stack Engineer",
    contact:
      "Lisbon, Portugal · helena.carvalho91@gmail.com · +351 912 447 802 · linkedin.com/in/helena-carvalho-hcv",
    summary: `${R1} ${R3} I work closest to the money in a product: billing, payroll and the guarantees a finance team needs before it trusts a number on screen. Comfortable being the most senior engineer in the room and still writing the difficult parts myself.`,
    coreSkills:
      "Core skills: Node.js, GraphQL, Redis, Docker, GitHub Actions, AWS, OpenTelemetry, incident response, technical mentoring.",
    experience: [
      {
        heading: "Lead Full-Stack Engineer - Pluma HR, Lisbon",
        dates: "Mar 2022 - Present",
        bullets: [
          R2,
          R4,
          R5,
          P1,
          P2,
          "Reviewed an internal conversational assistant pilot for the support team over two weeks of prototyping.",
          "Cut the monthly payroll close from three days to four hours for 620 client workspaces, with zero correction runs since launch.",
          "Ran the weekly release review for a team of six and kept the change log readable for support staff.",
          "Reduced the on-call pages from 14 a month to 4 by fixing the three alerts that fired most often.",
          "Wrote the onboarding notes that took new joiners from first commit in eight days to two.",
          "Mentored two engineers through their first production incidents, both now lead their own areas.",
          "Presented the pay-run redesign to the finance team and rewrote three screens after their feedback.",
        ],
      },
      {
        heading: "Senior Software Engineer - Orbital Commerce, Lisbon",
        dates: "Jan 2019 - Feb 2022",
        bullets: [
          P4,
          "Replaced a 14-second order search with a PostgreSQL full-text index that answers in under 300 ms for 4,200 merchants.",
          "Led the checkout rewrite that lifted completed orders by 11% in the first quarter after release.",
          "Ran the on-call rotation for two years and brought the weekly page count from nine to two.",
        ],
      },
      {
        heading: "Software Engineer - Tagus Systems, Lisbon",
        dates: "Sep 2016 - Dec 2018",
        bullets: [
          "Built the freight reporting suite that replaced 30 spreadsheets across four logistics clients.",
          "Reduced a nightly reconciliation job from 50 minutes to 6 by rewriting its queries against indexed views.",
          "Wrote the first internal component library, adopted by three product teams within a year.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Tenant isolation rewrite (Pluma HR)",
        body: "Moved 620 workspaces from application-level filtering to database policies over six weeks, with a policy test for every table and no customer downtime.",
      },
      {
        heading: "Payroll approval console (Pluma HR)",
        body: "Built on TanStack Start, a full-stack React framework: a line-by-line review screen for payroll managers, with an immutable audit trail that survived an external payroll audit in 2024 with no findings.",
      },
    ],
    education: ["MSc Computer Engineering, Universidade Nova de Lisboa, 2015"],
    certifications: ["AWS Certified Solutions Architect - Associate, 2021"],
    languages: [
      "Portuguese - native speaker, born and educated in Lisbon.",
      R6,
      "Spanish - conversational, used weekly with two Madrid clients.",
    ],
  },

  evidence_sentences: [R1, R2, R3, R4, R5, R6, P1, P2, P4],

  targets: {
    band: "exceptional",
    verdicts: {
      R1: "M",
      R2: "M",
      R3: "M",
      R4: "M",
      R5: "M",
      R6: "M",
      P1: "M",
      P2: "M",
      P3: "P",
      P4: "M",
    },
  },
};

export default dossier;
