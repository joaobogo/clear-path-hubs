import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";
import {
  clearConsent,
  requiresPriorOptIn,
  readConsent,
  writeConsent,
  onConsentChange,
  onTrackingPolicyChange,
} from "@/lib/tracking/consent";

/**
 * Cookie and tracking consent surface.
 *
 * Regional gate:
 *  - EU/EEA/UK/CH — a prominent choice appears until an affirmative action is
 *    taken. "Accept all" and "Decline all" carry equal weight.
 *  - Everywhere else — trackers are permitted by default and a slim, dismissible
 *    notice explains it, with the same controls one click away.
 *
 * Preferences reopen from the footer link, which dispatches
 * `taasflow:open-consent`.
 */
const NOTICE_DISMISSED_KEY = "taasflow_consent_notice_dismissed_v1";

export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  // Off until chosen. This defaulted to true, so the details panel opened with
  // Analytics reporting aria-checked="true" before any decision was recorded —
  // a pre-ticked consent control is not consent, and the stored policy
  // (requirePriorOptInEverywhere) says so explicitly (audit #8, TF8-09).
  // Marketing on the line below already did this correctly.
  const [analytics, setAnalytics] = useState(() => !requiresPriorOptIn());
  const [marketing, setMarketing] = useState(false);
  const [optIn, setOptIn] = useState(true);
  const [forced, setForced] = useState(false);
  const firstControl = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const priorOptIn = requiresPriorOptIn();
    setOptIn(priorOptIn);

    const decision = readConsent();
    if (decision) {
      setAnalytics(decision.analytics);
      setMarketing(decision.marketing);
    } else if (priorOptIn) {
      setOpen(true);
    } else {
      // Opt-out region: trackers already run. Show a slim notice once.
      let dismissed = false;
      try {
        dismissed = window.localStorage.getItem(NOTICE_DISMISSED_KEY) === "1";
      } catch {
        /* private mode */
      }
      if (!dismissed) setOpen(true);
    }

    const reopen = () => {
      const current = readConsent();
      setAnalytics(current?.analytics ?? !requiresPriorOptIn());
      setMarketing(current?.marketing ?? !requiresPriorOptIn());
      setDetails(true);
      setForced(true);
      setOpen(true);
    };
    window.addEventListener("taasflow:open-consent", reopen);
    // The admin policy can flip the region rule; re-evaluate when it arrives.
    const offPolicy = onTrackingPolicyChange(() => {
      const priorOptInNow = requiresPriorOptIn();
      setOptIn(priorOptInNow);
      if (priorOptInNow && !readConsent()) setOpen(true);
    });
    const unsubscribe = onConsentChange((d) => {
      if (d === null && requiresPriorOptIn()) setOpen(true);
    });
    return () => {
      window.removeEventListener("taasflow:open-consent", reopen);
      offPolicy();
      unsubscribe();
    };
  }, []);

  const slim = !optIn && !details && !forced;

  // Focus ONCE per opening, not on every re-render of an already-open banner.
  // Re-running this moved focus while a click was in flight, which — together
  // with the ResizeObserver below republishing the bar's height — swapped the
  // element under the cursor between pointer-down and pointer-up and lost the
  // first click (audit #7, TF7-03).
  const focusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      focusedFor.current = null;
      return;
    }
    const key = String(details);
    if (focusedFor.current === key) return;
    focusedFor.current = key;
    firstControl.current?.focus({ preventScroll: true });
  }, [open, details]);

  // The bar sits *below* the workspace action layer (z-55 vs z-60) and never
  // covers it: while visible it publishes its measured height, so the scroll
  // container gains bottom padding and sticky action bars are pushed up.
  // (See `html[data-consent-open]` rules in brand-tokens.css.)
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    if (!open) {
      root.removeAttribute("data-consent-open");
      root.style.removeProperty("--consent-bar-h");
      return;
    }
    root.setAttribute("data-consent-open", "true");
    const measure = () => {
      const h = barRef.current?.offsetHeight ?? 0;
      root.style.setProperty("--consent-bar-h", `${h}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (barRef.current) ro.observe(barRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      root.removeAttribute("data-consent-open");
      root.style.removeProperty("--consent-bar-h");
    };
  }, [open, details, slim]);

  if (!open) return null;


  const close = () => {
    setOpen(false);
    setForced(false);
    setDetails(false);
  };
  const acceptAll = () => {
    writeConsent({ analytics: true, marketing: true }, "accept_all");
    close();
  };
  const rejectAll = () => {
    writeConsent({ analytics: false, marketing: false }, "reject_all");
    close();
  };
  const saveChoice = () => {
    writeConsent({ analytics, marketing }, "granular");
    close();
  };
  const dismissNotice = () => {
    try {
      window.localStorage.setItem(NOTICE_DISMISSED_KEY, "1");
    } catch {
      /* private mode */
    }
    close();
  };

  return (
    <div
      ref={barRef}
      role="dialog"
      aria-modal="false"
      aria-label="Cookie and tracking preferences"
      className="fixed inset-x-0 bottom-0 z-[55] border-t border-border bg-background/98 px-3 pt-2.5 shadow-[var(--brand-shadow-xl)] backdrop-blur pb-[calc(0.625rem+env(safe-area-inset-bottom))] md:px-6 md:pt-3 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex w-full max-w-[var(--brand-public-width)] flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="min-w-0 max-w-3xl space-y-1 pr-8 md:pr-0">
          <p className="text-xs font-semibold text-foreground">
            {slim ? "We use cookies" : "Your choice about tracking"}
          </p>
          <p className="text-xs leading-snug text-muted-foreground">
            {slim
              ? "We use analytics and business tools to understand how the site is used. Turn optional tracking off at any time."
              : // The old wording — "Trackers are only injected once their
                // consent category is granted" — was not true of Google
                // Analytics, which loads on every page in consent mode with
                // storage denied and still contacts Google (audit #6, A6-04).
                // A promise a reader can disprove with their network tab is
                // worse than no promise. Say what actually happens — and what
                // happens differs by region: outside the opt-in regions the
                // optional tools are already running when this panel opens
                // via "Manage", so "nothing loads until you allow it" would
                // be false there.
                optIn
                ? "Nothing that identifies you loads until you allow it. Google Analytics runs on every page with storage switched off — it sets no cookies and cannot identify you — and only starts full measurement if you allow analytics."
                : "Analytics and business tools run by default where you are. Turn either off below; the choice is kept on this device and applies on every page."}{" "}
            <a href="/privacy" className="underline">
              Privacy policy
            </a>
            .
          </p>

          {!slim && details && (
            <div className="mt-3 space-y-3 rounded-[var(--brand-radius-lg)] border border-border/70 p-3">
              <label className="flex items-start justify-between gap-4">
                <span className="text-sm">
                  <span className="font-medium text-foreground">Analytics</span>
                  <span className="block text-muted-foreground">
                    Full Google Analytics measurement plus session quality tools
                    (Clarity, Hotjar). Declined, Google Analytics runs
                    restricted with no identifiers stored.
                  </span>
                </span>
                <Switch
                  {...(details ? { ref: firstControl } : {})}
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                  aria-label="Allow analytics tracking"
                />
              </label>
              <label className="flex items-start justify-between gap-4">
                <span className="text-sm">
                  <span className="font-medium text-foreground">Marketing</span>
                  <span className="block text-muted-foreground">
                    Advertising measurement on Meta and LinkedIn, plus our business visitor tool (RB2B).
                  </span>
                </span>
                <Switch
                  checked={marketing}
                  onCheckedChange={setMarketing}
                  aria-label="Allow marketing tracking"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Strictly necessary tooling — sign-in, security, saving this
                choice, and restricted traffic counts — always runs.
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end [&>button]:min-h-9 md:[&>button]:min-h-8">
          {slim ? (
            <>
              <Button
                ref={firstControl}
                variant="ghost"
                size="sm"
                onClick={() => setDetails(true)}
              >
                Manage
              </Button>
              <Button size="sm" onClick={dismissNotice}>
                Got it
              </Button>
            </>
          ) : (
            <>
              {!details && (
                <Button
                  ref={firstControl}
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetails(true)}
                >
                  Manage
                </Button>
              )}
              {/* Committed on pointer-DOWN as well as click. A consent choice
                  is not destructive, and this banner republishes its own
                  height while open — so the element under the cursor can move
                  between pointer-down and pointer-up and the choice is
                  silently lost, leaving the banner up and nothing written
                  (audit #7, TF7-03). `writeConsent` is idempotent, so the
                  follow-up click is harmless. */}
              {/* Focus used to land here when the panel opened — the third
                  control in tab order, past both toggles, so a keyboard user
                  met "Decline all" before they could see what they were
                  deciding about (audit #8, TF8-09). The panel focuses its
                  Analytics switch now. */}
              <Button
                variant="outline"
                size="sm"
                onPointerDown={rejectAll}
                onClick={rejectAll}
              >
                Decline all
              </Button>
              {details ? (
                <Button size="sm" onPointerDown={saveChoice} onClick={saveChoice}>
                  Save choice
                </Button>
              ) : (
                <Button size="sm" onPointerDown={acceptAll} onClick={acceptAll}>
                  Accept all
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Always dismissible: hides the bar without changing any tracking
          decision, so it can never sit on top of the primary action row. */}
      <button
        type="button"
        onClick={close}
        aria-label="Hide tracking notice"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:right-2 md:top-2 md:h-8 md:w-8"
      >
        <X className="h-4 w-4" />
      </button>
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
