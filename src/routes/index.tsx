import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { RunChapters } from "@/components/home/run-chapters";
import { RunHero } from "@/components/home/run-hero";
import { ClosingBand } from "@/components/layout/closing-band";
import { SiteShell } from "@/components/marketing/site-shell";
import { OFFER_LAST_UPDATED_LABEL } from "@/config/offer-facts";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import { marketingHead } from "@/lib/marketing/head";
import { roleFromSearch } from "@/lib/marketing/role-input";
import { SAMPLE_SHORTLIST_ROLE } from "@/lib/previews/representative-fixtures";

// Homepage metadata is authored inline. The content bundle is deliberately NOT
// imported here: importing it pulls every blog/industry markdown file into the
// homepage chunk (~890 KiB) and delays hydration.

const HOME_TITLE = "Recruiting Subscription & Candidate Sourcing | TaaSFlow";
const HOME_DESCRIPTION = `Everyone hears about your role. You meet ten. Agents open it on every channel the same day, a senior recruiter signs the shortlist. Start with one role for $${PRICE_PILOT_USD}.`;

export const Route = createFileRoute("/")({
  /** The role typed into the hero. Every chapter below speaks about it. */
  validateSearch: (search: Record<string, unknown>): { role?: string } => {
    const role = roleFromSearch(search["role"]);
    return role ? { role } : {};
  },
  head: () => marketingHead(undefined, "/", { title: HOME_TITLE, description: HOME_DESCRIPTION }),
  component: Home,
});

/* ------------------------------------------------------------------ page */

/**
 * The Run. One role on a five-day clock: the cold open, then seven chapters
 * (Brief, Broadcast, Score, Sign-off, Invoice, Proof, Start). The FAQ lives
 * on /faq; the three-way comparison on /pricing; industries on their hub.
 */
function Home() {
  const { role } = Route.useSearch();
  const navigate = useNavigate();
  // Running a role from the hero keeps the visitor here: the address gains
  // the role, the field redraws and every chapter speaks about it.
  const runRole = (next: string) =>
    void navigate({ to: "/", search: next ? { role: next } : {}, replace: true, resetScroll: false });
  const roleTitle = role || SAMPLE_SHORTLIST_ROLE;
  return (
    <SiteShell hideLinkHub hideClosingBand>
      <RunHero role={role} onRun={runRole} />
      <RunChapters role={roleTitle} lastUpdated={OFFER_LAST_UPDATED_LABEL} />
      <ClosingBand id="chapter-start" role={role} source="home_closing" />
    </SiteShell>
  );
}
