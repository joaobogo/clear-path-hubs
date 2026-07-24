import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileText, Lightbulb, ShieldQuestion } from 'lucide-react';

export type EvidenceCardProps = {
  factualQuote: string;
  interpretation: string;
  validationNeed?: string | null;
  result?: string | null;
  confidence?: number | null; // 0..1
  sourceKind?: string | null;
  sourceLocator?: Record<string, unknown> | null;
  className?: string;
};

const resultTone: Record<string, string> = {
  strong: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  partial: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  weak: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  missing: 'bg-muted text-muted-foreground border-border',
  contradictory: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  not_applicable: 'bg-muted text-muted-foreground border-border',
  needs_validation: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

export function EvidenceCard({
  factualQuote,
  interpretation,
  validationNeed,
  result,
  confidence,
  sourceKind,
  sourceLocator,
  className,
}: EvidenceCardProps) {
  const loc = sourceLocator as { page?: number; section?: string } | null | undefined;
  const locBits: string[] = [];
  if (sourceKind) locBits.push(sourceKind.replace('_', ' '));
  if (loc?.page) locBits.push(`p. ${loc.page}`);
  if (loc?.section) locBits.push(loc.section);

  return (
    <Card className={cn('p-4 space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {result && (
          <Badge variant="outline" className={cn('capitalize', resultTone[result] ?? '')}>
            {result.replace(/_/g, ' ')}
          </Badge>
        )}
        {typeof confidence === 'number' && (
          <span className="text-muted-foreground">
            confidence {Math.round(confidence * 100)}%
          </span>
        )}
        {locBits.length > 0 && (
          <span className="text-muted-foreground">· {locBits.join(' · ')}</span>
        )}
      </div>

      {/* Source Fact — verbatim, treated as raw material */}
      <div className="rounded-md border-l-4 border-primary/40 bg-muted/30 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          <FileText className="h-3 w-3" /> Source fact
        </div>
        <blockquote className="text-sm italic text-foreground/90 leading-relaxed">
          "{factualQuote}"
        </blockquote>
      </div>

      {/* TaaSFlow Interpretation — distinct visual language */}
      <div className="rounded-md border border-dashed border-primary/30 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary">
          <Lightbulb className="h-3 w-3" /> TaaSFlow interpretation
        </div>
        <p className="text-sm text-foreground leading-relaxed">{interpretation}</p>
      </div>

      {/* Validation Need — only when there is one, never generic */}
      {validationNeed && validationNeed.trim() && (
        <div className="rounded-md bg-blue-500/5 border border-blue-500/20 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-blue-600">
            <ShieldQuestion className="h-3 w-3" /> Validate in interview
          </div>
          <p className="text-sm text-foreground leading-relaxed">{validationNeed}</p>
        </div>
      )}
    </Card>
  );
}
