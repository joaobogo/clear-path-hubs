import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronDown } from "lucide-react";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import {
  buildRoleComparison,
  ROLE_COMPARE_MAX,
  type RoleCompareRow,
} from "@/lib/client-compare";

function CompareRow({
  row,
  columns,
}: {
  row: RoleCompareRow;
  columns: Array<{ matchId: string }>;
}) {
  return (
    <div className="border-t py-3 first:border-t-0">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {row.label}
      </div>
      <div
        className="mt-1.5 grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }}
      >
        {row.values.map((v) => (
          <div key={v.matchId} className="min-w-0 text-xs leading-relaxed">
            {v.lines.length === 1 ? (
              <span className="break-words">{v.lines[0]}</span>
            ) : (
              <ul className="space-y-0.5">
                {v.lines.map((line, i) => (
                  <li key={i} className="break-words">
                    · {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Two- or three-column comparison for one role. Same fields for each
 * candidate, no scores, no ranking, no recommended winner.
 */
export function RoleComparePanel({
  open,
  onOpenChange,
  candidates,
  isLoading = false,
  error = null,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidates: ClientCandidateDTO[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const [showSame, setShowSame] = useState(false);
  const comparison = useMemo(() => buildRoleComparison(candidates), [candidates]);
  const cols = comparison.columns;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Compare candidates</SheetTitle>
          <SheetDescription>
            Up to {ROLE_COMPARE_MAX} candidates, side by side. Differences first.
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden />
              <div>
                <p className="text-sm font-medium">Comparison unavailable</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  We could not load these candidates just now.
                </p>
                {onRetry && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
                    Retry
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div
            className="mt-4 grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.max(2, cols.length || 2)}, minmax(0, 1fr))` }}
            aria-busy="true"
          >
            {Array.from({ length: Math.max(2, cols.length || 2) }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-10/12" />
                <Skeleton className="h-3 w-9/12" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div
              className="sticky top-0 z-10 mt-4 grid gap-3 border-b bg-background/95 py-3 backdrop-blur"
              style={{ gridTemplateColumns: `repeat(${Math.max(1, cols.length)}, minmax(0, 1fr))` }}
            >
              {cols.map((c) => (
                <div key={c.matchId} className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  {c.subtitle && (
                    <div className="truncate text-xs text-muted-foreground">{c.subtitle}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-1">
              {comparison.differing.map((row) => (
                <CompareRow key={row.key} row={row} columns={cols} />
              ))}
              {comparison.differing.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  These candidates read the same on every compared field.
                </p>
              )}
            </div>

            {comparison.identical.length > 0 && (
              <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                <button
                  type="button"
                  onClick={() => setShowSame((v) => !v)}
                  aria-expanded={showSame}
                  className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium"
                >
                  <span>Same for all ({comparison.identical.length})</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${showSame ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {showSame && (
                  <div className="mt-2 space-y-2">
                    {comparison.identical.map((row) => (
                      <div key={row.key} className="text-xs">
                        <span className="font-medium">{row.label}: </span>
                        <span className="text-muted-foreground">
                          {row.values[0]?.lines.join(", ")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
