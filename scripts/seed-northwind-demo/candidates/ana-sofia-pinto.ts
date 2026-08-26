import type { Dossier } from "../types";

const R1 =
  "Eight years building production React and TypeScript applications before moving into management.";
const R3 =
  "Owned the reporting feature end to end, from schema design to shipped UI used by 200 analysts.";
const R2 =
  "Led the SQL and relational data modelling of the metrics warehouse in Postgres, with 50 migrations delivered on schedule.";
const P1 =
  "Beacon Analytics is multi-tenant SaaS for 140 client accounts with per-tenant data isolation.";
const P2 =
  "Second engineer in an early-stage, founder-led team, later its engineering manager.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2014.";

export const dossier: Dossier = {
  slug: "ana-sofia-pinto",
  full_name: "Ana Sofia Pinto",
  email: "anasofia.pinto@gmail.com",
  phone: "+351 918 330 476",
  city: "Lisbon",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: null,
  portfolio_url: null,

  headline: "Engineering Manager",
  years_experience: 12,
  react_ts_years: 8,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: ["Multi-tenant SaaS data isolation", "Database migrations in production"],
  q4: "At Beacon Analytics I owned scheduled reporting. I modelled report definitions, runs and delivery attempts in Postgres, wrote the migrations that moved 140 client accounts onto the new shape, and built the screen where an analyst composes a report, previews it and picks who receives it. What made it work was making failures visible: a failed delivery shows the reason and can be retried from the same screen. It replaced a nightly script nobody trusted and now sends about 4,000 reports a month with under 1% needing a manual retry.",
  cover_letter:
    "I have spent the last two years as an engineering manager and I miss the work. I am applying because this role is explicitly hands-on, from data model to shipped screen, which is what I was good at for the eight years before I started managing.\n\nI am not looking to keep a team; I want to be a senior individual contributor again. I can start in two months and would rather be honest about that than pretend otherwise.",

  availability: "2 months",
  compensation: {
    target: 75000,
    expected_min: 70000,
    expected_max: 80000,
    display: "EUR 75,000 per year (base)",
  },

  skills: ["React", "TypeScript", "PostgreSQL", "Node.js", "SQL", "multi-tenant SaaS", "coaching"],
  languages: ["Portuguese - native", "English - fluent (C2)", "French - intermediate"],
  education: [
    {
      institution: "Universidade de Aveiro",
      degree: "MSc Computer Engineering",
      end: "2013",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Beacon Analytics",
      title: "Engineering Manager",
      start: "2024-06",
      end: null,
      summary:
        "Leads a team of nine on a multi-tenant analytics platform; previously owned reporting and the metrics data model.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Marfim Software",
      title: "Senior Software Engineer",
      start: "2018-03",
      end: "2024-05",
      summary:
        "Built the reporting product and the metrics warehouse behind it for 140 client accounts.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Estrela Tech",
      title: "Software Engineer",
      start: "2014-01",
      end: "2018-02",
      summary: "Worked on customer-facing dashboards and the data ingestion layer feeding them.",
      location: "Lisbon, Portugal",
    },
  ],
  recruiter_summary:
    "Ana Sofia manages a team of nine at an analytics platform after eight years as a hands-on engineer, and is applying to return to individual contribution. She owned scheduled reporting from the Postgres model to the analyst screen, and the metrics warehouse behind 140 client accounts. Available in two months.",

  cv: {
    name: "Ana Sofia Pinto",
    title: "Engineering Manager",
    contact: "Lisbon, Portugal · anasofia.pinto@gmail.com · +351 918 330 476",
    summary: `${R1} ${R3} Two years of management taught me what I want, which is to be a senior engineer on a product team again. I still review designs and read every migration my team writes.`,
    coreSkills:
      "Core skills: Node.js, SQL, Redis, Airflow, AWS, hiring and interviewing, incident review, mentoring.",
    experience: [
      {
        heading: "Engineering Manager - Beacon Analytics, Lisbon",
        dates: "Jun 2024 - Present",
        bullets: [
          P1,
          "Grew the team from five to nine and kept quarterly delivery commitments in all four quarters.",
          "Cut time from first commit to production for a new joiner from six weeks to nine days.",
          "Ran the incident review process that took repeat outages from seven a quarter to one.",
        ],
      },
      {
        heading: "Senior Software Engineer - Marfim Software, Lisbon",
        dates: "Mar 2018 - May 2024",
        bullets: [
          R2,
          P2,
          "Shipped scheduled reporting now sending about 4,000 reports a month with under 1% retried by hand.",
          "Replaced a nightly script with a queue that made failures visible and retryable in one click.",
          "Took the analyst dashboard from 4.6 s to 1.3 s by reshaping its queries and caching layer.",
        ],
      },
      {
        heading: "Software Engineer - Estrela Tech, Lisbon",
        dates: "Jan 2014 - Feb 2018",
        bullets: [
          "Built the ingestion layer that took daily data volume from 2 GB to 40 GB without redesign.",
          "Delivered the first customer-facing dashboard, adopted by 60 accounts in its first year.",
          "Wrote the on-call handbook still used by the team today.",
          "Ran the weekly delivery review for nine engineers and kept its notes to one readable page.",
          "Cut time to first review on pull requests from two days to four hours across two teams.",
          "Reduced the on-call pages from 18 a month to 6 by fixing the noisiest three alerts.",
          "Coached four engineers through promotion, two of them into their first lead roles.",
          "Rewrote the hiring loop after 12 interviews, which cut candidate time to offer from five weeks to two.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Metrics warehouse (Marfim Software)",
        body: "A reshaped model for 140 client accounts, delivered over three months with old and new figures compared daily until they agreed.",
      },
      {
        heading: "Report composer (Marfim Software)",
        body: "A screen where an analyst builds, previews and schedules a report without asking an engineer, which removed a standing queue of about 30 requests.",
      },
    ],
    education: ["MSc Computer Engineering, Universidade de Aveiro, 2013"],
    certifications: [],
    languages: [
      "Portuguese - native speaker, born and educated in Aveiro.",
      R6,
      "French - intermediate, used with a Lyon client for two years.",
    ],
  },

  evidence_sentences: [R1, R2, R3, R6, P1, P2],

  targets: {
    band: "strong",
    verdicts: {
      R1: "M",
      R2: "M",
      R3: "M",
      R4: "P",
      R5: "X",
      R6: "M",
      P1: "M",
      P2: "M",
      P3: "X",
      P4: "X",
    },
  },
};

export default dossier;
