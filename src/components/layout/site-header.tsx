import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionContext } from "@/lib/auth.functions";
import { landingPathForRole } from "@/lib/roles";
import { ProductionLink } from "@/components/marketing/production-link";
import { BrandMark } from "@/components/layout/brand-mark";
import { RunLinkButton } from "@/components/system/run-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  CANDIDATE_PRIMARY_CTA,
  MESSAGE_CTA,
  PRIMARY_CTA,
  PRIMARY_ITEMS,
  SECONDARY_CTAS,
  isCandidateJourneyPath,
} from "@/config/public-navigation";
import { cn } from "@/lib/utils";

const NAV_LINKS = PRIMARY_ITEMS.filter(
  (i): i is Extract<(typeof PRIMARY_ITEMS)[number], { kind: "link" }> => i.kind === "link",
);

/** Signed-in visitors see "Open workspace" where "Sign in" would be. */
function useSessionCta() {
  const [cta, setCta] = useState<{ to: string; label: string } | null>(null);
  const ctx = useServerFn(getSessionContext);

  useEffect(() => {
    let mounted = true;

    async function resolve() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        setCta(null);
        return;
      }
      try {
        const session = await ctx();
        if (!mounted) return;
        setCta({ to: landingPathForRole(session.primary_role), label: "Open workspace" });
      } catch {
        if (!mounted) return;
        setCta(null);
      }
    }

    resolve();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") resolve();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [ctx]);

  return cta;
}

const linkClass =
  "inline-flex min-h-11 items-center whitespace-nowrap px-1 text-[15px] underline-offset-[6px] decoration-2 hover:text-[color:var(--blue-600)]";
const activeClass = "text-[color:var(--blue-600)] underline";
const inactiveClass = "text-[color:var(--ink)]";

/**
 * Site header (The Run). White on every page: wordmark and "Hiring, handled.",
 * five links, Sign in, one blue button. The current page is blue and
 * underlined. On a phone the links collapse behind a 44 px menu button and
 * the pilot button stays visible.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const candidateMode = isCandidateJourneyPath(pathname);
  // On the pilot checkout the page's own form is the one primary action, so
  // the site button becomes the quiet alternative.
  const onPilot = pathname === "/pilot" || pathname.startsWith("/pilot/");
  const primary = candidateMode ? CANDIDATE_PRIMARY_CTA : onPilot ? MESSAGE_CTA : PRIMARY_CTA;
  const sessionCta = useSessionCta();
  const signIn = sessionCta ?? SECONDARY_CTAS.find((c) => c.to === "/login") ?? { to: "/login", label: "Sign in" };

  return (
    <header className="day sticky top-0 z-40 w-full border-b border-[color:var(--rule)]">
      <div className="mx-auto flex h-[72px] w-full max-w-[calc(var(--max)+2*var(--margin))] items-center gap-3 px-[var(--margin)] sm:gap-6">
        <BrandMark />

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={linkClass}
              activeProps={{ className: activeClass, "aria-current": "page" }}
              inactiveProps={{ className: inactiveClass }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 sm:gap-4 lg:ml-6">
          <ProductionLink to={signIn.to} className={cn(linkClass, inactiveClass, "hidden lg:inline-flex")}>
            {signIn.label}
          </ProductionLink>
          <RunLinkButton
            to={primary.to}
            size="sm"
            variant={onPilot ? "ghost" : "primary"}
            className="min-h-11 px-3 text-sm sm:px-4 sm:text-[15px]"
          >
            {primary.label}
          </RunLinkButton>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open navigation menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-1)] border border-[color:var(--rule-2)] text-[color:var(--ink)] lg:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="day flex w-full max-w-sm flex-col p-0">
              <SheetHeader className="border-b border-[color:var(--rule)] px-5 py-4 text-left">
                <SheetTitle className="text-base font-semibold text-[color:var(--ink)]">Menu</SheetTitle>
                <SheetDescription className="sr-only">Primary site navigation</SheetDescription>
              </SheetHeader>
              <nav aria-label="Primary" className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="flex min-h-12 items-center rounded-[var(--r-1)] px-3 text-lg hover:bg-[color:var(--blue-50)]"
                    activeProps={{ className: "text-[color:var(--blue-600)] underline underline-offset-[6px] decoration-2", "aria-current": "page" }}
                    inactiveProps={{ className: inactiveClass }}
                  >
                    {l.label}
                  </Link>
                ))}
                <Link
                  to={candidateMode ? "/" : "/jobs"}
                  className="mt-4 flex min-h-12 items-center rounded-[var(--r-1)] border-t border-[color:var(--rule)] px-3 pt-4 text-base text-[color:var(--slate)]"
                >
                  {candidateMode ? "For employers" : "For candidates: browse jobs"}
                </Link>
              </nav>
              <div className="space-y-2 border-t border-[color:var(--rule)] p-4">
                <RunLinkButton to={primary.to} className="w-full">
                  {primary.label}
                </RunLinkButton>
                {!candidateMode && !onPilot ? (
                  <RunLinkButton to={MESSAGE_CTA.to} variant="ghost" className="w-full">
                    {MESSAGE_CTA.label}
                  </RunLinkButton>
                ) : null}
                <ProductionLink
                  to={signIn.to}
                  className="flex min-h-11 items-center justify-center text-sm font-medium text-[color:var(--ink)]"
                >
                  {signIn.label}
                </ProductionLink>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
