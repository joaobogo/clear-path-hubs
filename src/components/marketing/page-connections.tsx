import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass, BookOpen, Layers, Users } from "lucide-react";

/**
 * PageConnections — per-page contextual link block.
 * Every major page renders four kinds of onward paths so no page is a dead
 * end and there are no generic "learn more" anchors:
 *   1. Next commercial page  (the logical purchase-side follow-up)
 *   2. Supporting explainer  (a deeper "how / why" page)
 *   3. Relevant resource     (article, playbook, or case study)
 *   4. Audience / industry   (segment or industry landing)
 * Rendered above <InternalLinkHub /> at the bottom of major routes.
 */

export type ConnectionLink = {
  to: string;
  params?: Record<string, string>;
  label: string;
  desc: string;
};

export type PageConnectionsProps = {
  eyebrow?: string;
  heading?: string;
  commercial: ConnectionLink;
  explainer: ConnectionLink;
  resource: ConnectionLink;
  audience: ConnectionLink;
};

const ICONS = {
  commercial: Compass,
  explainer: Layers,
  resource: BookOpen,
  audience: Users,
} as const;

const LABELS = {
  commercial: "Next step",
  explainer: "Go deeper",
  resource: "Read next",
  audience: "For your team",
} as const;

export function PageConnections({
  eyebrow = "Where to go next",
  heading = "Continue on TaaSFlow",
  commercial,
  explainer,
  resource,
  audience,
}: PageConnectionsProps) {
  const items: Array<{ kind: keyof typeof ICONS; link: ConnectionLink }> = [
    { kind: "commercial", link: commercial },
    { kind: "explainer", link: explainer },
    { kind: "resource", link: resource },
    { kind: "audience", link: audience },
  ];

  return (
    <section
      aria-labelledby="page-connections-heading"
      className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)]"
    >
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
          {eyebrow}
        </p>
        <h2
          id="page-connections-heading"
          className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          {heading}
        </h2>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ kind, link }) => {
            const Icon = ICONS[kind];
            const kicker = LABELS[kind];
            return (
              <li key={kind}>
                <Link
                  to={link.to as never}
                  params={link.params as never}
                  className="group block h-full rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-5 transition hover:border-[color:var(--brand-navy)]/30 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2 text-[color:var(--brand-navy)]/80">
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                      {kicker}
                    </span>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 font-[family-name:var(--brand-font-display)] text-lg font-semibold tracking-tight text-[color:var(--brand-navy)]">
                    {link.label}
                    <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </p>
                  <p className="mt-1.5 text-sm text-[color:var(--brand-navy)]/80">
                    {link.desc}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
