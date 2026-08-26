import type { Dossier } from "../types";

const R1 =
  "Six years building production React and TypeScript applications for estate agents and landlords.";
const R3 =
  "Owned the listing pipeline end to end, from schema design to shipped UI used by 300 agents.";
const R2 =
  "Handle the SQL and relational modelling for properties in Postgres, including the migrations I have written since 2022.";
const R5 =
  "Built and keep maintaining the automated tests for pricing: unit specs in Vitest and end-to-end checks in Playwright on each merge.";
const P2 =
  "Employee number seven in an early-stage, founder-led team that grew to 30 while I was there.";
const P3 =
  "Daily exposure to AI work: shipped LLM-written listing descriptions as product features in production for 300 agents.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2019.";

export const dossier: Dossier = {
  slug: "diogo-martins",
  full_name: "Diogo Martins",
  email: "diogo.martins.dev@gmail.com",
  phone: "+351 934 771 038",
  city: "Lisbon",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: "https://www.linkedin.com/in/diogo-martins-dmr",
  portfolio_url: null,

  headline: "Senior Engineer",
  years_experience: 6,
  react_ts_years: 6,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: ["Database migrations in production", "AI or LLM product features"],
  q4: "At Casa Nova Tech I owned the generated listing description. I designed the Postgres tables for property attributes and generated drafts, wrote the migrations, and built the editor where an agent reviews a draft, edits it and publishes. Because agents are accountable for what they publish, nothing goes live unedited: the screen shows the draft beside the raw attributes and records who approved it. It reached 300 agents, cut the time to publish a listing from 25 minutes to about 6, and raised the share of listings with a full description from 54% to 91%.",
  cover_letter:
    "I joined a proptech as its seventh employee and stayed through the part where everything breaks, which is where I learned to ship features whole rather than in halves.\n\nThe generated-description work taught me how careful you have to be when a model writes something a professional signs their name to. I would like to bring that to a team building for paying clients, and I can start in a month.",

  availability: "1 month",
  compensation: {
    target: 66000,
    expected_min: 62000,
    expected_max: 70000,
    display: "EUR 66,000 per year (base)",
  },

  skills: ["React", "TypeScript", "PostgreSQL", "Node.js", "Vitest", "Playwright", "OpenAI API"],
  languages: ["Portuguese - native", "English - fluent (C1)", "Spanish - basic"],
  education: [
    {
      institution: "Universidade Nova de Lisboa",
      degree: "BSc Computer Science",
      end: "2019",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Casa Nova Tech",
      title: "Senior Engineer",
      start: "2022-01",
      end: null,
      summary:
        "Seventh employee at a founder-led proptech; owns the listing pipeline and the generated description feature.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Sintra Labs",
      title: "Software Engineer",
      start: "2019-09",
      end: "2021-12",
      summary: "Built customer portals and internal tooling for utilities and insurance clients.",
      location: "Lisbon, Portugal",
    },
  ],
  recruiter_summary:
    "Diogo was the seventh employee at a founder-led proptech, where he owns the listing pipeline from the Postgres model to the editor 300 agents use. He shipped a generated listing-description feature that raised complete listings from 54% to 91%. Six years with React and TypeScript, available in a month.",

  cv: {
    layout: "T1",
    interests: "Amateur astronomer; coaches a junior futsal team in Aveiro.",
    name: "Diogo Martins",
    title: "Senior Engineer",
    contact:
      "Lisbon, Portugal · diogo.martins.dev@gmail.com · +351 934 771 038 · linkedin.com/in/diogo-martins-dmr",
    summary: `${R1} ${R3} I like small companies where the person who designs the table also answers for the screen. Most of my last two years went into making generated text something a professional is willing to publish under their own name.`,
    coreSkills:
      "Core skills: Node.js, REST APIs, Redis, Docker, GitHub Actions, AWS, prompt evaluation, image pipelines.",
    experience: [
      {
        heading: "Senior Engineer - Casa Nova Tech, Lisbon",
        dates: "Jan 2022 - Present",
        bullets: [
          R2,
          "No hands-on row-level security or multi-tenant isolation model work yet - our estate is single-tenant.",
          R5,
          P2,
          P3,
          "Cut the time to publish a listing from 25 minutes to about 6 for 300 agents.",
          "Raised listings carrying a complete description from 54% to 91% in two quarters.",
          "Built the photo ordering tool that lifted enquiry rates on new listings by 13%.",
          "Cut the build and check pipeline from 11 minutes to 5, which unblocked same-day fixes.",
          "Ran a monthly triage with customer support and closed 35 ageing tickets in a quarter.",
          "Wrote the runbook that let two colleagues handle on-call without waking anyone else.",
          "Paired weekly with a new joiner for four months; he shipped his first change in week two.",
          "Reduced repeat support questions by rewriting the four error messages people asked about most.",
        ],
      },
      {
        heading: "Software Engineer - Sintra Labs, Lisbon",
        dates: "Sep 2019 - Dec 2021",
        bullets: [
          "Delivered a self-service portal that moved 38% of a utility's meter readings off the phone lines.",
          "Rewrote the claims form for an insurer, halving abandonment from 41% to 20%.",
          "Replaced hand-written PostgreSQL reports with a shared query layer used by four teams.",
          "Prototyped one client portal in Next.js before the team settled on its own setup.",
          "Shipped a customer portal used by 3,400 people in its first year.",
          "Cut a nightly import from four hours to 35 minutes by batching the writes.",
          "Wrote the first automated checks on the project, covering the three flows that broke most often.",
          "Documented the release steps so any of the four engineers could ship on a Friday.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Description drafting (Casa Nova Tech)",
        body: "Attributes go in, a draft comes back, and the agent edits before publishing; a review record keeps the accountability with the person who signs the listing.",
      },
      {
        heading: "Photo ordering tool (Casa Nova Tech)",
        body: "A drag-and-drop gallery with quality warnings, built in three weeks after watching agents reorder photos in a spreadsheet.",
      },
    ],
    education: ["BSc Computer Science, Universidade Nova de Lisboa, 2019"],
    certifications: [],
    languages: [
      "Portuguese - native speaker, born and educated in Lisbon.",
      R6,
      "Spanish - basic, used on two Madrid launches.",
    ],
  },

  evidence_sentences: [R1, R2, R3, R5, R6, P2, P3],

  targets: {
    band: "strong",
    verdicts: {
      R1: "M",
      R2: "M",
      R3: "M",
      R4: "X",
      R5: "M",
      R6: "M",
      P1: "X",
      P2: "M",
      P3: "M",
      P4: "P",
    },
  },
};

export default dossier;
