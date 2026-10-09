import { createFileRoute, Link } from "@tanstack/react-router";
import { faqScript, marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";
import { EditorialHero } from "@/components/marketing/editorial-hero";
import securityHero from "@/assets/page-security-hero.jpg";
import {
  TRUST_SECTIONS,
  TRUST_CONTACTS,
  TRUST_LAST_REVIEWED,
  NO_HIPAA_CERTIFICATION_NOTE,
  type TrustSection,
} from "@/config/trust-center";
import { COMPLIANCE_NOTE, HUMAN_OVERSIGHT_NOTE, RECORDS_NOTE, ATS_NOTE } from "@/config/offer-facts";
import { ShieldCheck, FileText, Clock, ExternalLink, Mail, CircleDot } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () =>
    marketingHead(undefined, "/security", {
      title: "Security and Trust | TaaSFlow",
      description:
        "Security and privacy information for TaaSFlow with dates and sources: tenant isolation, access controls, retention, audit coverage, subprocessors, your records and how scoring works.",
    }, { scripts: [faqScript(FAQ)] }),
  component: TrustCenterPage,
});

const CLIENT_KEEPS = [
  "Candidate profiles, evidence and scores you have seen, available as an export.",
  "Your role blueprints, rubrics and screening questions.",
  "Every decision, comment and hire record, with a history of who changed what.",
  "Exportable shortlists for internal stakeholders.",
];

const SCORING_LINES = [
  {
    title: "Evidence first",
    body: "Every score points at a specific line in the CV or an answer to a screening question. If we cannot cite it, we do not score it.",
  },
  {
    title: "A rubric per role",
    body: "The rubric is built from your role brief: must-haves, preferred criteria and deal-breakers. You approve it before any candidate is scored.",
  },
  {
    title: "A record of every score run",
    body: "Each score is written to an append-only record with the rubric version and the evidence used.",
  },
  {
    title: "Contradictions are flagged",
    body: "When two pieces of evidence disagree, the candidate card shows the contradiction instead of picking a winner.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "What happens if we stop working with TaaSFlow?",
    a: `${RECORDS_NOTE} There are no placement fees to unwind.`,
  },
  {
    q: "Can the software hire or reject a candidate?",
    a: `No. ${HUMAN_OVERSIGHT_NOTE} A recruiter reviews every shortlist and your team makes the decisions.`,
  },
  {
    q: "What if we already have an ATS?",
    a: `${ATS_NOTE} You can export your candidate records at any time.`,
  },
  {
    q: "Where does our data live?",
    a: "In your organisation's workspace on managed infrastructure. The database enforces who can read what with row-level security, and candidate files sit in private storage. The sections above give the detail and the source for each statement.",
  },
  {
    q: "Do you hold SOC 2, ISO 27001 or HIPAA certification?",
    a: `${COMPLIANCE_NOTE} ${NO_HIPAA_CERTIFICATION_NOTE}`,
  },
];

const SOURCE_LABEL: Record<string, string> = {
  code: "Verified in the platform",
  doc: "Internal review",
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
      {documented ? "Documented" : "Policy in preparation"}
    </span>
  );
}

function TrustCenterPage() {
  return (
    <SiteShell>
      <EditorialHero
        eyebrow="Security"
        title="Security and privacy, stated only where we can prove it"
        lead="Every claim here traces to the platform, an internal control, or a published policy. Where something is not in place yet, it says so."
        image={securityHero}
        imageAlt="A secure data facility corridor lit by a single warm light"
        stats={[
          { value: "EU and US", label: "Processing regions" },
          { value: "Append-only", label: "Audit events" },
          { value: TRUST_LAST_REVIEWED, label: "Last reviewed" },
        ]}
        primary={{ to: "/privacy", label: "Read the Privacy Notice" }}
        secondary={{ to: "/contact", label: "Send us a message" }}
      >
        <p className="max-w-3xl rounded-xl border border-[color:var(--brand-navy)]/10 bg-white/70 p-4 text-sm text-[color:var(--brand-navy)]/75">
          This page is our own account of how the system works — not an independent audit or a
          third-party verification.
        </p>
        <p className="mt-3 max-w-3xl text-sm text-[color:var(--brand-navy)]/75">
          {COMPLIANCE_NOTE} {NO_HIPAA_CERTIFICATION_NOTE} See{" "}
          <Link to="/ai-in-hiring" className="underline underline-offset-4">
            how AI is used in hiring
          </Link>
          .
        </p>

      </EditorialHero>

      <PublicSection className="!py-0">
        <PublicPage>
          <nav aria-label="Security and trust sections" className="border-y border-[color:var(--brand-navy)]/10 py-6">
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
              {[
                ["what-you-keep", "What you keep"],
                ["scoring", "How scoring works"],
                ["faq", "FAQ"],
              ].map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="text-[color:var(--brand-navy)]/70 underline-offset-4 hover:text-[color:var(--brand-navy)] hover:underline"
                  >
                    {label}
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

      <PublicSection className="pt-8">
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
                    <p className="mt-1.5 text-xs uppercase tracking-[0.08em] text-[color:var(--brand-navy)]/70">
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
            id="what-you-keep"
            className="scroll-mt-24 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white/70 p-6 sm:p-8"
          >
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
              What you keep
            </h2>
            <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/70">{RECORDS_NOTE}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {CLIENT_KEEPS.map((c) => (
                <li key={c} className="border-l-2 border-[color:var(--brand-navy)]/15 pl-4 text-[15px] leading-relaxed">
                  {c}
                </li>
              ))}
            </ul>
          </article>

          <article
            id="scoring"
            className="scroll-mt-24 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white/70 p-6 sm:p-8"
          >
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
              How scoring works
            </h2>
            <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/70">
              Scores support a person's decision; they do not make it. For the full walk-through, see{" "}
              <Link to="/how-it-works" hash="scoring" className="underline underline-offset-4">
                how candidates are scored
              </Link>{" "}
              and{" "}
              <Link to="/ai-in-hiring" className="underline underline-offset-4">
                how AI is used in hiring
              </Link>
              .
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {SCORING_LINES.map((l) => (
                <div key={l.title} className="rounded-xl bg-[color:var(--brand-navy)]/[0.04] p-4">
                  <h3 className="text-sm font-semibold text-[color:var(--brand-navy)]">{l.title}</h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">{l.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article
            id="faq"
            className="scroll-mt-24 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white/70 p-6 sm:p-8"
          >
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
              Questions buyers ask
            </h2>
            <div className="mt-4 divide-y divide-[color:var(--brand-navy)]/10">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--brand-navy)]">
                    {f.q}
                  </summary>
                  <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70">{f.a}</p>
                </details>
              ))}
            </div>
          </article>

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
            <p className="mt-3 max-w-2xl text-sm text-[color:var(--brand-navy)]/70">
              There is no separate security mailbox yet. Vulnerability reports go to the same
              privacy@taasflow.com mailbox as privacy requests, so please put "Security report" in
              the subject line.
            </p>
            <dl className="mt-6 grid gap-6 sm:grid-cols-3">
              {TRUST_CONTACTS.map((c) => (
                <div key={c.label}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--brand-navy)]/70">
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
            <p className="mt-8 text-sm text-[color:var(--brand-navy)]/70">
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
        primary={{ to: "/contact", label: "Send us a message" }}
        secondary={{ to: "/privacy", label: "Read the Privacy Notice" }}
      />
    </SiteShell>
  );
}
