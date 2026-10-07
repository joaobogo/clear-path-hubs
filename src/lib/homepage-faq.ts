/**
 * Homepage FAQ copy.
 *
 * Kept out of `src/routes/index.tsx` on purpose: the route file is split into a
 * shared chunk for `head()`, and module-scope constants declared in the route
 * are not re-exported into that chunk, which breaks hydration.
 *
 * Every answer is built from `offer-facts.ts` and `pricing-core.ts`, so the
 * visible text and the FAQPage JSON-LD (both read from this list) cannot drift
 * from the rest of the site.
 */
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import {
  ATS_NOTE,
  FIRST_SHORTLIST_TIMING,
  PILOT_IS_PAID_NOTE,
  RECORDS_NOTE,
  SHORTLIST_LABEL,
  TIMING_FINE_PRINT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";

export const HOMEPAGE_FAQ = [
  {
    q: "What does it cost?",
    a: `The pilot is $${PRICE_PILOT_USD} for one role, one time per company. ${PILOT_IS_PAID_NOTE} Packages for more roles are on the pricing page. There is no placement fee.`,
  },
  {
    q: "How fast do we get candidates?",
    a: `${FIRST_SHORTLIST_TIMING} ${TIMING_FINE_PRINT}`,
  },
  {
    q: "Who does the work?",
    a: WHO_RUNS_THE_SEARCH,
  },
  {
    q: "What does the pilot cover?",
    a: `One role from brief to shortlist. You receive ${SHORTLIST_LABEL.charAt(0).toLowerCase()}${SHORTLIST_LABEL.slice(1)}, the evidence behind each score, and access to the shared workspace where your team reviews them.`,
  },
  {
    q: "Who owns the candidate records?",
    a: RECORDS_NOTE,
  },
  {
    q: "Does it connect to our ATS?",
    a: ATS_NOTE,
  },
] as const;
