import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Eye, ShieldCheck, UserRound } from "lucide-react";
import { PublicPage, PublicSection, SiteShell, CtaSection } from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/ai-hiring-compliance")({
  head: () =>
    marketingHead(undefined, "/ai-hiring-compliance", {
      title: "How TaaSFlow Uses AI in Recruiting | Human Review & Data",
      description:
        "How TaaSFlow uses AI for CV parsing and role-fit scoring, what data is used, where human review happens, how protected criteria are handled, and how candidates can request review.",
    }),
  component: AiHiringCompliancePage,
});

const cards = [
  {
    icon: Eye,
    title: "AI supports evidence and scoring",
    body: "AI is used to help parse CVs, extract role-relevant evidence, and compare that evidence with the requirements in the approved role brief.",
  },
  {
    icon: UserRound,
    title: "A human reviews the shortlist",
    body: "An automated score is not the hiring decision. TaaSFlow's workflow requires human review before candidates are delivered to the client, and the client decides whom to interview and hire.",
  },
  {
    icon: ShieldCheck,
    title: "Protected criteria are screened out",
    body: "The intake and screening safeguards reject or remove criteria tied to protected characteristics. Role evidence should concern job-relevant experience, skills, credentials, availability, and other lawful requirements.",
  },
  {
    icon: CheckCircle2,
    title: "Candidates can ask for human review",
    body: "Candidates can request an explanation of an automated assessment or contest it through the privacy process. Requests can be sent to privacy@taasflow.com.",
  },
] as const;

function AiHiringCompliancePage() {
  return (
    <SiteShell>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean-text)]">
            AI in hiring
          </p>
          <h1 className="mt-3 max-w-4xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            What the AI does, what people decide, and what candidates can question.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[color:var(--brand-navy)]/80">
            TaaSFlow uses AI to support recruiting work, not to make the final employment decision. This page describes the current product behavior and the safeguards already implemented in the platform.
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="grid gap-5 md:grid-cols-2">
            {cards.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <Icon className="h-5 w-5 text-[color:var(--brand-ocean-text)]" aria-hidden />
                <h2 className="mt-3 text-xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{body}</p>
              </article>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection>
        <PublicPage>
          <div className="max-w-3xl space-y-10">
            <section>
              <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold">Data sent for AI-assisted processing</h2>
              <p className="mt-4 leading-relaxed text-[color:var(--brand-navy)]/80">
                The current provider register describes CV text, the role description, requirement list, and candidate skills and experience summaries as inputs used for parsing, evidence extraction, and requirement scoring. Before those calls, the workflow is designed to redact direct identifiers including name, email, phone, street address, and date of birth.
              </p>
            </section>

            <section>
              <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold">Model provider and training</h2>
              <p className="mt-4 leading-relaxed text-[color:var(--brand-navy)]/80">
                The current provider register identifies Google Gemini models, accessed through the managed AI gateway, for CV parsing, evidence extraction, and requirement scoring. The documented provider configuration states that this processing is not retained for model training, with operational logs handled under the provider policy.
              </p>
            </section>

            <section>
              <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold">What we do not claim</h2>
              <p className="mt-4 leading-relaxed text-[color:var(--brand-navy)]/80">
                We do not present an AI score as a final hiring decision, and we do not claim an independent bias audit that has not been completed. Our Security and Trust pages distinguish implemented controls from work that is still in progress.
              </p>
            </section>

            <section>
              <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold">Candidate questions and review</h2>
              <p className="mt-4 leading-relaxed text-[color:var(--brand-navy)]/80">
                A candidate who wants an explanation, correction, deletion, or human review can contact privacy@taasflow.com. The Privacy Notice describes the data-rights process and retention policy.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/privacy" className="text-sm font-semibold text-[color:var(--brand-ocean-text)]">Read the Privacy Notice</Link>
                <Link to="/trust" className="text-sm font-semibold text-[color:var(--brand-ocean-text)]">View Trust</Link>
                <Link to="/security" className="text-sm font-semibold text-[color:var(--brand-ocean-text)]">View Security</Link>
              </div>
            </section>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Human-reviewed recruiting"
        title="See how sourcing, evidence, scoring, and review fit together."
        description="The client keeps the hiring decision. TaaSFlow makes the recruiting work and evidence visible."
        primary={{ to: "/how-it-works", label: "See how it works" }}
        secondary={{ to: "/book", label: "Book a 20-minute call" }}
      />
    </SiteShell>
  );
}
