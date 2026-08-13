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

/**
 * Straight-answers band — resolves the six most common buyer anxieties
 * before a call is needed. No adjectives, no hidden logic.
 *
 * 1. Pricing        — flat monthly, no placement fee, cancel anytime.
 * 2. ROI            — assumptions are editable in the calculator, not baked in.
 * 3. Delivery       — first ranked shortlist in days of intake.
 * 4. Ownership      — you keep the candidates, the ATS, and the final call.
 * 5. Next step      — what happens in the 48h after you submit intake.
 * 6. Human vs AI    — humans decide, AI structures — the boundary is explicit.
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
    answer: "A flat monthly subscription. No percentage-of-salary placement fee.",
    detail:
      "Tiers are listed on the pricing page. Month-to-month, cancel anytime. No fee is triggered when a candidate we deliver is hired.",
  },
  {
    icon: ShieldCheck,
    question: "How honest is the ROI math?",
    answer: "The calculator ships with editable assumptions. Nothing is baked in.",
    detail:
      "Adjust hires per year, salary band, agency fee, and internal recruiter cost. The comparison recomputes live — you can screenshot it and share.",
  },
  {
    icon: Calendar,
    question: "What is the delivery promise?",
    answer:
      "A first ranked shortlist in days of intake sign-off. Weekly refresh after that.",
    detail:
      "If a role is unusually niche, we surface that in intake — not on delivery day. No vague 'we'll get back to you' timelines.",
  },
  {
    icon: UserCheck,
    question: "Who owns the candidates?",
    answer: "You do. Every candidate delivered is yours to hire, keep, or archive.",
    detail:
      "No placement fee is charged for hiring a candidate we delivered — this month, next month, or a year later. Your ATS stays the source of truth.",
  },
  {
    icon: Database,
    question: "What happens after I submit intake?",
    answer:
      "A recruiter reviews the brief within one business day and confirms the rubric with you.",
    detail:
      "You'll see the confirmed brief, the rubric, and the sourcing plan in the workspace before any candidate is contacted. No black-box handoff.",
  },
  {
    icon: Bot,
    question: "What do humans do vs the AI?",
    answer:
      "Humans decide. AI structures the evidence, drafts the rubric, and speeds up sourcing.",
    detail:
      "Every shortlist is reviewed by a named recruiter before it reaches you. AI never sends a candidate; it prepares the file the recruiter signs off on.",
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
            The six questions we get before every first call.
          </h2>
          <p className="mt-3 text-[color:var(--brand-navy)]/80">
            Answered here so you don't have to book a call to find out.
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
            className="font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)]"
          >
            Book a Call →
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
