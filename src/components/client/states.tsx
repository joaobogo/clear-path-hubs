import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Inbox, AlertTriangle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Deliberate empty / loading / permission states for every client surface.
 * Rules:
 *  - An empty state explains what will appear here and offers the next step.
 *  - A skeleton matches the shape of the final layout.
 *  - A permission-denied state explains who to ask — never a blank card or raw error.
 */

type Action = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
};

function ActionButton({ action, size = "sm" }: { action: Action; size?: "sm" | "default" }) {
  if (action.to) {
    return (
      <Button asChild size={size} variant={action.variant ?? "default"}>
        <Link to={action.to}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button size={size} variant={action.variant ?? "default"} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  whatAppearsHere,
  action,
  secondaryAction,
  className,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  /** One plain line: what this surface is for. */
  description: string;
  /** What will show up here once work happens. */
  whatAppearsHere?: string;
  action?: Action;
  secondaryAction?: Action;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center rounded-xl border bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </span>
      <h3 className="mt-4 text-base font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {whatAppearsHere && (
        <p className="mt-2 text-xs text-muted-foreground">{whatAppearsHere}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && <ActionButton action={action} />}
          {secondaryAction && (
            <ActionButton action={{ variant: "outline", ...secondaryAction }} />
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function PermissionDenied({
  title = "You don't have access to this yet",
  description,
  whoToAsk = "Ask a workspace owner or admin on your team to grant you access — they can change your role in Team settings.",
  action,
}: {
  title?: string;
  description?: string;
  whoToAsk?: string;
  action?: Action;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </span>
      <h3 className="mt-4 text-base font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <p className="mt-2 text-sm text-muted-foreground">{whoToAsk}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <ActionButton action={action ?? { label: "Open Team settings", to: "/client/team" }} />
        <Button asChild size="sm" variant="outline">
          <Link to="/client/conversations">Message your recruiter</Link>
        </Button>
      </div>
    </div>
  );
}

export function NoWorkspaceState() {
  return (
    <EmptyState
      icon={Building2}
      title="No workspace selected"
      description="Pick a workspace to see its roles, candidates, and decisions."
      whatAppearsHere="If you were just invited, your access may still be pending."
      action={{ label: "Go to dashboard", to: "/client" }}
      secondaryAction={{ label: "Message your recruiter", to: "/client/conversations" }}
    />
  );
}

export function ErrorState({
  title = "We couldn't load this",
  description = "Nothing is lost — this is a temporary problem on our side.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
      </span>
      <h3 className="mt-4 text-base font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/client/conversations">Tell your recruiter</Link>
        </Button>
      </div>
    </div>
  );
}

/* ---------- Skeletons that match the final layouts ---------- */

export function SkeletonRows({
  rows = 4,
  height = "h-16",
}: {
  rows?: number;
  height?: string;
}) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn("rounded-lg border bg-card p-4", height)}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonBoard({ columns = 6 }: { columns?: number }) {
  return (
    <div
      className="grid gap-3 sm:min-w-[1100px]"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 2 }).map((_, r) => (
            <div key={r} className="space-y-2 rounded-lg border bg-card p-3">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-6 w-full rounded-md" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: tiles }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
