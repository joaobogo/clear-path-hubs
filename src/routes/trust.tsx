import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import {
  PRICE_PILOT_DISPLAY,
  PRICE_MULTI_DISPLAY,
  PRICE_SPRINT_DISPLAY,
  PRICE_ENTERPRISE_DISPLAY,
  PILOT_ROLES_LABEL,
  MULTI_ROLES_LABEL,
  SPRINT_ROLES_LABEL,
  ENTERPRISE_ROLES_LABEL,
} from "@/config/pricing-core";
import {
  ShieldCheck,
  Lock,
  Scale,
  FileText,
  Users,
  KeyRound,
  Gauge,
  Layers,
  CircleDot,
} from "lucide-react";

/**
 * /trust — Commercial Trust Pack
 * ------------------------------
 * One place where a buyer can read exactly:
 *  - how pricing works,
 *  - what they keep,
 *  - how scoring works,
 *  - how candidate privacy works,
 *  - what TaaSFlow does vs what the client controls,
 *  - FAQs,
 *  - security & process language,
 *  - founder credibility.
 */

export const Route = createFileRoute("/trust")({
  head: () =>
    marketingHead(undefined, "/trust", {
      title: "Trust — Pricing, privacy, scoring, and security | TaaSFlow",
      description:
        "The commercial trust pack for TaaSFlow. How pricing works, what you keep, how scoring works, candidate privacy, and where the line runs between TaaSFlow and your team.",
    }),
  component: TrustPage,
});

const PRICING_LINES = [
  {
    label: "Pilot",
    price: PRICE_PILOT_DISPLAY,
    scope: PILOT_ROLES_LABEL,
    detail: "One-off package. See the system on a real role before scaling.",
  },
  {
    label: "Multi Position",
    price: PRICE_MULTI_DISPLAY,
    scope: MULTI_ROLES_LABEL,
    detail: "Reference package. Higher volume, lower cost per role.",
  },
  {
    label: "Hiring Sprint",
    price: PRICE_SPRINT_DISPLAY,
    scope: SPRINT_ROLES_LABEL,
    detail: "For teams hiring in waves — quarterly or program-based.",
  },
  {
    label: "Enterprise",
    price: PRICE_ENTERPRISE_DISPLAY,
    scope: ENTERPRISE_ROLES_LABEL,
    detail: "Continuous hiring, multi-business-unit, custom SLAs.",
  },
];

const CLIENT_KEEPS = [
  "Every candidate profile, evidence, and score you have seen — permanently.",
  "Your role blueprints, rubrics, screening questions, and scoring logic.",
  "Talent pools, silver medalist memory, and rediscovery data.",
  "Every decision, comment, and hire record — with audit trail.",
  "Exportable shortlists and share links for internal stakeholders.",
];

const NEVER_CHARGED = [
  "No placement fees.",
  "No salary percentages.",
  "No per-seat charges for internal reviewers.",
  "No extra fees for rediscovery or silver medalist hires.",
];

const SCORING_LINES = [
  {
    title: "Evidence-first, not vibe-first",
    body: "Every score points at a specific line in the CV, an answer to a screening question, or a piece of enrichment data. If we cannot cite it, we do not score it.",
  },
  {
    title: "Rubric per role",
    body: "The scoring rubric is generated from your role blueprint — must-haves, preferred criteria, dealbreakers, and screening answers. It is visible to you before any candidate is scored.",
  },
  {
    title: "Immutable score runs",
    body: "Once a score is generated it is written to an append-only record with the model version and the evidence used. Nobody can rewrite history.",
  },
  {
    title: "Contradictions surfaced, not hidden",
    body: "When two evidence sources disagree — CV vs LinkedIn, claim vs screening answer — we flag it as a contradiction on the candidate card instead of picking a winner.",
  },
  {
    title: "Confidence, not certainty",
    body: "Every extracted fact carries a confidence signal. Low-confidence facts do not carry the same weight as verified ones and are visible as such.",
  },
];

