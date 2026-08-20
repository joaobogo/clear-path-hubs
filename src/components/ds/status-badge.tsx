import { cva, type VariantProps } from "class-variance-authority";
import { Check, X, Clock, AlertTriangle, ArrowRight, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveStatus, type StatusGlyph, type StatusTone } from "@/lib/status-system";

const badge = cva(
  "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
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

const GLYPH_ICON = {
  check: Check,
  cross: X,
  clock: Clock,
  alert: AlertTriangle,
  arrow: ArrowRight,
  pause: Pause,
} as const;

const DOT_COLOR: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground/60",
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {
  /**
   * Canonical status key (e.g. "shortlisted", "processing"). When set, the
   * tone, label and glyph all come from the shared status registry.
   */
  status?: string | null;
  /** Candidate screens get plain-language labels from the same registry. */
  audience?: "internal" | "candidate";
  /** Redundant non-colour mark. Defaults to the registry glyph, or a dot. */
  glyph?: StatusGlyph | "none";
  dot?: boolean;
}

export function StatusBadge({
  tone,
  status,
  audience,
  glyph,
  dot = true,
  className,
  children,
  ...rest
}: StatusBadgeProps) {
  const resolved = status ? resolveStatus(status, { audience }) : null;
  const finalTone: StatusTone = (tone as StatusTone) ?? resolved?.tone ?? "neutral";
  const finalGlyph: StatusGlyph | "none" =
    glyph ?? resolved?.glyph ?? (dot ? "dot" : "none");
  const label = children ?? resolved?.label ?? null;
  const Icon = finalGlyph !== "none" && finalGlyph !== "dot" ? GLYPH_ICON[finalGlyph] : null;

  return (
    <span
      className={cn(badge({ tone: finalTone }), className)}
      title={resolved?.description}
      {...rest}
    >
      {Icon ? <Icon aria-hidden className="h-3 w-3 shrink-0" /> : null}
      {!Icon && finalGlyph === "dot" ? (
        <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_COLOR[finalTone])} />
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  );
}
