import type { Dossier } from "../types";

const R1 =
  "Ten years building production React and TypeScript applications for schools and universities.";
const R3 =
  "Owned assessment delivery end to end, from schema design to shipped UI used in live exams.";
const R2 =
  "Lead the SQL and relational data modelling for the assessment store in Postgres, with 80 migrations run without downtime.";
const R4 =
  "Enforced row-level security in the database so each institution reads its cohort in isolation.";
const R5 =
  "Own 2,600 automated tests, unit in Vitest and end-to-end in Playwright, blocking any red release.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2015.";

export const dossier: Dossier = {
  slug: "marta-nunes",
  full_name: "Marta Nunes",
  email: "marta.nunes.dev@gmail.com",
  phone: "+351 939 204 517",
  city: "Coimbra",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: "https://www.linkedin.com/in/marta-nunes-mnz",
  portfolio_url: null,

  headline: "Staff Engineer",
  years_experience: 10,
  react_ts_years: 10,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: ["Postgres row-level security", "Database migrations in production"],
  q4: "At Lumen Learning I owned timed assessment delivery. I designed the Postgres model for papers, attempts and marks, wrote the migrations that moved eight years of attempts onto it, and built the invigilator screen that shows every candidate's progress during a live exam. The requirement that shaped everything was that no institution could ever read another one's cohort, so the queries run under database policies rather than application filters. It carried 41,000 exam attempts in the first term with no lost submissions and one planned maintenance window.",
  cover_letter:
    "I have spent five years on assessment software, where a bad release is a student's exam. That has made me careful in a way I think transfers well to a team building for paying clients.\n\nI am relocating to Lisbon in September and want a hands-on staff role rather than a management track. Working end to end, from the data model to the screen, is the part of the job I have no intention of giving up.",

  availability: "2 months",
  compensation: {
    target: 75000,
    expected_min: 70000,
    expected_max: 80000,
    display: "EUR 75,000 per year (base)",
  },

  skills: [
    "React",
    "TypeScript",
    "PostgreSQL",
    "Node.js",
    "row-level security",
    "Vitest",
    "Playwright",
    "Next.js",
  ],
  languages: ["Portuguese - native", "English - fluent (C2)", "German - basic"],
  education: [
    {
      institution: "Universidade de Coimbra",
      degree: "MSc Software Engineering",
      end: "2015",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Lumen Learning",
      title: "Staff Engineer",
      start: "2021-01",
      end: null,
      summary:
        "Owns assessment delivery and the institution data model on an edtech platform serving 180 schools.",
      location: "Coimbra, Portugal",
    },
    {
      company: "Mondego Systems",
      title: "Senior Software Engineer",
      start: "2018-02",
      end: "2020-12",
      summary:
        "Led the front-end rebuild of a student records product and its reporting layer.",
      location: "Coimbra, Portugal",
    },
    {
      company: "Iberia Web Studio",
      title: "Software Engineer",
      start: "2015-09",
      end: "2018-01",
      summary: "Built web applications for public-sector and university clients.",
      location: "Coimbra, Portugal",
    },
  ],
  recruiter_summary:
    "Marta is a staff engineer on an edtech platform, where she owns timed assessment delivery from the Postgres model to the invigilator screen used in live exams. She moved institution separation into database policies and owns a 2,600-test suite across Vitest and Playwright. Ten years with React and TypeScript, relocating to Lisbon in September.",

  cv: {
    name: "Marta Nunes",
    title: "Staff Engineer",
    contact:
      "Coimbra, Portugal · marta.nunes.dev@gmail.com · +351 939 204 517 · linkedin.com/in/marta-nunes-mnz",
    summary: `${R1} ${R3} Ten years in education software has made me deliberate: exam day has no rollback window, so I plan migrations and releases around that. I still write the hardest parts myself and review most of what the team ships.`,
    coreSkills:
      "Core skills: Node.js, GraphQL, Redis, Kubernetes, GitHub Actions, load testing, accessibility, technical leadership.",
    experience: [
      {
        heading: "Staff Engineer - Lumen Learning, Coimbra",
        dates: "Jan 2021 - Present",
        bullets: [
          R2,
          R4,
          R5,
          "Carried 41,000 exam attempts in one term with no lost submissions and a single maintenance window.",
          "Cut marking turnaround for 180 schools from six days to 36 hours.",
          "Rewrote the invigilator screen after watching three live exams, removing 70% of support calls.",
          "Worked inside an early-stage product group of nine before it became a full department.",
          "Rewrote the release checklist after a bad Friday, and the team has not rolled back since.",
          "Halved the time to first review on pull requests by splitting work into smaller changes.",
          "Ran a monthly session with the operations team that turned 20 vague complaints into shipped fixes.",
          "Mentored one junior engineer for a year; she now runs the weekly release herself.",
          "Cut the local setup time for new joiners from a day and a half to about an hour.",
        ],
      },
      {
        heading: "Senior Software Engineer - Mondego Systems, Coimbra",
        dates: "Feb 2018 - Dec 2020",
        bullets: [
          "Led a records rebuild in Next.js that took page load from 3.4 s to 900 ms for 60,000 students.",
          "Replaced a nightly PostgreSQL report job with incremental views, freeing four hours of batch window.",
          "Introduced code review and release notes, cutting emergency fixes from 11 a quarter to 2.",
        ],
      },
      {
        heading: "Software Engineer - Iberia Web Studio, Coimbra",
        dates: "Sep 2015 - Jan 2018",
        bullets: [
          "Delivered 14 client projects, including two university enrolment portals still in service.",
          "Built the studio's form engine, cutting bespoke form work from three days to two hours.",
          "Ran accessibility fixes that took a government client through an external audit.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Assessment store rewrite (Lumen Learning)",
        body: "Eight years of exam attempts moved onto a new model over eleven weeks, with dual reads until the two shapes agreed on every mark.",
      },
      {
        heading: "Invigilator console (Lumen Learning)",
        body: "A live view of every candidate in an exam room, built after three site visits and now used in 180 schools.",
      },
    ],
    education: ["MSc Software Engineering, Universidade de Coimbra, 2015"],
    certifications: [],
    languages: [
      "Portuguese - native speaker, born and educated in Coimbra.",
      R6,
      "German - basic, studied for two years.",
    ],
  },

  evidence_sentences: [R1, R2, R3, R4, R5, R6],

  targets: {
    band: "top",
    verdicts: {
      R1: "M",
      R2: "M",
      R3: "M",
      R4: "M",
      R5: "M",
      R6: "M",
      P1: "X",
      P2: "P",
      P3: "X",
      P4: "P",
    },
  },
};

export default dossier;
