/**
 * Brand Center — TaaSFlow strategy, messaging and voice.
 *
 * Sourced from the approved positioning in this project: the FGV brand core
 * for TaaSFlow, `src/content/pages/*`, the live homepage, and
 * `src/config/pricing-core.ts`. No claim, metric, client or certification is
 * introduced here that is not already approved in the project.
 */

export const IDENTITY = {
  brandId: "taasflow",
  name: "TaaSFlow",
  legalNote:
    "Use “TaaSFlow” in running copy. Capitalisation is fixed: capital T, lower a, lower a, capital S, capital F. Never “TaaSFlow”, “TAASflow” or “Taas Flow”.",
  category: "Recruiting subscription, ATS/workspace, and Talent as a Service.",
  promise: "Your whole hiring stack, all in one.",
  tagline: "ATS + recruiting + outreach.",
  parentLine: "An FGV Company",
  parentStatus:
    "Parent-company lockup is supplied by the FGV brand programme. Held at review status until a signed-off FGV relationship asset lands in this project — it is not applied to the live site.",
  shortDescription:
    "TaaSFlow combines a recruiting workspace, ongoing sourcing, outreach, evidence-based candidate review, and ranked shortlists in one subscription.",
  mediumDescription:
    "TaaSFlow is a recruiting subscription with the applicant tracking system included. You get a hiring workspace your team owns, recruiters sourcing and running outreach on your open roles, and every candidate reviewed against the role's own criteria before they reach you. Shortlists arrive ranked, with the evidence behind each ranking attached. One monthly price covers the software and the work.",
  fullDescription:
    "Most companies pay twice to hire: once for applicant tracking software, and again for recruiters or agency fees on top. TaaSFlow puts both in one subscription. Inside the workspace you post roles, define what good looks like, and watch every application land in a structured pipeline. Behind it, recruiters run ongoing sourcing and outreach against those roles instead of waiting for inbound. Every candidate is screened against the role's stated criteria, and the shortlist you review is ranked with the supporting evidence attached, so a decision is a decision about a person, not about a pile of CVs. Clients see only the candidates approved for their role, contact details are released separately, and the workspace stays yours as roles open and close. New teams can start with a paid pilot on one role before subscribing.",
  elevatorPitch:
    "TaaSFlow is a recruiting subscription with the ATS built in. You get the hiring workspace, the sourcing, and the outreach in one monthly price — and every shortlist arrives ranked with the evidence behind it.",
  purpose:
    "Hiring stalls when the software, the sourcing and the judgement live in three different places. TaaSFlow exists to put them in one place, so a small team can run a real search without assembling a recruiting function or paying a percentage of someone's salary to do it.",
  positioning:
    "For teams hiring more than occasionally but too small to run an in-house recruiting function, TaaSFlow is the recruiting subscription that includes the applicant tracking system. Unlike ATS vendors, the sourcing and outreach are part of the service. Unlike agencies, the price is a subscription, and the workspace, pipeline and candidate history stay with the client.",
} as const;

export interface Audience {
  name: string;
  description: string;
  cares: string;
}

export const AUDIENCES: Audience[] = [
  {
    name: "Founders and hiring managers at growing companies",
    description: "Running searches alongside their actual job, usually without a recruiter in the building.",
    cares: "Fewer, better candidates. A price they can plan around. No percentage-of-salary surprise at the end.",
  },
  {
    name: "Heads of People and internal recruiters",
    description: "Own the process, need capacity and a system rather than another vendor to manage.",
    cares: "One workspace their team owns, pipeline visibility, and sourcing that keeps running between reviews.",
  },
  {
    name: "Operations and finance leaders",
    description: "Approve the spend and compare it to agency fees.",
    cares: "Predictable subscription cost, clear scope, and the ability to see what the money produced.",
  },
  {
    name: "Candidates",
    description: "Apply into a TaaSFlow-run role and track their own application.",
    cares: "A clear process, a real status, and a review that looks at their experience rather than a keyword.",
  },
];

export interface Pillar {
  title: string;
  body: string;
  proof: string;
}

export const PILLARS: Pillar[] = [
  {
    title: "Structured intake",
    body: "A role starts with what good actually looks like — responsibilities, must-haves, screening questions and the weighting used to review against them.",
    proof: "Intake takes minutes and produces a role blueprint the client confirms before sourcing begins.",
  },
  {
    title: "Ongoing sourcing and outreach",
    body: "Recruiters run continuous sourcing and outreach against live roles rather than waiting on inbound applications.",
    proof: "Sourcing and outreach are inside the subscription, not billed as an extra service.",
  },
  {
    title: "Evidence-based shortlists",
    body: "Every candidate is reviewed against the role's own criteria, and the shortlist is ranked with the evidence behind each ranking attached.",
    proof: "Reviewers see the supporting evidence next to each ranked candidate before making a decision.",
  },
  {
    title: "A hiring workspace the client owns",
    body: "Roles, pipeline, candidate history and decisions live in one workspace that stays with the client between searches.",
    proof: "The ATS is included in the subscription; there is no separate software line.",
  },
];

