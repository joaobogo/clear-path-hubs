import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, Sparkles } from "lucide-react";
import { CASE_STUDIES } from "@/content/case-studies";

type CaseStudyPreviewsProps = {
  className?: string;
  title?: string;
  intro?: string;
  /** Number of preview cards to show (defaults to 3). */
  count?: number;
};

export function CaseStudyPreviews({
  className = "",
  title = "Real engagements, real timelines.",
  intro = "A sample of the outcomes clients see after they start an intake — by industry and company type.",
  count = 3,
}: CaseStudyPreviewsProps) {
  const studies = CASE_STUDIES.slice(0, count);

  return (
    <section className={className}>
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Case studies
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{intro}</p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {studies.map((study) => (
          <Link
            key={study.slug}
            to="/case-studies"
            className="group flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-shadow hover:shadow-lg"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
              {study.industry}
            </p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--brand-navy)]">
              {study.companyType}
            </p>

            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
              Roles hired
            </p>
            <p className="mt-1 text-sm text-[color:var(--brand-navy)]/80 line-clamp-2">
              {study.rolesNeeded.slice(0, 3).join(", ")}
              {study.rolesNeeded.length > 3 ? ", …" : ""}
            </p>

            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--brand-navy)]/80">
              <Clock className="h-3.5 w-3.5 text-[color:var(--brand-ocean-text)]" aria-hidden />
              First shortlist in {study.timeToFirstShortlist}
            </p>

            <p className="mt-4 text-sm font-medium leading-relaxed">
              {study.outcomeHighlight}
            </p>

            <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean-text)]">
              Read the full story
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
