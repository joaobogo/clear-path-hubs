import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

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
    <section
      className={cn(
        "relative overflow-hidden border-b border-[color:var(--brand-navy)]/10",
        tone === "warm"
          ? "bg-[color:var(--brand-cream)]"
          : "bg-[color:var(--brand-navy)]/[0.035]",
      )}
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-12 sm:px-6 sm:pt-14 lg:px-8 lg:pb-14">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean-text)]">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-[color:var(--brand-navy)]/80">{lead}</p>

            {primary || secondary ? (
              <div className="mt-7 flex flex-wrap gap-3">
                {primary ? (
                  <Link
                    to={primary.to}
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  >
                    {primary.label}
                  </Link>
                ) : null}
                {secondary ? (
                  <Link
                    to={secondary.to}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 bg-white/70 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-white"
                  >
                    {secondary.label}
                  </Link>
                ) : null}
              </div>
            ) : null}

            {note ? (
              <p className="mt-3 text-sm font-semibold text-[color:var(--brand-navy)]">{note}</p>
            ) : null}

            {stats?.length ? (
              <dl className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="block font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
                        {stat.value}
                      </span>
                      <span className="mt-0.5 block text-xs uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/60">
                        {stat.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <figure className="relative m-0">
            <div className="overflow-hidden rounded-2xl bg-[color:var(--brand-navy)]/5 shadow-[0_24px_60px_-30px_rgba(12,35,64,0.45)]">
              <img
                src={image}
                alt={imageAlt}
                width={1600}
                height={1008}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                sizes="(max-width: 1024px) 100vw, 560px"
                className="aspect-[16/11] w-full object-cover"
              />
            </div>
          </figure>
        </div>

        {children ? <div className="mt-10">{children}</div> : null}
      </div>
    </section>
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
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <figure className="relative m-0 overflow-hidden rounded-2xl">
          <img
            src={image}
            alt={imageAlt}
            width={1600}
            height={1008}
            loading="lazy"
            decoding="async"
            sizes="(max-width: 1200px) 100vw, 1136px"
            className="aspect-[21/9] w-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-[color:var(--brand-navy)]/85 via-[color:var(--brand-navy)]/35 to-transparent"
          />
          <figcaption className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                {eyebrow}
              </p>
            ) : null}
            <p className="mt-1.5 max-w-2xl font-[family-name:var(--brand-font-display)] text-xl font-semibold text-white sm:text-2xl">
              {caption}
            </p>
            {stats?.length ? (
              <dl className="mt-5 grid max-w-3xl gap-x-6 gap-y-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="block text-lg font-semibold text-white">{stat.value}</span>
                      <span className="block text-xs uppercase tracking-[0.12em] text-white/70">
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
