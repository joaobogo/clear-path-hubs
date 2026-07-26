import type { ReactNode } from "react";
import { Lock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StateViewProps {
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

/**
 * Shown when the signed-in user is authenticated but not allowed to see the
 * resource. Never leaks whether the resource exists.
 */
export function PermissionState({
  title = "You don't have access to this",
  description = "Ask a workspace admin to grant you access, or switch to an area you own.",
  action,
  secondaryAction,
  className,
}: Partial<StateViewProps>) {
  return (
    <div
      role="status"
      className={cn(
        "ws-surface flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Lock aria-hidden className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/** Confirmation surface after a completed flow (application sent, offer accepted). */
export function SuccessState({
  title,
  description,
  action,
  secondaryAction,
  className,
}: StateViewProps) {
  return (
    <div
      role="status"
      className={cn(
        "ws-surface ws-enter flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
      style={{ boxShadow: "inset 0 0 0 1px var(--taas-accent-brass-line), var(--taas-shadow-2)" }}
    >
      <div
        className="mb-4 grid h-12 w-12 place-items-center rounded-full"
        style={{
          backgroundColor: "var(--taas-accent-brass-soft)",
          color: "var(--taas-accent-brass-strong)",
        }}
      >
        <CheckCircle2 aria-hidden className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
