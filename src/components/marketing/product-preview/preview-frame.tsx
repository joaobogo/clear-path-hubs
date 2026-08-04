import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { REPRESENTATIVE_LABEL, REPRESENTATIVE_NOTICE } from "@/lib/previews/representative-fixtures";

/**
 * Shared chrome for every public product preview.
 *
 * One frame, one label: any preview rendered on the marketing site carries the
 * "Representative data" chip and the same explanatory notice, so a visitor can
 * never read a preview as a live account.
 */
export function PreviewFrame({
  title,
  caption,
  children,
  footer,
  className,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={
        "min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm " +
        (className ?? "")
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex shrink-0 gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            </span>
            <span className="truncate text-xs font-semibold text-foreground">{title}</span>
          </div>
          {caption ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{caption}</p>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          {REPRESENTATIVE_LABEL}
        </span>
      </div>

      <div className="p-3 sm:p-4">{children}</div>

      <figcaption className="border-t border-border/60 bg-muted/20 px-3 py-2 text-[11px] leading-snug text-muted-foreground sm:px-4">
        {footer ?? REPRESENTATIVE_NOTICE}
      </figcaption>
    </figure>
  );
}
