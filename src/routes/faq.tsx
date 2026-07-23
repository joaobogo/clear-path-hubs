import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { marketingHead } from "@/lib/marketing/head";
import { PublicPage, PublicSection } from "@/components/marketing/site-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight, Link as LinkIcon } from "lucide-react";

type QA = { q: string; a: string; id: string };
type Group = { id: string; title: string; items: QA[] };

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);

const RAW_GROUPS: Array<{ id: string; title: string; items: Array<Omit<QA, "id">> }> = [
  {
    id: "how-taasflow-works",
    title: "How TaaSFlow Works",
    items: [
      { q: "What is TaaSFlow?", a: "TaaSFlow is a hiring operating system. Clients submit roles through a structured intake, we run sourcing and screening, and candidates are delivered inside a shared workspace with evidence against each requirement." },
      { q: "How is TaaSFlow different from a traditional agency?", a: "You get a workspace instead of a PDF. Every role, candidate, and note lives in the same account, and delivery is structured around the brief rather than contingent on placements." },
      { q: "Who operates the delivery?", a: "A dedicated TaaSFlow team handles intake, sourcing, screening, and evidence capture. Your hiring managers keep decision rights." },
      { q: "Do we need to change our ATS?", a: "No. TaaSFlow runs the pre-hire workflow inside its own workspace. Handover into your ATS happens at the point you decide." },
    ],
  },
  {
    id: "candidate-delivery",
    title: "Candidate Delivery",
    items: [
      { q: "How are candidates delivered?", a: "Candidates surface in your workspace as a ranked shortlist, each with evidence against the requirements defined in the brief." },
      { q: "What does evidence mean?", a: "For each candidate, we capture concrete signals mapped to your requirements — experience, projects, credentials, or answers to screening questions — so review isn't guesswork." },
      { q: "How many candidates should we expect?", a: "A shortlist is sized to the role and the market. We favour signal over volume." },
      { q: "Can we request more candidates?", a: "Yes. Feedback in the workspace shapes the next batch." },
    ],
  },
  {
    id: "workspace-and-visibility",
    title: "Workspace and Visibility",
    items: [
      { q: "Who has access to our workspace?", a: "The client account, invited teammates, and the TaaSFlow delivery team assigned to your roles." },
      { q: "Can multiple teammates review candidates?", a: "Yes. Invite as many teammates as needed with role-appropriate access." },
      { q: "What can we see about progress?", a: "Open roles, current stage per candidate, feedback exchanged, and messages — in one view." },
      { q: "Can we message the delivery team?", a: "Yes. Messaging is inside the workspace so it stays attached to the role." },
    ],
  },
  {
    id: "pricing-and-billing",
    title: "Pricing and Billing",
    items: [
      { q: "How does TaaSFlow charge?", a: "TaaSFlow uses a service model rather than placement fees. Specific pricing depends on scope and is confirmed in the commercial agreement." },
      { q: "Are there placement fees?", a: "No. Delivery is not contingent on placement." },
      { q: "How is billing handled?", a: "Billing is agreed with your account team and documented in your contract." },
      { q: "Where can I see current pricing?", a: "See the Pricing page for how the model works. Exact numbers are shared during the commercial conversation." },
    ],
  },
  {
    id: "pilots-and-starting",
    title: "Pilots and Starting",
    items: [
      { q: "Can we start with a single role?", a: "Yes. Most clients start with one or two roles to see how delivery works before scaling." },
      { q: "What do we need to start?", a: "A role to fill and someone to run the intake with us. We handle the structure from there." },
      { q: "How do pilots work?", a: "Pilot scope, cadence, and success criteria are agreed together. Details are confirmed in the commercial conversation." },
      { q: "How do I kick off?", a: "Submit the role through Start Hiring, or contact sales to talk through scope first." },
    ],
  },
  {
    id: "candidate-scoring-and-evaluation",
    title: "Candidate Scoring and Evaluation",
    items: [
      { q: "How does TaaSFlow evaluate candidates?", a: "Each requirement in the brief is assessed against evidence captured during sourcing and screening. Reviewers see the evidence, not just a verdict." },
      { q: "Is the evaluation automated?", a: "Structured tooling supports the delivery team, but a human reviews evidence before candidates surface to clients." },
      { q: "What if we disagree with an assessment?", a: "Feedback in the workspace goes straight to the delivery team and shapes what comes next." },
    ],
  },
  {
    id: "enterprise",
    title: "Enterprise",
    items: [
      { q: "Does TaaSFlow support multiple teams or business units?", a: "Yes. Enterprise accounts run parallel searches across teams and business units on a shared workspace with account-level reporting." },
      { q: "Do you support SSO and enterprise access controls?", a: "Enterprise access, provisioning, and security details are discussed as part of the enterprise consultation." },
      { q: "How is reporting handled at scale?", a: "Account-level reporting rolls up roles across teams, with role-level detail available in each requisition." },
      { q: "How do we start an enterprise engagement?", a: "Book an enterprise consultation from the Enterprise page." },
    ],
  },
  {
    id: "staffing-partnerships",
    title: "Staffing Partnerships",
    items: [
      { q: "Do you work with staffing agencies?", a: "Yes. TaaSFlow partners with staffing and recruiting agencies who want more delivery capacity while keeping the client relationship." },
      { q: "Can delivery be white-labelled?", a: "White-label or co-branded delivery is available where approved. The exact model is agreed per account." },
      { q: "How does a partnership start?", a: "Reach out through the Staffing Partnerships page to discuss scope and how your clients would experience the workspace." },
    ],
  },
  {
    id: "candidate-questions",
    title: "Candidate Questions",
    items: [
      { q: "How do I apply for a role?", a: "Browse open roles on the Jobs page and apply directly to the ones that fit." },
      { q: "What is the Talent Network?", a: "A private pool that lets us match you to future briefs. Your profile stays private until you choose to be considered for a specific role." },
      { q: "How do I sign in?", a: "Use Candidate Sign In to access your workspace, update your profile, and track applications." },
      { q: "What happens after I apply?", a: "You'll get a confirmation and can follow status inside your candidate workspace. If there's a fit, the delivery team follows up with next steps." },
    ],
  },
  {
    id: "privacy-and-data",
    title: "Privacy and Data",
    items: [
      { q: "Who can see my candidate profile?", a: "Your profile is not browsed by employers. It surfaces to a specific client only when you agree to be considered for a specific role." },
      { q: "Can I update or delete my data?", a: "Yes. You can update, pause, or remove your profile from your candidate workspace." },
      { q: "Who has access to client hiring data?", a: "The client account, invited teammates, and the TaaSFlow delivery team assigned to that account." },
      { q: "How can I request more information about privacy?", a: "Send a note via the Contact page and select Support or General inquiry." },
    ],
  },
];

