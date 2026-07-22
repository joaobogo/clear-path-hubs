import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground ring-border",
        success: "bg-success-soft text-success ring-success/20",
        warning: "bg-warning-soft text-warning-foreground ring-warning/30",
        danger: "bg-danger-soft text-destructive ring-destructive/20",
        info: "bg-info-soft text-info ring-info/20",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {
  dot?: boolean;
}

export function StatusBadge({ tone, dot = true, className, children, ...rest }: StatusBadgeProps) {
  return (
    <span className={cn(badge({ tone }), className)} {...rest}>
      {dot ? (
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "danger" && "bg-destructive",
            tone === "info" && "bg-info",
            (!tone || tone === "neutral") && "bg-muted-foreground/60",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
