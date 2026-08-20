import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { bandToTier, classifyBand } from "@/lib/scoring/bands";

/**
 * TaaSFlow branded score visual. VISUAL ONLY — does not compute, transform,
 * or override the provided value. Consumers pass the canonical 0–100 fit
 * score directly from the scoring engine. The band comes from the canonical
 * band table (src/lib/scoring/bands.ts) and is used only to pick a token
 * color, never to relabel or re-derive recommendation.
 */

export type ScoreBand = "excellent" | "strong" | "moderate" | "weak" | "poor";

export function bandForScore(score: number | null | undefined): ScoreBand | null {
  return bandToTier(classifyBand(score));
}

const bandColor: Record<ScoreBand, string> = {
  excellent: "var(--taas-score-excellent)",
  strong: "var(--taas-score-strong)",
  moderate: "var(--taas-score-moderate)",
  weak: "var(--taas-score-weak)",
  poor: "var(--taas-score-poor)",
};

const bandLabel: Record<ScoreBand, string> = {
  excellent: "Excellent fit",
  strong: "Strong fit",
  moderate: "Moderate fit",
  weak: "Developing",
  poor: "Low fit",
};

export interface ScoreDisplayProps {
  /** 0–100 fit score from the scoring engine. Passed through unchanged. */
  score: number | null | undefined;
  /** Optional label override; defaults to band label. */
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "ring" | "bar" | "chip";
  className?: string;
  /** Rendered when score is null/undefined (e.g. not yet scored). */
  fallback?: ReactNode;
}

export function ScoreDisplay({
  score,
  label,
  size = "md",
  variant = "ring",
  className,
  fallback,
}: ScoreDisplayProps) {
  const band = bandForScore(score);
  if (band === null || score === null || score === undefined) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground",
          className,
        )}
      >
        {fallback ?? "Not scored"}
      </span>
    );
  }
  const rounded = Math.round(score);
  const color = bandColor[band];
  const displayLabel = label ?? bandLabel[band];

  if (variant === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
          className,
        )}
        style={{
          backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
          color,
          boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 30%, transparent)`,
        }}
        aria-label={`${displayLabel}: ${rounded}`}
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="tabular-nums">{rounded}</span>
        <span className="opacity-80">· {displayLabel}</span>
      </span>
    );
  }

  if (variant === "bar") {
    const pct = Math.max(0, Math.min(100, rounded));
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums text-foreground">{rounded}</span>
          <span className="text-xs text-muted-foreground">{displayLabel}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${displayLabel}: ${rounded}`}
          className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full transition-[width]"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    );
  }

  // ring
  const dims = size === "sm" ? 44 : size === "lg" ? 72 : 56;
  const stroke = size === "sm" ? 4 : size === "lg" ? 6 : 5;
  const radius = (dims - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const dash = (rounded / 100) * circ;

  return (
    <div
      className={cn("inline-flex items-center gap-3", className)}
      aria-label={`${displayLabel}: ${rounded}`}
    >

      <svg width={dims} height={dims} viewBox={`0 0 ${dims} ${dims}`} aria-hidden>
        <circle
          cx={dims / 2}
          cy={dims / 2}
          r={radius}
          fill="none"
          stroke="var(--taas-surface-muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={dims / 2}
          cy={dims / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(-90 ${dims / 2} ${dims / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-foreground"
          fontSize={size === "lg" ? 20 : size === "sm" ? 13 : 16}
          fontWeight={600}
        >
          {rounded}
        </text>
      </svg>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{displayLabel}</div>
        <div className="text-xs text-muted-foreground">Fit score</div>
      </div>
    </div>
  );
}
