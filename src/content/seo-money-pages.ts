export type MoneyPageSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type MoneyPageData = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  directAnswer: string;
  sections: MoneyPageSection[];
  faqs: { q: string; a: string }[];
};

export const MONEY_PAGES = {
  "flat-fee-recruiting": {
    path: "/flat-fee-recruiting",
    title: "Flat-Fee Recruiting: Costs, Model and $699 Pilot | TaaSFlow",
    description: "How flat-fee recruiting works, what the fee includes, how it differs from placement-fee agencies, and how TaaSFlow's $699 first-role pilot works.",
    eyebrow: "Flat-fee recruiting",
    h1: "Recruiting for one fixed price, not a percentage of salary.",
    directAnswer: "Flat-fee recruiting replaces a percentage-of-salary placement fee with a known price for a defined recruiting outcome. TaaSFlow starts with a one-time $699 pilot for one role: a guaranteed top 10 candidates, scored against the criteria you approve, with no placement fee.",
    sections: [
      { heading: "What a flat recruiting fee should include", paragraphs: ["A useful flat fee should make the scope visible before you buy. With TaaSFlow, the pilot covers one role and the recruiting execution needed to build the candidate pipeline."], bullets: ["Multi-channel sourcing and outreach", "Candidate scoring against approved role criteria", "Senior-recruiter review before shortlist delivery", "A guaranteed ranked top 10", "The client-owned candidate pipeline"] },
      { heading: "Why salary percentage and recruiting work are different things", paragraphs: ["A contingency fee rises when the salary rises, even when the recruiting workflow is similar. A flat-fee model prices the recruiting scope instead. That makes the cost easier to compare before the search begins.", "The right comparison is not simply fee versus fee. Compare who performs the sourcing, what arrives at the end, what happens if the shortlist misses, and whether you keep the candidate pipeline."] },
      { heading: "The TaaSFlow first-role pilot", paragraphs: ["The pilot costs $699, is available once per company, and covers one role. The first ranked top 10 is targeted within five business days. The pilot continues for 15 days so the client gets a deeper scored view of the market and the pipeline generated for the role.", "If none of the delivered top 10 scores above 90 against the approved criteria, TaaSFlow reruns the search at no cost. A later change in hiring preference does not invalidate candidates that matched the agreed brief."] },
      { heading: "What happens to the candidates", paragraphs: ["Candidates sourced for the client are kept for that client. The client can return to that pipeline and reuse it later rather than paying again for access to the same sourced group."] },
    ],
    faqs: [
      { q: "How much is the TaaSFlow pilot?", a: "$699, paid once, for one role. It is available once per company." },
      { q: "Is there a placement fee if we hire someone?", a: "No. TaaSFlow does not add a percentage-of-salary placement fee to the pilot." },
      { q: "How many candidates are guaranteed?", a: "The pilot guarantees a ranked top 10 candidates for the approved role criteria." },
      { q: "How fast is the shortlist?", a: "The first ranked top 10 is targeted within five business days, with the full scored market view developed through day 15 of the pilot." },
      { q: "What if the top 10 is weak?", a: "If none of the top 10 scores above 90 against the criteria you approved, TaaSFlow reruns the search at no cost." },
      { q: "Do we keep the candidates?", a: "Yes. The candidates sourced for your company remain your pipeline to keep and reuse." },
    ],
  },
  "recruiting-as-a-service": {
    path: "/recruiting-as-a-service",
    title: "Recruiting as a Service: How the Model Works | TaaSFlow",
    description: "A practical guide to recruiting as a service: what is done for you, how it differs from RPO, agencies and sourcing software, and how TaaSFlow works.",
    eyebrow: "Recruiting as a service",
    h1: "Recruiting execution your team can turn on role by role.",
    directAnswer: "Recruiting as a service is an outsourced recruiting model where a provider performs recurring or defined recruiting work instead of charging only when a placement closes. TaaSFlow combines recruiting execution, AI-assisted scoring and a client workspace, with a $699 one-role pilot before a company commits to more capacity.",
    sections: [
      { heading: "What the service actually does", paragraphs: ["The value of recruiting as a service is not another sourcing tool login. The provider should absorb work that would otherwise sit with an internal recruiter: translating the brief, running sourcing and outreach, evaluating responses, scoring evidence and preparing the shortlist."], bullets: ["Role brief and criteria", "Sourcing and outreach", "Evidence-backed scoring", "Human shortlist review", "Candidate pipeline in one workspace"] },
      { heading: "Recruiting as a service vs RPO", paragraphs: ["RPO commonly takes responsibility for a broader recruiting process, often with embedded people, process redesign and longer engagements. Recruiting as a service can be narrower: defined recruiting capacity or outcomes without replacing the entire talent-acquisition function.", "TaaSFlow is designed to support an internal hiring team rather than require the company to hand over every hiring decision."] },
      { heading: "Recruiting as a service vs an agency", paragraphs: ["Traditional agencies frequently price around a successful placement. Recruiting as a service prices the work or capacity. TaaSFlow's first-role pilot is a fixed $699 and does not add a placement fee if the client hires from the delivered pipeline."] },
      { heading: "What to check before buying", paragraphs: ["Ask for the exact deliverable, timeline, approval process, ownership of sourced candidates, data-retention terms, and the rule for a missed shortlist. A vague promise of access to 'AI recruiting' is not the same as a defined recruiting outcome."] },
    ],
    faqs: [
      { q: "Is recruiting as a service the same as an agency?", a: "No. The models can overlap operationally, but recruiting as a service is typically priced around defined work or capacity rather than a contingency placement fee." },
      { q: "Does TaaSFlow replace our hiring manager?", a: "No. TaaSFlow runs recruiting work and scores candidates; the client makes the hiring decision." },
      { q: "Can we try it on one role?", a: "Yes. The first-role pilot is $699, one time per company, for one role." },
      { q: "What does the pilot deliver?", a: "A guaranteed ranked top 10 candidates, with the first top 10 targeted within five business days and a deeper scored market view by day 15." },
    ],
  },
  "recruitment-agency-alternative": {
    path: "/recruitment-agency-alternative",
    title: "Recruitment Agency Alternative With No Placement Fee | TaaSFlow",
    description: "Compare recruiting agencies with flat-fee recruiting, sourcing software and in-house hiring. See when TaaSFlow is a practical no-placement-fee alternative.",
    eyebrow: "Agency alternative",
    h1: "A recruiting agency alternative when you want the work done, not a placement fee.",
    directAnswer: "If you need recruiting execution but do not want to pay a percentage of salary per hire, a flat-fee recruiting service is one alternative to a traditional agency. TaaSFlow runs sourcing, outreach and scoring for a fixed price, starting with one $699 role and no placement fee.",
    sections: [
      { heading: "The main alternatives to a contingency agency", paragraphs: ["Companies can build an internal recruiting team, use job boards directly, buy sourcing software, hire a fractional recruiter, use RPO, or use a flat-fee recruiting service. The best choice depends on how much work the internal team wants to retain."], bullets: ["In-house recruiting: maximum control, fixed internal headcount", "Job boards: low operating complexity, high screening burden", "Sourcing software: more reach, work stays internal", "Fractional recruiter: flexible human capacity", "RPO: broader outsourced recruiting process", "Flat-fee service: defined recruiting execution for a known fee"] },
      { heading: "When TaaSFlow is a fit", paragraphs: ["TaaSFlow is designed for a company that wants sourcing and evaluation work performed for it, wants a visible scoring process, and wants to retain the candidate pipeline.", "It is less useful for a company that only wants an ATS license or that wants an executive-search partner paid specifically for a closed placement."] },
      { heading: "What the $699 pilot proves", paragraphs: ["The pilot lets the company test the actual recruiting process on one live role. The deliverable is a guaranteed top 10 candidates, not access to a demo environment. The search continues through day 15 to provide a fuller scored view of the market."] },
    ],
    faqs: [
      { q: "Does TaaSFlow charge a success fee?", a: "No placement fee is added to the $699 pilot." },
      { q: "Is TaaSFlow software only?", a: "No. The offer includes recruiting execution: sourcing, outreach, scoring and senior-recruiter shortlist review." },
      { q: "Who makes the final hiring decision?", a: "The client. TaaSFlow provides the scored candidate pipeline and supporting evidence." },
      { q: "Can we reuse candidates later?", a: "Yes. Candidates sourced for your company remain your pipeline to keep and reuse." },
    ],
  },
  "ai-recruiting-agency": {
    path: "/ai-recruiting-agency",
    title: "AI Recruiting Agency: Software vs Done-for-You Recruiting | TaaSFlow",
    description: "What an AI recruiting agency should actually do, where human review belongs, and how TaaSFlow combines agents, scoring and senior recruiters.",
    eyebrow: "AI recruiting agency",
    h1: "AI can run volume. A recruiter should still own the shortlist.",
    directAnswer: "An AI recruiting agency uses automation to perform parts of sourcing, outreach, screening or ranking while still delivering recruiting work as a service. TaaSFlow uses agents for search and scoring, then has a senior recruiter review the shortlist before it reaches the client. Software does not make the final hiring decision.",
    sections: [
      { heading: "Where AI helps", paragraphs: ["Recruiting creates repetitive work: searching across channels, normalizing candidate information, comparing experience to a role rubric, and maintaining a consistent record of why a candidate scored the way they did. Those are areas where automation can increase coverage and consistency."] },
      { heading: "Where human review belongs", paragraphs: ["A ranking is not a hiring decision. TaaSFlow uses human recruiter review as a gate before a shortlist is delivered. The client then decides who to interview and who to hire.", "The public promise should be clear about that boundary: agents can support sourcing and scoring, but protected characteristics should not be used as scoring criteria and software should not silently make the final employment decision."] },
      { heading: "What buyers should ask an AI recruiting provider", paragraphs: ["Ask which candidate data is used, what evidence supports a score, where human review happens, how candidates can question an assessment, how long records are retained, and which model providers process candidate data. Those questions matter more than the word 'AI' in the product name."] },
      { heading: "How the TaaSFlow pilot works", paragraphs: ["For $699, once per company, TaaSFlow runs one role and guarantees a ranked top 10. The first top 10 is targeted within five business days, with the full scored market view developed through day 15."] },
    ],
    faqs: [
      { q: "Does AI decide who gets hired?", a: "No. TaaSFlow assists sourcing and scoring; a senior recruiter reviews the shortlist and the client makes the hiring decision." },
      { q: "Can a candidate ask for human review?", a: "TaaSFlow's published privacy process provides a human-review path for automated assessments." },
      { q: "What does the pilot cost?", a: "$699 for one role, one time per company." },
      { q: "What happens if the scores are weak?", a: "If none of the delivered top 10 scores above 90 against the approved role criteria, TaaSFlow reruns the search at no cost." },
    ],
  },
  "recruiter-fees": {
    path: "/recruiter-fees",
    title: "Recruiter Fees Explained: Agency, RPO and Flat-Fee Models",
    description: "Understand the main recruiter fee models and how to compare percentage-of-salary, retained, subscription, RPO and flat-fee recruiting costs.",
    eyebrow: "Recruiter fees",
    h1: "Recruiter fees make more sense when you separate price from the work included.",
    directAnswer: "Recruiter fees can be charged as a percentage of salary, a retained search fee, an hourly or embedded-recruiter cost, a recurring service fee, or a flat amount for defined recruiting work. To compare them fairly, calculate both the cash fee and the recruiting work your internal team still has to perform.",
    sections: [
      { heading: "Percentage-of-salary fees", paragraphs: ["Contingency and retained search agreements often express fees as a percentage of first-year compensation. The exact percentage varies by provider, role and agreement, so the signed terms are the authority. The important effect is that the fee rises with salary."] },
      { heading: "Flat recruiting fees", paragraphs: ["A flat fee disconnects the recruiting price from candidate salary. That can make budgeting easier, but only if the scope is explicit. Check how many roles are covered, whether sourcing is included, what counts as delivery, and whether there is a placement fee later."] },
      { heading: "Software fees are not recruiting fees", paragraphs: ["A sourcing database or ATS can be inexpensive relative to a search firm, but the comparison is incomplete if an internal employee must still run every search, message candidates, screen replies and build the shortlist. Include that operating effort in the decision."] },
      { heading: "TaaSFlow's public starting point", paragraphs: ["The first-role pilot is $699, paid once, available once per company, and covers one role. It guarantees a top 10 candidates and does not add a placement fee. Larger package prices are published on the pricing page."] },
    ],
    faqs: [
      { q: "What is the cheapest recruiting model?", a: "There is no universal answer because the work included differs. A job board or software license can have a lower invoice while requiring much more internal recruiting time." },
      { q: "Does a higher salary make TaaSFlow's pilot more expensive?", a: "No. The $699 pilot price is tied to the one-role pilot, not a percentage of salary." },
      { q: "Are larger TaaSFlow prices public?", a: "Yes. The pricing page publishes package totals for up to 10, 20, 30, 40 and 100 positions." },
      { q: "Is the $699 pilot recurring?", a: "No. It is a one-time first-role pilot and is available once per company." },
    ],
  },
} satisfies Record<string, MoneyPageData>;
