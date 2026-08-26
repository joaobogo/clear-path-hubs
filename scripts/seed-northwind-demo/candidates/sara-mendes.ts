import type { Dossier } from "../types";

const R1 =
  "Five years building production React and TypeScript applications for tour operators.";
const R4 =
  "Applied row-level security so every multi-tenant operator account stays in isolation from the others.";
const R5 =
  "Wrote the automated tests for booking: unit specs in Vitest and end-to-end journeys in Playwright.";
const P1 =
  "Rota Travel Tech is multi-tenant SaaS for 60 operators with per-tenant data isolation in the database.";
const P2 =
  "Third engineer in an early-stage, founder-led team, hired before the product had paying customers.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2020.";

export const dossier: Dossier = {
  slug: "sara-mendes",
  full_name: "Sara Mendes",
  email: "sara.mendes.web@gmail.com",
  phone: "+351 928 447 190",
  city: "Lisbon",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: null,
  portfolio_url: null,

  headline: "Full-Stack Engineer",
  years_experience: 5,
  react_ts_years: 5,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: ["Postgres row-level security", "Multi-tenant SaaS data isolation"],
  q4: "At Rota Travel Tech I built the seasonal availability calendar. Operators used to keep departure dates in spreadsheets, so I modelled departures and capacity in the database, then built the calendar where an operator opens or closes a date and sees the effect on bookings straight away. Each operator only ever sees their own departures, which is enforced by row-level security rather than by the application. It went to all 60 operators in one release and removed the weekly support routine of fixing capacity by hand, which had been costing us about six hours a week.",
  cover_letter:
    "My contract with a travel platform ends this month, so I am available immediately. I have spent three years as the third engineer on a small product, which means I have touched most parts of it.\n\nI am looking for a team with more senior engineers to learn from, on a product where the customer is a business rather than a passer-by. I would be glad to talk through the availability calendar work in detail.",

  availability: "Immediate (contract ending)",
  compensation: {
    target: 58000,
    expected_min: 54000,
    expected_max: 62000,
    display: "EUR 58,000 per year (base)",
  },

  skills: ["React", "TypeScript", "Node.js", "Postgres", "row-level security", "Vitest", "Playwright"],
  languages: ["Portuguese - native", "English - fluent (C1)", "Italian - conversational"],
  education: [
    {
      institution: "ISCTE - Instituto Universitário de Lisboa",
      degree: "BSc Computer Engineering",
      end: "2020",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Rota Travel Tech",
      title: "Full-Stack Engineer",
      start: "2022-06",
      end: null,
      summary:
        "Third engineer at an early-stage travel platform; built the availability calendar and the operator booking screens.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Alfama Studio",
      title: "Junior Developer",
      start: "2020-08",
      end: "2022-05",
      summary: "Built websites and small web applications for hospitality clients.",
      location: "Lisbon, Portugal",
    },
  ],
  recruiter_summary:
    "Sara is the third engineer at an early-stage travel platform, where she built the seasonal availability calendar now used by all 60 operator accounts. She applied the row-level security rules that keep operators apart and wrote the Vitest and Playwright suites around booking. Five years with React and TypeScript, available immediately.",

  cv: {
    name: "Sara Mendes",
    title: "Full-Stack Engineer",
    contact: "Lisbon, Portugal · sara.mendes.web@gmail.com · +351 928 447 190",
    summary: `${R1} I have worked mostly on booking flows, where a small mistake becomes a phone call from a tour operator within the hour. Being one of three engineers meant learning the database, the API and the screen at the same time. I am at my best close to the people using the product.`,
    coreSkills:
      "Core skills: Node.js, REST APIs, Redis, Docker, GitHub Actions, payment gateway integrations, calendar and timezone handling.",
    experience: [
      {
        heading: "Full-Stack Engineer - Rota Travel Tech, Lisbon",
        dates: "Jun 2022 - Present",
        bullets: [
          R4,
          R5,
          P1,
          P2,
          "Shipped the seasonal availability calendar to 60 operators, removing six hours of manual fixes a week.",
          "Cut booking drop-off on mobile from 46% to 29% by rebuilding the passenger details step.",
          "Added Postgres indexes that took the departure search from 3 s to under 400 ms.",
          "Cut the release pipeline from 13 minutes to 6 by splitting the checks that ran twice.",
          "Ran a monthly review with support that turned 25 recurring complaints into shipped changes.",
          "Wrote the handover notes that let two colleagues cover the area while I was on leave.",
          "Mentored a junior developer for eight months; she now handles her own releases.",
          "Halved the number of clarifying questions on tickets by writing acceptance notes with the product lead.",
        ],
      },
      {
        heading: "Junior Developer - Alfama Studio, Lisbon",
        dates: "Aug 2020 - May 2022",
        bullets: [
          "Delivered nine hospitality websites, four of them with direct booking integrations.",
          "Rebuilt a restaurant group's reservation page, lifting online bookings by 31% in a quarter.",
          "Wrote the studio's deployment checklist after two bad Friday releases.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Availability calendar (Rota Travel Tech)",
        body: "One screen where an operator opens or closes departures for a whole season and sees the booking impact immediately; it replaced a spreadsheet shared by six people.",
      },
      {
        heading: "Timezone-safe departures (Rota Travel Tech)",
        body: "A rewrite of how departure times are stored and displayed, which ended a long-running class of complaints about times shown an hour out.",
      },
    ],
    education: ["BSc Computer Engineering, ISCTE - Instituto Universitário de Lisboa, 2020"],
    certifications: [],
    languages: [
      "Portuguese - native speaker, born and educated in Lisbon.",
      R6,
      "Italian - conversational, learned working with two Rome operators.",
    ],
  },

  evidence_sentences: [R1, R4, R5, R6, P1, P2],

  targets: {
    band: "strong",
    verdicts: {
      R1: "M",
      R2: "P",
      R3: "P",
      R4: "M",
      R5: "M",
      R6: "M",
      P1: "M",
      P2: "M",
      P3: "X",
      P4: "X",
    },
  },
};

export default dossier;
