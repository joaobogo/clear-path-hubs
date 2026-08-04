import { Check, Circle, Loader2 } from "lucide-react";

import { PreviewFrame } from "@/components/marketing/product-preview/preview-frame";
import { PREVIEW_ONBOARDING } from "@/lib/previews/representative-fixtures";

const STATE_META = {
  done: { Icon: Check, className: "border-primary/40 bg-primary/10 text-primary", label: "Done" },
  active: {
    Icon: Loader2,
    className: "border-primary bg-primary/15 text-primary",
    label: "In progress",
  },
  todo: {
    Icon: Circle,
    className: "border-border bg-background text-muted-foreground/70",
    label: "Next",
  },
} as const;

/**
 * Onboarding preview — what actually happens between "describe the role" and
 * "decide in the workspace", as a vertical timeline that works at every width.
 */
export function OnboardingPreview({ className }: { className?: string }) {
  return (
    <PreviewFrame
      title="Getting started"
      caption="From role brief to first decisions"
      className={className}
    >
      <ol className="space-y-3">
        {PREVIEW_ONBOARDING.map((step) => {
          const meta = STATE_META[step.state];
          const { Icon } = meta;
          return (
            <li key={step.label} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <span
                className={
                  "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border " +
                  meta.className
                }
              >
                <Icon
                  className={"h-3.5 w-3.5" + (step.state === "active" ? " animate-spin" : "")}
                  aria-hidden
                />
                <span className="sr-only">{meta.label}</span>
              </span>
              <div className="min-w-0">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{step.label}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{step.elapsed}</span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{step.detail}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {meta.label} · {step.owner}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </PreviewFrame>
  );
}
