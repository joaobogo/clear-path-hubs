import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PublicEmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--brand-navy)]/15 bg-white/60 px-6 py-14 text-center",
        className,
      )}
      role="status"
    >
      {icon ? (
        <div className="mb-4 text-[color:var(--brand-navy)]/60" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-semibold text-[color:var(--brand-navy)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-[color:var(--brand-navy)]/70">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
