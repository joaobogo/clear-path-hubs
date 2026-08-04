import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { marketingHead } from "@/lib/marketing/head";
import { PublicPage, PublicSection, SiteShell } from "@/components/marketing/site-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight, Link as LinkIcon, Search } from "lucide-react";

type QA = { q: string; a: string; more?: string; id: string };
type Group = { id: string; title: string; blurb: string; items: QA[] };

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);

const RAW_GROUPS: Array<{
  id: string;
  title: string;
  blurb: string;
  items: Array<Omit<QA, "id">>;
}> = [
  {
    id: "model",
    title: "Model",
    blurb: "What TaaSFlow is, how the system runs a search, and where expert oversight sits.",
    items: [
      {
        q: "What is TaaSFlow?",
        a: "A hiring operating system. You submit roles through a structured intake, our delivery team runs sourcing and screening, and candidates are delivered inside a shared workspace with evidence against every requirement.",
        more: "Think of it as hiring infrastructure you subscribe to: agents run the search, evidence backs every score, and expert oversight approves what reaches you — the same workspace and the same context across every role you run.",
      },
      {
        q: "How is TaaSFlow different from an agency?",
        a: "You get a workspace instead of a PDF, a flat subscription instead of placement fees, and evidence instead of a verdict. Delivery is not contingent on placement.",
      },
      {
        q: "Who operates the delivery?",
        a: "A dedicated TaaSFlow team handles intake, sourcing, screening, and evidence capture. Your hiring managers keep decision rights end-to-end.",
      },
      {
        q: "Do we need to change our ATS?",
        a: "No. TaaSFlow runs the pre-hire workflow inside its own workspace and hands over into your ATS at the point you decide.",
      },
      {
        q: "Can we start with a single role?",
        a: "Yes. Most clients start with one or two roles to see how delivery works before scaling. Pilot scope and cadence are agreed together.",
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing",
    blurb: "Flat subscription, no placement fees, and how the commercial model actually behaves.",
    items: [
      {
        q: "How does TaaSFlow charge?",
        a: "A flat monthly subscription. No placement fees, no per-hire commissions. The subscription covers sourcing, screening, evidence, and workspace delivery for the roles in scope.",
        more: "Tiers scale by concurrent role volume. You can pause, resize, or add roles between billing cycles — the workspace and history stay intact.",
      },
      {
        q: "Are there placement fees?",
        a: "No. Delivery is not contingent on placement, so there is no incentive to push weak candidates.",
      },
      {
        q: "How is billing handled?",
        a: "Monthly, on the terms agreed with your account team and documented in your contract.",
      },
      {
        q: "Where can I see pricing?",
        a: "The Pricing page shows tiers and typical monthly ranges. Exact scope is confirmed in the commercial conversation.",
      },
    ],
  },
  {
    id: "candidate-delivery",
    title: "Candidate delivery",
    blurb: "How candidates surface, what evidence you receive, and how volume is calibrated.",
    items: [
      {
        q: "How are candidates delivered?",
        a: "They surface in your workspace as a ranked shortlist, each with evidence mapped against the requirements defined in the brief.",
      },
      {
        q: "How many candidates should we expect?",
        a: "Shortlists are sized to the role and the market. We favour signal over volume — usually a small, hand-reviewed shortlist per cadence rather than a firehose.",
      },
      {
        q: "How fast do candidates start arriving?",
        a: "The first ranked candidates typically arrive within days of the intake being finalised, with regular batches after that.",
      },
      {
        q: "Can we request more candidates?",
        a: "Yes. Feedback in the workspace shapes the next batch. You can also open new requirement variants without restarting the intake.",
      },
    ],
  },
  {
    id: "scoring",
    title: "Scoring",
    blurb: "Evidence-first evaluation and how disagreements are resolved.",
    items: [
      {
        q: "How does TaaSFlow evaluate candidates?",
        a: "Each requirement in the brief is scored against concrete evidence — experience, projects, credentials, or answers to screening questions. Reviewers always see the evidence, not just a verdict.",
        more: "Structured tooling supports the delivery team, but a human reviews evidence before a candidate ever surfaces to a client.",
      },
      {
        q: "Is the evaluation automated?",
        a: "Assisted, not automated. AI supports evidence extraction and ranking, but a human recruiter signs off before delivery.",
      },
      {
        q: "What if we disagree with an assessment?",
        a: "Feedback inside the workspace goes straight to the delivery team and recalibrates the next batch.",
      },
      {
        q: "Can we see the reasoning behind a score?",
        a: "Yes — every candidate carries per-requirement evidence and a rationale. Nothing is a black box.",
      },
    ],
  },
  {
    id: "client-workspace",
    title: "Client workspace",
    blurb: "Access, visibility, collaboration, and what the workspace does day-to-day.",
    items: [
      {
        q: "Who has access to our workspace?",
        a: "Your client account, invited teammates, and the TaaSFlow delivery team assigned to your roles. No wider distribution.",
      },
      {
        q: "Can multiple teammates review candidates?",
        a: "Yes. Invite as many teammates as needed with role-appropriate access — reviewers, editors, hiring managers, admins.",
      },
      {
        q: "What can we see about progress?",
        a: "Open roles, current stage per candidate, feedback exchanged, and messages — in one live view. No status meetings required.",
      },
      {
        q: "Can we message the delivery team?",
        a: "Yes. Messaging is inside the workspace so it stays attached to the role, not lost in email threads.",
      },
    ],
  },
  {
    id: "enterprise",
    title: "Enterprise",
    blurb: "Multi-team scale, governance, reporting, and enterprise access controls.",
    items: [
      {
        q: "Does TaaSFlow support multiple teams or business units?",
        a: "Yes. Enterprise accounts run parallel searches across teams and business units on a shared workspace with account-level reporting.",
      },
      {
        q: "Do you support SSO and enterprise access controls?",
        a: "Enterprise access, provisioning, audit logs, and security details are agreed as part of the enterprise consultation.",
      },
      {
        q: "How is reporting handled at scale?",
        a: "Account-level reporting rolls up roles across teams, with role-level detail available in each requisition. TA, Finance, and Procurement each get views tailored to their questions.",
      },
      {
        q: "How do we start an enterprise engagement?",
        a: "Book an enterprise consultation from the Enterprise page and we'll scope it with your TA and Procurement leads.",
      },
    ],
  },
  {
    id: "partnerships",
    title: "Partnerships",
    blurb: "Staffing and recruiting agencies using TaaSFlow to scale delivery.",
    items: [
      {
        q: "Do you work with staffing agencies?",
        a: "Yes. TaaSFlow partners with staffing and recruiting agencies who want more delivery capacity while keeping the client relationship.",
      },
      {
        q: "Can delivery be white-labelled?",
        a: "White-label or co-branded delivery is available where approved. The exact model is agreed per account.",
      },
      {
        q: "Who owns the client relationship?",
        a: "The agency does. TaaSFlow operates the delivery layer; the agency owns communication, presentation, and commercial decisions with the end client.",
      },
      {
        q: "How does a partnership start?",
        a: "Reach out through the Staffing Partnerships page to walk through scope and how your clients would experience the workspace.",
      },
    ],
  },
  {
    id: "candidate-questions",
    title: "Candidate questions",
    blurb: "For candidates applying, joining the network, or tracking an application.",
    items: [
      {
        q: "How do I apply for a role?",
        a: "Browse open roles on the Jobs page and apply directly. You'll receive a reference ID to track the application.",
      },
      {
        q: "What is the Talent Network?",
        a: "A private pool that lets us match you to future briefs. Your profile stays private until you agree to be considered for a specific role.",
      },
      {
        q: "How do I sign in?",
        a: "Use Candidate Sign In to access your workspace, update your profile, and track applications.",
      },
      {
        q: "What happens after I apply?",
        a: "You get a confirmation and can follow status inside your candidate workspace. If there's a fit, the delivery team follows up with next steps.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    blurb: "Data ownership, candidate visibility, and how to update or remove information.",
    items: [
      {
        q: "Who can see my candidate profile?",
        a: "Your profile is not browsed by employers. It surfaces to a specific client only when you agree to be considered for a specific role.",
      },
      {
        q: "Can I update or delete my data?",
        a: "Yes. You can update, pause, or remove your profile from your candidate workspace at any time.",
      },
      {
        q: "Who has access to client hiring data?",
        a: "The client account, invited teammates, and the TaaSFlow delivery team assigned to that account. No third-party resale.",
      },
      {
        q: "How can I request more information about privacy?",
        a: "Send a note via the Contact page and select Support or General inquiry.",
      },
    ],
  },
];

const GROUPS: Group[] = RAW_GROUPS.map((g) => ({
  ...g,
  items: g.items.map((it) => ({ ...it, id: `${g.id}--${slug(it.q)}` })),
}));

export const Route = createFileRoute("/faq")({
  head: () => {
    const base = marketingHead(undefined, "/faq", {
      title: "FAQ — TaaSFlow",
      description:
        "Clear answers on the TaaSFlow model, pricing, candidate delivery, evidence-based scoring, client workspace, enterprise, partnerships, and privacy.",
    });
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: GROUPS.flatMap((g) =>
        g.items.map((it) => ({
          "@type": "Question",
          name: it.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: it.more ? `${it.a} ${it.more}` : it.a,
          },
        })),
      ),
    };
    return {
      ...base,
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(faqJsonLd) },
      ],
    };
  },
  component: FaqPage,
});

