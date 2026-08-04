import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";
import {
  TRUST_SECTIONS,
  TRUST_CONTACTS,
  TRUST_LAST_REVIEWED,
  type TrustSection,
} from "@/config/trust-center";
import { ShieldCheck, FileText, Clock, ExternalLink, Mail, CircleDot } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () =>
    marketingHead(undefined, "/security", {
      title: "Trust Center — Security, privacy and tenant isolation | TaaSFlow",
      description:
        "Verified security and privacy information for TaaSFlow: row-level tenant isolation, access controls, encryption, retention, audit coverage, subprocessors and incident response — with dates and sources.",
    }),
  component: TrustCenterPage,
});

const SOURCE_LABEL: Record<string, string> = {
  code: "Verified in the platform",
  doc: "Internal certification",
  legal: "Published policy",
};

function StateBadge({ state }: { state: TrustSection["state"] }) {
  const documented = state === "documented";
  return (
    <span
      className={
        documented
          ? "inline-flex items-center gap-1.5 rounded-full bg-[color:var(--brand-navy)]/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--brand-navy)]/70"
          : "inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-700"
      }
    >
      <CircleDot className="h-3 w-3" aria-hidden />
      {documented ? "Documented" : "Documentation in progress"}
    </span>
  );
}

function TrustCenterPage() {
  return (
    <SiteShell>
      <PublicSection className="pb-8">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/50">
            Trust Center
          </p>
          <h1 className="mt-4 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Security and privacy, stated only where we can prove it
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            Every claim below traces to the platform itself, an internal certification, or a
            published policy. Where something is not in place yet, it says so.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-[color:var(--brand-navy)]/70">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/12 px-3 py-1.5">
              <Clock className="h-4 w-4" aria-hidden />
              Last reviewed {TRUST_LAST_REVIEWED}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/12 px-3 py-1.5">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              No certifications claimed
            </span>
            <Link
              to="/privacy"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/12 px-3 py-1.5 hover:bg-[color:var(--brand-navy)]/5"
            >
              <FileText className="h-4 w-4" aria-hidden />
              Privacy Notice
            </Link>
          </div>

          <p className="mt-8 max-w-3xl rounded-xl border border-[color:var(--brand-navy)]/10 bg-white/60 p-4 text-sm text-[color:var(--brand-navy)]/70">
            This page is maintained by TaaSFlow to answer common security and privacy questions
            about the platform. It is our own account of how the system works — not an independent
            audit or a third-party verification.
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-0">
        <PublicPage>
          <nav aria-label="Trust Center sections" className="border-y border-[color:var(--brand-navy)]/10 py-6">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {TRUST_SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-[color:var(--brand-navy)]/70 underline-offset-4 hover:text-[color:var(--brand-navy)] hover:underline"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#security-contact"
                  className="text-[color:var(--brand-navy)]/70 underline-offset-4 hover:text-[color:var(--brand-navy)] hover:underline"
                >
                  Security contact
                </a>
              </li>
            </ul>
          </nav>
        </PublicPage>
      </PublicSection>

      <PublicSection>
        <PublicPage className="space-y-10">
          {TRUST_SECTIONS.map((section) => (
            <article
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white/70 p-6 sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
                  {section.title}
                </h2>
                <StateBadge state={section.state} />
              </div>
              <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/70">{section.summary}</p>

              <ul className="mt-6 space-y-4">
                {section.claims.map((claim) => (
                  <li key={claim.text} className="border-l-2 border-[color:var(--brand-navy)]/15 pl-4">
                    <p className="text-[15px] leading-relaxed">{claim.text}</p>
                    <p className="mt-1.5 text-xs uppercase tracking-[0.08em] text-[color:var(--brand-navy)]/45">
                      {SOURCE_LABEL[claim.source]} · {claim.reference}
                    </p>
                  </li>
                ))}
              </ul>

              {section.note && (
                <p className="mt-6 rounded-xl bg-[color:var(--brand-navy)]/[0.04] p-4 text-sm text-[color:var(--brand-navy)]/70">
                  {section.note}
                </p>
              )}

              {section.links && section.links.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
                  {section.links.map((l) => (
                    <Link
                      key={l.to + l.label}
                      to={l.to}
                      className="inline-flex items-center gap-1.5 text-[color:var(--brand-navy)] underline-offset-4 hover:underline"
                    >
                      {l.label}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  ))}
                </div>
              )}
            </article>
          ))}

          <article
            id="security-contact"
            className="scroll-mt-24 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white/70 p-6 sm:p-8"
          >
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
              Security contact
            </h2>
            <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/70">
              A real person reads these. Use the closest match rather than a general enquiry form.
            </p>
            <dl className="mt-6 grid gap-6 sm:grid-cols-3">
              {TRUST_CONTACTS.map((c) => (
                <div key={c.label}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--brand-navy)]/50">
                    {c.label}
                  </dt>
                  <dd className="mt-2">
                    <a
                      href={c.href}
                      className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--brand-navy)] underline-offset-4 hover:underline"
                    >
                      <Mail className="h-4 w-4" aria-hidden />
                      {c.value}
                    </a>
                    <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">{c.detail}</p>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 text-sm text-[color:var(--brand-navy)]/55">
              Last reviewed {TRUST_LAST_REVIEWED}. This page is reviewed when the platform's access
              model, subprocessors or published policies change.
            </p>
          </article>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Procurement"
        title="Need this in a security questionnaire?"
        description="Send us your questionnaire or DPA template. We answer against the real configuration, and we say 'not yet' where that is the honest answer."
        primary={{ to: "/contact", label: "Talk to us" }}
        secondary={{ to: "/privacy", label: "Read the Privacy Notice" }}
      />
    </SiteShell>
  );
}
