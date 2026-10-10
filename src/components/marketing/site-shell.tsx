import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { InternalLinkHub } from "@/components/marketing/internal-link-hub";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ClosingBand } from "@/components/layout/closing-band";
import { RunLinkButton } from "@/components/system/run-button";
import { CTA_MESSAGE, CTA_PRIMARY } from "@/config/cta";
import { cn } from "@/lib/utils";
import {
  PRIMARY_NAV as CONFIG_PRIMARY_NAV,
  isCandidateJourneyPath,
} from "@/config/public-navigation";


/* ---------------------------------------------------------------- Nav data
 * Legacy re-export retained for older imports. The single source of truth is
 * `@/config/public-navigation`; do not add links here.
 */

export const PRIMARY_NAV = CONFIG_PRIMARY_NAV;



/* ---------------------------------------------------------------- Skip link */

export function SkipNav() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[color:var(--blue-600)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus-ring)]"
    >
      Skip to main content
    </a>
  );
}

/* ---------------------------------------------------------------- Header and footer
 * The Run: src/components/layout/site-header.tsx and site-footer.tsx.
 * SiteFooter is re-exported here for older imports.
 */

export { SiteFooter };

/** Paths whose own form is the action: no closing band competes with it. */
const NO_CLOSING_BAND_PATHS = ["/pilot", "/contact"];

/* ---------------------------------------------------------------- Shell */

export function SiteShell({
  children,
  hideLinkHub = false,
  hideClosingBand = false,
  role,
}: {
  children: ReactNode;
  hideLinkHub?: boolean;
  hideClosingBand?: boolean;
  /** The page's own role, pre-filled in the closing band's role input. */
  role?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showBand =
    !hideClosingBand &&
    !isCandidateJourneyPath(pathname) &&
    !NO_CLOSING_BAND_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <div className="site-run day flex min-h-dvh flex-col">
      <SkipNav />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      {!hideLinkHub && <InternalLinkHub />}
      {showBand ? <ClosingBand role={role} /> : null}
      <SiteFooter />
    </div>
  );
}


/* ---------------------------------------------------------------- Layout helpers */

export function PublicPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function PublicSection({
  children,
  className,
  id,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag id={id} className={cn("py-10 sm:py-14 lg:py-16", className)}>
      {children}
    </Tag>
  );
}


/* ---------------------------------------------------------------- Breadcrumbs */

export function Breadcrumbs({
  items,
}: {
  items: { label: string; to?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-[1200px] px-4 pt-6 text-sm text-[color:var(--brand-navy)]/80 sm:px-6 lg:px-8">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
              {item.to && !last ? (
                <Link to={item.to} className="inline-flex min-h-11 items-center hover:text-[color:var(--brand-navy)]">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-[color:var(--brand-navy)]" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ---------------------------------------------------------------- CTA Section */

export function CtaSection({
  eyebrow,
  title,
  description,
  primary = { to: CTA_PRIMARY.to, label: CTA_PRIMARY.label },
  secondary = { to: CTA_MESSAGE.to, label: CTA_MESSAGE.label },
  tertiary,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  primary?: { to: string; label: string };
  secondary?: { to: string; label: string };
  tertiary?: { to: string; label: string };
}) {
  return (
    <PublicSection>
      <PublicPage>
        <div className="border-t border-[color:var(--rule)] pt-12 text-left">
          {eyebrow && <p className="text-[13px] font-medium text-[color:var(--faint)] [font-stretch:88%]">{eyebrow}</p>}
          <h2 className="mt-2 max-w-3xl text-[32px] leading-[1.08] text-[color:var(--ink)] sm:text-[44px] sm:leading-[1.04]">
            {title}
          </h2>
          {description && <p className="mt-4 max-w-2xl text-lg text-[color:var(--slate)]">{description}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <RunLinkButton to={primary.to}>{primary.label}</RunLinkButton>
            <RunLinkButton to={secondary.to} variant="ghost">
              {secondary.label}
            </RunLinkButton>
          </div>
          {tertiary && (
            <div className="mt-5">
              <Link
                to={tertiary.to}
                className="inline-flex min-h-11 items-center gap-1 text-base font-medium text-[color:var(--blue-600)] underline-offset-4 hover:underline"
              >
                {tertiary.label}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      </PublicPage>
    </PublicSection>
  );
}


/* ---------------------------------------------------------------- Loading */

export function PublicLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand-navy)]/80" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- 404 & Error */

export function PublicNotFound() {
  return (
    <SiteShell>
      <PublicSection>
        <PublicPage>
          <div className="mx-auto max-w-xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">Error 404</p>
            <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-5xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-6xl">
              Page not found
            </h1>
            <p className="mt-4 text-base text-[color:var(--brand-navy)]/80">
              The page you were looking for doesn't exist or has moved.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--blue-600)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--blue-700)]"
              >
                Go to home
              </Link>
              <Link
                to="/jobs"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
              >
                Browse jobs
              </Link>
              <Link
                to="/contact"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
              >
                Contact us
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}

export function PublicErrorState({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  return (
    <SiteShell>
      <PublicSection>
        <PublicPage>
          <div className="mx-auto max-w-xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-danger)]">Something went wrong</p>
            <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
              This page didn't load
            </h1>
            <p className="mt-4 text-base text-[color:var(--brand-navy)]/80">
              A temporary issue prevented this page from loading. You can try again or head back home.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--blue-600)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--blue-700)]"
                >
                  Try again
                </button>
              )}
              <Link
                to="/"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
              >
                Go to home
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
