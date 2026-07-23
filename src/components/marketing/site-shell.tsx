import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, ChevronDown, Loader2, Menu, Linkedin, Mail } from "lucide-react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";

import { brand } from "@/config/brand";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  NAV_GROUPS,
  PRIMARY_NAV as CONFIG_PRIMARY_NAV,
  PRIMARY_CTA,
  SECONDARY_CTAS,
  FOOTER_GROUPS,
  SOCIAL_LINKS,
  type NavLink,
} from "@/config/public-navigation";


/* ---------------------------------------------------------------- Nav data
 * Legacy re-export retained for older imports. The single source of truth is
 * `@/config/public-navigation`; do not add links here.
 */

export const PRIMARY_NAV = CONFIG_PRIMARY_NAV;

const SOCIAL_ICONS: Record<string, typeof Linkedin> = {
  LinkedIn: Linkedin,
  Email: Mail,
};


/* ---------------------------------------------------------------- Brand mark */

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2 rounded-md" aria-label="TaaSFlow — Home">
      <img
        src={brand.logos.primary}
        alt="TaaSFlow"
        width={compact ? 28 : 32}
        height={compact ? 28 : 32}
        className="h-8 w-auto shrink-0"
      />
    </Link>
  );
}

/* ---------------------------------------------------------------- Skip link */

export function SkipNav() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[color:var(--brand-navy)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus-ring)]"
    >
      Skip to main content
    </a>
  );
}

/* ---------------------------------------------------------------- Announcement */

const ANNOUNCEMENT_KEY = "taasflow.announcement.v1";
const ANNOUNCEMENT_TEXT = "New: transparent role-specific scoring — see how it works.";
const ANNOUNCEMENT_LINK = "/how-it-works";

function Announcement() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.sessionStorage.getItem(ANNOUNCEMENT_KEY) === "1");
  }, []);
  if (dismissed) return null;
  return (
    <div className="relative w-full bg-[color:var(--brand-navy)] px-4 py-2 text-center text-xs text-white/90 sm:text-sm">
      <Link to={ANNOUNCEMENT_LINK} className="inline-flex items-center gap-1 hover:text-white">
        <span>{ANNOUNCEMENT_TEXT}</span>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          window.sessionStorage.setItem(ANNOUNCEMENT_KEY, "1");
          setDismissed(true);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/70 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- Header */

function DesktopNavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-md px-2 py-1.5 text-sm text-[color:var(--brand-navy)]/75 transition-colors hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
      activeProps={{ className: "text-[color:var(--brand-navy)] font-semibold" }}
    >
      {label}
    </Link>
  );
}

function GroupTrigger({ label }: { label: string }) {
  return (
    <NavigationMenuPrimitive.Trigger
      className="group inline-flex h-9 items-center gap-1 rounded-md px-3 py-1.5 text-sm text-[color:var(--brand-navy)]/80 outline-none transition-colors hover:text-[color:var(--brand-navy)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] data-[state=open]:text-[color:var(--brand-navy)]"
    >
      {label}
      <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
    </NavigationMenuPrimitive.Trigger>
  );
}

