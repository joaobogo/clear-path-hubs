/**
 * Homepage FAQ copy.
 *
 * Kept out of `src/routes/index.tsx` on purpose: the route file is split into a
 * shared chunk for `head()`, and module-scope constants declared in the route
 * are not re-exported into that chunk, which breaks hydration.
 */
export const HOMEPAGE_FAQ = [
  {
    q: "What is TaaSFlow?",
    a: "TaaSFlow is an on-demand Talent Management SaaS platform delivered on flexible commercial terms. A recruiter runs sourcing and evaluation for your roles inside a live workspace your team can see at any time.",
  },
  {
    q: "How is TaaSFlow different from a recruiting agency?",
    a: "Agencies charge a percentage of salary per hire and forward CVs by email. TaaSFlow is a package-based engagement with ranked candidates, evidence per requirement, and a transparent workspace — no placement fees.",
  },
  {
    q: "What does the client actually receive?",
    a: "A ranked shortlist, recruiter-written evidence tied to each requirement, CV quotes, a live pipeline across every stage, and one workspace thread with your recruiter — all owned by your team.",
  },
  {
    q: "How does pricing work?",
    a: "Fixed package pricing scoped to volume. Higher volume lowers cost per role, and annual commitment saves 10%. No percentage-of-salary fees, no per-hire fees.",
  },
  {
    q: "Who owns the candidates and pipeline?",
    a: "You do. Every candidate, note, evidence quote, and message stays in your workspace so past pipelines are reusable when new roles open.",
  },
  {
    q: "How do we start?",
    a: "Open a role with the intake wizard or book a conversation. We confirm the requirements with you before any sourcing begins so evidence is scored against what you actually approved.",
  },
] as const;
