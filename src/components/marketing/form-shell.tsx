import { Link } from "@tanstack/react-router";

import { FGV } from "@/config/ecosystem";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * FormShell — focused chrome for long, high-intent flows
 * (intake, apply, auth, password reset, receipts).
 *
 * Intentionally distraction-free: brand mark + exit link only,
 * no primary nav, no announcement, no footer columns.
 */
function FormIntro({ eyebrow, title, description }: { eyebrow?: string; title?: string; description?: string }) {
  if (!eyebrow && !title && !description) return null;
  return (
    <div className="mb-8">
      {eyebrow && <p className="narrow text-[13px] font-medium text-[color:var(--faint)]">{eyebrow}</p>}
      {title && <h1 className="mt-2 text-[26px] leading-[1.1] text-[color:var(--ink)] sm:text-[32px]">{title}</h1>}
      {description && <p className="mt-2 max-w-[640px] text-[15px] text-[color:var(--slate)] sm:text-base">{description}</p>}
    </div>
  );
}

export function FormShell({
  children,
  exitTo = "/",
  exitLabel = "Exit",
  eyebrow,
  title,
  description,
  progress,
  width = "md",
  className,
  aside,
}: {
  children: ReactNode;
  exitTo?: string;
  exitLabel?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  progress?: { step: number; total: number; label?: string; note?: ReactNode };
  width?: "sm" | "md" | "lg";
  className?: string;
  /** A document taking shape beside the form (the live brief), on tint, from 1024 up. */
  aside?: ReactNode;
}) {
  const maxW =
    width === "sm" ? "max-w-md" : width === "lg" ? "max-w-4xl" : "max-w-2xl";

  return (
    <div className="site-run day flex min-h-dvh flex-col">
      <a
        href="#form-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[color:var(--blue-600)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to form
      </a>
      {/* The focused flow header: wordmark and the exit only. No site navigation while someone fills a form. */}
      <header className="sticky top-0 z-30 w-full border-b border-[color:var(--rule)] bg-white">
        <div className="mx-auto flex h-[60px] w-full max-w-[calc(var(--max)+2*var(--margin))] items-center justify-between gap-4 px-[var(--margin)]">
          <Link
            to="/"
            aria-label="TaaSFlow — Home"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--r-1)]"
          >
            <img src={brand.logos.primary} alt="TaaSFlow" width={116} height={28} className="h-7 w-auto max-w-none shrink-0" />
          </Link>
          {progress && (
            /* Visible on phones too: a candidate who cannot see how much is
               left is the candidate who stops mid-way. */
            <div className="flex min-w-0 items-center gap-2 sm:gap-3" aria-live="polite">
              {/* On phones the step is already stated at the top of the form and
                  a full-width bar sits under this header, so the inline copy
                  would only crowd the row. */}
              <span className="hidden truncate text-sm text-[color:var(--slate)] sm:inline">
                {progress.label ?? `Step ${progress.step} of ${progress.total}`}
              </span>
              {/* Status that must survive being missed — a toast would be gone
                  before a candidate on a phone finished reading it. */}
              {progress.note}
              <div
                className="hidden h-2 w-16 shrink-0 overflow-hidden rounded-full bg-[color:var(--blue-100)] sm:block sm:w-40"
                role="progressbar"
                aria-label={progress.label ?? `Step ${progress.step} of ${progress.total}`}
                aria-valuetext={progress.label ?? `Step ${progress.step} of ${progress.total}`}
                aria-valuenow={progress.step}
                aria-valuemin={0}
                aria-valuemax={progress.total}
              >
                <div
                  className="h-full rounded-full bg-[color:var(--blue-600)] transition-all"
                  style={{ width: `${Math.round((progress.step / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <a
            href={exitTo}
            className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[var(--r-1)] px-3 py-2 text-[15px] font-medium text-[color:var(--ink)] hover:text-[color:var(--blue-600)]"
          >
            {exitLabel}
          </a>

        </div>
        {progress && (
          <div
            className="h-1 w-full bg-[color:var(--blue-100)] sm:hidden"
            role="progressbar"
            aria-label={progress.label ?? `Step ${progress.step} of ${progress.total}`}
            aria-valuetext={progress.label ?? `Step ${progress.step} of ${progress.total}`}
            aria-valuenow={progress.step}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          >
            <div
              className="h-full bg-[color:var(--blue-600)] transition-all"
              style={{ width: `${Math.round((progress.step / progress.total) * 100)}%` }}
            />
          </div>
        )}
      </header>

      <main id="form-main" tabIndex={-1} className="flex-1 focus:outline-none">
        {aside ? (
          <div className="mx-auto grid w-full max-w-[calc(var(--max)+2*var(--margin))] lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className={cn("w-full px-[var(--margin)] py-8 sm:py-12 lg:pr-12", className)}>
              <FormIntro eyebrow={eyebrow} title={title} description={description} />
              {children}
            </div>
            <aside className="tint px-[var(--margin)] py-8 sm:py-12 lg:px-8">
              <div className="lg:sticky lg:top-[84px]">{aside}</div>
            </aside>
          </div>
        ) : (
          <div className={cn("mx-auto w-full px-4 py-8 sm:px-6 sm:py-12", maxW, className)}>
            <FormIntro eyebrow={eyebrow} title={title} description={description} />
            {children}
          </div>
        )}
      </main>

      <footer className="border-t border-[color:var(--rule)] bg-white py-4">
        <div className="mx-auto flex w-full max-w-[calc(var(--max)+2*var(--margin))] flex-wrap items-center justify-between gap-2 px-[var(--margin)] text-sm text-[color:var(--faint)]">
          {/* Parent identification stays on conversion routes; sibling-brand
              outbound links do not. */}
          <span>
            © {new Date().getFullYear()} TaaSFlow — part of {FGV.name}
          </span>
          <nav aria-label="Form legal" className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/privacy" className="inline-flex min-h-6 items-center py-1 hover:text-[color:var(--blue-600)]">Privacy</Link>
            <Link to="/terms" className="inline-flex min-h-6 items-center py-1 hover:text-[color:var(--blue-600)]">Terms</Link>
            <a href="mailto:hello@taasflow.com" className="inline-flex min-h-6 items-center py-1 hover:text-[color:var(--blue-600)]">
              hello@taasflow.com
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
