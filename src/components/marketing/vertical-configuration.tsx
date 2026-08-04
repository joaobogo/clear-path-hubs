/**
 * VerticalConfigurationSection — one reusable module, rendered on every public
 * industry page. It shows how the *same* platform is configured for that
 * hiring environment: role families, requirement patterns, evidence types,
 * rubric weights, compliance, approval controls, integrations and an example
 * role blueprint.
 *
 * Invariants
 *  - No new URLs: this renders inside existing industry routes.
 *  - Blueprint content is explicitly labelled as an example.
 *  - Integration availability is read from the verified directory, never faked.
 *  - Colours use brand tokens only.
 */

import { Link } from "@tanstack/react-router";
import { PublicSection } from "@/components/marketing/site-shell";
import {
  APPROVAL_CONTROLS,
  WEIGHT_DIMENSIONS,
  resolveVerticalConfig,
  type VerticalConfig,
} from "@/config/vertical-configuration";
import { AVAILABILITY_LABEL, INTEGRATIONS } from "@/config/integrations-directory";

function Card({
  title,
  children,
  eyebrow,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--brand-sky)] bg-[color:var(--brand-paper)] p-5">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-1 text-base font-semibold text-[color:var(--brand-ink)]">{title}</h3>
      <div className="mt-3 text-sm text-[color:var(--brand-ink)]/75">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-ocean)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function WeightBars({ config }: { config: VerticalConfig }) {
  return (
    <dl className="space-y-2.5">
      {WEIGHT_DIMENSIONS.map((d) => {
        const value = config.weights[d.key];
        return (
          <div key={d.key}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-[color:var(--brand-ink)]/80">{d.label}</dt>
              <dd className="text-sm font-semibold tabular-nums text-[color:var(--brand-ink)]">{value}</dd>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--brand-sky)]">
              <div
                className="h-full rounded-full bg-[color:var(--brand-ocean)]"
                style={{ width: `${(value / 35) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </dl>
  );
}

export function VerticalConfigurationSection({
  slug,
  industryName,
}: {
  slug: string;
  industryName: string;
}) {
  const config = resolveVerticalConfig(slug);
  const integrations = config.integrations
    .map((id) => INTEGRATIONS.find((i) => i.id === id))
    .filter((i): i is (typeof INTEGRATIONS)[number] => Boolean(i));

  return (
    <PublicSection className="bg-[color:var(--brand-mist)]/30 py-14">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean-text)]">
          Platform configuration
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-balance text-[color:var(--brand-ink)] sm:text-3xl">
          How TaaSFlow is configured for {industryName.toLowerCase()} hiring
        </h2>
        <p className="mt-3 text-sm text-[color:var(--brand-ink)]/75">
          Same platform, same objects, different configuration —{" "}
          <span className="font-medium text-[color:var(--brand-ink)]">{config.label}</span>. {config.summary}
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card eyebrow="Role families" title="What the workspace is set up to hire">
          <ul className="space-y-3">
            {config.roleFamilies.map((family) => (
              <li key={family.name}>
                <p className="font-medium text-[color:var(--brand-ink)]">{family.name}</p>
                <p className="mt-0.5">{family.examples.join(" · ")}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card eyebrow="Requirements" title="Requirement patterns captured at intake">
          <Bullets items={config.requirementPatterns} />
        </Card>

        <Card eyebrow="Evidence" title="Evidence types extracted from the CV">
          <dl className="space-y-3">
            {config.evidenceTypes.map((e) => (
              <div key={e.label}>
                <dt className="font-medium text-[color:var(--brand-ink)]">{e.label}</dt>
                <dd className="mt-0.5">{e.detail}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card eyebrow="Scoring" title="Rubric weighting for this configuration">
          <WeightBars config={config} />
          <div className="mt-4 border-t border-[color:var(--brand-sky)] pt-3">
            <Bullets items={config.scoringNotes} />
          </div>
        </Card>

        <Card eyebrow="Compliance" title="Compliance handled in the workflow">
          <dl className="space-y-3">
            {config.compliance.map((c) => (
              <div key={c.label}>
                <dt className="font-medium text-[color:var(--brand-ink)]">{c.label}</dt>
                <dd className="mt-0.5">{c.detail}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card eyebrow="Approval controls" title="Who has to agree before anything moves">
          <p className="mb-3">{config.approvalNote}</p>
          <dl className="space-y-3">
            {config.approvalControls.map((key) => (
              <div key={key}>
                <dt className="font-medium text-[color:var(--brand-ink)]">{APPROVAL_CONTROLS[key].label}</dt>
                <dd className="mt-0.5">{APPROVAL_CONTROLS[key].description}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card eyebrow="Integrations" title="Connections used in this configuration">
          <ul className="space-y-2">
            {integrations.map((i) => (
              <li key={i.id} className="flex items-baseline justify-between gap-3">
                <span className="text-[color:var(--brand-ink)]">{i.name}</span>
                <span className="shrink-0 rounded-full border border-[color:var(--brand-sky)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--brand-ink)]/70">
                  {AVAILABILITY_LABEL[i.availability]}
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/integrations"
            className="mt-4 inline-block text-sm font-medium text-[color:var(--brand-ocean-text)] underline-offset-4 hover:underline"
          >
            See the full integrations directory
          </Link>
        </Card>

        <Card eyebrow="Role blueprint — example" title={config.blueprint.title}>
          <p className="mb-3 text-xs text-[color:var(--brand-ink)]/60">
            Example configuration output, not a customer role. Seniority: {config.blueprint.seniority}.
          </p>
          <p className="font-medium text-[color:var(--brand-ink)]">Must-haves</p>
          <div className="mt-1">
            <Bullets items={config.blueprint.mustHaves} />
          </div>
          <p className="mt-3 font-medium text-[color:var(--brand-ink)]">Dealbreakers</p>
          <div className="mt-1">
            <Bullets items={config.blueprint.dealbreakers} />
          </div>
          <p className="mt-3 font-medium text-[color:var(--brand-ink)]">Screening questions</p>
          <div className="mt-1">
            <Bullets items={config.blueprint.screeningQuestions} />
          </div>
        </Card>

        <Card eyebrow="Intelligence" title="What the recommendations layer watches here">
          <Bullets items={config.intelligenceFocus} />
        </Card>
      </div>
    </PublicSection>
  );
}
