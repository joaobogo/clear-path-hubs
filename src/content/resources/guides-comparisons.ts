import type { ResourceGuide } from "./types";

/** Comparisons — model-versus-model decision guides. */
export const COMPARISON_GUIDES: ResourceGuide[] = [
  {
    slug: "subscription-recruiting-vs-contingency",
    title: "Subscription vs contingency recruiting",
    h1: "Subscription recruiting vs contingency fees",
    metaTitle: "Subscription vs Contingency Recruiting Compared | TaaSFlow",
    metaDescription:
      "How subscription recruiting and contingency agency fees differ on cost, incentives, speed and ownership — and which model fits your hiring volume.",
    category: "Comparisons",
    summary:
      "Contingency prices the outcome. Subscription prices the capacity. The right choice depends on volume, repeatability and who keeps the pipeline.",
    updated: "2026-02-10",
    audience: "Finance and talent leaders choosing a commercial model",
    sections: [
      {
        heading: "The structural difference",
        blocks: [
          {
            kind: "table",
            columns: ["", "Contingency agency", "Subscription"],
            rows: [
              ["What you pay for", "A completed placement", "Search capacity over a period"],
              ["Cost shape", "% of salary, per hire", "Fixed monthly or per-package"],
              ["Cost per extra hire", "Repeats in full", "Marginal within your tier"],
              ["Who keeps the pipeline", "Usually the agency", "You do"],
              ["Incentive", "Close the placeable candidate", "Keep capacity productive across roles"],
            ],
          },
        ],
      },
      {
        heading: "Where each model wins",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Contingency wins for a one-off, senior, hard-to-access search where you want zero risk until offer",
              "Subscription wins when you have multiple roles open, repeating role families, or a need to forecast spend",
              "Neither wins if the requirements are undefined — that cost lands on you either way",
            ],
          },
        ],
      },
      {
        heading: "The incentive question nobody asks",
        blocks: [
          {
            kind: "p",
            text: "A percentage fee rewards the highest-salary placement that will close. A subscription rewards keeping every role moving. Read your model's incentive before you read its price.",
          },
          {
            kind: "callout",
            title: "Test it in the conversation",
            text: "Ask what happens if the best candidate is cheaper than budget. The answer tells you which incentive you are buying.",
          },
        ],
      },
      {
        heading: "How to compare honestly",
        blocks: [
          {
            kind: "steps",
            items: [
              { label: "Count hires, not roles", text: "Model 12 months of expected hires, including backfills." },
              { label: "Price both at that volume", text: "Contingency scales linearly; subscription does not." },
              { label: "Add the cost of waiting", text: "Days open have a cost — put a number on it before you compare." },
              { label: "Price the asset", text: "A pipeline you keep has value at month 13. A finished placement does not." },
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        q: "Is subscription always cheaper?",
        a: "No. For a single low-volume hire, a one-off package or contingency search can cost less. Subscription economics improve with concurrent and repeat hiring.",
      },
      {
        q: "What about guarantees?",
        a: "Contingency typically offers a replacement window tied to the fee. In a subscription, the equivalent protection is continued search capacity within your term.",
      },
      {
        q: "Can we run both?",
        a: "Yes, and many teams do — subscription for volume and repeatable families, retained or contingency search for rare senior roles.",
      },
      {
        q: "How do we avoid paying twice?",
        a: "Agree candidate-source attribution in writing before either engagement starts, and keep one system of record for who was sourced where.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "Fixed subscription tiers banded by concurrent active roles",
        "One-off packages for teams that only need a single search",
        "No percentage-of-salary fee at offer stage",
        "Your candidates, evidence and history stay in your workspace",
      ],
    },
    related: [
      "recruiting-as-a-service",
      "internal-recruiter-vs-recruiting-subscription",
      "cost-of-an-unfilled-position",
    ],
    onward: [
      { to: "/pricing", label: "Pricing", desc: "Tiers, packages and what each includes." },
      { to: "/how-it-works", label: "How it works", desc: "What happens after you open a role." },
      { to: "/enterprise", label: "Enterprise", desc: "Volume hiring and custom terms." },
    ],
  },

  {
    slug: "internal-recruiter-vs-recruiting-subscription",
    title: "Internal recruiter vs subscription",
    h1: "Hiring an internal recruiter vs a recruiting subscription",
    metaTitle: "Internal Recruiter vs Recruiting Subscription | TaaSFlow",
    metaDescription:
      "A decision framework for choosing between an in-house recruiter and a recruiting subscription: capacity, cost shape, ramp time and single-person risk.",
    category: "Comparisons",
    summary:
      "One recruiter gives you ownership and context. A subscription gives you elastic capacity. The tie-breaker is usually concurrency and continuity.",
    updated: "2026-02-10",
    audience: "Founders and HR leads sizing their first recruiting capability",
    sections: [
      {
        heading: "What each option actually gives you",
        blocks: [
          {
            kind: "table",
            columns: ["", "Internal recruiter", "Subscription"],
            rows: [
              ["Cost shape", "Salary, benefits, tooling, ramp", "Fixed subscription"],
              ["Ramp time", "Weeks to learn the business", "Days, but needs your calibration"],
              ["Concurrency", "Limited by one person's hours", "Banded by tier"],
              ["Continuity risk", "Holiday, sickness, resignation", "Spread across a team and system"],
              ["Context depth", "Highest — sits with the team", "Requires deliberate briefing"],
            ],
          },
        ],
      },
      {
        heading: "The hidden costs of the in-house option",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Sourcing tools, job board slots and an ATS licence are rarely in the salary comparison",
              "A recruiter with ten open roles becomes a coordinator, not a sourcer",
              "When they leave, undocumented pipeline leaves with them",
            ],
          },
        ],
      },
      {
        heading: "A decision framework",
        blocks: [
          {
            kind: "steps",
            items: [
              { label: "Count concurrent roles", text: "Consistently five or more open at once favours added capacity." },
              { label: "Check the hiring calendar", text: "Spiky, seasonal hiring favours subscription elasticity." },
              { label: "Check the specialism", text: "Deep niche sourcing needs channel reach more than headcount." },
              { label: "Decide who owns the bar", text: "Whichever model you pick, the bar stays yours." },
            ],
          },
          {
            kind: "callout",
            title: "The combination most teams land on",
            text: "One internal owner for the bar, candidate experience and stakeholder management — plus external capacity for sourcing and screening volume.",
          },
        ],
      },
    ],
    faqs: [
      {
        q: "Does a subscription replace our HR team?",
        a: "No. It supplies search and screening capacity. Employer brand, onboarding and people operations stay in-house.",
      },
      {
        q: "How many roles can one internal recruiter handle?",
        a: "It depends on role difficulty and how much coordination they absorb, but concurrency is the binding constraint long before skill is.",
      },
      {
        q: "What if we already have a recruiter?",
        a: "Then the useful question is what to take off their plate — usually sourcing breadth and first-pass screening.",
      },
      {
        q: "Can we switch later?",
        a: "Yes, provided you keep the pipeline and evidence. Ownership of the data is what makes switching cheap.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "Seats for your own team alongside the subscription capacity",
        "Sourcing, screening and scheduling handled inside one workspace",
        "Your pipeline, evidence and decision history remain yours",
        "Tiers scale with concurrent roles rather than headcount",
      ],
    },
    related: ["subscription-recruiting-vs-contingency", "hiring-for-multiple-open-roles", "recruiting-as-a-service"],
    onward: [
      { to: "/pricing", label: "Pricing", desc: "What each tier includes, including seats." },
      { to: "/solutions", label: "Solutions", desc: "How teams structure the split." },
      { to: "/contact", label: "Talk it through", desc: "Bring your role count and calendar." },
    ],
  },

  {
    slug: "ats-vs-hiring-intelligence",
    title: "ATS vs hiring intelligence",
    h1: "ATS vs hiring intelligence: storage is not decision support",
    metaTitle: "ATS vs Hiring Intelligence Platform | TaaSFlow",
    metaDescription:
      "An ATS records applications. A hiring intelligence layer ranks, evidences and recommends. Where each belongs and how they work together.",
    category: "Comparisons",
    summary:
      "An ATS answers 'where is this candidate?'. Hiring intelligence answers 'who should I talk to next, and why?'",
    updated: "2026-02-10",
    audience: "Talent operations and HR systems owners",
    sections: [
      {
        heading: "Two different jobs",
        blocks: [
          {
            kind: "table",
            columns: ["", "ATS", "Hiring intelligence"],
            rows: [
              ["Primary job", "Record and route applications", "Rank candidates and justify the ranking"],
              ["Unit of value", "Compliance and audit trail", "Decision quality and speed"],
              ["Typical output", "A list and a stage", "A shortlist with evidence"],
              ["Fails when", "Nobody reads the list", "The evidence is not traceable"],
            ],
          },
        ],
      },
      {
        heading: "Symptoms that you need the intelligence layer",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Hundreds of applications and a shortlist built from whoever applied first",
              "Hiring managers asking 'why this candidate?' and getting a gut answer",
              "Different reviewers applying visibly different bars",
              "Good candidates lost between screening and scheduling",
            ],
          },
        ],
      },
      {
        heading: "How they coexist",
        blocks: [
          {
            kind: "steps",
            items: [
              { label: "Keep one system of record", text: "Decide which system is authoritative for stage and outcome." },
              { label: "Push evidence, not opinions", text: "Whatever ranks candidates should write its reasoning back." },
              { label: "Avoid double data entry", text: "If recruiters retype stages, the second system will rot." },
            ],
          },
          {
            kind: "callout",
            title: "Do not buy a ranking you cannot read",
            text: "A score without traceable evidence is a black box, and hiring managers are right to distrust it.",
          },
        ],
      },
    ],
    faqs: [
      {
        q: "Do we need to replace our ATS?",
        a: "Not necessarily. Many teams keep the ATS as the compliance record and add an intelligence layer for ranking and decisions.",
      },
      {
        q: "Is a hiring intelligence platform just AI screening?",
        a: "Screening is one part. The layer also covers evidence storage, calibration, shortlist comparison, scheduling and decision tracking.",
      },
      {
        q: "What about audit and compliance?",
        a: "Whichever system holds the authoritative record must keep decisions, reasons and access history — that is a requirement, not a feature.",
      },
      {
        q: "How do we prove it works?",
        a: "Compare shortlists produced with and without the layer on the same role, and review the rejected pile in both.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "Candidate ranking with readable, per-requirement evidence",
        "Side-by-side shortlist comparison as the default view",
        "Interviews, scorecards and offers tracked in the same workspace",
        "Integrations directory for the systems you already run",
      ],
    },
    related: ["ai-recruiting-agents", "building-a-candidate-pipeline", "choosing-a-recruiting-partner"],
    onward: [
      { to: "/platform", label: "The platform", desc: "The decision workspace in detail." },
      { to: "/integrations", label: "Integrations", desc: "What connects to what today." },
      { to: "/security", label: "Security", desc: "Access control and data handling." },
    ],
  },

  {
    slug: "choosing-a-recruiting-partner",
    title: "Choosing a recruiting partner",
    h1: "How to choose a recruiting partner: a due-diligence checklist",
    metaTitle: "How to Choose a Recruiting Partner: Checklist | TaaSFlow",
    metaDescription:
      "The questions that separate a real hiring partner from a CV forwarder: evidence, ownership, escalation, candidate experience and commercial terms.",
    category: "Comparisons",
    summary:
      "Judge partners on what they can show you, not what they promise. Evidence, ownership and escalation beat any pitch deck.",
    updated: "2026-02-10",
    audience: "Buyers running a recruiting vendor selection",
    sections: [
      {
        heading: "Ask for evidence, not testimonials",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Show me a real shortlist with the reasoning attached (anonymised is fine)",
              "Show me a role that went badly and what changed afterwards",
              "Show me what a candidate sees at each stage",
              "Show me how I would search this pipeline in twelve months",
            ],
          },
        ],
      },
      {
        heading: "Commercial terms that matter",
        blocks: [
          {
            kind: "table",
            columns: ["Term", "What to pin down"],
            rows: [
              ["Cost shape", "Fixed, percentage, or hybrid — and what triggers extra cost"],
              ["Capacity", "How many roles run concurrently before quality drops"],
              ["Data ownership", "Who keeps candidates and evidence at the end of term"],
              ["Exit", "Notice period, export format, and what you take with you"],
              ["Attribution", "How duplicate candidates across sources are resolved"],
            ],
          },
        ],
      },
      {
        heading: "Operational fit",
        blocks: [
          {
            kind: "steps",
            items: [
              { label: "Escalation path", text: "Name the human who fixes a stalled role, and the response window." },
              { label: "Calibration cadence", text: "Agree when the bar gets reviewed, not just when candidates arrive." },
              { label: "Reporting", text: "Agree the two or three numbers you will both look at weekly." },
            ],
          },
          {
            kind: "callout",
            title: "Red flags",
            text: "Unverifiable metrics, no candidate-facing transparency, no data export, and a shortlist you cannot interrogate.",
          },
        ],
      },
    ],
    faqs: [
      {
        q: "Should we run a pilot first?",
        a: "Yes. A short, scoped pilot on one real role tells you more than any reference call — provided the success criteria are agreed up front.",
      },
      {
        q: "What is a fair pilot success criterion?",
        a: "Something observable: a shortlist you would genuinely interview, delivered inside an agreed window, with evidence you can read.",
      },
      {
        q: "How many vendors should we compare?",
        a: "Two or three, on the same role, with the same brief. Comparing different roles produces noise, not signal.",
      },
      {
        q: "What if the partner cannot show real outcomes?",
        a: "Ask for a methodology walkthrough instead — and treat any unverifiable statistic as marketing rather than evidence.",
      },
    ],
    product: {
      heading: "How TaaSFlow answers these questions",
      points: [
        "Readable evidence behind every candidate recommendation",
        "You keep the pipeline, evidence and decision history",
        "A published trust centre covering data handling and access",
        "A scoped pilot with agreed criteria before any subscription",
      ],
    },
    related: ["subscription-recruiting-vs-contingency", "recruiting-as-a-service", "ats-vs-hiring-intelligence"],
    onward: [
      { to: "/pilot", label: "The pilot", desc: "Scope, timing and what you receive." },
      { to: "/trust", label: "Trust centre", desc: "How we handle your data." },
      { to: "/case-studies", label: "Case studies", desc: "Representative engagements." },
    ],
  },
];
