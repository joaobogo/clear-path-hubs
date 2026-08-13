/**
 * The figure, never bare.
 *
 * `ScoreRing` draws a 0-100 value as a ring. It is deliberately not exported
 * for standalone use with a raw number: `EvidencedScore` is the only public
 * surface, and it requires the `EvidencedNumber` contract — value, label,
 * criteria line, method label and a path to the evidence.
 */
import { Link } from "@tanstack/react-router";
import type { EvidencedNumber } from "@/lib/scoring/evidenced-number";
import type { FitPresentation } from "@/lib/client-fit-presentation";

const RING: Record<FitPresentation["accent"], string> = {
  emerald: "text-success",
  sky: "text-info",
  amber: "text-warning-strong",
  slate: "text-muted-foreground",
  rose: "text-destructive",
};

export function ScoreRing({
  value,
  label,
  accent = "slate",
  size = 56,
}: {
  value: number;
  /** How to read the figure, e.g. "Fit". Rendered inside the ring. */
  label: string;
  accent?: FitPresentation["accent"];
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${RING[accent]}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[13px] font-semibold tabular-nums">{clamped}</span>
        <span className="text-[8px] uppercase tracking-wide opacity-70">{label}</span>
      </span>
    </span>
  );
}

/**
 * A figure with everything a reader needs to trust it. `matchId` is required so
 * the evidence path always resolves to a real destination.
 */
export function EvidencedScore({
  number,
  accent = "slate",
  matchId,
  org,
  className = "",
}: {
  number: EvidencedNumber;
  accent?: FitPresentation["accent"];
  matchId: string;
  org?: string | null;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <ScoreRing value={number.value} label={number.label} accent={accent} />
      <div className="min-w-0 text-xs">
        <p className="font-medium text-foreground">
          {number.label} {Math.round(number.value)}
        </p>

        <p className="mt-0.5 text-muted-foreground line-clamp-2">{number.criteria_summary}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">{number.method_label}</p>
        {number.caveat && (
          <p className="mt-0.5 text-[11px] text-warning-strong line-clamp-2">{number.caveat}</p>
        )}
        <Link
          to="/client/candidates/$id"
          params={{ id: matchId }}
          search={org ? { org } : undefined}
          hash="sec-coverage"
          className="mt-1 inline-flex min-h-6 items-center text-[11px] font-medium text-primary underline underline-offset-2 hover:text-primary/80"
        >
          See the evidence
        </Link>
      </div>
    </div>
  );
}
