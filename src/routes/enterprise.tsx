import { createFileRoute, Link } from "@tanstack/react-router";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";

const entry = getPage("enterprise");

export const Route = createFileRoute("/enterprise")({
  head: () =>
    marketingHead(entry, "/enterprise", {
      title: "Enterprise — TaaSFlow",
      description:
        "Volume hiring, global sourcing, workspace transparency, reporting, tailored billing, and enterprise-grade access controls — all on the same TaaSFlow operating system.",
    }),
  component: EnterprisePage,
});

const CAPABILITIES = [
  {
    title: "Volume hiring",
    body: "Run many searches in parallel with shared brief conventions, shared scoring standards, and one workspace per business unit.",
  },
  {
    title: "Global sourcing",
    body: "Source across geographies and time zones. Remote, on-site, and — where approved for the role — relocation-friendly candidates.",
  },
  {
    title: "Workspace transparency",
    body: "Everyone in the account sees the same pipeline, the same evidence, the same decisions. No hidden queues, no side channels.",
  },
  {
    title: "Reporting",
    body: "Roll-up views of pipeline health, stage velocity, source mix and decision outcomes across roles, teams and business units.",
  },
  {
    title: "Account structure",
    body: "Multiple positions, teams and hiring managers under one organisation. Fine-grained roles: admin, editor, viewer.",
  },
  {
    title: "Tailored billing",
    body: "Invoicing aligned to your finance process: purchase orders, consolidated billing, and multi-currency where supported.",
  },
  {
    title: "Security and access controls",
    body: "Row-level tenant isolation, per-role permissions, private CV storage with signed short-lived URLs, and a full audit trail.",
  },
  {
    title: "Support model",
    body: "A named account contact, direct messaging inside every workspace, and joint reviews on a cadence you set.",
  },
];

function EnterprisePage() {
  return (
    <>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Enterprise
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Hire at scale on one transparent operating system.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            Enterprise TaaSFlow is the same product, sized for organisations running many searches
            in parallel across teams, geographies and business units. One workspace, one source of
            truth, one accountable team.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Book enterprise consultation
            </Link>
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Submit your first role
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <h2 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {c.title}
                </h2>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/75">{c.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
              How enterprise engagements start
            </h2>
            <ol className="mt-5 grid gap-4 sm:grid-cols-3">
              <li className="rounded-xl bg-[color:var(--brand-navy)]/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">01</p>
                <p className="mt-2 font-semibold">Scoping conversation</p>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                  We map roles, teams, geographies, and success criteria for the first quarter.
                </p>
              </li>
              <li className="rounded-xl bg-[color:var(--brand-navy)]/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">02</p>
                <p className="mt-2 font-semibold">Account setup</p>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                  Organisation, workspaces, roles, and billing are configured before any role goes live.
                </p>
              </li>
              <li className="rounded-xl bg-[color:var(--brand-navy)]/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">03</p>
                <p className="mt-2 font-semibold">Rolling execution</p>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                  Roles are submitted through the standard intake and delivered into the shared workspace.
                </p>
              </li>
            </ol>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Talk to enterprise"
        title="Let’s scope your hiring plan together."
        description="Book a consultation and we’ll come back with a tailored account structure and price."
        primary={{ to: "/contact", label: "Book consultation" }}
        secondary={{ to: "/intake", label: "Submit a role" }}
      />
    </>
  );
}
