import type { Dossier } from "../types";

const R1 =
  "Seven years building production React and TypeScript applications used by clinical teams.";
const R3 =
  "Owning referral features end to end, from schema design to shipped UI signed off by two hospitals.";
const R2 =
  "Do the SQL and relational data modelling for patient records in Postgres, with 30 reviewed migrations shipped so far.";
const R4 =
  "Practical row-level security work: each multi-tenant clinic keeps its records in isolation under one shared-schema model.";
const P1 =
  "Vitalis Health is multi-tenant SaaS for 45 clinics, held apart by per-tenant data isolation.";
const P2 =
  "Joined an early-stage, founder-led team of six and stayed through the first 40 clinic launches.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2018.";

export const dossier: Dossier = {
  slug: "mariana-lopes",
  full_name: "Mariana Lopes",
  email: "mariana.lopes.pt@gmail.com",
  phone: "+351 926 350 771",
  city: "Lisbon",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: "https://www.linkedin.com/in/mariana-lopes-mlp",
  portfolio_url: null,

  headline: "Senior Full-Stack Engineer",
  years_experience: 7,
  react_ts_years: 7,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: [
    "Postgres row-level security",
    "Multi-tenant SaaS data isolation",
    "Database migrations in production",
  ],
  q4: "At Vitalis Health I owned the clinic referral flow. I modelled referrals, consent and audit rows in Postgres, wrote the migrations that split a single overloaded table into three, and built the screen where a nurse sends a case to a specialist and watches its status. Because a referral crosses two organisations, the read paths sit behind row-level security so a clinic only ever sees its own side of the case. Two hospitals signed it off and referral turnaround dropped from four days to under one.",
  cover_letter:
    "I have spent three years in healthtech, where the interesting problem is rarely the interface: it is proving that the right people, and only the right people, can see a record. That is the sort of ownership this role describes.\n\nI would like to keep working on a product where the domain matters and the team is small enough that I can see the effect of what I ship. I can start within a month.",

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
    "row-level security",
    "HL7 FHIR",
    "Playwright",
  ],
  languages: ["Portuguese - native", "English - fluent (C1)", "Spanish - intermediate"],
  education: [
    {
      institution: "Instituto Superior Técnico",
      degree: "MSc Information Systems Engineering",
      end: "2018",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Vitalis Health",
      title: "Senior Full-Stack Engineer",
      start: "2022-09",
      end: null,
      summary:
        "Sixth engineer on an early-stage healthtech; owns referrals, consent and the clinic isolation model.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Meridian Software",
      title: "Software Engineer",
      start: "2018-07",
      end: "2022-08",
      summary:
        "Built scheduling and billing modules for hospital clients, and the shared reporting layer behind them.",
      location: "Lisbon, Portugal",
    },
  ],
  recruiter_summary:
    "Mariana is the sixth engineer at an early-stage healthtech in Lisbon, where she owns referrals and consent from the Postgres model to the screen two hospitals signed off. She introduced the row-level security model that keeps 45 clinics apart. Seven years with React and TypeScript, available in a month.",

  cv_filename: "CV Mariana Lopes.pdf",

  cv: {
    layout: "T3",
    targetPages: 2,
    educationFirst: true,
    name: "Mariana Lopes",
    title: "Senior Full-Stack Engineer",
    contact:
      "Lisbon, Portugal · mariana.lopes.pt@gmail.com · +351 926 350 771 · linkedin.com/in/mariana-lopes-mlp",
    summary: `${R1} ${R3} Healthcare taught me to treat access rules as part of the product rather than an afterthought. I like being close to the clinicians who use what I build and hearing when it gets in their way.`,
    coreSkills:
      "Core skills: Node.js, HL7 FHIR, Redis, Docker, Azure, GitHub Actions, accessibility, clinical stakeholder work.",
    experience: [
      {
        heading: "Senior Full-Stack Engineer - Vitalis Health, Lisbon",
        dates: "Sep 2022 - Present",
        bullets: [
          R2,
          R4,
          P1,
          P2,
          "Contributed to the automated tests in the Playwright suite covering the referral and consent journeys.",
          "Brought referral turnaround from four days to under one across 45 clinics.",
          "Replaced a paper consent process for 12,000 patients with an auditable digital record.",
          "Kept the release notes short enough that support staff actually read them, which halved handover calls.",
          "Trimmed the deployment pipeline from 12 minutes to 5 by caching dependencies between runs.",
          "Ran a monthly bug triage with support and closed 40 long-standing tickets in a quarter.",
          "Mentored a career-changer through her first six months; she shipped her first feature in week three.",
          "Wrote the runbook that let two colleagues take on-call for the first time without escalating.",
        ],
      },
      {
        heading: "Software Engineer - Meridian Software, Lisbon",
        dates: "Jul 2018 - Aug 2022",
        bullets: [
          "Rebuilt appointment scheduling for three hospital groups, removing 1,100 double bookings a year.",
          "Wrote the billing export that reconciled 98% of claims automatically, up from 71%.",
          "Tuned the PostgreSQL reporting views behind a dashboard used by 400 administrative staff.",
          "Mentored two graduate engineers through their first year of production work.",
          "Helped a colleague move the patient portal to Next.js during a two-week spike.",
          "Took the billing module through two external audits with no findings raised against it.",
          "Rewrote the shift handover screen after watching a night team use it, cutting missed notes to none.",
          "Ran the fortnightly release for two years, moving it from a manual evening job to a 20-minute routine.",
          "Wrote the onboarding notes new engineers still follow in their first week on the reporting layer.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Consent register (Vitalis Health)",
        body: "An append-only record of who agreed to what and when, built with the clinical governance lead over five weeks and later used as evidence in a regulator review.",
      },
      {
        heading: "Referral status board (Vitalis Health)",
        body: "A single screen showing every open case between a clinic and its specialists, replacing three spreadsheets and a shared mailbox.",
      },
    ],
    education: ["MSc Information Systems Engineering, Instituto Superior Técnico, 2018"],
    certifications: [],
    languages: [
      "Portuguese - native speaker, born and educated in Lisbon.",
      R6,
      "Spanish - intermediate, used with a Galician clinic group.",
    ],
  },

  evidence_sentences: [R1, R2, R3, R4, R6, P1, P2],

  targets: {
    band: "top",
    verdicts: {
      R1: "M",
      R2: "M",
      R3: "M",
      R4: "M",
      R5: "P",
      R6: "M",
      P1: "M",
      P2: "M",
      P3: "X",
      P4: "P",
    },
  },
};

export default dossier;