function FaqPage() {
  const initial = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return undefined;
    const match = GROUPS.flatMap((g) => g.items).find((it) => it.id === hash);
    return match?.id;
  }, []);
  const [openItem, setOpenItem] = useState<string | undefined>(initial);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!initial) return;
    const el = document.getElementById(initial);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initial]);

  const q = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.q.toLowerCase().includes(q) ||
          it.a.toLowerCase().includes(q) ||
          (it.more?.toLowerCase().includes(q) ?? false),
      ),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  const totalMatches = filteredGroups.reduce((n, g) => n + g.items.length, 0);

  return (
    <SiteShell>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <PublicSection className="pb-6 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            FAQ
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Straight answers, before you ask.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            The nine things buyers and candidates ask most, answered without hedging. If you need
            depth, expand the deeper explanation on any answer.
          </p>

          {/* Search */}
          <div className="mt-8 max-w-xl">
            <label htmlFor="faq-search" className="sr-only">
              Search FAQ
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--brand-navy)]/80" />
              <input
                id="faq-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search: pricing, scoring, SSO, referrals…"
                className="w-full rounded-md border border-[color:var(--brand-navy)]/15 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--brand-navy)]/40 focus:ring-2 focus:ring-[color:var(--brand-navy)]/10"
              />
            </div>
            {q && (
              <p className="mt-2 text-xs text-[color:var(--brand-navy)]/80">
                {totalMatches} answer{totalMatches === 1 ? "" : "s"} match &ldquo;{query}&rdquo;
              </p>
            )}
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Category nav ────────────────────────────────────────── */}
      <PublicSection className="pb-4">
        <PublicPage>
          <nav aria-label="FAQ categories" className="flex flex-wrap gap-2">
            {GROUPS.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                className="rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-navy)]/40 hover:text-[color:var(--brand-navy)]"
              >
                {g.title}
              </a>
            ))}
          </nav>
        </PublicPage>
      </PublicSection>

      {/* ── Groups ──────────────────────────────────────────────── */}
      <PublicSection className="py-8">
        <PublicPage>
          {filteredGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--brand-navy)]/20 bg-white p-10 text-center">
              <p className="text-base font-semibold">No answers match that search.</p>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
                Try a broader term, or send us the question directly.
              </p>
              <button
                onClick={() => setQuery("")}
                className="mt-4 rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-4 py-2 text-sm font-medium hover:bg-[color:var(--brand-navy)]/5"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-12">
              {filteredGroups.map((group) => (
                <section key={group.id} id={group.id} aria-labelledby={`${group.id}-h`}>
                  <div className="mb-4 max-w-3xl">
                    <h2
                      id={`${group.id}-h`}
                      className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight"
                    >
                      {group.title}
                    </h2>
                    <p className="mt-1 text-sm text-[color:var(--brand-navy)]/80">
                      {group.blurb}
                    </p>
                  </div>
                  <Accordion
                    type="single"
                    collapsible
                    className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white px-6"
                    value={openItem}
                    onValueChange={(v) => setOpenItem(v || undefined)}
                  >
                    {group.items.map((it) => (
                      <AccordionItem key={it.id} value={it.id} id={it.id}>
                        <AccordionTrigger className="text-left text-base font-semibold">
                          <span>{it.q}</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-[color:var(--brand-navy)]/80">{it.a}</p>
                          {it.more && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-medium text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]">
                                Read the deeper explanation
                              </summary>
                              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
                                {it.more}
                              </p>
                            </details>
                          )}
                          <a
                            href={`#${it.id}`}
                            className="mt-3 inline-flex items-center gap-1 text-xs text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]"
                            aria-label={`Link to question: ${it.q}`}
                          >
                            <LinkIcon className="h-3 w-3" />
                            Direct link
                          </a>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))}
            </div>
          )}
        </PublicPage>
      </PublicSection>

      {/* ── Still stuck CTA ─────────────────────────────────────── */}
      <PublicSection className="py-16">
        <PublicPage>
          <div className="rounded-2xl bg-[color:var(--brand-navy)] px-6 py-12 text-white sm:px-12">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-white">
                  Didn&rsquo;t find your answer?
                </h2>
                <p className="mt-2 max-w-2xl text-white/70">
                  Send a note through Contact and we&rsquo;ll route it to the right team.
                </p>
              </div>
              <Link
                to="/contact"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:opacity-90"
              >
                Contact us
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
