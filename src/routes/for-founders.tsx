import { createFileRoute } from "@tanstack/react-router";

import { AudiencePage } from "@/components/marketing/audience-page";
import { faqScript, marketingHead } from "@/lib/marketing/head";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import {
  CALL_NAME,
  FIRST_SHORTLIST_TIMING,
  HUMAN_OVERSIGHT_NOTE,
  PILOT_IS_PAID_NOTE,
  RECORDS_NOTE,
  SHORTLIST_LABEL,
  TIMING_FINE_PRINT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";

const FAQ = [
  {
    q: `Is the $${PRICE_PILOT_USD} pilot a free trial?`,
    a: `No. ${PILOT_IS_PAID_NOTE} It covers one role, once per company, so you can judge the shortlist on a real hire before deciding on anything larger.`,
  },
  {
    q: "Can I run a second role on the pilot price?",
    a: `No. The $${PRICE_PILOT_USD} pilot is one role, one time per company. If you want more roles, packages are flat totals on the pricing page.`,
  },
  {
    q: "Do I need a job description before I start?",
    a: "No. A short inquiry is enough to begin. If you have a job description, send it; if not, the intake and the plan step help you write down what you need. Nothing is sourced until you approve the scope.",
  },
  {
    q: "How much of my time does it take?",
    a: "Expect a short intake, a rubric to approve, and then time to read the shortlist and decide. The searching and first screening are done for you, and a recruiter reviews the results before you see them.",
  },
  {
    q: "Do you take a percentage of the hire's salary?",
    a: "No. There are no placement fees and no percentage of salary. The pilot and packages are flat fees.",
  },
  {
    q: "Who makes the hiring decision?",
    a: `You do. ${HUMAN_OVERSIGHT_NOTE}`,
  },
];

const TITLE = `Hiring Help for Founders | $${PRICE_PILOT_USD} Pilot | TaaSFlow`;
const DESCRIPTION = `Your first recruiter, for $${PRICE_PILOT_USD} a role. One pilot per company: a ranked shortlist with the evidence behind each score, and you make the hiring decision.`;

export const Route = createFileRoute("/for-founders")({
  head: () =>
    marketingHead(
      undefined,
      "/for-founders",
      { title: TITLE, description: DESCRIPTION },
      {
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: "Who TaaSFlow is for", path: "/solutions" },
          { name: "Founders", path: "/for-founders" },
        ],
        scripts: [faqScript(FAQ)],
      },
    ),
  component: ForFoundersPage,
});

function ForFoundersPage() {
  return (
    <AudiencePage
      eyebrow="For founders"
      title={`Your first recruiter, for $${PRICE_PILOT_USD} a role.`}
      lead={`You are hiring while also running the company. TaaSFlow does the searching and first screening for one role and hands you ${SHORTLIST_LABEL.toLowerCase()}, each with the evidence behind its score. The pilot is one role, once per company.`}
      sections={[
        {
          id: "why",
          title: "Why founder-led hiring stalls",
          paragraphs: [
            "Early hires matter more than almost anything else you decide, and they land on the person with the least spare time. Searching profiles at night, answering applicants and trying to compare people on different kinds of evidence is slow, and it is easy to stop when the week gets busy.",
            "You may not have a recruiter, or an applicant tracking system, or a way to tell whether a search is working. An agency fee on a first hire can feel like a lot to pay for a process you cannot see into.",
          ],
        },
        {
          id: "what-you-get",
          title: "What the pilot gives you",
          paragraphs: [
            `For $${PRICE_PILOT_USD} you get one role worked end to end. ${WHO_RUNS_THE_SEARCH}`,
            `${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
          ],
          bullets: [
            "One role, one time per company",
            "A rubric that turns your must-haves and deal-breakers into something every candidate is scored against",
            SHORTLIST_LABEL,
            "A workspace where you can see each score, its evidence and the candidate's record",
            "Your candidate records stay exportable",
          ],
        },
        {
          id: "your-part",
          title: "What you do and what you do not have to",
          paragraphs: [
            "You describe the role, confirm the criteria and make the decision. That is the part only you can do well. You do not have to write boolean searches, read every CV or manage a spreadsheet of replies.",
            "You also keep control of what happens next. You choose who to interview, you run the conversations and you extend the offer. We do not make hire or reject calls for you.",
          ],
        },
        {
          id: "honest-scope",
          title: "What this is not",
          paragraphs: [
            "It is not a free trial: the pilot is a paid evaluation of one role. It is not a guarantee of a hire or of a timeline, because the market and your brief both matter. It is not a replacement for talking to candidates yourself.",
            "It is a way to find out, on a real role and for a fixed price, whether a ranked and evidenced shortlist saves you time and improves who you meet.",
          ],
        },
        {
          id: "after",
          title: "If it works, what comes next",
          paragraphs: [
            `${RECORDS_NOTE}`,
            "If you have more roles to fill, packages are flat totals listed on the pricing page, with no placement fees and no percentage of salary. If the pilot is not for you, there is nothing to unwind.",
          ],
        },
      ]}
      faq={FAQ}
      links={[
        { to: "/pilot", label: "The pilot", desc: "What is in it and how to request it." },
        { to: "/how-it-works", label: "How it works", desc: "Four steps from your brief to a shortlist." },
        { to: "/pricing", label: "Pricing", desc: "The pilot price and flat package totals." },
        { to: "/compare", label: "Compare your options", desc: "Agencies, freelancers and in-house hires side by side." },
        { to: "/for-hr-teams", label: "For HR and talent teams", desc: "If you already have people running hiring." },
        { to: "/solutions", label: "Who TaaSFlow is for", desc: "The other audiences we work with." },
      ]}
      ctaTitle="Share your first role."
      ctaDescription={`Request the pilot for one role, or book a ${CALL_NAME} to talk it through first.`}
    />
  );
}
