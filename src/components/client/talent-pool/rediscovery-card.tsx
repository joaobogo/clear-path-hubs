import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Trash2,
  MapPin,
  Clock,
  Star,
  BookmarkPlus,
  ArrowUpRight,
} from "lucide-react";
import {
  addToPool,
  removeFromPool,
  toggleGoodForFuture,
  type RediscoveryCandidateDTO,
  type TalentPoolDTO,
} from "@/lib/talent-pool.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function RediscoveryCard({
  candidate,
  orgId,
  pools,
  activePoolId,
  readOnly,
}: {
  candidate: RediscoveryCandidateDTO;
  orgId: string;
  pools: TalentPoolDTO[];
  activePoolId: string | null;
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const addFn = useServerFn(addToPool);
  const removeFn = useServerFn(removeFromPool);
  const gffFn = useServerFn(toggleGoodForFuture);

  const addTo = useMutation({
    mutationFn: (poolId: string) =>
      addFn({
        data: {
          orgId,
          poolId,
          candidate_profile_ids: [candidate.candidate_profile_id],
        },
      }),
    onSuccess: () => {
      toast.success("Added to pool");
      qc.invalidateQueries({ queryKey: ["talent-pool"] });
    },
    onError: (e: Error) => toastError(e),
  });
  const removeFromActive = useMutation({
    mutationFn: (poolId: string) =>
      removeFn({
        data: {
          orgId,
          poolId,
          candidate_profile_id: candidate.candidate_profile_id,
        },
      }),
    onSuccess: () => {
      toast.success("Removed from pool");
      qc.invalidateQueries({ queryKey: ["talent-pool"] });
    },
    onError: (e: Error) => toastError(e),
  });
  const gff = useMutation({
    mutationFn: () =>
      gffFn({
        data: {
          orgId,
          candidate_profile_id: candidate.candidate_profile_id,
          on: !candidate.is_good_for_future,
        },
      }),
    onSuccess: () => {
      toast.success(
        candidate.is_good_for_future
          ? "Removed from Good for future"
          : "Marked good for future role",
      );
      qc.invalidateQueries({ queryKey: ["talent-pool"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const stageLabel = candidate.last_stage?.replace(/_/g, " ") ?? "—";
  const days = Math.max(
    1,
    Math.round(
      (Date.now() - new Date(candidate.last_activity_at).getTime()) / 86400_000,
    ),
  );

  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{candidate.display_name}</p>
          {candidate.headline && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {candidate.headline}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-1">
          {candidate.is_silver && (
            <Badge className="border-amber-300/60 bg-amber-100/60 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 text-[10px]">
              <Star className="mr-0.5 h-2.5 w-2.5" /> silver
            </Badge>
          )}
          {candidate.is_good_for_future && (
            <Badge className="border-primary/40 bg-primary/10 text-primary text-[10px]">
              <Sparkles className="mr-0.5 h-2.5 w-2.5" /> future
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {candidate.seniority && <span>{candidate.seniority}</span>}
        {candidate.location && (
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="h-3 w-3" /> {candidate.location}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5">
          <Clock className="h-3 w-3" /> {days}d ago
        </span>
      </div>

      {candidate.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {candidate.skills.slice(0, 6).map((s) => (
            <Badge key={s} variant="outline" className="text-[10px] font-normal">
              {s}
            </Badge>
          ))}
          {candidate.skills.length > 6 && (
            <span className="text-[10px] text-muted-foreground">
              +{candidate.skills.length - 6}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 rounded-md border bg-muted/30 px-2.5 py-1.5 text-[11px]">
        Last role:{" "}
        <span className="font-medium">
          {candidate.last_role_title ?? "Untitled"}
        </span>{" "}
        · stage <span className="capitalize">{stageLabel}</span>
        {candidate.match_count > 1 && ` · seen ${candidate.match_count}×`}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          disabled={readOnly || gff.isPending}
          onClick={() => gff.mutate()}
        >
          <Sparkles className="h-3 w-3" />
          {candidate.is_good_for_future ? "In future" : "Good for future"}
        </Button>

        {!readOnly && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                <BookmarkPlus className="h-3 w-3" /> Add to pool
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              {pools.filter((p) => !p.is_system).length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">
                  No custom pools yet. Create one from the sidebar.
                </p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {pools
                    .filter((p) => !p.is_system)
                    .map((p) => {
                      const inPool = candidate.pool_ids.includes(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                            onClick={() =>
                              inPool
                                ? removeFromActive.mutate(p.id)
                                : addTo.mutate(p.id)
                            }
                          >
                            <span>{p.name}</span>
                            {inPool && <span className="text-primary">✓</span>}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              )}
            </PopoverContent>
          </Popover>
        )}

        {activePoolId && !readOnly && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => removeFromActive.mutate(activePoolId)}
          >
            <Trash2 className="h-3 w-3" /> Remove
          </Button>
        )}

        {candidate.last_position_id && (
          <Link
            to="/client/positions/$id"
            params={{ id: candidate.last_position_id }}
            className="ml-auto inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
          >
            View role <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </li>
  );
}
