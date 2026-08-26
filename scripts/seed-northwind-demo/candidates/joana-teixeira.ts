import type { Dossier } from "../types";

const R6 =
  "English - fluent, written and spoken (C1/C2); working language since 2023.";

export const dossier: Dossier = {
  slug: "joana-teixeira",
  full_name: "Joana Teixeira",
  email: "joana.teixeira.web@gmail.com",
  phone: "+351 921 704 358",
  city: "Lisbon",
  region: "",
  country: "Portugal",
  timezone: "Europe/Lisbon",
  linkedin_url: null,
  portfolio_url: null,

  headline: "Front-end Developer",
  years_experience: 3,
  react_ts_years: 3,
  eu_right_to_work: true,
  visa_required: false,
  work_authorization_notes: "Portuguese national; EU right to work, no sponsorship needed.",
  multi_choice: ["Database migrations in production"],
  q4: "At Chiado Interactive I built the campaign landing page builder. Marketing staff used to ask a developer for every new page, so I built a small editor where they choose a layout, drop in copy and images, and publish. I designed the component set, wrote the editor and handled the publishing step. It went live for four client accounts and now produces around 20 pages a month without a developer, which freed roughly a day a week for the rest of the team.",
  cover_letter: null,

  availability: "1 month",
  compensation: {
    target: 42000,
    expected_min: 38000,
    expected_max: 45000,
    display: "EUR 42,000 per year (base)",
  },

  skills: ["React", "JavaScript", "CSS", "HTML", "Figma", "accessibility"],
  languages: ["Portuguese - native", "English - fluent (C1)"],
  education: [
    {
      institution: "Escola Superior de Tecnologia de Setúbal",
      degree: "BSc Multimedia Engineering",
      end: "2022",
    },
  ],
  certifications: [],
  experience: [
    {
      company: "Chiado Interactive",
      title: "Front-end Developer",
      start: "2023-04",
      end: null,
      summary:
        "Builds marketing sites and a landing page editor for four client accounts at a digital agency.",
      location: "Lisbon, Portugal",
    },
    {
      company: "Tejo Web",
      title: "Junior Front-end Developer",
      start: "2022-06",
      end: "2023-03",
      summary: "Built client websites and maintained the agency's component library.",
      location: "Lisbon, Portugal",
    },
  ],
  recruiter_summary:
    "Joana is a front-end developer at a Lisbon agency, where she built a landing page editor that now produces around 20 marketing pages a month without developer help. Three years of experience, mostly interface work with React. Available in a month.",

  cv: {
    name: "Joana Teixeira",
    title: "Front-end Developer",
    contact: "Lisbon, Portugal · joana.teixeira.web@gmail.com · +351 921 704 358",
    summary:
      "Three years of interface work at Lisbon agencies, mostly marketing sites and small internal editors built with React. I care about how a page behaves on a slow phone and about wording that does not confuse people. I am looking for my first product team, where I can stay with something longer than a campaign.",
    coreSkills:
      "Core skills: CSS architecture, design systems, Figma handover, accessibility, image optimisation, content editing tools.",
    experience: [
      {
        heading: "Front-end Developer - Chiado Interactive, Lisbon",
        dates: "Apr 2023 - Present",
        bullets: [
          "Built the landing page editor that now produces about 20 pages a month without a developer.",
          "Cut the largest client site's mobile load time from 4.2 s to 1.8 s.",
          "Rebuilt the enquiry form after 300 abandoned submissions, halving drop-off.",
          "Added a few Playwright checks to the editor after a bad release.",
          "Delivered 14 campaign pages across four client accounts in the last year.",
          "Kept the client handover notes short enough to be read, which cut follow-up emails in half.",
          "Reduced image weight on six sites by about 70% without visible quality loss.",
          "Ran the monthly review of open client bugs and closed 45 small tickets in a quarter.",
          "Wrote the checklist that took a new colleague from first commit in a week to two days.",
          "Fixed the eight most-reported layout problems on mobile after reading a month of support emails.",
          "Rewrote the form error messages that support quoted most, which cut those emails to almost none.",
          "Paired weekly with an intern for three months; she shipped two pages on her own by the end.",
          "Rebuilt a client's newsletter sign-up, which doubled monthly subscriptions.",
          "Cut a landing page from 4.6 s to 1.7 s on a mid-range phone.",
          "Wrote the editor guide that marketing staff use without asking for help.",
        ],
      },
      {
        heading: "Junior Front-end Developer - Tejo Web, Lisbon",
        dates: "Jun 2022 - Mar 2023",
        bullets: [
          "Shipped six client websites, three of them still unchanged two years later.",
          "Maintained the agency component library and wrote its usage notes.",
          "Fixed the accessibility findings that took two client sites through review.",
          "Delivered six client websites with no missed launch dates.",
          "Cut the studio's average page weight by about half by introducing an image build step.",
          "Wrote the component usage notes that let two colleagues build pages without asking questions.",
          "Fixed the accessibility issues that took two client sites through their review first time.",
          "Trained a client's marketing team to edit their own copy, removing about 15 tickets a month.",
        ],
      },
    ],
    selectedWork: [
      {
        heading: "Landing page editor (Chiado Interactive)",
        body: "Layouts, copy and images assembled by marketing staff and published without a developer, built over two months and now used weekly.",
      },
      {
        heading: "Component library refresh (Tejo Web)",
        body: "Buttons, forms and cards rewritten with clear states and documentation, which cut new-page build time roughly in half.",
      },
    ],
    education: ["BSc Multimedia Engineering, Escola Superior de Tecnologia de Setúbal, 2022"],
    certifications: [],
    languages: ["Portuguese - native speaker, born and educated in Lisbon.", R6],
  },

  evidence_sentences: [R6],

  targets: {
    band: "not_recommended",
    verdicts: {
      R1: "P",
      R2: "X",
      R3: "P",
      R4: "X",
      R5: "P",
      R6: "M",
      P1: "X",
      P2: "X",
      P3: "X",
      P4: "X",
    },
  },
};

export default dossier;
