/**
 * Canonical candidate score presentation for employer surfaces: the approved
 * score out of 100, plus the unicorn marker for a 95+ score or a confirmed hire.
 * One component so every card, board and profile header reads the same.
 */
type Props = {
  score: number | null | undefined;
  unicorn?: boolean;
  className?: string;
};

export function UnicornBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ${className}`}
      title="Unicorn — top-tier match (95+ score or hired)"
    >
      <span aria-hidden>🦄</span>
      Unicorn
    </span>
  );
}

export function CandidateScoreBadge({ score, unicorn = false, className = "" }: Props) {
  if (score == null && !unicorn) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {score != null && (
        <span className="inline-flex items-baseline gap-0.5 rounded-full border bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums">
          {Math.round(score)}
          <span className="text-[9px] font-normal text-muted-foreground">/100</span>
        </span>
      )}
      {unicorn && <UnicornBadge />}
    </span>
  );
}
