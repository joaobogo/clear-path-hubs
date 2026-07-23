import { Link } from "@tanstack/react-router";
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
}: {
  children: ReactNode;
  exitTo?: string;
  exitLabel?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  progress?: { step: number; total: number; label?: string };
  width?: "sm" | "md" | "lg";
  className?: string;
}) {
  const maxW =
    width === "sm" ? "max-w-md" : width === "lg" ? "max-w-4xl" : "max-w-2xl";

  return (
    <div className="flex min-h-dvh flex-col bg-[color:var(--brand-paper)] text-[color:var(--brand-navy)]">
      <a
        href="#form-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[color:var(--brand-navy)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to form
      </a>
      <header className="sticky top-0 z-30 w-full border-b border-[color:var(--brand-navy)]/10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="TaaSFlow — Home"
            className="inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            <img src={brand.logos.primary} alt="TaaSFlow" width={28} height={28} className="h-7 w-auto" />
          </Link>
          {progress && (
            <div className="hidden items-center gap-3 sm:flex" aria-live="polite">
              <span className="text-xs font-medium text-[color:var(--brand-navy)]/70">
                {progress.label ?? `Step ${progress.step} of ${progress.total}`}
              </span>
              <div
                className="h-1.5 w-40 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10"
                role="progressbar"
                aria-valuenow={progress.step}
                aria-valuemin={0}
                aria-valuemax={progress.total}
              >
                <div
                  className="h-full rounded-full bg-[color:var(--brand-navy)] transition-all"
                  style={{ width: `${Math.round((progress.step / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <a
            href={exitTo}
            className="rounded-md px-2.5 py-1.5 text-sm text-[color:var(--brand-navy)]/70 hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            {exitLabel}
          </a>
        </div>
        {progress && (
          <div
            className="h-0.5 w-full bg-[color:var(--brand-navy)]/10 sm:hidden"
            role="progressbar"
            aria-valuenow={progress.step}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          >
            <div
              className="h-full bg-[color:var(--brand-navy)] transition-all"
              style={{ width: `${Math.round((progress.step / progress.total) * 100)}%` }}
            />
          </div>
        )}
      </header>

      <main id="form-main" tabIndex={-1} className="flex-1 focus:outline-none">
        <div className={cn("mx-auto w-full px-4 py-8 sm:px-6 sm:py-12", maxW, className)}>
          {(eyebrow || title || description) && (
            <div className="mb-8">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h1 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title}
                </h1>
              )}
              {description && (
                <p className="mt-2 max-w-xl text-sm text-[color:var(--brand-navy)]/70 sm:text-base">
                  {description}
                </p>
              )}
            </div>
          )}
          {children}
        </div>
      </main>

      <footer className="border-t border-[color:var(--brand-navy)]/10 bg-white/60 py-4">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 text-xs text-[color:var(--brand-navy)]/60 sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} TaaSFlow</span>
          <nav aria-label="Form legal" className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:text-[color:var(--brand-navy)]">Privacy</Link>
            <Link to="/terms" className="hover:text-[color:var(--brand-navy)]">Terms</Link>
            <a href="mailto:hello@taasflow.com" className="hover:text-[color:var(--brand-navy)]">
              hello@taasflow.com
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
