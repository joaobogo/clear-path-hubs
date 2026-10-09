import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Wallet,
  Calendar,
  UserCheck,
  Database,
  Bot,
} from "lucide-react";
import { PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import {
  ATS_NOTE,
  FIRST_SHORTLIST_TIMING,
  HUMAN_OVERSIGHT_NOTE,
  PILOT_IS_PAID_NOTE,
  RECORDS_NOTE,
  RESPONSE_TIME_SENTENCE,
  TIMING_FINE_PRINT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";

/**
 * Straight-answers band. Every answer is built from `offer-facts.ts` and
 * `pricing-core.ts`, so it cannot disagree with the rest of the site. Not
 * rendered on the home page (which has one FAQ); kept for pages that want it.
 */

export const ITEMS: {
  icon: React.ComponentType<{ className?: string }>;
  question: string;
  answer: string;
  detail: string;
}[] = [
  {
    icon: Wallet,
    question: "What does it cost?",
    answer: `The pilot is $${PRICE_PILOT_USD} for one role, one time per company.`,
    detail: `${PILOT_IS_PAID_NOTE} There is no placement fee. Packages for more roles are on the pricing page.`,
  },
  {
    icon: ShieldCheck,
    question: "Can I compare the cost with an agency?",
    answer: "Yes. The cost comparison on the pricing page uses assumptions you can change.",
    detail:
      "Adjust the salary, the agency fee and your internal recruiter cost, and the comparison recalculates.",
  },
  {
    icon: Calendar,
    question: "How fast do we get candidates?",
    answer: FIRST_SHORTLIST_TIMING,
    detail: TIMING_FINE_PRINT,
  },
  {
    icon: UserCheck,
    question: "Who owns the candidates?",
    answer: "You do. Every candidate delivered is yours to hire, keep or archive.",
    detail: `${RECORDS_NOTE} ${ATS_NOTE}`,
  },
  {
    icon: Database,
    question: "What happens after I submit a role?",
    answer: "A recruiter reviews the brief and confirms the criteria with you.",
    detail:
      `${RESPONSE_TIME_SENTENCE} You see the confirmed brief and the sourcing plan before any candidate is contacted.`,
  },
  {
    icon: Bot,
    question: "Who does the work?",
    answer: WHO_RUNS_THE_SEARCH,
    detail: HUMAN_OVERSIGHT_NOTE,
  },
];

export function StraightAnswers() {
  return (
    <PublicSection
      aria-labelledby="straight-answers-heading"
      className="border-y border-[color:var(--brand-navy)]/8 bg-white"
    >
      <PublicPage>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean-text)]">
            Straight answers
          </p>
          <h2
            id="straight-answers-heading"
            className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl"
          >
            Six questions buyers ask first.
          </h2>
          <p className="mt-3 text-[color:var(--brand-navy)]/80">
            Answered here so you can decide before you get in touch.
          </p>
        </div>

        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((it) => (
            <li
              key={it.question}
              className="flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-5"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean-text)]">
                  <it.icon className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="text-sm font-semibold text-[color:var(--brand-navy)]">
                  {it.question}
                </h3>
              </div>
              <p className="mt-3 text-[15px] font-semibold text-[color:var(--brand-navy)]">
                {it.answer}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                {it.detail}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-[color:var(--brand-navy)]/80">
          Still want to talk it through?{" "}
          <Link
            to="/contact"
            className="font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)] py-1"
          >
            Send us a message
          </Link>
        </p>
      </PublicPage>
    </PublicSection>
  );
}

/**
 * The same six Q&As this section renders, shaped for FAQPage JSON-LD. Built
 * from ITEMS so the structured data can never drift from the visible text.
 */
export const STRAIGHT_ANSWERS_FAQ = ITEMS.map((it) => ({
  q: it.question,
  a: `${it.answer} ${it.detail}`,
}));
