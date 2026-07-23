import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Canonical dashboard card. All workspace cards (action-required, candidate,
 * position, interview, message, activity) should compose this primitive so
 * padding, radius, elevation, hover, and focus behavior stay consistent.
 *
 * Rules enforced by this component:
 * - single border (border-border), no double outlines
 * - single elevation ramp via --shadow-elevation-1/-2 (no ad-hoc shadow-lg)
 * - equal comparable heights via h-full when used in a grid
 * - single primary click target when `to` or `onClick` is provided
 * - visible focus ring via focus-visible tokens
 * - 44px touch target respected by min-h on interactive variant
 */

type BaseProps = {
  className?: string;
  /** Renders as a Link — the entire card becomes the single primary target. */
  to?: string;
  /** Search params for the Link. Ignored when `to` is unset. */
  search?: Record<string, unknown>;
  /** Alternate click behavior when not navigating. */
  onClick?: () => void;
  /** Loading skeleton (blocks content). */
  loading?: boolean;
  /** Error state (shows fallback with retry). */
  error?: { message: string; onRetry?: () => void };
  /** Tone accents the left edge; use sparingly. */
  tone?: "default" | "attention" | "success" | "danger";
  children?: ReactNode;
};

const toneAccent: Record<NonNullable<BaseProps["tone"]>, string> = {
  default: "",
  attention: "before:bg-warning/70",
  success: "before:bg-success/70",
  danger: "before:bg-destructive/70",
};

export function DashboardCard({
  className,
  to,
  search,
  onClick,
  loading,
  error,
  tone = "default",
  children,
}: BaseProps) {
  const interactive = Boolean(to || onClick);
  const base = cn(
    "group relative flex h-full flex-col rounded-xl border border-border bg-card p-5",
    "shadow-[var(--shadow-elevation-1)] transition-all",
    tone !== "default" &&
      "before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full",
    tone !== "default" && toneAccent[tone],
    interactive &&
      "min-h-11 hover:border-primary/30 hover:shadow-[var(--shadow-elevation-2)] focus-within:border-primary/40",
    className,
  );

  if (loading) {
    return (
      <div className={cn(base, "animate-pulse")} aria-busy="true" aria-live="polite">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="mt-4 h-6 w-1/2 rounded bg-muted" />
        <div className="mt-3 h-3 w-2/3 rounded bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={base} role="alert">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Couldn't load this section</p>
            <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
            {error.onRetry ? (
              <button
                type="button"
                onClick={error.onRetry}
                className="mt-3 inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (to) {
    return (
      <Link
        to={to}
        search={search as never}
        className={cn(
          base,
          "outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          base,
          "text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        {children}
      </button>
    );
  }

  return <div className={base}>{children}</div>;
}

/* ----------------------------- Sub-slots ----------------------------- */

export function CardHeader({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-3",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  as: As = "h3",
  ...rest
}: ComponentPropsWithoutRef<"h3"> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <As
      className={cn(
        "min-w-0 truncate text-sm font-semibold text-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

export function CardEyebrow({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </p>
  );
}

export function CardBody({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("mt-3 min-w-0 flex-1 space-y-2 text-sm", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "mt-4 flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardChevron() {
  return (
    <ChevronRight
      className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
      aria-hidden
    />
  );
}
