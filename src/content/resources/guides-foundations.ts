import type { ResourceGuide } from "./types";

/** Foundations — what the category is and how it works. */
export const FOUNDATION_GUIDES: ResourceGuide[] = [
  {
    slug: "recruiting-as-a-service",
    title: "Recruiting as a Service",
    h1: "Recruiting as a Service: the complete guide",
    metaTitle: "Recruiting as a Service: How It Works | TaaSFlow",
    metaDescription:
      "What Recruiting as a Service is, how the subscription model works, where it fits against agencies and in-house teams, and how to run it well.",
    category: "Foundations",
    summary:
      "A subscription operating model for hiring: fixed cost, continuous search capacity, and a system of record you keep.",
    updated: "2026-02-10",
    audience: "Founders, HR leads and hiring managers evaluating hiring models",
    sections: [
      {
        heading: "What Recruiting as a Service actually means",
        blocks: [
          {
            kind: "p",
            text: "Recruiting as a Service (RaaS) replaces per-hire fees with a subscription. You buy search capacity and hiring infrastructure for a period of time, not a single placement.",
          },
          {
            kind: "bullets",
            items: [
              "Fixed, forecastable cost instead of a percentage of salary",
              "Continuous sourcing across every open role, not one requisition at a time",
              "The pipeline, evidence and history stay in your workspace",
            ],
          },
        ],
      },
      {
        heading: "The three components you are buying",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                label: "Search capacity",
                text: "Sourcing and outreach that runs every day the role is open, across channels rather than a single job board.",
              },
              {
                label: "Screening and evidence",
                text: "Structured review against the role requirements, so every recommendation carries the reasoning behind it.",
              },
              {
                label: "A decision surface",
                text: "One place where shortlists, interviews, feedback and offers are tracked — and stay searchable after the hire.",
              },
            ],
          },
        ],
      },
      {
        heading: "Where the model fits — and where it does not",
        blocks: [
          {
            kind: "table",
            columns: ["Situation", "Fit"],
            rows: [
              ["Two or more roles open at once", "Strong — capacity is shared across roles"],
              ["Repeating role families you hire every quarter", "Strong — the pipeline compounds"],
              ["One senior, highly confidential search", "Depends — retained search may fit better"],
              ["A single junior hire, once a year", "Weak — a one-off package is cheaper"],
            ],
          },
        ],
      },
      {
        heading: "How to run it well in the first 30 days",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                label: "Week 1 — define the bar",
                text: "Write requirements as observable evidence: what a candidate must have done, not adjectives.",
              },
              {
                label: "Week 2 — calibrate on real profiles",
                text: "Review the first shortlist and correct the rubric. Calibration is the highest-leverage hour you will spend.",
              },
              {
                label: "Weeks 3–4 — protect decision speed",
                text: "Name one decision owner per role and hold a standing slot for interviews. Most lost candidates are lost to waiting.",
              },
            ],
          },
          {
            kind: "callout",
            title: "The failure mode to watch",
            text: "Subscription capacity cannot fix an undefined bar or an absent decision maker. Fix those first; they dominate every other variable.",
          },
        ],
      },
    ],
    faqs: [
      {
        q: "Is Recruiting as a Service the same as RPO?",
        a: "No. RPO usually outsources an entire hiring function on a long contract. RaaS is a shorter-cycle subscription for search capacity and hiring infrastructure, and you keep the pipeline.",
      },
      {
        q: "Do I still pay a placement fee?",
        a: "Not in a subscription model. The subscription covers the search; there is no percentage of salary at offer stage.",
      },
      {
        q: "What happens to candidates I do not hire?",
        a: "They stay in your talent pool with the evidence attached, so the next similar role starts from a warm pipeline instead of zero.",
      },
      {
        q: "How many roles can one subscription cover?",
        a: "That depends on the tier you choose. Capacity is banded by the number of roles you want active at the same time.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "Agents run sourcing and outreach continuously while a role is open",
        "Every candidate score is backed by extracted evidence you can read",
        "Shortlists, interviews and offers live in one Decision Workspace",
        "Your talent pool and its evidence remain searchable after each hire",
      ],
    },
    related: [
      "subscription-recruiting-vs-contingency",
      "internal-recruiter-vs-recruiting-subscription",
      "choosing-a-recruiting-partner",
    ],
    onward: [
      { to: "/how-it-works", label: "How it works", desc: "The seven-stage process, with typical timing." },
      { to: "/pricing", label: "Pricing", desc: "Subscription tiers and one-off packages." },
      { to: "/platform", label: "The platform", desc: "The workspace where decisions get made." },
    ],
  },

  {
    slug: "ai-recruiting-agents",
    title: "AI recruiting agents",
    h1: "AI recruiting agents: what they do, what they should never do",
    metaTitle: "AI Recruiting Agents: Capabilities and Limits | TaaSFlow",
    metaDescription:
      "A practical guide to AI recruiting agents: the tasks they handle reliably, the decisions that must stay human, and how to audit their output.",
    category: "Foundations",
    summary:
      "Agents are good at breadth, consistency and never getting tired. They are not good at judgement — keep the decision human.",
    updated: "2026-02-10",
    audience: "Talent leaders and hiring managers assessing AI in hiring",
    sections: [
      {
        heading: "The work agents do reliably",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Breadth: reading every application, not the first twenty",
              "Consistency: applying the same rubric to candidate one and candidate four hundred",
              "Extraction: pulling verifiable facts from a CV into structured fields",
              "Continuity: keeping outreach and follow-up running on schedule",
            ],
          },
        ],
      },
      {
        heading: "The work that must stay human",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Deciding who gets hired, rejected or advanced",
              "Judging motivation, context and trade-offs a CV cannot show",
              "Setting the bar — the rubric itself is a human artefact",
              "Any communication that changes a candidate's expectations",
            ],
          },
          {
            kind: "callout",
            title: "Evidence, not verdicts",
            text: "An agent's job is to show you what it found and where it found it. If you cannot trace a score back to a line in the CV, the score is not usable.",
          },
        ],
      },
      {
        heading: "How to audit an agent's output",
        blocks: [
          {
            kind: "steps",
            items: [
              { label: "Ask for the source", text: "Every claim should point at the text it came from." },
              { label: "Re-run a known set", text: "Score five candidates you already have an opinion on and compare." },
              { label: "Check the misses", text: "Read the rejected pile. Wrong rejections tell you more than right acceptances." },
              { label: "Version the rubric", text: "When the bar changes, the rubric version changes — old scores stay attached to the old rubric." },
            ],
          },
        ],
      },
      {
        heading: "Questions to ask any vendor",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Can I read the evidence behind a score, line by line?",
              "Is the rubric versioned and immutable once a score is recorded?",
              "What does the candidate see, and in what language?",
              "Can a human override, and is the override recorded?",
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        q: "Do AI agents replace recruiters?",
        a: "They replace the repetitive parts of the work — reading, extracting, following up. Calibration, judgement and relationships stay human.",
      },
      {
        q: "How do you prevent bias amplification?",
        a: "Score against explicit, role-specific requirements rather than pattern-matching on profiles, keep the evidence readable, and review the rejected pile regularly.",
      },
      {
        q: "What do candidates get told?",
        a: "Candidate-facing language should describe screening and application review in plain terms, with a way to check their own status.",
      },
      {
        q: "Can scores change after the fact?",
        a: "They should not. A recorded score belongs to the rubric version it was produced under; a new bar produces a new score run.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "Every score is attached to an immutable rubric version and a score run",
        "Extracted evidence is stored per candidate and readable in the workspace",
        "Human review and overrides are recorded, not silent",
        "Candidate-facing copy describes screening — never an internal score",
      ],
    },
    related: ["ats-vs-hiring-intelligence", "multichannel-candidate-outreach", "recruiting-as-a-service"],
    onward: [
      { to: "/agents", label: "The agent roster", desc: "Which agents run which part of the search." },
      { to: "/trust", label: "Trust centre", desc: "Data handling, retention and access." },
      { to: "/platform", label: "The platform", desc: "Where evidence and decisions live." },
    ],
  },

  {
    slug: "building-a-candidate-pipeline",
    title: "Building a candidate pipeline",
    h1: "Building a candidate pipeline that survives the hire",
    metaTitle: "How to Build a Candidate Pipeline That Lasts | TaaSFlow",
    metaDescription:
      "A repeatable method for building talent pipelines: define role families, capture evidence once, keep warm candidates reachable, and measure decay.",
    category: "Operations",
    summary:
      "Most pipelines die at offer-accept. A pipeline that persists is a data asset — and it makes the next hire dramatically faster.",
    updated: "2026-02-10",
    audience: "Talent acquisition leads and hiring managers with recurring roles",
    sections: [
      {
        heading: "Start from role families, not requisitions",
        blocks: [
          {
            kind: "p",
            text: "A requisition is a moment. A role family is a pattern you hire against repeatedly — and it is the right unit for a pipeline.",
          },
          {
            kind: "bullets",
            items: [
              "Group roles that share a requirement spine (e.g. mid-level RN, field service engineer, enterprise AE)",
              "Write the spine once as observable evidence",
              "Let individual requisitions differ only in the variable parts: location, seniority band, shift, language",
            ],
          },
        ],
      },
      {
        heading: "Capture evidence once, reuse it forever",
        blocks: [
          {
            kind: "p",
            text: "If your only record of a candidate is a CV file and a rejection reason, the pipeline is not reusable. Structured evidence is what makes rediscovery possible.",
          },
          {
            kind: "bullets",
            items: [
              "Extract the facts: credentials, systems, scope, sector, dates",
              "Record the reason for every decision, including near-misses",
              "Tag the constraint that blocked a hire — timing, band, location — because constraints expire",
            ],
          },
        ],
      },
      {
        heading: "Keep warmth honest",
        blocks: [
          {
            kind: "steps",
            items: [
              { label: "Set a decay clock", text: "Treat any candidate untouched for six months as cold until re-confirmed." },
              { label: "Re-confirm, do not assume", text: "Availability, salary expectation and location all move. Ask before you shortlist." },
              { label: "Give a reason to reply", text: "A specific role beats a generic keep-in-touch note every time." },
            ],
          },
          {
            kind: "callout",
            title: "Never present stale availability as current",
            text: "Showing a hiring manager a candidate who is no longer available costs more credibility than an empty shortlist.",
          },
        ],
      },
      {
        heading: "What to measure",
        blocks: [
          {
            kind: "table",
            columns: ["Metric", "What it tells you"],
            rows: [
              ["Warm pool per role family", "Whether the next opening starts from zero"],
              ["Rediscovery rate", "How often a hire comes from an existing candidate"],
              ["Near-miss reasons", "Whether your bar or your band is the real blocker"],
              ["Decay rate", "How fast your pool goes stale without contact"],
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        q: "How large should a pipeline be?",
        a: "Size matters less than freshness and fit. A small pool of re-confirmed, well-evidenced candidates outperforms a large stale list.",
      },
      {
        q: "Is a pipeline just a CV database?",
        a: "No. A database stores documents; a pipeline stores structured evidence, decisions and constraints, which is what makes it searchable later.",
      },
      {
        q: "Who owns the pipeline in a subscription model?",
        a: "You should. If a vendor keeps the pipeline when the contract ends, you were renting outcomes rather than building an asset.",
      },
      {
        q: "How do we handle candidates who said no?",
        a: "Record why. Compensation, timing and location objections expire — and those candidates are often the fastest second-time hires.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "Structured evidence is extracted per candidate and kept with the record",
        "Role-fit rediscovery surfaces existing candidates against new openings",
        "Decision reasons and near-miss constraints are captured, not discarded",
        "Availability is re-confirmed before a candidate is presented",
      ],
    },
    related: ["hard-to-fill-roles", "hiring-for-multiple-open-roles", "recruiting-as-a-service"],
    onward: [
      { to: "/talent-network", label: "Talent network", desc: "How candidates enter and stay reachable." },
      { to: "/platform", label: "The platform", desc: "Where pipelines and evidence live." },
      { to: "/industries", label: "By industry", desc: "Role families for your sector." },
    ],
  },
];