const PRIVACY_LINES = [
  "Candidates own their data. They can request access, correction, and deletion at any time.",
  "CVs are stored in a private bucket with per-organization access, encrypted at rest.",
  "External stakeholder share links are token-gated, scoped to the shortlist, and revocable.",
  "PII is never used to train third-party models. Model calls are per-request, stateless, and logged for audit.",
  "Consent and legal basis are recorded per candidate — with an audit trail on every access.",
];

type Split = { area: string; taasflow: string; client: string };
const SPLIT: Split[] = [
  {
    area: "Role definition",
    taasflow: "We help translate the ask into a structured brief and rubric.",
    client: "You approve the brief, the rubric, and the dealbreakers before sourcing starts.",
  },
  {
    area: "Sourcing & outreach",
    taasflow: "We run multi-channel sourcing and outreach with delivery health tracking.",
    client: "You see the pipeline in real time and can pause, redirect, or comment.",
  },
  {
    area: "Evaluation",
    taasflow: "We parse CVs, extract evidence, and score against your rubric.",
    client: "You review, override, and decide. Every override is captured with a reason.",
  },
  {
    area: "Shortlist & decisions",
    taasflow: "We deliver a ranked shortlist with evidence and provenance.",
    client: "You decide who moves forward. We never make hire/no-hire calls for you.",
  },
  {
    area: "Data & records",
    taasflow: "We host the system of record and keep the audit trail complete.",
    client: "You own the data. Export, delete, or migrate at any time.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "What happens if we stop working with TaaSFlow?",
    a: "You keep every candidate, every profile, every score, and every record. We provide a full export on request. There are no clawbacks and no placement fees to unwind.",
  },
  {
    q: "Do you charge a percentage of salary?",
    a: "No. Pricing is package-based and published above. Higher volume gets a lower cost per role. Enterprise plans are custom but never percentage-based.",
  },
  {
    q: "Do candidates know they are being evaluated by an AI-assisted system?",
    a: "Yes. The application flow and privacy notice make the AI-assisted evaluation explicit. Every evaluation is reviewable and reversible by a human.",
  },
  {
    q: "Can the AI make a hire or reject a candidate?",
    a: "No. The system ranks and explains. A human on your team makes every progression, offer, and rejection decision. Every decision is logged with the person and the reason.",
  },
  {
    q: "How are you different from an ATS or a recruiting agency?",
    a: "An ATS stores. An agency executes. TaaSFlow is a recruiting execution system: system of record + sourcing + evidence-first scoring + live client control + persistent memory across roles.",
  },
  {
    q: "What if we already have an ATS?",
    a: "TaaSFlow runs alongside — the system of record for how the role was actually run, the evidence behind every candidate, and the memory that carries between roles.",
  },
  {
    q: "Where does our data live?",
    a: "In an isolated, per-organization workspace with row-level security. Encrypted at rest. Access is scoped to your team and, when granted, our staff — every read is logged.",
  },
];

const SECURITY_LINES = [
  { icon: Lock, title: "Data isolation", body: "Per-organization workspace with row-level security on every table." },
  { icon: KeyRound, title: "Access control", body: "Least-privilege roles: platform admin, client admin, editor, viewer. All access audited." },
  { icon: ShieldCheck, title: "Encryption", body: "TLS in transit. Encrypted at rest. Private storage for CVs and evidence." },
  { icon: FileText, title: "Auditability", body: "Immutable audit events for score runs, decisions, and admin actions." },
  { icon: Scale, title: "Legal basis & consent", body: "Consent and legal basis recorded per candidate with a full audit trail." },
  { icon: Users, title: "Subject rights", body: "Candidates can request access, correction, or deletion. We honor them in-product." },
];

