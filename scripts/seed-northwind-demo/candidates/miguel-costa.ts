import type { Dossier } from "../types";

const R1 =
  "Five years building and shipping React and TypeScript applications for public bodies.";
const R3 =
  "Owned the permit request feature end to end, from schema design to shipped UI used by two councils.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2020.";

export const dossier: Dossier = {
  slug: "miguel-costa",
  full_name: "Miguel Costa",
  email: "miguel.costa.dev@outlook.com",
  phone: "+351 961 224 508",
  city: "Lisbon",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: null,
  portfolio_url: null,

  headline: "Full-Stack Developer",
  years_experience: 5,
  react_ts_years: 5,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: ["None of these"],
  q4: "At Civitas Consulting I owned the permit request form for two municipal councils. I designed the tables for requests, attachments and status changes, then built the form a resident completes and the queue a council officer works through. The part that took longest was the status history, because residents kept phoning to ask where their request was: now every change is recorded and shown with a date. It went live for both councils and cut the average time to a decision from 21 days to 12, with about 70% of requests arriving online instead of at a counter.",
  cover_letter: null,

  availability: "1 month",
  compensation: {
    target: 55000,
    expected_min: 50000,
    expected_max: 58000,
    display: "EUR 55,000 per year (base)",
  },

  skills: ["React", "TypeScript", "Node.js", "SQL", "Next.js", "Docker"],
  languages: ["Portuguese - native", "English - fluent (C1)"],
  education: [
    {
      institution: "Instituto Superior de Engenharia de Lisboa",
      degree: "BSc Computer Engineering",
      end: "2020",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Civitas Consulting",
      title: "Full-Stack Developer",
      start: "2021-10",
      end: null,
      summary:
        "Delivers public-sector web projects, owning the permit request service used by two municipal councils.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Lusa Digital",
      title: "Junior Developer",
      start: "2020-06",
      end: "2021-09",
      summary: "Built websites and internal tools for media and education clients.",
      location: "Lisbon, Portugal",
    },
  ],
  recruiter_summary:
    "Miguel delivers public-sector web projects in Lisbon and owns the permit request service for two municipal councils, from the request tables to the officer queue. His status history work cut average decision time from 21 days to 12. Five years with React and TypeScript, available in a month.",

  cv: {
    name: "Miguel Costa",
    title: "Full-Stack Developer",
    contact: "Lisbon, Portugal · miguel.costa.dev@outlook.com · +351 961 224 508",
    summary: `${R1} ${R3} Public-sector work is slower than commercial work but the users are unforgiving, which has made me careful about forms, wording and error states. I want to move somewhere releases happen weekly rather than quarterly.`,
    coreSkills:
      "Core skills: Node.js, Next.js, Docker, GitLab CI, accessibility standards, document handling, technical writing.",
    experience: [
      {
        heading: "Full-Stack Developer - Civitas Consulting, Lisbon",
        dates: "Oct 2021 - Present",
        bullets: [
          "No hands-on row-level security or multi-tenant isolation model work: our councils each run their own install.",
          "Cut average time to a permit decision from 21 days to 12 across two councils.",
          "Moved about 70% of permit requests online, away from the counter.",
          "Rebuilt the attachment upload after 400 failed submissions in one quarter, ending that failure class.",
          "Added the status history residents asked for, which removed roughly 250 phone enquiries a month.",
          "Wrote a few Playwright checks around the request form during a quiet sprint.",
          "Tuned the slowest queries behind the officer queue with SQL a colleague reviewed with me.",
          "Cut the release pipeline from 16 minutes to 8 by removing duplicated checks.",
          "Ran a monthly review with support that closed 22 ageing tickets in a quarter.",
          "Wrote the runbook that let a colleague cover on-call for the first time.",
          "Paired with a new joiner for three months; he shipped his first change in week three.",
          "Reduced repeat support questions by rewriting the two screens people misread most often.",
          "Rebuilt a licensing form that had a 45% abandonment rate, bringing it under 20%.",
          "Cut a monthly report from a full day of manual work to a scheduled job.",
          "Wrote the handover notes that let a colleague take the project over in a week.",
        ],
      },
      {
        heading: "Junior Developer - Lusa Digital, Lisbon",
        dates: "Jun 2020 - Sep 2021",
        bullets: [
          "Shipped seven client sites, including a newsroom template still in use across four titles.",
          "Rebuilt an events calendar in Next.js that handled 40,000 visitors on launch day.",
          "Automated a weekly content report that had taken an editor three hours by hand.",
          "Shipped six internal tools for public-sector clients, two still in daily use.",
          "Reduced a manual typing task from three hours a day to about 20 minutes.",
          "Added the first automated checks on a legacy project after a release broke payroll exports.",
          "Wrote the deployment notes that ended the practice of one person shipping everything.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Permit request service (Civitas Consulting)",
        body: "One form, one officer queue and a visible status trail, built with two councils over four months and now handling about 900 requests a quarter.",
      },
      {
        heading: "Accessible form patterns (Civitas Consulting)",
        body: "A shared set of field, error and help patterns that passed an external accessibility review and is now reused on every project we start.",
      },
    ],
    education: ["BSc Computer Engineering, Instituto Superior de Engenharia de Lisboa, 2020"],
    certifications: [],
    languages: ["Portuguese - native speaker, born and educated in Lisbon.", R6],
  },

  evidence_sentences: [R1, R3, R6],

  targets: {
    band: "consider",
    verdicts: {
      R1: "M",
      R2: "P",
      R3: "M",
      R4: "X",
      R5: "P",
      R6: "M",
      P1: "X",
      P2: "X",
      P3: "X",
      P4: "P",
    },
  },
};

export default dossier;
