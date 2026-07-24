import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

export type CriterionRowProps = {
  criterionLabel: string;
  weight?: number | null;
  result?: string | null;
  confidence?: number | null; // 0..1
  numericScore?: number | null; // gated by caller (admin/staff only)
  showNumeric?: boolean;
  active?: boolean;
  onSelect?: () => void;
};

const resultDot: Record<string, string> = {
  strong: 'bg-emerald-500',
  partial: 'bg-amber-500',
  weak: 'bg-orange-500',
  missing: 'bg-muted-foreground/40',
  contradictory: 'bg-rose-500',
  not_applicable: 'bg-muted-foreground/30',
  needs_validation: 'bg-blue-500',
};

export function CriterionRow({
  criterionLabel,
  weight,
  result,
  confidence,
  numericScore,
  showNumeric = false,
  active = false,
  onSelect,
}: CriterionRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors',
        active ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/40',
      )}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', resultDot[result ?? ''] ?? 'bg-muted-foreground/30')} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{criterionLabel}</span>
        <span className="block text-xs text-muted-foreground">
          {result ? result.replace(/_/g, ' ') : 'no result'}
          {typeof weight === 'number' && ` · weight ${weight}`}
          {typeof confidence === 'number' && ` · ${Math.round(confidence * 100)}% conf`}
        </span>
      </span>
      {showNumeric && typeof numericScore === 'number' && (
        <Badge variant="outline" className="tabular-nums">{numericScore}</Badge>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
