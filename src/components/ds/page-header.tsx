import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-border pb-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {breadcrumb ? <div className="text-xs text-muted-foreground">{breadcrumb}</div> : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-6 space-y-6", className)}>{children}</div>;
}

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 lg:px-8",
        "max-w-[var(--page-max-w)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
