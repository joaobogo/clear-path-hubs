import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  clearConsent,
  isOptInRegion,
  readConsent,
  writeConsent,
  onConsentChange,
} from "@/lib/tracking/consent";

/**
 * Cookie and tracking consent surface (TF-014).
 *
 * Appears until an affirmative choice is made. "Accept" and "Decline" carry
 * equal visual weight, which is what EU regulators expect. Preferences can be
 * reopened any time from the footer link, which dispatches
 * `taasflow:open-consent`.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [optIn, setOptIn] = useState(true);

  useEffect(() => {
    setOptIn(isOptInRegion());
    const decision = readConsent();
    if (!decision) {
      setOpen(true);
    } else {
      setAnalytics(decision.analytics);
      setMarketing(decision.marketing);
    }

    const reopen = () => {
      const current = readConsent();
      setAnalytics(current?.analytics ?? true);
      setMarketing(current?.marketing ?? false);
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener("taasflow:open-consent", reopen);
    const unsubscribe = onConsentChange((d) => {
      if (d === null) setOpen(true);
    });
    return () => {
      window.removeEventListener("taasflow:open-consent", reopen);
      unsubscribe();
    };
  }, []);

  if (!open) return null;

  const acceptAll = () => {
    writeConsent({ analytics: true, marketing: true }, "accept_all");
    setOpen(false);
  };
  const rejectAll = () => {
    writeConsent({ analytics: false, marketing: false }, "reject_all");
    setOpen(false);
  };
  const saveChoice = () => {
    writeConsent({ analytics, marketing }, "granular");
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie and tracking preferences"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-background/98 p-4 shadow-[var(--brand-shadow-xl)] backdrop-blur md:p-6"
    >
      <div className="mx-auto flex w-full max-w-[var(--brand-public-width)] flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Your choice about tracking
          </p>
          <p className="text-sm text-muted-foreground">
            We only run measurement and advertising tools if you say yes. Nothing
            optional loads before you choose.{" "}
            <a href="/privacy" className="underline">
              Privacy policy
            </a>
            .
          </p>

          {details && (
            <div className="mt-3 space-y-3 rounded-[var(--brand-radius-lg)] border border-border/70 p-3">
              <label className="flex items-start justify-between gap-4">
                <span className="text-sm">
                  <span className="font-medium text-foreground">Analytics</span>
                  <span className="block text-muted-foreground">
                    Traffic and product measurement (Google Analytics, session
                    quality tools). Helps us fix what does not work.
                  </span>
                </span>
                <Switch
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                  aria-label="Allow analytics tracking"
                />
              </label>
              <label className="flex items-start justify-between gap-4">
                <span className="text-sm">
                  <span className="font-medium text-foreground">Marketing</span>
                  <span className="block text-muted-foreground">
                    Advertising measurement and company-level visitor
                    identification (Meta, LinkedIn, Apollo, RB2B).
                  </span>
                </span>
                <Switch
                  checked={marketing}
                  onCheckedChange={setMarketing}
                  aria-label="Allow marketing tracking"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Strictly necessary functionality — sign-in, security, and saving
                this choice — always runs and needs no consent.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end [&>button]:min-h-11 md:[&>button]:min-h-8">
          {!details && (
            <Button variant="ghost" size="sm" onClick={() => setDetails(true)}>
              Manage
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={rejectAll}>
            Decline all
          </Button>
          {details ? (
            <Button size="sm" onClick={saveChoice}>
              Save choice
            </Button>
          ) : (
            <Button size="sm" onClick={acceptAll}>
              Accept all
            </Button>
          )}
        </div>

      </div>
      {!optIn && null}
    </div>
  );
}

/** Footer control that reopens the preferences panel and can withdraw consent. */
export function ConsentPreferencesLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className ?? "underline hover:text-foreground"}
      onClick={() => window.dispatchEvent(new CustomEvent("taasflow:open-consent"))}
    >
      Cookie preferences
    </button>
  );
}

/** Exposed for a "withdraw consent" action in legal pages. */
export function withdrawConsent() {
  clearConsent();
}
