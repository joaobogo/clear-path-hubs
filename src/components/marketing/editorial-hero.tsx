import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { EditorialCover } from "@/components/marketing/editorial-cover";
import { PagePhotograph } from "@/components/marketing/page-photograph";

/**
 * Editorial hero and photo band for the public sub-pages.
 *
 * The sub-pages were text-first: a long lead paragraph followed by white space.
 * These two primitives give every page a real photograph, a short lead, and
 * facts carried as figures instead of sentences — so a visitor reads the page
 * in a glance rather than in a paragraph.
 */

export type HeroStat = { value: string; label: string };

type EditorialHeroProps = {
  eyebrow: string;
  title: ReactNode;
  /** Keep to two short lines. Anything longer belongs in the page body. */
  lead: string;
  /** Imported image URL. Rendered as the page's LCP image. */
  image: string;
  imageAlt: string;
  /** Facts as figures — three or four, never prose. */
  stats?: HeroStat[];
  primary?: { to: string; label: string };
  secondary?: { to: string; label: string };
  /** Optional short line under the CTAs (e.g. a delivery promise). */
  note?: string;
  /** Extra content below the copy column, e.g. a step rail. */
  children?: ReactNode;
  /** Warm tint reads better on pages that open onto cream sections. */
  tone?: "cool" | "warm";
};

export function EditorialHero({
  eyebrow,
  title,
  lead,
  image,
  imageAlt,
  stats,
  primary,
  secondary,
  note,
  children,
  tone = "cool",
}: EditorialHeroProps) {
  return (
    <EditorialCover image={image} alt={imageAlt} width={1600} height={1008} className={tone === "warm" ? "editorial-warm" : undefined}>
          <div className="max-w-3xl">
            <p className="editorial-cover-muted text-xs font-semibold uppercase tracking-[0.16em]">{eyebrow}</p>
            <h1 className="editorial-cover-copy mt-3 text-balance font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-[1.08] sm:text-5xl">{title}</h1>
            <p className="editorial-cover-muted mt-4 max-w-2xl text-lg">{lead}</p>

            {primary || secondary ? (
              <div className="mt-7 flex flex-wrap gap-3">
                {primary ? (
                  <Link
                    to={primary.to}
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--blue-600)] px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-on-dark)] hover:opacity-90"
                  >
                    {primary.label}
                  </Link>
                ) : null}
                {secondary ? (
                  <Link
                    to={secondary.to}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-on-dark)]/40 bg-[color:var(--brand-on-dark)]/10 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-on-dark)] hover:bg-[color:var(--brand-on-dark)]/20"
                  >
                    {secondary.label}
                  </Link>
                ) : null}
              </div>
            ) : null}

            {note ? (
              <p className="mt-3 text-sm font-semibold editorial-cover-copy">{note}</p>
            ) : null}

            {stats?.length ? (
              <dl className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="block font-[family-name:var(--brand-font-display)] text-2xl font-semibold editorial-cover-copy">
                        {stat.value}
                      </span>
                      <span className="mt-0.5 block text-xs uppercase tracking-[0.12em] editorial-cover-muted">
                        {stat.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        {children ? <div className="mt-10">{children}</div> : null}
    </EditorialCover>
  );
}

type PhotoBandProps = {
  image: string;
  imageAlt: string;
  /** One short line laid over the photograph. */
  caption: string;
  /** Optional kicker above the caption. */
  eyebrow?: string;
  stats?: HeroStat[];
  className?: string;
};

/**
 * A full-width photographic break between text sections: gives long pages a
 * visual beat and carries three facts without another paragraph.
 */
export function PhotoBand({ image, imageAlt, caption, eyebrow, stats, className }: PhotoBandProps) {
  return (
    <section className={cn("relative", className)}>
      <div className="editorial-cover relative">
        <figure className="relative m-0 overflow-hidden">
          <PagePhotograph src={image} alt={imageAlt} width={1600} height={704} className="h-[260px] sm:h-[380px]" />
          <div aria-hidden className="editorial-cover-scrim pointer-events-none absolute inset-0 hidden sm:block" />
          <figcaption className="relative mx-auto max-w-[1200px] px-4 py-6 sm:absolute sm:inset-x-0 sm:bottom-0 sm:px-6 sm:py-8 lg:px-8">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-on-dark)]/70">
                {eyebrow}
              </p>
            ) : null}
            <p className="mt-1.5 max-w-2xl font-[family-name:var(--brand-font-display)] text-xl font-semibold text-[color:var(--brand-on-dark)] sm:text-2xl">
              {caption}
            </p>
            {stats?.length ? (
              <dl className="mt-5 grid max-w-3xl gap-x-6 gap-y-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="block text-lg font-semibold text-[color:var(--brand-on-dark)]">{stat.value}</span>
                      <span className="block text-xs uppercase tracking-[0.12em] text-[color:var(--brand-on-dark)]/70">
                        {stat.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