export const VOICE = {
  summary:
    "Warm, direct and specific. TaaSFlow sounds like an experienced recruiter explaining exactly what will happen next — not a platform announcing itself.",
  attributes: [
    { trait: "Plain", detail: "Short sentences. Concrete nouns. If a sentence needs a second read, rewrite it." },
    { trait: "Specific", detail: "Name the thing: the role, the step, the price, the timeline. Vague reassurance reads as evasion." },
    { trait: "Level", detail: "Confident without chest-thumping. State what the product does and let it stand." },
    { trait: "Honest about limits", detail: "Say what is not included, what needs a human, and what is still in review." },
    { trait: "Human", detail: "Candidates and hiring managers are people under pressure. Write to them, not about them." },
  ],
} as const;

export const WRITING_PRINCIPLES: string[] = [
  "Lead with the buyer outcome, then explain the mechanism.",
  "Use concrete nouns and verbs; delete adjectives that carry no information.",
  "Explain systems visually and in short language — a diagram beats a paragraph.",
  "State boundaries next to claims. If something needs review or approval, say so in the same sentence.",
  "Use proof only when it is verified in the project. Never illustrate with a number you cannot source.",
  "End a commercial page with one specific action, not a menu of them.",
  "Hero headline stays under 10 words; a subhead under 20; a section intro under two short lines.",
  "Candidate-facing copy says “screening” or “application review”. It never says “AI score”.",
];

export const WORDS_TO_USE: { term: string; why: string }[] = [
  { term: "Recruiting subscription", why: "The category. Says price model and service in two words." },
  { term: "Hiring workspace", why: "What the client logs into. Warmer and clearer than “platform”." },
  { term: "Ranked shortlist", why: "The deliverable clients actually receive." },
  { term: "Evidence", why: "What sits behind a ranking. Concrete and reviewable." },
  { term: "Sourcing and outreach", why: "The work recruiters do between reviews." },
  { term: "Screening / application review", why: "Candidate-facing language for evaluation." },
  { term: "Pilot", why: "A paid trial on one role before subscribing." },
  { term: "Role blueprint", why: "The confirmed definition of the role a search runs against." },
];

export const WORDS_TO_AVOID: { term: string; why: string }[] = [
  { term: "AI score", why: "Never shown to candidates. Use “screening” or “application review”." },
  { term: "Revolutionary / game-changing / world-class / best-in-class", why: "Unsupported superlatives." },
  { term: "One-stop shop / 360-degree / end-to-end everything", why: "Overclaims scope and sounds like a brochure." },
  { term: "Seamless / effortless / limitless", why: "Describes a feeling, not a mechanism." },
  { term: "Guaranteed", why: "TaaSFlow does not guarantee hiring outcomes." },
  { term: "Fully autonomous / no humans needed", why: "Recruiters review every shortlist. Saying otherwise is false." },
  { term: "Unlock your potential", why: "Says nothing about hiring." },
  { term: "Talent acquisition transformation", why: "Category jargon. Say what changes instead." },
  { term: "Free trial", why: "The pilot is paid. Do not imply otherwise." },
];

export const START_HERE: { task: string; goTo: string; note: string }[] = [
  { task: "Write about TaaSFlow", goTo: "Messaging", note: "Approved short, medium and full descriptions plus the elevator pitch — copy them verbatim." },
  { task: "Use the logo", goTo: "Logo system", note: "Variants, clear space, minimum sizes and the incorrect-use set." },
  { task: "Create a social post", goTo: "Social assets", note: "Exact-dimension LinkedIn, X, Facebook, YouTube and Instagram templates with working PNG export." },
  { task: "Build a presentation", goTo: "Presentations and documents", note: "16:9 title slide plus US Letter and A4 report covers." },
  { task: "Create a report or proposal", goTo: "Presentations and documents", note: "Document cover, type hierarchy, chart rules." },
  { task: "Download assets", goTo: "Downloads", note: "Approved pack, per-asset PNG/SVG, and the asset manifest." },
];

export const GOVERNANCE = {
  owner: "TaaSFlow marketing — brand@taasflow.com",
  version: "1.0",
  updatedAt: "2026-07-30",
  cadence: "Reviewed whenever design tokens, the logo system, or approved positioning change.",
} as const;
