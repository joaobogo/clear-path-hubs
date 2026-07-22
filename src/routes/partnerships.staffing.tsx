import { createFileRoute, Link } from "@tanstack/react-router";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";

const entry = getPage("partnerships-staffing");

export const Route = createFileRoute("/partnerships/staffing")({
  head: () =>
    marketingHead(entry, "/partnerships/staffing", {
      title: "Staffing partnerships — TaaSFlow",
      description:
        "A partnership model for staffing and recruiting agencies who want to extend their capacity with TaaSFlow’s workspace, sourcing and evidence-based scoring.",
    }),
  component: PartnershipsStaffingPage,
});

const WINS = [
  {
    title: "For your agency",
    points: [
      "Extend delivery capacity without hiring recruiters",
      "Take on roles outside your usual specialisation",
      "Use one workspace to keep the whole search auditable",
      "Keep your client relationship — we operate behind you",
    ],
  },
  {
    title: "For your clients",
    points: [
      "Ranked candidates with transparent evidence",
      "A structured workspace for reviews and decisions",
      "Consistent quality across every role type",
      "One accountable process from brief to hire",
    ],
  },
  {
    title: "For TaaSFlow",
    points: [
      "A sustainable, long-horizon partnership",
      "Roles that match our operating system",
      "Continuous feedback that improves our sourcing",
      "Shared upside when engagements succeed",
    ],
  },
];

function PartnershipsStaffingPage() {
  return (
    <>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Staffing partnerships
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            A partnership model built for agencies who value transparency.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            TaaSFlow partners with staffing and recruiting agencies who want to extend their
            delivery capacity, cover more role types, and keep their clients close — using the same
            workspace, sourcing and evidence-based scoring we run for direct clients.
          </p>
          <p className="mt-3 max-w-2xl text-sm text-[color:var(--brand-navy)]/60">
            This programme complements the core TaaSFlow product; it does not replace it. Every
            partnership runs on the same operating system, the same intake, and the same
            evidence-first standards.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Talk to partnerships
            </Link>
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Submit a role
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            A model where every side wins
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {WINS.map((w) => (
              <div key={w.title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {w.title}
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                  {w.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
              How partnerships are structured
            </h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="font-semibold">Scope</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  Each partnership is scoped to the role types, geographies, and volume you handle.
                  We agree service standards up front and review them together.
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Operations</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  Roles flow through our standard intake. Your team and ours share a workspace per
                  client so there is one source of truth.
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Commercials</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  Commercials are agreed per partnership. We do not publish rate cards for
                  partnerships — every arrangement is quoted on scope and volume.
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Client relationship</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  You stay the primary relationship with your client. TaaSFlow operates as your
                  delivery engine, with the level of visibility your client wants.
                </p>
              </div>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Partner with us"
        title="Let’s scope a partnership."
        description="Send us a note about your agency and the roles you want to cover. We reply personally."
        primary={{ to: "/contact", label: "Contact partnerships" }}
        secondary={{ to: "/how-it-works", label: "How TaaSFlow works" }}
      />
    </>
  );
}
