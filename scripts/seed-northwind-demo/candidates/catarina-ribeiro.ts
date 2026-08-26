import type { Dossier } from "../types";

const R1 =
  "Six years building and shipping React and TypeScript applications for online retailers.";
const R3 =
  "Owned checkout end to end, from schema design to shipped UI for eleven retail clients.";
const R2 =
  "Write the SQL and relational data modelling for catalogues in Postgres, including the migrations each store launch needs.";
const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2019.";

export const dossier: Dossier = {
  slug: "catarina-ribeiro",
  full_name: "Catarina Ribeiro",
  email: "catarina.ribeiro.dev@gmail.com",
  phone: "+351 925 887 316",
  city: "Braga",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: null,
  portfolio_url: null,

  headline: "Full-Stack Developer",
  years_experience: 6,
  react_ts_years: 6,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: ["Database migrations in production"],
  q4: "At Minho Commerce Studio I owned checkout for a home goods retailer. I modelled orders, promotions and stock reservations in Postgres, wrote the migrations that introduced reservations without stopping trading, and rebuilt the three checkout steps as one page. The change I care about most is stock reservation: the basket now holds an item for fifteen minutes, which ended the complaints from customers who paid for something already sold. Completed orders rose 17% in the first month and oversold items dropped from about 40 a week to under 5.",
  cover_letter: null,

  availability: "3 weeks",
  compensation: {
    target: 60000,
    expected_min: 56000,
    expected_max: 64000,
    display: "EUR 60,000 per year (base)",
  },

  skills: ["React", "TypeScript", "PostgreSQL", "Node.js", "Next.js", "SQL", "Shopify APIs"],
  languages: ["Portuguese - native", "English - fluent (C1)"],
  education: [
    {
      institution: "Universidade do Minho",
      degree: "BSc Informatics Engineering",
      end: "2019",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Minho Commerce Studio",
      title: "Full-Stack Developer",
      start: "2021-02",
      end: null,
      summary:
        "Builds and maintains e-commerce products for eleven retail clients, owning checkout and catalogue work.",
      location: "Braga, Portugal",
    },
    {
      company: "Independent (freelance)",
      title: "Freelance Developer",
      start: "2019-07",
      end: "2021-01",
      summary:
        "Delivered web shops and booking sites for small businesses across northern Portugal.",
      location: "Braga, Portugal",
    },
  ],
  recruiter_summary:
    "Catarina builds e-commerce products for eleven retail clients from Braga, owning checkout from the Postgres order model to the shipped page. Her stock reservation work lifted completed orders 17% and cut oversold items from about 40 a week to under 5. Six years with React and TypeScript, available in three weeks.",

  cv: {
    name: "Catarina Ribeiro",
    title: "Full-Stack Developer",
    contact: "Braga, Portugal · catarina.ribeiro.dev@gmail.com · +351 925 887 316",
    summary: `${R1} ${R3} Retail work is measured in orders, which makes it easy to tell whether a change helped. I have worked remotely for four years and go into Lisbon roughly one day a week for client sessions.`,
    coreSkills:
      "Core skills: Node.js, Next.js, Redis, Docker, GitHub Actions, payment integrations, performance budgets.",
    experience: [
      {
        heading: "Full-Stack Developer - Minho Commerce Studio, Braga",
        dates: "Feb 2021 - Present",
        bullets: [
          R2,
          "Read through the row-level security rules a colleague set up for our tenant data, but have not written them myself.",
          "Lifted completed orders 17% in a month after rebuilding a three-step checkout as one page.",
          "Cut oversold items from about 40 a week to under 5 by adding fifteen-minute stock reservations.",
          "Contributed to the automated tests in the Playwright checks that run before each client release.",
          "Took the catalogue page from 2.9 s to 1.1 s on mobile for the studio's largest client.",
          "Worked inside a founder-led studio of eight, sitting in on client calls from the first month.",
          "Cut the deployment pipeline from 12 minutes to 6 by caching dependencies between runs.",
          "Ran a monthly triage with support and closed 28 long-standing tickets in a quarter.",
          "Wrote the handover notes that let two colleagues cover the area during holidays.",
          "Mentored a junior developer for seven months; she now reviews changes on her own.",
          "Halved rework on tickets by agreeing acceptance notes with the design lead before starting.",
          "Rebuilt a client's checkout, which lifted completed orders by about a fifth.",
          "Cut a shop's page load from 5.1 s to 1.9 s on mobile connections.",
          "Wrote the release checklist the studio still follows before every client launch.",
        ],
      },
      {
        heading: "Freelance Developer - Independent, Braga",
        dates: "Jul 2019 - Jan 2021",
        bullets: [
          "Delivered 16 projects for small businesses, seven of them web shops still trading today.",
          "Built a bakery ordering site that took 300 pre-orders in its first weekend.",
          "Moved four clients off shared hosting, ending a recurring pattern of weekend outages.",
          "Delivered 11 freelance projects over two years with no missed launch date.",
          "Rebuilt a bakery chain's ordering page, which lifted online orders from 40 to 180 a week.",
          "Cut a client's hosting bill by a third by replacing a server-rendered site with static pages.",
          "Wrote plain-language handover documents so clients could keep their sites current themselves.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Stock reservation (Minho Commerce Studio)",
        body: "A timed hold on basket items, shipped without pausing trading, which ended the class of complaints from customers paying for sold-out stock.",
      },
      {
        heading: "Promotion engine (Minho Commerce Studio)",
        body: "Rules a marketing manager can edit without a developer, now running about 30 campaigns a quarter across five clients.",
      },
    ],
    education: ["BSc Informatics Engineering, Universidade do Minho, 2019"],
    certifications: [],
    languages: ["Portuguese - native speaker, born and educated in Braga.", R6],
  },

  evidence_sentences: [R1, R2, R3, R6],

  targets: {
    band: "strong",
    verdicts: {
      R1: "M",
      R2: "M",
      R3: "M",
      R4: "X",
      R5: "P",
      R6: "M",
      P1: "X",
      P2: "P",
      P3: "X",
      P4: "P",
    },
  },
};

export default dossier;
