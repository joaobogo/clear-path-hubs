import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PublicPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-10 sm:mb-14", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl lg:text-5xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-4 max-w-2xl text-base text-[color:var(--brand-navy)]/75 sm:text-lg">
          {description}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}
