import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  getRoleFitFromPool,
  listRoleFitPositions,
  type RoleFitCandidateDTO,
} from "@/lib/role-fit.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Recycle, CalendarClock, MapPin, ArrowUpRight, Layers } from "lucide-react";
import { agoLabel } from "@/lib/format/relative-date";
import { formatDate } from "@/lib/format/datetime";

function screenedAgo(iso: string): string {
  return agoLabel(iso);
}

function fmtDate(iso: string): string {
  return formatDate(iso);
}

function FitCard({ c, orgId }: { c: RoleFitCandidateDTO; orgId?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{c.display_name}</p>
          {c.headline ? (
            <p className="text-sm text-muted-foreground">{c.headline}</p>
          ) : null}
        </div>
        <Badge variant="secondary" className="gap-1">
          <CalendarClock className="h-3 w-3" />
          Screened {screenedAgo(c.screened_at)}
        </Badge>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Screened on {fmtDate(c.screened_at)}
        {c.screened_for_title ? ` for ${c.screened_for_title}` : ""}
        {c.furthest_stage ? ` · reached ${c.furthest_stage}` : ""}
      </p>

      <ul className="mt-3 space-y-1 text-sm">
        {c.reasons.map((r, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted-foreground">·</span>
            <span>{r.label}</span>
          </li>
        ))}
      </ul>

      {c.matched_requirements.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {c.matched_requirements.slice(0, 6).map((r) => (
            <Badge key={r} variant="outline" className="text-xs">
              {r}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {c.location ? (
            <>
              <MapPin className="h-3 w-3" />
              {c.location}
            </>
          ) : null}
        </span>
        <Button asChild size="sm" variant="ghost">
          <Link
            to="/client/candidates/$id"
            params={{ id: c.candidate_profile_id }}
            search={orgId ? { org: orgId } : undefined}
          >
            Open <ArrowUpRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function RoleFitPanel({ orgId }: { orgId?: string }) {
  const [positionId, setPositionId] = useState<string>("");
  const positionsFn = useServerFn(listRoleFitPositions);
  const fitFn = useServerFn(getRoleFitFromPool);

  const positions = useQuery({
    queryKey: ["role-fit", "positions", orgId],
    queryFn: () => positionsFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const fit = useQuery({
    queryKey: ["role-fit", orgId, positionId],
    queryFn: () => fitFn({ data: { orgId: orgId!, positionId } }),
    enabled: !!orgId && !!positionId,
  });

  const summary = fit.data?.summary;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <Recycle className="h-4 w-4 text-muted-foreground" />
            Who we've already screened who fits a new role
          </span>
          <Select value={positionId} onValueChange={setPositionId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Pick a role" />
            </SelectTrigger>
            <SelectContent>
              {(positions.data?.positions ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!positionId ? (
          <p className="text-sm text-muted-foreground">
            Pick a role to see candidates already screened for you who match it.
            Every match shows the date they were screened and why they're
            relevant — work you've already paid for, reused at no extra cost.
          </p>
        ) : fit.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : !summary ? null : (
          <>
            <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">In your library</p>
                <p className="text-2xl font-semibold">{summary.library_size}</p>
                <p className="text-xs text-muted-foreground">candidates screened to date</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Fit this role</p>
                <p className="text-2xl font-semibold">{summary.fitting}</p>
                <p className="text-xs text-muted-foreground">with recorded evidence</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Already met</p>
                <p className="text-2xl font-semibold">{summary.already_interviewed}</p>
                <p className="text-xs text-muted-foreground">interviewed or offered before</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Library depth</p>
                <p className="text-2xl font-semibold">
                  {summary.oldest_screening_at
                    ? fmtDate(summary.oldest_screening_at).split(" ").slice(1).join(" ")
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">earliest screening reused</p>
              </div>
            </div>

            <p className="border-l-2 border-primary/40 pl-3 text-sm">
              {summary.fitting === 0
                ? "None of your previously screened candidates show recorded evidence for this role yet — this search starts fresh."
                : `${summary.fitting} candidate${summary.fitting === 1 ? "" : "s"} you already paid to screen ${summary.fitting === 1 ? "matches" : "match"} this role, so ${summary.fitting === 1 ? "that screening" : "those screenings"} carry over instead of being repeated. Your library grows with every role, which is why cost per hire falls over time.`}
            </p>

            {(fit.data?.requirements.length ?? 0) > 0 ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Layers className="h-3 w-3" />
                Matched against {fit.data!.requirements.length} recorded requirement
                {fit.data!.requirements.length === 1 ? "" : "s"} for this role.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                This role has no recorded requirements yet, so matches rely on
                prior progress and saved pools only.
              </p>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {(fit.data?.candidates ?? []).map((c) => (
                <FitCard key={c.candidate_profile_id} c={c} orgId={orgId} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
