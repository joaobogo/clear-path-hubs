import {
  PILOT_IS_PAID_NOTE,
  RECORDS_NOTE,
  SEATS_NOTE,
} from "@/config/offer-facts";

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "How does recruiting with TaaSFlow differ from an agency?",
    a: `An agency charges a percentage of first-year salary once a candidate is placed. TaaSFlow charges one exact total, set by how many positions you are hiring for, for the search itself: the sourcing, the evaluation and the workspace. ${RECORDS_NOTE}`,
  },
  {
    q: "Do prices go up if we hire multiple candidates?",
    a: "No. The package total covers the search capacity, not the outcome. For a one-off package that total is paid once. For a subscription it is charged each month. Either way, hire one, hire three or hire none and the total for your package stays the same.",
  },
  {
    q: "Can we pause a subscription between roles?",
    a: "Subscriptions can be paused with notice and resumed when your next roles are ready. Exact terms are on your quote or agreement.",
  },
  {
    q: "What if we add positions mid-engagement?",
    a: "Your total is recalculated from the new position count at the next billing cycle, and the total never falls as the count rises. The intake context and workspace carry over. Removing positions works the same way.",
  },
  {
    q: "Is there a contract minimum?",
    a: "Subscriptions run month-to-month and one-off packages have no minimum at all. There is no annual commitment. If you choose to pay twelve months up front you save 10% on the annual total; the monthly package price itself never changes. Exact terms are on your quote.",
  },
  {
    q: "How does the pilot work?",
    a: `${PILOT_IS_PAID_NOTE} Each company can run it once. You get the full workflow for one role: intake, sourcing, scoring and a ranked shortlist, for a fixed price. If it fits, you can move to a larger package. ${RECORDS_NOTE}`,
  },
  {
    q: "How many people can use the workspace?",
    a: `${SEATS_NOTE} The comparison table on this page lists seats for every package.`,
  },
];
