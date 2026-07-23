import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  tone?: "neutral" | "positive" | "info";
  className?: string;
}

const TONE = {
  neutral: {
    bg: "bg-card/40",
    ring: "bg-muted text-muted-foreground",
  },
  positive: {
    bg: "bg-gradient-to-br from-primary/5 via-card/40 to-card/40",
    ring: "bg-primary/10 text-primary",
  },
  info: {
    bg: "bg-gradient-to-br from-secondary/40 via-card/40 to-card/40",
    ring: "bg-secondary text-secondary-foreground",
  },
} as const;

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  const t = TONE[tone];
  return (
    <div
      role="status"
      className={cn(
        "taas-motion-surface flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center",
        t.bg,
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mb-4 grid h-12 w-12 place-items-center rounded-full",
            t.ring,
          )}
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {(action || secondaryAction) ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
