import type { Dossier } from "../types";

const R1 =
  "Eight years building production React and TypeScript applications for advertising platforms.";
const R3 =
  "Owned campaign budgeting end to end, from schema design to shipped UI used by 400 media buyers.";
const R2 =
  "Own the SQL and relational data modelling for spend in Postgres, with 70 migrations shipped against live traffic.";
const R4 =
  "Wrote the row-level security model keeping 210 multi-tenant advertiser accounts in isolation.";
const R5 =
  "Comfortable writing and maintaining 2,100 automated tests, unit in Vitest and end-to-end in Playwright, run on every pull request.";
const P1 =
  "Signal Ads is multi-tenant SaaS for 210 advertisers, separated by per-tenant data isolation in Postgres.";
const P4 =
  "Moved the buyer console to Remix, a full-stack React framework similar to TanStack Start, cutting time to interactive by 60%.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2017.";

export const dossier: Dossier = {
  slug: "filipe-rocha",
  full_name: "Filipe Rocha",
  email: "filipe.rocha.eng@gmail.com",
  phone: "+351 932 615 887",
  city: "Lisbon",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: "https://www.linkedin.com/in/filipe-rocha-frc",
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
  q4: "At Signal Ads I owned campaign budgeting. I modelled budgets, pacing and spend events in Postgres, wrote the migrations that reshaped four years of spend history while campaigns kept running, and built the screen where a media buyer sets a budget and sees the pacing forecast. Advertiser data can never cross accounts, so every read runs under row-level security with a test for each policy. It shipped to 400 buyers, cut overspend incidents from about 30 a month to two, and removed the nightly spreadsheet finance had been maintaining.",
  cover_letter:
    "I was an early engineer on an adtech platform and stayed eight years, which means I have shipped against live traffic often enough to be calm about it. Budgeting, pacing and tenant separation have been my work for the last four.\n\nI am open about compensation: I am at the upper end of the market and would rather say so now than at the end of a process. If that fits, I would be glad to talk about the role in detail.",

  availability: "2 months",
  compensation: {
    target: 92000,
    expected_min: 88000,
    expected_max: 96000,
    display: "EUR 92,000 per year (base)",
  },

  skills: [
    "React",
    "TypeScript",
    "PostgreSQL",
    "Remix",
    "row-level security",
    "Vitest",
    "Playwright",
    "Node.js",
  ],
  languages: ["Portuguese - native", "English - fluent (C2)", "German - basic"],
  education: [
    {
      institution: "Universidade de Lisboa",
      degree: "MSc Computer Science",
      end: "2017",
    },
  ],
  certifications: ["Google Cloud Professional Cloud Developer (2023)"],
  experience: [
    {
      company: "Signal Ads",
      title: "Senior Software Engineer",
      start: "2020-02",
      end: null,
      summary:
        "Early engineer on an adtech platform; owns budgeting, pacing and the advertiser isolation model for 210 accounts.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Horizonte Media",
      title: "Software Engineer",
      start: "2017-09",
      end: "2020-01",
      summary:
        "Built publisher-facing tools and the inventory reporting layer behind them.",
      location: "Lisbon, Portugal",
    },
  ],
  recruiter_summary:
    "Filipe was an early engineer at an adtech platform and owns campaign budgeting from the Postgres spend model to the screen 400 media buyers use. He wrote the row-level security model separating 210 advertiser accounts and keeps a 2,100-test suite green. Eight years with React and TypeScript; his expectation of EUR 92,000 sits above the role's band.",

  cv: {
    name: "Filipe Rocha",
    title: "Senior Software Engineer",
    contact:
      "Lisbon, Portugal · filipe.rocha.eng@gmail.com · +351 932 615 887 · linkedin.com/in/filipe-rocha-frc",
    summary: `${R1} ${R3} Advertising spend is unforgiving: a pacing bug is somebody's money within minutes. I have spent four years making that class of mistake rare and visible when it happens.`,
    coreSkills:
      "Core skills: Node.js, ClickHouse, Kafka, Redis, Terraform, Google Cloud, load testing, on-call leadership.",
    experience: [
      {
        heading: "Senior Software Engineer - Signal Ads, Lisbon",
        dates: "Feb 2020 - Present",
        bullets: [
          R2,
          R4,
          R5,
          P1,
          "Cut overspend incidents from about 30 a month to two after the pacing rewrite.",
          "Reshaped four years of spend history without pausing a single live campaign.",
          "Assessed an AI creative-scoring vendor over three weeks and wrote the recommendation.",
          "Ran the weekly release review for seven engineers and kept the notes usable by support staff.",
          "Reduced on-call pages from 16 a month to 5 by fixing the three alerts that fired most.",
          "Cut the build from 10 minutes to 4, which moved us to daily releases.",
          "Mentored three engineers, two of whom now own their own areas end to end.",
          "Wrote the onboarding guide that took new joiners from first commit in a week to two days.",
        ],
      },
      {
        heading: "Software Engineer - Horizonte Media, Lisbon",
        dates: "Sep 2017 - Jan 2020",
        bullets: [
          P4,
          "Rebuilt inventory reporting for 90 publishers, taking report generation from 40 minutes to 90 seconds.",
          "Replaced a PostgreSQL view stack with materialised aggregates, halving infrastructure cost.",
          "Introduced release tagging and rollbacks after an outage that took three hours to undo.",
          "Delivered an advertiser reporting tool used by 900 accounts in its first year.",
          "Cut a daily aggregation job from three hours to 25 minutes by restructuring its writes.",
          "Introduced our first automated checks, covering the two flows that caused most incidents.",
          "Wrote the release guide that took deployments from weekly to daily without extra incidents.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Pacing rewrite (Signal Ads)",
        body: "Budget pacing rebuilt over ten weeks with a shadow run against real campaigns, ending a long pattern of end-of-month overspend.",
      },
      {
        heading: "Buyer console (Signal Ads)",
        body: "A single screen for budgets, pacing forecast and spend to date, now the daily tool of 400 media buyers.",
      },
    ],
    education: ["MSc Computer Science, Universidade de Lisboa, 2017"],
    certifications: ["Google Cloud Professional Cloud Developer, 2023"],
    languages: [
      "Portuguese - native speaker, born and educated in Lisbon.",
      R6,
      "German - basic, studied at evening classes.",
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
