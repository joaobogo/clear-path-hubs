import { createFileRoute } from "@tanstack/react-router";

import { AudiencePage } from "@/components/marketing/audience-page";
import { faqScript, marketingHead } from "@/lib/marketing/head";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import {
  ATS_NOTE,
  FIRST_SHORTLIST_TIMING,
  HUMAN_OVERSIGHT_NOTE,
  OFFER_CATEGORY,
  PILOT_IS_PAID_NOTE,
  RECORDS_NOTE,
  SEATS_NOTE,
  SHORTLIST_LABEL,
  TIMING_FINE_PRINT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";

const FAQ = [
  {
    q: "Are you a recruiting agency?",
    a: `No. TaaSFlow is a ${OFFER_CATEGORY.toLowerCase()}. You pay a flat package fee, not a percentage of a salary, and we do not place or employ anyone. ${WHO_RUNS_THE_SEARCH}`,
  },
  {
    q: "Does this replace the recruiters on my team?",
    a: "No. It adds sourcing and screening capacity for roles your team does not have time to work. Your recruiters and hiring managers keep the interviews, the offers and every hiring decision.",
  },
  {
    q: "We already use an applicant tracking system. Can we still use TaaSFlow?",
    a: `Yes, as a separate workspace for the roles you hand us. ${ATS_NOTE} You can export candidate records and move the people you choose into your own system.`,
  },
  {
    q: "How do we judge whether it works before committing?",
    a: `Start with the pilot: one role, $${PRICE_PILOT_USD}, one time per company. ${PILOT_IS_PAID_NOTE} ${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
  },
  {
    q: "Who is accountable for fairness in the screening?",
    a: `${HUMAN_OVERSIGHT_NOTE} Read how AI is used in hiring for what the software does and what a person decides.`,
  },
  {
    q: "What happens to the candidate records afterwards?",
    a: RECORDS_NOTE,
  },
];

const TITLE = "TaaSFlow for HR and Talent Teams | Sourcing Capacity";
const DESCRIPTION =
  "Not an agency. Sourcing capacity for your HR or talent team at a flat fee: ranked shortlists with the evidence behind each score, and you make every hiring decision.";

export const Route = createFileRoute("/for-hr-teams")({
  head: () =>
    marketingHead(
      undefined,
      "/for-hr-teams",
      { title: TITLE, description: DESCRIPTION },
      {
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: "Who TaaSFlow is for", path: "/solutions" },
          { name: "HR and talent teams", path: "/for-hr-teams" },
        ],
        scripts: [faqScript(FAQ)],
      },
    ),
  component: ForHrTeamsPage,
});

function ForHrTeamsPage() {
  return (
    <AudiencePage
      eyebrow="For HR and talent teams"
      title="Not an agency. Sourcing capacity for your team at a flat fee."
      lead={`Your team owns the hiring process. TaaSFlow takes on the first, slowest part of it: finding candidates and scoring them against criteria you approve. You get ${SHORTLIST_LABEL.toLowerCase()}, and every score comes with its evidence.`}
      sections={[
        {
          id: "problem",
          title: "Where HR and talent teams lose time",
          paragraphs: [
            "Most of a recruiter's week on an open role goes to the top of the funnel: posting, searching, reading applications and chasing replies. That work has to happen before a hiring manager sees anyone worth interviewing, and it competes with everything else on your plate.",
            "The usual ways to get more capacity each have a catch. A contingent agency charges when a hire is made and rarely shows how it got there. An extra recruiter on the payroll is a long commitment for work that comes in waves. An applicant tracking system stores records but does not find or score anyone.",
          ],
        },
        {
          id: "what-you-get",
          title: "What your team gets",
          paragraphs: [
            `TaaSFlow runs the sourcing and screening for the roles you choose. ${WHO_RUNS_THE_SEARCH}`,
            "For each role you receive a shortlist in a shared workspace. Every candidate is ranked against a rubric you approved before sourcing started, and every score links to the CV line or application answer behind it. A requirement we cannot evidence is flagged, not hidden.",
          ],
          bullets: [
            SHORTLIST_LABEL,
            "A rubric of must-haves, nice-to-haves and deal-breakers that you confirm first",
            "The evidence behind each score, visible to your hiring managers too",
            "One workspace per role, with stage moves and decisions recorded next to the candidate",
          ],
        },
        {
          id: "working-with-your-team",
          title: "How it fits alongside your recruiters",
          paragraphs: [
            "You decide which roles to hand over. Hard-to-fill roles, roles that keep slipping, and roles in a market your team does not know well are common choices. Everything else can stay in your own process.",
            `Hiring managers can be invited into the workspace to read the shortlist and the evidence. ${SEATS_NOTE} Your people run the interview loop, give feedback on each shortlist and make the final decision.`,
          ],
          bullets: [
            "You confirm the rubric before scoring starts",
            "You advance, hold or pass on each candidate, with a reason",
            "You run interviews, references and offers",
            "Nothing is sent to candidates until a person has approved it",
          ],
        },
        {
          id: "governance",
          title: "Governance your team can explain",
          paragraphs: [
            `${HUMAN_OVERSIGHT_NOTE} A recruiter reviews every shortlist before it reaches you, and the workspace keeps an append-only audit history of releases, overrides and access.`,
            "If a colleague, a candidate or a regulator asks why someone was ranked where they were, you can open the record and show the evidence. The security page lists what we hold and what we do not.",
          ],
        },
        {
          id: "cost",
          title: "What it costs, and how to start",
          paragraphs: [
            `The pilot is one role for $${PRICE_PILOT_USD}, one time per company. ${PILOT_IS_PAID_NOTE} ${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
            "If the pilot works, packages for more roles are priced as flat totals on the pricing page. There are no placement fees and no percentage of salary.",
          ],
        },
      ]}
      faq={FAQ}
      links={[
        { to: "/how-it-works", label: "How it works", desc: "The four steps and who owns each one." },
        { to: "/pricing", label: "Pricing", desc: "The pilot and the flat package totals." },
        { to: "/security", label: "Security and trust", desc: "What we hold, what we do not, and how records are handled." },
        { to: "/ai-in-hiring", label: "How AI is used in hiring", desc: "What the software does and what a person decides." },
        { to: "/compare", label: "Compare your options", desc: "Agencies, in-house recruiters and other approaches side by side." },
        { to: "/solutions", label: "Who TaaSFlow is for", desc: "The other audiences we work with." },
      ]}
      ctaTitle="Hand over one role and see the shortlist."
      ctaDescription={`Request the pilot for one role, or send us a message to talk it through first.`}
    />
  );
}
