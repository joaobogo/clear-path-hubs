import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Briefcase,
  Bell,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Filter,
  FileSearch,
  Info,
  Loader2,
  MessageSquare,
  Plug,
  ScrollText,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  SurfaceAction,
  SurfaceIconName,
  SurfaceStateContent,
} from "@/lib/empty-states/empty-state-catalogue";

const ICONS: Record<SurfaceIconName, React.ComponentType<{ className?: string }>> = {
  roles: Briefcase,
  candidates: Users,
  evidence: FileSearch,
  agents: BrainCircuit,
  analytics: Sparkles,
  integrations: Plug,
  messages: MessageSquare,
  approvals: CheckCircle2,
  audit: ScrollText,
  notifications: Bell,
  outcomes: Trophy,
  filters: Filter,
};

const TONE = {
  expected: {
    ring: "bg-muted text-muted-foreground",
    badge: "text-muted-foreground",
    Icon: Info,
  },
  waiting: {
    ring: "bg-primary/10 text-primary",
    badge: "text-primary",
    Icon: Clock,
  },
  attention: {
    ring: "taas-bg-warning-soft taas-tx-warning",
    badge: "taas-tx-warning",
    Icon: AlertTriangle,
  },
} as const;

function ActionBtn({
  action,
  onClick,
  variant = "default",
}: {
  action: SurfaceAction;
  onClick?: () => void;
  variant?: "default" | "outline";
}) {
  if (action.to && !onClick) {
    return (
      <Button asChild size="sm" variant={variant}>
        <Link to={action.to} search={action.search as never}>
          {action.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button size="sm" variant={variant} onClick={onClick} disabled={!onClick}>
      {action.label}
    </Button>
  );
}

/**
 * The single presentation for every "nothing to show" state in the product.
 * It always answers: why it's empty, whether that's expected, what will fill it,
 * what the system is doing right now, and the one next action.
 */
export function SurfaceState({
  content,
  onAction,
  onSecondaryAction,
  compact = false,
  className,
}: {
  content: SurfaceStateContent;
  /** Provide when the primary action is a callback rather than a route. */
  onAction?: () => void;
  onSecondaryAction?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const Icon = ICONS[content.icon];
  const tone = TONE[content.tone];
  const ToneIcon = tone.Icon;

  return (
    <div
      role="status"
      aria-live="polite"
      data-surface-state={content.id}
      className={cn(
        "mx-auto w-full max-w-xl rounded-2xl border border-dashed bg-card/50 text-left",
        compact ? "p-5" : "p-6 sm:p-8",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            tone.ring,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{content.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{content.why}</p>
        </div>
      </div>

      <dl className={cn("mt-4 grid gap-2 text-sm", compact ? "" : "sm:grid-cols-2")}>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</dt>
          <dd className={cn("mt-0.5 flex items-start gap-1.5 text-[13px]", tone.badge)}>
            <ToneIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{content.expected}</span>
          </dd>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Right now
          </dt>
          <dd className="mt-0.5 text-[13px] text-foreground/90">{content.activity}</dd>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2 sm:col-span-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            What fills this
          </dt>
          <dd className="mt-0.5 text-[13px] text-foreground/90">{content.populates}</dd>
        </div>
        {content.eta ? (
          <div className="rounded-lg bg-muted/40 px-3 py-2 sm:col-span-2">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Typical timing
            </dt>
            <dd className="mt-0.5 text-[13px] text-foreground/90">{content.eta}</dd>
          </div>
        ) : null}
      </dl>

      {content.action || content.secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {content.action ? <ActionBtn action={content.action} onClick={onAction} /> : null}
          {content.secondaryAction ? (
            <ActionBtn
              action={content.secondaryAction}
              onClick={onSecondaryAction}
              variant="outline"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Consistent loading shell for the same slots the empty state occupies. */
export function SurfaceLoading({
  label = "Loading",
  compact = false,
  className,
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "mx-auto w-full max-w-xl rounded-2xl border border-dashed bg-card/50",
        compact ? "p-5" : "p-6 sm:p-8",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
        </span>
        <div className="flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg sm:col-span-2" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