const GROUPS: Group[] = RAW_GROUPS.map((g) => ({
  ...g,
  items: g.items.map((it) => ({ ...it, id: `${g.id}--${slug(it.q)}` })),
}));

const CANONICAL = "https://clear-path-hubs.lovable.app/faq";

export const Route = createFileRoute("/faq")({
  head: () => {
    const base = marketingHead(undefined, "/faq", {
      title: "FAQ — TaaSFlow",
      description:
        "Answers to common questions about TaaSFlow: how hiring works, candidate delivery, workspace visibility, pricing model, pilots, enterprise, staffing partnerships, and privacy.",
    });
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: GROUPS.flatMap((g) =>
        g.items.map((it) => ({
          "@type": "Question",
          name: it.q,
          acceptedAnswer: { "@type": "Answer", text: it.a },
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

  // Scroll to and open the deep-linked question after mount.
  useEffect(() => {
    if (!initial) return;
    const el = document.getElementById(initial);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initial]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            FAQ
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            Straight answers about how TaaSFlow works, what to expect from delivery, and how
            candidates, clients, and partners fit together.
          </p>
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
          <div className="space-y-12">
            {GROUPS.map((group) => (
              <section key={group.id} id={group.id} aria-labelledby={`${group.id}-h`}>
                <h2
                  id={`${group.id}-h`}
                  className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight"
                >
                  {group.title}
                </h2>
                <Accordion
                  type="single"
                  collapsible
                  className="mt-4 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white px-6"
                  value={openItem}
                  onValueChange={(v) => setOpenItem(v || undefined)}
                >
                  {group.items.map((it) => (
                    <AccordionItem key={it.id} value={it.id} id={it.id}>
                      <AccordionTrigger className="text-left text-base font-semibold">
                        <span className="flex items-center gap-2">
                          <span>{it.q}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-[color:var(--brand-navy)]/75">{it.a}</p>
                        <a
                          href={`#${it.id}`}
                          className="mt-3 inline-flex items-center gap-1 text-xs text-[color:var(--brand-navy)]/60 hover:text-[color:var(--brand-navy)]"
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
    </>
  );
}