function TrustPage() {
  return (
    <SiteShell>
      <PublicSection className="pb-6 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Commercial Trust Pack
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Everything a buyer needs, in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            How pricing works. What you keep. How scoring works. How candidate
            privacy works. Where the line runs between what we do and what your
            team controls.
          </p>
          <nav className="mt-8 flex flex-wrap gap-2 text-sm">
            {[
              ["pricing", "Pricing"],
              ["what-you-keep", "What you keep"],
              ["scoring", "How scoring works"],
              ["privacy", "Candidate privacy"],
              ["split", "TaaSFlow vs your controls"],
              ["faq", "FAQ"],
              ["security", "Security & process"],
              ["founders", "Founders"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-full border border-[color:var(--brand-navy)]/15 px-3 py-1.5 text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)]"
              >
                {label}
              </a>
            ))}
          </nav>
        </PublicPage>
      </PublicSection>

      {/* PRICING */}
      <div id="pricing"><PublicSection className="py-12">
        <PublicPage>
          <SectionHeader
            icon={Gauge}
            eyebrow="How pricing works"
            title="One-off packages, published prices, no percentages."
            lede="Higher volume gets a lower cost per role. You never pay a percentage of salary. You never pay placement fees."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PRICING_LINES.map((p) => (
              <div key={p.label} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-ocean-text)]">
                  {p.label}
                </div>
                <div className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold text-[color:var(--brand-navy)]">
                  {p.price}
                </div>
                <div className="mt-1 text-xs text-[color:var(--brand-navy)]/80">{p.scope}</div>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">{p.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)]/[0.03] p-5 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-[color:var(--brand-navy)]">Never charged</h4>
              <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--brand-navy)]/80">
                {NEVER_CHARGED.map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--brand-ocean-text)]" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[color:var(--brand-navy)]">Full pricing detail</h4>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
                Tier feature lists, ROI math, and the calculator live on the
                pricing page. Every public surface reads from the same source.
              </p>
              <Link
                to="/pricing"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)]"
              >
                See pricing detail →
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection></div>

      {/* WHAT YOU KEEP */}
      <div id="what-you-keep"><PublicSection className="py-12">
        <PublicPage>
          <SectionHeader
            icon={Layers}
            eyebrow="What you keep"
            title="If you leave, nothing walks out the door."
            lede="Everything the system produces is yours. Portable, exportable, permanent."
          />
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {CLIENT_KEEPS.map((c) => (
              <li key={c} className="flex items-start gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4 text-sm text-[color:var(--brand-navy)]/80">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]" />
                {c}
              </li>
            ))}
          </ul>
        </PublicPage>
      </PublicSection></div>

      {/* SCORING */}
      <div id="scoring"><PublicSection className="py-12">
        <PublicPage>
          <SectionHeader
            icon={Gauge}
            eyebrow="How scoring works"
            title="Evidence, cited. Rubric, visible. History, immutable."
            lede="Every score can be traced back to a specific line of evidence. Every rubric is visible to you before any candidate is scored."
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {SCORING_LINES.map((s) => (
              <div key={s.title} className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
                <h4 className="text-sm font-semibold text-[color:var(--brand-navy)]">{s.title}</h4>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{s.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection></div>

      {/* PRIVACY */}
      <div id="privacy"><PublicSection className="py-12">
        <PublicPage>
          <SectionHeader
            icon={Lock}
            eyebrow="Candidate privacy"
            title="Candidates own their data. We enforce it."
            lede="Being AI-assisted doesn't mean being opaque. Candidates know how their data is used, and they can act on it."
          />
          <ul className="mt-6 space-y-3">
            {PRIVACY_LINES.map((p) => (
              <li key={p} className="flex items-start gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4 text-sm text-[color:var(--brand-navy)]/80">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[color:var(--brand-navy)]/80">
            See the <Link to="/privacy" className="underline">privacy notice</Link> for
            the full policy language.
          </p>
        </PublicPage>
      </PublicSection></div>

      {/* SPLIT */}
      <div id="split"><PublicSection className="py-12">
        <PublicPage>
          <SectionHeader
            icon={Scale}
            eyebrow="What TaaSFlow does vs what your team controls"
            title="The line is drawn in the product, not in a slide."
            lede="We execute. You decide. Every override is captured; every decision has a name on it."
          />
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[color:var(--brand-navy)]/[0.03] text-[color:var(--brand-navy)]/80">
                <tr>
                  <th className="px-4 py-3 font-semibold">Area</th>
                  <th className="px-4 py-3 font-semibold">TaaSFlow</th>
                  <th className="px-4 py-3 font-semibold">Your team</th>
                </tr>
              </thead>
              <tbody>
                {SPLIT.map((row) => (
                  <tr key={row.area} className="border-t border-[color:var(--brand-navy)]/10 align-top">
                    <td className="px-4 py-3 font-semibold text-[color:var(--brand-navy)]">{row.area}</td>
                    <td className="px-4 py-3 text-[color:var(--brand-navy)]/80">{row.taasflow}</td>
                    <td className="px-4 py-3 text-[color:var(--brand-navy)]/80">{row.client}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PublicPage>
      </PublicSection></div>

      {/* FAQ */}
      <div id="faq"><PublicSection className="py-12">
        <PublicPage>
          <SectionHeader
            icon={FileText}
            eyebrow="FAQ"
            title="The questions buyers actually ask."
            lede=""
          />
          <div className="mt-6 divide-y divide-[color:var(--brand-navy)]/10 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--brand-navy)]">
                  <span className="mr-2 text-[color:var(--brand-ocean-text)]">›</span>
                  {f.q}
                </summary>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">{f.a}</p>
              </details>
            ))}
          </div>
        </PublicPage>
      </PublicSection></div>

      {/* SECURITY */}
      <div id="security"><PublicSection className="py-12">
        <PublicPage>
          <SectionHeader
            icon={ShieldCheck}
            eyebrow="Security & process"
            title="The controls that are actually in the product."
            lede="The enforced controls a buyer would want to verify."
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY_LINES.map((s) => (
              <div key={s.title} className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
                <s.icon className="h-5 w-5 text-[color:var(--brand-ocean-text)]" />
                <h4 className="mt-3 text-sm font-semibold text-[color:var(--brand-navy)]">{s.title}</h4>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)]/[0.03] p-5">
            <h4 className="text-sm font-semibold text-[color:var(--brand-navy)]">
              Hosting and sub-processors
            </h4>
            <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
              Your data sits in a managed Postgres database with private file
              storage operated by Supabase. The application itself runs on
              Cloudflare's edge network, which also provides CDN and WAF.
              Payments run through Stripe, transactional email through Resend,
              and the AI models used for CV parsing and role-fit scoring are
              Google Gemini models called through a managed gateway.
            </p>
            <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
              The complete sub-processor register — purpose, jurisdiction and
              transfer safeguards for each provider — is published in{" "}
              <a
                href="/privacy#6-sharing-of-personal-data-sub-processors"
                className="underline decoration-[color:var(--brand-ocean-text)]/40 underline-offset-2"
              >
                section 6 of our Privacy Notice
              </a>
              .
            </p>
          </div>
          <p className="mt-5 text-xs text-[color:var(--brand-navy)]/80">
            This page is maintained by the TaaSFlow team to answer common
            security and privacy questions about the platform. It is not a
            certification. Enterprise buyers can request a full security
            review as part of onboarding.
          </p>

        </PublicPage>
      </PublicSection></div>

      <CtaSection
        eyebrow="Buy with your eyes open"
        title="Book a walkthrough of the trust pack."
        description="30 minutes. We show pricing, scoring, evidence, and the audit trail on a live workspace — with your role, not a demo."
        primary={{ to: "/intake", label: "Start a role" }}
        secondary={{ to: "/pricing", label: "See pricing detail" }}
      />
    </SiteShell>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  lede,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
        <Icon className="h-3.5 w-3.5" /> {eyebrow}
      </div>
      <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
        {title}
      </h2>
      {lede ? (
        <p className="mt-3 text-base text-[color:var(--brand-navy)]/80">{lede}</p>
      ) : null}
    </div>
  );
}
