import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { Award, ArrowRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  resurfaceForPosition,
  logReengagement,
  noteResurface,
  REASON_LABELS,
} from "@/lib/talent-memory.functions";

/**
 * Employer surfaces never show a raw number. Requirement overlap is expressed
 * as a qualitative band, consistent with fit bands elsewhere.
 */
function overlapLabel(score: number): string {
  if (score >= 80) return "Strong requirement overlap";
  if (score >= 55) return "Good requirement overlap";
  if (score >= 30) return "Partial requirement overlap";
  return "Some requirement overlap";
}


export function ResurfacePanel({
  orgId,
  positionId,
}: {
  orgId: string;
  positionId: string;
}) {
  const qc = useQueryClient();
  const resurfaceFn = useServerFn(resurfaceForPosition);
  const reengageFn = useServerFn(logReengagement);
  const noteFn = useServerFn(noteResurface);

  const { data, isPending } = useQuery({
    queryKey: ["talent-memory", "resurface", orgId, positionId],
    queryFn: () => resurfaceFn({ data: { orgId, positionId, limit: 8 } }),
  });

  const reengage = useMutation({
    mutationFn: (id: string) =>
      reengageFn({ data: { orgId, id, position_id: positionId } }),
    onSuccess: () => {
      toast.success("Re-engagement logged");
      qc.invalidateQueries({ queryKey: ["talent-memory"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const items = data?.candidates ?? [];

  const suggestions = useMemo(() => items.filter((r) => r.match_score > 0), [items]);

  if (isPending) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Loading talent memory…
      </div>
    );
  }
  if (suggestions.length === 0) return null;

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em]">
            <Award className="h-4 w-4 text-warning-strong" aria-hidden />
            From your talent memory
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Silver medalists whose profile overlaps with this role.
          </p>
        </div>
        <Link
          to="/client/talent-memory"
          className="text-xs text-primary hover:underline whitespace-nowrap"
        >
          View all
        </Link>
      </header>

      <ul className="divide-y">
        {suggestions.map((s) => {
          const m = s.memory;
          const revealedOne = revealed.has(m.id);
          return (
            <li key={m.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{m.candidate.display_name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {overlapLabel(s.match_score)}
                    </Badge>

                    <Badge variant="secondary" className="text-[10px]">
                      {REASON_LABELS[m.reason_category]}
                    </Badge>
                    {m.consent_status === "granted" && (
                      <Badge className="border-success/60 bg-success/60 text-success text-[10px]">
                        consent granted
                      </Badge>
                    )}
                  </div>
                  {m.candidate.headline && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {m.candidate.headline}
                    </p>
                  )}
                  {m.role_title_snapshot && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Previously considered for{" "}
                      <span className="font-medium text-foreground">
                        {m.role_title_snapshot}
                      </span>
                    </p>
                  )}
                  {revealedOne && s.overlap_skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.overlap_skills.slice(0, 8).map((sk) => (
                        <Badge
                          key={sk}
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {sk}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {!revealedOne ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRevealed((prev) => new Set(prev).add(m.id));
                        noteFn({
                          data: { orgId, id: m.id, position_id: positionId },
                        }).catch(() => {});
                      }}
                    >
                      Reveal
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reengage.mutate(m.id)}
                      disabled={reengage.isPending}
                    >
                      <RotateCw className="mr-1 h-3 w-3" />
                      Re-engage
                    </Button>
                  )}
                  <Link
                    to="/client/talent-memory"
                    search={{ id: m.id }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Open <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
