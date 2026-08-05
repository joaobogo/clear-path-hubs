import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import {
  dismissGapKey,
  profileGaps,
  readDismissedGapKeys,
  type ProfileGap,
} from "@/lib/candidate/profile-gaps";

/**
 * "Finish these three things" — outcome-tied profile prompts.
 * No percentage, no badges: each row states the consequence and deep-links
 * to the exact field. Errors hide the block instead of showing it broken.
 */
export function ProfileGapsBlock({
  profile,
  loading = false,
  error = false,
}: {
  profile: Record<string, unknown> | null | undefined;
  loading?: boolean;
  error?: boolean;
}) {
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  useEffect(() => {
    setDismissed(readDismissedGapKeys());
  }, []);

  if (error) return null;

  if (loading || dismissed === null) {
    return (
      <section className="rounded-2xl border bg-card p-5" aria-hidden>
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-2">
          <div className="h-14 animate-pulse rounded-lg bg-muted" />
          <div className="h-14 animate-pulse rounded-lg bg-muted" />
        </div>
      </section>
    );
  }

  let gaps: ProfileGap[] = [];
  try {
    gaps = profileGaps(profile, dismissed);
  } catch {
    return null;
  }

  if (gaps.length === 0) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Check className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Your profile is complete</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing is missing that affects matching or scheduling.{" "}
              <Link to="/me/profile" className="underline underline-offset-2 text-foreground">
                Review your profile
              </Link>{" "}
              any time.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-base font-semibold">
        {gaps.length === 1 ? "Finish this one thing" : `Finish these ${gaps.length === 2 ? "two" : "three"} things`}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Each one changes whether you show up in searches or can be scheduled.
      </p>
      <ul className="mt-4 space-y-2">
        {gaps.map((g) => (
          <li key={g.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
            <Link
              to="/me/profile"
              search={{ field: g.fieldId }}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-3 min-h-11 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{g.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{g.reason}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            <button
              type="button"
              aria-label={`Dismiss: ${g.label}`}
              onClick={() => {
                dismissGapKey(g.key);
                setDismissed(readDismissedGapKeys());
              }}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
