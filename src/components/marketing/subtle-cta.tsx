import { Link } from "@tanstack/react-router";

/**
 * Subtle inline CTA. Two variants:
 *  - "hire": drives to /intake and /how-it-works
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
      ? "Hiring for this? TaaSFlow ships ranked candidates weekly."
      : "Looking for your next role? See what TaaSFlow is hiring for now.");

  const primary = hire
    ? { to: "/intake", label: "Start hiring" }
    : { to: "/jobs", label: "Browse open roles" };
  const secondary = hire
    ? { to: "/how-it-works", label: "See how it works" }
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
          className="inline-flex min-h-10 items-center rounded-md bg-[color:var(--brand-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)]"
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
