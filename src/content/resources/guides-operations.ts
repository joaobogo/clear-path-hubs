import type { ResourceGuide } from "./types";

/** Operations and economics — running the process and pricing the delay. */
export const OPERATIONS_GUIDES: ResourceGuide[] = [
  {
    slug: "hard-to-fill-roles",
    title: "Hard-to-fill roles",
    h1: "How to fill a hard-to-fill role",
    metaTitle: "How to Fill Hard-to-Fill Roles | TaaSFlow",
    metaDescription:
      "Diagnose why a role is stuck — supply, definition, band, or process — then apply the fix that matches the actual constraint.",
    category: "Operations",
    summary:
      "Most 'impossible' roles are not supply problems. Diagnose before you spend, because the wrong fix costs another month.",
    updated: "2026-02-10",
    audience: "Hiring managers with a role open longer than expected",
    sections: [
      {
        heading: "Four causes, four different fixes",
        blocks: [
          {
            kind: "table",
            columns: ["Cause", "Signal", "Fix"],
            rows: [
              ["Genuine scarcity", "Few qualified profiles exist anywhere", "Widen geography, seniority or credential path"],
              ["Over-specified requirements", "Strong candidates fail on one nice-to-have", "Split must-have from nice-to-have"],
              ["Compensation band", "Candidates withdraw at the salary conversation", "Re-band, or change the scope to match the band"],
              ["Process friction", "Good candidates drop between stages", "Compress scheduling and name a decision owner"],
            ],
          },
        ],
      },
      {
        heading: "Run the diagnosis in one hour",
        blocks: [
          {
            kind: "steps",
            items: [
              { label: "Read the rejections", text: "Where in the funnel do people leave, and who leaves — you or them?" },
              { label: "Count the must-haves", text: "More than five hard requirements usually means the role is two roles." },
              { label: "Check the market band", text: "Compare your offer to what similar scope pays in the same geography." },
              { label: "Time the stages", text: "Measure days between application, screen, interview and decision." },
            ],
          },
        ],
      },
      {
        heading: "Widening without lowering the bar",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Trade credential for demonstrated scope where the credential is not legally required",
              "Accept adjacent-sector experience when the underlying work is the same",
              "Open remote or hybrid variants of the same requirement spine",
              "Consider a two-step hire: a strong near-miss plus a defined ramp plan",
            ],
          },
          {
            kind: "callout",
            title: "The cost of waiting is a real number",
            text: "Before you hold out for a perfect profile, price the days the role stays open — then decide deliberately.",
          },
        ],
      },
    ],
    faqs: [
      {
        q: "How long is too long for a role to stay open?",
        a: "Compare against your own history for the same role family. A role that took four weeks last year and is at ten weeks now has a process or band problem, not a supply problem.",
      },
      {
        q: "Should we raise pay or widen the profile?",
        a: "Whichever the evidence points at. Withdrawals at the salary stage mean band; failures at the requirement stage mean profile.",
      },
      {
        q: "Do multi-channel campaigns help scarce roles?",
        a: "Yes, when scarcity is real — reaching passive candidates matters more than another job board slot.",
      },
      {
        q: "When should we pause a role?",
        a: "When the band or the scope cannot change yet. Pausing honestly is better than running a search that cannot close.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "Requirement spines separate must-haves from nice-to-haves before sourcing starts",
        "Funnel diagnostics show where candidates leave and why",
        "Near-miss evidence is retained so widening the brief is instant",
        "Compensation signal supports the band conversation",
      ],
    },
    related: ["multichannel-candidate-outreach", "cost-of-an-unfilled-position", "building-a-candidate-pipeline"],
    onward: [
      { to: "/how-it-works", label: "How it works", desc: "The stages and their typical timing." },
      { to: "/industries", label: "By industry", desc: "Sector-specific role constraints." },
      { to: "/contact", label: "Get a diagnosis", desc: "Bring one stuck role." },
    ],
  },

  {
    slug: "multichannel-candidate-outreach",
    title: "Multichannel candidate outreach",
    h1: "Multichannel candidate outreach that people actually answer",
    metaTitle: "Multichannel Candidate Outreach Guide | TaaSFlow",
    metaDescription:
      "How to run outreach across job boards, professional networks, email and referrals without spamming — sequencing, message structure and measurement.",
    category: "Operations",
    summary:
      "Reach is a channel problem. Reply rate is a message problem. Fix them separately.",
    updated: "2026-02-10",
    audience: "Recruiters and founders doing their own sourcing",
    sections: [
      {
        heading: "Match the channel to the candidate",
        blocks: [
          {
            kind: "table",
            columns: ["Channel", "Best for", "Watch out for"],
            rows: [
              ["Job boards", "Active candidates, volume roles", "Applicant volume without relevance"],
              ["Professional networks", "Passive, specialist profiles", "Generic templates get ignored"],
              ["Direct email", "Named, researched targets", "Consent and local rules"],
              ["Referrals", "Trust-sensitive and senior hires", "Narrow, homogeneous reach"],
              ["Communities", "Niche technical or clinical roles", "Norms differ — read before posting"],
            ],
          },
        ],
      },
      {
        heading: "A message structure that earns a reply",
        blocks: [
          {
            kind: "steps",
            items: [
              { label: "One specific reason", text: "Name the thing in their background that made you write." },
              { label: "One concrete fact", text: "Scope, team, band or location — something they can evaluate." },
              { label: "One small ask", text: "A reply, not a 45-minute call." },
            ],
          },
          {
            kind: "callout",
            title: "Sequence, do not repeat",
            text: "Two follow-ups that add new information outperform five that resend the same message.",
          },
        ],
      },
      {
        heading: "Respect and compliance",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Honour opt-outs immediately and permanently",
              "Say where you got their details when asked",
              "Never imply an offer or a decision that has not been made",
              "Keep one thread per candidate and role so nobody gets contacted twice",
            ],
          },
        ],
      },
      {
        heading: "What to measure",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Reply rate by channel and by message variant",
              "Qualified reply rate — replies that pass first screen",
              "Time from first contact to first conversation",
              "Opt-out rate, as a quality guardrail",
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        q: "How many channels should we run at once?",
        a: "Two well-run channels beat five neglected ones. Add a channel only when the current ones are measured and stable.",
      },
      {
        q: "Does personalisation still matter at volume?",
        a: "Yes, but it should be structural: one specific, verifiable detail per message rather than free-form rewriting.",
      },
      {
        q: "How do we avoid contacting the same person twice?",
        a: "Keep a single conversation thread per candidate and role, with source attribution recorded.",
      },
      {
        q: "What reply rate is good?",
        a: "It varies by role scarcity and channel. Track your own baseline and compare variants against it rather than industry claims.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "Outreach runs across multiple channels while a role is open",
        "One unified conversation thread per candidate and role",
        "Opt-outs and consent state are recorded and respected",
        "Reply and qualified-reply rates reported per channel",
      ],
    },
    related: ["hard-to-fill-roles", "ai-recruiting-agents", "building-a-candidate-pipeline"],
    onward: [
      { to: "/agents", label: "The agent roster", desc: "Who runs outreach and follow-up." },
      { to: "/platform", label: "The platform", desc: "Where conversations are tracked." },
      { to: "/trust", label: "Trust centre", desc: "Consent and data handling." },
    ],
  },

  {
    slug: "hiring-for-multiple-open-roles",
    title: "Hiring for multiple open roles",
    h1: "Hiring for multiple open roles at once",
    metaTitle: "How to Hire for Multiple Open Roles at Once | TaaSFlow",
    metaDescription:
      "Sequencing, shared requirement spines, one decision queue and weekly rituals for teams running several searches in parallel.",
    category: "Operations",
    summary:
      "Parallel hiring fails on attention, not on sourcing. Sequence the decisions, share the requirement work, and keep one queue.",
    updated: "2026-02-10",
    audience: "Teams running three or more searches at the same time",
    sections: [
      {
        heading: "Sequence by dependency, not by urgency",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Hire the roles that unblock other hires first — leads before their teams",
              "Group roles with a shared requirement spine into one sourcing effort",
              "Stagger interview loads so the same panel is not booked against itself",
            ],
          },
        ],
      },
      {
        heading: "One queue, one owner per role",
        blocks: [
          {
            kind: "p",
            text: "The most common failure in parallel hiring is diffuse ownership. Every role needs a single named decision owner, and every decision needs to appear in one queue.",
          },
          {
            kind: "steps",
            items: [
              { label: "One queue", text: "All pending decisions across all roles, ordered by what expires soonest." },
              { label: "One owner", text: "Named per role, with a deputy for holidays." },
              { label: "One standing slot", text: "A fixed weekly time when decisions get made, not deferred." },
            ],
          },
        ],
      },
      {
        heading: "The weekly ritual",
        blocks: [
          {
            kind: "table",
            columns: ["Question", "Action if the answer is bad"],
            rows: [
              ["Which role has no movement this week?", "Diagnose cause; do not just add sourcing"],
              ["Who is waiting on us?", "Clear it before adding new candidates"],
              ["Which candidate is at risk of another offer?", "Escalate to a decision today"],
              ["What did we learn about the bar?", "Update the requirement spine"],
            ],
          },
          {
            kind: "callout",
            title: "Never let a good candidate wait on a slow role",
            text: "Candidates do not experience your portfolio of roles. They experience the silence on theirs.",
          },
        ],
      },
    ],
    faqs: [
      {
        q: "How many roles can one manager realistically run?",
        a: "The constraint is interview and decision time, not sourcing. Count the hours the panel can actually give each week and work backwards.",
      },
      {
        q: "Should we pause roles to focus?",
        a: "Pausing deliberately is better than running every role slowly. Pick the roles that unblock the most work.",
      },
      {
        q: "How do we keep the bar consistent across roles?",
        a: "Share the requirement spine across a role family and review it weekly, so drift is caught while it is small.",
      },
      {
        q: "What about candidates who fit a different role?",
        a: "Route them deliberately, with their consent, rather than rejecting and losing the evidence.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "A single decision queue across every open role",
        "Shared requirement spines across role families",
        "SLA clocks that surface roles and candidates waiting on you",
        "Cross-role fit suggestions from your existing pipeline",
      ],
    },
    related: ["ninety-day-hiring-plan", "building-a-candidate-pipeline", "internal-recruiter-vs-recruiting-subscription"],
    onward: [
      { to: "/platform", label: "The platform", desc: "The decision queue in practice." },
      { to: "/pricing", label: "Pricing", desc: "Tiers banded by concurrent roles." },
      { to: "/enterprise", label: "Enterprise", desc: "High-volume and continuous hiring." },
    ],
  },

  {
    slug: "ninety-day-hiring-plan",
    title: "The 90-day hiring plan",
    h1: "A 90-day hiring plan you can actually run",
    metaTitle: "90-Day Hiring Plan Template and Framework | TaaSFlow",
    metaDescription:
      "A quarter-length hiring plan: define the bar in weeks 1–2, run parallel search in weeks 3–8, and convert plus review in weeks 9–12.",
    category: "Operations",
    summary:
      "Ninety days is enough to define the bar, fill the priority roles, and leave a pipeline behind — if the sequence holds.",
    updated: "2026-02-10",
    audience: "Leaders with a quarterly hiring commitment",
    sections: [
      {
        heading: "Weeks 1–2 — define and instrument",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Write requirement spines as observable evidence for each role family",
              "Name one decision owner and one deputy per role",
              "Agree the band, the panel and the standing decision slot",
              "Set the two numbers you will review weekly",
            ],
          },
        ],
      },
      {
        heading: "Weeks 3–8 — run search in parallel",
        blocks: [
          {
            kind: "steps",
            items: [
              { label: "Calibrate early", text: "Correct the rubric on the first shortlist, not the fourth." },
              { label: "Protect interview capacity", text: "Block the slots before candidates exist." },
              { label: "Review the rejected pile weekly", text: "It is the fastest signal that the bar is mis-set." },
              { label: "Escalate stalls at 7 days", text: "No movement for a week is a defect, not bad luck." },
            ],
          },
        ],
      },
      {
        heading: "Weeks 9–12 — convert and consolidate",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Close offers fast — stalled offers past 48 hours need an owner, not a reminder",
              "Capture structured interview feedback so the next cycle starts calibrated",
              "Re-confirm and label the warm pool you are keeping",
              "Write down what changed about the bar this quarter",
            ],
          },
          {
            kind: "callout",
            title: "Leave an asset behind",
            text: "A quarter that fills roles but leaves no evidence, no calibrated rubric and no warm pool has to start from zero next quarter.",
          },
        ],
      },
      {
        heading: "The review that makes the next quarter cheaper",
        blocks: [
          {
            kind: "table",
            columns: ["Review question", "Why it matters"],
            rows: [
              ["Where did days actually go?", "Waiting usually beats sourcing as the biggest cost"],
              ["Which requirements never mattered?", "Removes false scarcity next time"],
              ["Which channel produced qualified replies?", "Directs next quarter's effort"],
              ["Which near-misses should we revisit?", "Turns a rejection list into a pipeline"],
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        q: "Is 90 days realistic for senior roles?",
        a: "For many roles yes, but scarce senior searches can run longer. Plan the quarter around the roles that unblock the most work.",
      },
      {
        q: "What if priorities change mid-quarter?",
        a: "Re-sequence rather than adding. Capacity is finite, and adding roles without removing any is how quarters fail.",
      },
      {
        q: "How do we track progress without vanity metrics?",
        a: "Track days open, decisions pending on your side, and qualified reply rate. All three are actionable.",
      },
      {
        q: "What should exist on day 91?",
        a: "Filled priority roles, a calibrated rubric, structured interview feedback, and a re-confirmed warm pool.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "Guided onboarding that sets requirement spines and owners in week one",
        "SLA clocks and stall detection on roles, candidates and offers",
        "Structured interview scorecards tied to the requirements",
        "Quarterly analytics on where days and spend actually went",
      ],
    },
    related: ["hiring-for-multiple-open-roles", "cost-of-an-unfilled-position", "recruiting-as-a-service"],
    onward: [
      { to: "/how-it-works", label: "How it works", desc: "Stage-by-stage with typical timing." },
      { to: "/pilot", label: "Start with a pilot", desc: "One role, agreed criteria." },
      { to: "/platform", label: "The platform", desc: "Where the plan is tracked." },
    ],
  },

  {
    slug: "cost-of-an-unfilled-position",
    title: "Cost of an unfilled position",
    h1: "The cost of an unfilled position — and how to calculate yours",
    metaTitle: "Cost of an Unfilled Position Calculator | TaaSFlow",
    metaDescription:
      "Work out what an open role costs per day: lost output, cover costs and delayed revenue. Use the calculator, then compare it to your hiring spend.",
    category: "Economics",
    summary:
      "An open role has a daily cost. Once you can name it, every hiring decision — band, brief, urgency — gets easier.",
    updated: "2026-02-10",
    audience: "Finance, operations and hiring leaders building a business case",
    sections: [
      {
        heading: "The four components of vacancy cost",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                label: "Lost output",
                text: "The value the role was expected to produce, pro-rated per working day.",
              },
              {
                label: "Cover cost",
                text: "Overtime, contractors, or the opportunity cost of colleagues absorbing the work.",
              },
              {
                label: "Delayed revenue or delivery",
                text: "Deals, cases, shifts or projects that cannot start without the role filled.",
              },
              {
                label: "Compounding risk",
                text: "Burnout and attrition in the team carrying the gap — the cost that outlives the vacancy.",
              },
            ],
          },
        ],
      },
      {
        heading: "Calculate your own number",
        blocks: [
          { kind: "calculator" },
          {
            kind: "p",
            text: "Use conservative inputs. A defensible smaller number persuades a finance team; an inflated one ends the conversation.",
          },
        ],
      },
      {
        heading: "How to use the number",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Compare the daily cost to the cost of widening the band by a few percent",
              "Compare two weeks of vacancy to the entire cost of the search",
              "Use it to justify a standing weekly decision slot — waiting is the expensive part",
              "Use it to decide whether to pause a role honestly rather than run it slowly",
            ],
          },
          {
            kind: "callout",
            title: "Method, not a benchmark",
            text: "This is a framework for your own inputs. Treat any published industry average as a prompt to measure, not as your number.",
          },
        ],
      },
      {
        heading: "Reducing the number",
        blocks: [
          {
            kind: "table",
            columns: ["Lever", "Typical effect"],
            rows: [
              ["Named decision owner per role", "Removes the largest source of idle days"],
              ["Pre-booked interview slots", "Compresses the scheduling gap"],
              ["Warm pipeline for the role family", "Shortens the sourcing phase"],
              ["Must-have vs nice-to-have split", "Stops false scarcity extending the search"],
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        q: "What if we cannot estimate revenue per role?",
        a: "Use fully-loaded salary as a floor for lost output, then add cover costs you can evidence. It understates the true cost, which is fine for a business case.",
      },
      {
        q: "Should we include recruiter time?",
        a: "Include it if you are comparing hiring models. Exclude it if you are only pricing the delay itself, to avoid double counting.",
      },
      {
        q: "How many working days should we use?",
        a: "Use your own calendar. Around 21–22 working days per month is a reasonable default for salaried roles.",
      },
      {
        q: "Does this apply to shift-based roles?",
        a: "Yes, and it is often clearer: unfilled shifts have a direct cover cost you can read off the rota.",
      },
    ],
    product: {
      heading: "How TaaSFlow implements this",
      points: [
        "Days-open and stage-level timing tracked per role",
        "Stall detection on roles, candidates and offers",
        "Analytics that attribute delay to sourcing, scheduling or decisions",
        "Fixed subscription pricing so hiring spend is forecastable against this number",
      ],
    },
    related: ["hard-to-fill-roles", "subscription-recruiting-vs-contingency", "ninety-day-hiring-plan"],
    onward: [
      { to: "/pricing", label: "Pricing", desc: "Compare your daily cost to a subscription." },
      { to: "/how-it-works", label: "How it works", desc: "Where the days go, and how they compress." },
      { to: "/contact", label: "Talk to us", desc: "Bring your numbers." },
    ],
  },
];
