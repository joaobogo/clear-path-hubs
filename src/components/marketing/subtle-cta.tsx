import { Link } from "@tanstack/react-router";
import { CTA_HOW_IT_WORKS, CTA_PRIMARY } from "@/config/cta";

/**
 * Subtle inline CTA. Two variants:
 *  - "hire": drives to the pilot request and /how-it-works
 *  - "candidate": drives to /jobs and /candidate-join
 *
 * Renders as a low-contrast strip so it fits mid-page without shouting.
 */
export function SubtleCta({
  variant = "hire",
  headline,
  className,
}: {
  variant?: "hire" | "candidate";
  headline?: string;
  className?: string;
}) {
  const hire = variant === "hire";
  const title =
    headline ??
    (hire
      ? "Hiring for this? Start with one role and a ranked shortlist."
      : "Looking for your next role? See the roles open now.");

  const primary = hire
    ? { to: CTA_PRIMARY.to, label: CTA_PRIMARY.label }
    : { to: "/jobs", label: "Browse open roles" };
  const secondary = hire
    ? { to: CTA_HOW_IT_WORKS.to, label: CTA_HOW_IT_WORKS.label }
    : { to: "/candidate-success", label: "Candidate stories" };

  return (
    <aside
      className={
        "my-10 flex flex-col items-start justify-between gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] px-5 py-4 sm:flex-row sm:items-center " +
        (className ?? "")
      }
    >
      <p className="text-sm text-[color:var(--brand-navy)]/80">
        <span className="font-semibold text-[color:var(--brand-navy)]">
          {title}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={primary.to}
          className="inline-flex min-h-10 items-center rounded-md bg-[color:var(--blue-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--blue-700)]"
        >
          {primary.label}
        </Link>
        <Link
          to={secondary.to}
          className="text-sm font-semibold text-[color:var(--brand-navy)] underline underline-offset-4 hover:opacity-80"
        >
          {secondary.label} →
        </Link>
      </div>
    </aside>
  );
}