function GroupContent({ links }: { links: NavLink[] }) {
  const visible = links.filter((l) => !l.hidden);
  return (
    <NavigationMenuPrimitive.Content className="absolute left-0 top-0 w-full data-[motion=from-start]:animate-in data-[motion=to-start]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out">
      <ul className="grid w-[min(560px,90vw)] gap-1 p-3 sm:grid-cols-2">
        {visible.map((l) => (
          <li key={`${l.to}-${l.label}`}>
            <NavigationMenuPrimitive.Link asChild>
              <Link
                to={l.to}
                className="block rounded-md px-3 py-2.5 text-sm text-[color:var(--brand-navy)]/85 hover:bg-[color:var(--brand-navy)]/5 hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                <span className="block font-medium">{l.label}</span>
                {l.description ? (
                  <span className="mt-0.5 block text-xs text-[color:var(--brand-navy)]/55">
                    {l.description}
                  </span>
                ) : null}
              </Link>
            </NavigationMenuPrimitive.Link>
          </li>
        ))}
      </ul>
    </NavigationMenuPrimitive.Content>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Close mobile sheet when route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  const signIn = SECONDARY_CTAS.find((c) => c.label === "Sign in") ?? { to: "/login", label: "Sign in" };
  const browseJobs = SECONDARY_CTAS.find((c) => c.label === "Browse jobs") ?? { to: "/jobs", label: "Browse jobs" };

  return (
    <>
      <Announcement />
      <header className="sticky top-0 z-40 w-full border-b border-[color:var(--brand-navy)]/10 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <BrandMark />

          <NavigationMenuPrimitive.Root
            aria-label="Primary"
            className="relative hidden flex-1 items-center justify-center lg:flex"
          >
            <NavigationMenuPrimitive.List className="flex items-center gap-1">
              {NAV_GROUPS.map((group) => (
                <NavigationMenuPrimitive.Item key={group.label}>
                  <GroupTrigger label={group.label} />
                  <GroupContent links={group.links} />
                </NavigationMenuPrimitive.Item>
              ))}
              {CONFIG_PRIMARY_NAV.filter((n) => !n.hidden).map((n) => (
                <NavigationMenuPrimitive.Item key={n.to}>
                  <NavigationMenuPrimitive.Link asChild>
                    <DesktopNavLink to={n.to} label={n.label} />
                  </NavigationMenuPrimitive.Link>
                </NavigationMenuPrimitive.Item>
              ))}
            </NavigationMenuPrimitive.List>
            <div className="absolute left-0 top-full flex w-full justify-center">
              <NavigationMenuPrimitive.Viewport className="origin-top-center relative mt-2 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-xl border border-[color:var(--brand-navy)]/10 bg-white text-[color:var(--brand-navy)] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]" />
            </div>
          </NavigationMenuPrimitive.Root>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <Link
              to={signIn.to}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              {signIn.label}
            </Link>
            <Link
              to={browseJobs.to}
              className="rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              {browseJobs.label}
            </Link>
            <Link
              to={PRIMARY_CTA.to}
              className="rounded-md bg-[color:var(--brand-navy)] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              {PRIMARY_CTA.label}
            </Link>
          </div>

          {/* Mobile trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Open navigation menu"
                className="ml-auto h-11 w-11 lg:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-full max-w-sm flex-col bg-white p-0">
              <SheetHeader className="border-b border-[color:var(--brand-navy)]/10 px-5 py-4 text-left">
                <SheetTitle className="text-base font-semibold text-[color:var(--brand-navy)]">
                  Menu
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Primary site navigation
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto">
                <nav aria-label="Mobile primary" className="flex flex-col gap-1 px-3 py-4">
                  {CONFIG_PRIMARY_NAV.filter((n) => !n.hidden).map((n) => (
                    <Link
                      key={n.to}
                      to={n.to}
                      className="min-h-11 rounded-md px-3 py-2.5 text-base text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                      activeProps={{ className: "bg-[color:var(--brand-navy)]/5 font-semibold" }}
                    >
                      {n.label}
                    </Link>
                  ))}
                </nav>
                <Accordion type="multiple" className="px-3 pb-4">
                  {NAV_GROUPS.map((group) => (
                    <AccordionItem key={group.label} value={group.label} className="border-b-0">
                      <AccordionTrigger className="min-h-11 rounded-md px-3 py-2.5 text-base font-medium text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 hover:no-underline">
                        {group.label}
                      </AccordionTrigger>
                      <AccordionContent className="pb-1">
                        <ul className="flex flex-col">
                          {group.links.filter((l) => !l.hidden).map((l) => (
                            <li key={`${l.to}-${l.label}`}>
                              <Link
                                to={l.to}
                                className="block min-h-11 rounded-md px-6 py-2.5 text-sm text-[color:var(--brand-navy)]/85 hover:bg-[color:var(--brand-navy)]/5 hover:text-[color:var(--brand-navy)]"
                                activeProps={{ className: "font-semibold text-[color:var(--brand-navy)]" }}
                              >
                                {l.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
              <div className="space-y-2 border-t border-[color:var(--brand-navy)]/10 p-4">
                <Link
                  to={PRIMARY_CTA.to}
                  className="flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  {PRIMARY_CTA.label}
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to={browseJobs.to}
                    className="flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 px-3 py-2 text-sm font-medium text-[color:var(--brand-navy)]"
                  >
                    {browseJobs.label}
                  </Link>
                  <Link
                    to={signIn.to}
                    className="flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 px-3 py-2 text-sm font-medium text-[color:var(--brand-navy)]"
                  >
                    {signIn.label}
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </>
  );
}

/* ---------------------------------------------------------------- Footer */

function FooterCol({ title, links }: { title: string; links: NavLink[] }) {
  const visible = links.filter((l) => !l.hidden);
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/60">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {visible.map((l) => (
          <li key={`${l.to}-${l.label}`}>
            {l.external ? (
              <a
                href={l.to}
                className="text-sm text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                {l.label}
              </a>
            ) : (
              <Link
                to={l.to}
                className="text-sm text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  const legalGroup = FOOTER_GROUPS.find((g) => g.label === "Legal");
  const columnGroups = FOOTER_GROUPS.filter((g) => g.label !== "Legal");

  return (
    <footer className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)]">
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <BrandMark />
            <p className="mt-4 max-w-sm text-sm text-[color:var(--brand-navy)]/70">
              A live recruiting workspace with ranked, evidence-backed candidate delivery.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ href, label }) => {
                const Icon = SOCIAL_ICONS[label] ?? Mail;
                return (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/10 text-[color:var(--brand-navy)]/70 hover:border-[color:var(--brand-navy)]/30 hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </a>
                );
              })}
            </div>
          </div>

          {columnGroups.map((group) => (
            <FooterCol key={group.label} title={group.label} links={group.links} />
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[color:var(--brand-navy)]/10 pt-6 text-sm text-[color:var(--brand-navy)]/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TaaSFlow. All rights reserved.</p>
          {legalGroup ? (
            <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {legalGroup.links.filter((l) => !l.hidden).map((l) =>
                l.external ? (
                  <a key={l.label} href={l.to} className="hover:text-[color:var(--brand-navy)]">
                    {l.label}
                  </a>
                ) : (
                  <Link key={l.label} to={l.to} className="hover:text-[color:var(--brand-navy)]">
                    {l.label}
                  </Link>
                ),
              )}
              <a href="mailto:hello@taasflow.com" className="hover:text-[color:var(--brand-navy)]">
                hello@taasflow.com
              </a>
            </nav>
          ) : null}
        </div>
      </div>
    </footer>
  );
}


/* ---------------------------------------------------------------- Shell */

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[color:var(--brand-paper)] text-[color:var(--brand-navy)]">
      <SkipNav />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
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
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={cn("py-16 sm:py-20 lg:py-24", className)}>{children}</Tag>;
}

/* ---------------------------------------------------------------- Breadcrumbs */

export function Breadcrumbs({
  items,
}: {
  items: { label: string; to?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-[1200px] px-4 pt-6 text-sm text-[color:var(--brand-navy)]/60 sm:px-6 lg:px-8">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
              {item.to && !last ? (
                <Link to={item.to} className="hover:text-[color:var(--brand-navy)]">
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
  primary = { to: "/intake", label: "Start hiring" },
  secondary = { to: "/jobs", label: "Browse jobs" },
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  primary?: { to: string; label: string };
  secondary?: { to: string; label: string };
}) {
  return (
    <PublicSection>
      <PublicPage>
        <div className="rounded-2xl bg-[color:var(--brand-navy)] px-6 py-14 text-center text-white sm:px-12 sm:py-16">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
              {eyebrow}
            </p>
          )}
          <h2 className="mx-auto mt-3 max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h2>
          {description && (
            <p className="mx-auto mt-4 max-w-xl text-base text-white/75">{description}</p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={primary.to}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {primary.label}
            </Link>
            <Link
              to={secondary.to}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {secondary.label}
            </Link>
          </div>
        </div>
      </PublicPage>
    </PublicSection>
  );
}

/* ---------------------------------------------------------------- Loading */

export function PublicLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand-navy)]/70" aria-hidden />
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">Error 404</p>
            <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-5xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-6xl">
              Page not found
            </h1>
            <p className="mt-4 text-base text-[color:var(--brand-navy)]/70">
              The page you were looking for doesn't exist or has moved. Try one of these instead.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)]"
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
            <p className="mt-4 text-base text-[color:var(--brand-navy)]/70">
              A temporary issue prevented this page from loading. You can try again or head back home.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)]"
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
