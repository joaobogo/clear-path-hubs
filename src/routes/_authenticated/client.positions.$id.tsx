import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
 getClientContext,
 getClientPositionDetail,
 moveMatchStage,
 type MatchStage,
} from "@/lib/client.functions";
import { confirmRoleBlueprint } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertCircle, MessageSquare, Users } from "lucide-react";
import { RoleBlueprint } from "@/components/product/role-blueprint";
import { GeneratedBlueprintPanel } from "@/components/positions/generated-blueprint-panel";
import { ResurfacePanel } from "@/components/client/resurface-panel";
import { RoleMemoryPanel } from "@/components/role-memory-panel";
import { JobQualityPanel } from "@/components/positions/JobQualityPanel";

export const Route = createFileRoute("/_authenticated/client/positions/$id")({
 head: () => ({
 meta: [
 { title: "Position · Client workspace" },
 { name: "robots", content: "noindex" },
 ],
 }),
 notFoundComponent: () => <div className="p-8">Position not found.</div>,
 errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.positions.$id.tsx"),
 component: PositionDetailPage,
});

const KANBAN_COLUMNS: { key: MatchStage; label: string }[] = [
 { key: "delivered", label: "Delivered" },
 { key: "shortlisted", label: "Shortlisted" },
 { key: "interview_process", label: "Interview Process" },
 { key: "offer", label: "Offer" },
 { key: "hired", label: "Hired" },
 { key: "not_moving_forward", label: "Not Moving Forward" },
];

// Canonical transition matrix (mirrors server STAGE_GRAPH in client.functions.ts).
const STAGE_GRAPH: Record<MatchStage, MatchStage[]> = {
 delivered: ["shortlisted", "interview_process", "not_moving_forward"],
 shortlisted: ["interview_process", "not_moving_forward"],
 interview_process: ["offer", "shortlisted", "not_moving_forward"],
 offer: ["hired", "not_moving_forward"],
 hired: [],
 not_moving_forward: ["shortlisted"],
};

const STAGE_LABELS: Record<MatchStage, string> = {
 delivered: "Delivered",
 shortlisted: "Shortlist",
 interview_process: "Move to Interview Process",
 offer: "Make offer",
 hired: "Mark hired",
 not_moving_forward: "Not moving forward",
};

// Client-friendly status labels — never expose internal enum values.
const STATUS_LABELS: Record<string, string> = {
 draft: "Draft",
 submitted: "Submitted",
 under_review: "TaaSFlow reviewing",
 needs_clarification: "Clarification needed",
 approved: "Approved",
 active: "Active — sourcing",
 paused: "Paused",
 filled: "Filled",
 closed: "Closed",
 archived: "Archived",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function PositionDetailPage() {
 const { id } = Route.useParams();
 const qc = useQueryClient();
 const ctxFn = useServerFn(getClientContext);
 const detailFn = useServerFn(getClientPositionDetail);
 const moveFn = useServerFn(moveMatchStage);
 const orgSearch = useClientOrgSearch();
 const support = useSupportView();
 const { data: ctx } = useQuery({
 queryKey: ["client-context", orgSearch ?? null],
 queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
 });
 const orgId = ctx?.active?.organization_id;
 const queryKey = ["client-position", orgId, id];
 const { data, refetch } = useQuery({
 queryKey,
 queryFn: () => detailFn({ data: { orgId: orgId!, positionId: id } }),
 enabled: !!orgId,
 });
 useEffect(() => {
 const onRefresh = () => refetch();
 window.addEventListener("client:refresh", onRefresh);
 return () => window.removeEventListener("client:refresh", onRefresh);
 }, [refetch]);

  const [dragOver, setDragOver] = useState<MatchStage | null>(null);

  const confirmBlueprintFn = useServerFn(confirmRoleBlueprint);
  const confirmBlueprint = useMutation({
    mutationFn: () => confirmBlueprintFn({ data: { orgId: orgId!, positionId: id } }),
    onSuccess: () => {
      toast.success("Thanks — we've noted your sign-off on this brief.");
      void refetch();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "We couldn't record that. Please try again."),
  });


 const move = useMutation({
  mutationFn: (v: { matchId: string; toStage: MatchStage; reason?: string }) =>
   moveFn({ data: { orgId: orgId!, matchId: v.matchId, toStage: v.toStage, reason: v.reason } }),
 onMutate: async (v) => {
 await qc.cancelQueries({ queryKey });
 const snapshot = qc.getQueryData<AnyRow>(queryKey);
 qc.setQueryData<AnyRow>(queryKey, (prev: AnyRow) => {
 if (!prev) return prev;
 return {
 ...prev,
 matches: prev.matches.map((m: AnyRow) =>
 m.id === v.matchId ? { ...m, stage: v.toStage } : m,
 ),
 };
 });
 return { snapshot };
 },
 onError: (e: Error, _v, ctx) => {
 if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot);
 const raw = e.message.replace(/^Error: /, "");
  const msg = raw.startsWith("invalid_transition")
  ? "That move is not allowed for this stage."
  : raw === "reason_required"
  ? "A reason is required to mark a candidate as not moving forward."
  : raw === "SUPPORT_VIEW_READ_ONLY"
  ? "Unavailable while viewing this workspace in read-only support mode."
  : raw === "forbidden"
  ? "You do not have permission to move candidates."
  : raw === "match_not_visible"
  ? "This candidate is no longer available."
  : raw;
 toast.error(msg);
 },
 onSuccess: () => {
 toast.success("Stage updated");
 qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
 qc.invalidateQueries({ queryKey: ["client-positions", orgId] });
 qc.invalidateQueries({ queryKey: ["client-candidates", orgId] });
 },
 onSettled: () => qc.invalidateQueries({ queryKey }),
 });

 const delivered = useMemo(() => {
 if (!data) return [];
 return [...(data.matches as AnyRow[])].sort((a, b) => {
 const at = a.delivered_at ? new Date(a.delivered_at).getTime() : 0;
 const bt = b.delivered_at ? new Date(b.delivered_at).getTime() : 0;
 return bt - at;
 });
 }, [data]);

 if (!data) return <div className="p-8 text-muted-foreground">Loading…</div>;
 if (!data.position) throw notFound();

 const canEdit =
 !support.readOnly &&
 (ctx?.active?.role === "client_admin" ||
 ctx?.active?.role === "client_editor" ||
 ctx?.active?.role === "platform_admin" ||
 ctx?.active?.role === "operations");

 const { position, matches, activity, summary } = data;
 const byStage: Record<string, AnyRow[]> = {};
 for (const col of KANBAN_COLUMNS) byStage[col.key] = [];
 for (const m of matches as AnyRow[]) {
 const s = m.stage as string;
 if (byStage[s]) byStage[s].push(m);
 }

 const attemptMove = (matchId: string, from: MatchStage, to: MatchStage) => {
  if (from === to) return;
  const allowed = STAGE_GRAPH[from] ?? [];
  if (!allowed.includes(to)) {
   toast.error(
    `Cannot move from ${from.replace("_", " ")} to ${to.replace("_", " ")}.`,
   );
   return;
  }
  if (to === "not_moving_forward") {
   const reason =
    typeof window !== "undefined"
     ? window.prompt(
        "Reason for not moving this candidate forward (required, visible to your team):",
       )
     : null;
   if (!reason || !reason.trim()) {
    toast.error("A reason is required to reject a candidate.");
    return;
   }
   move.mutate({ matchId, toStage: to, reason: reason.trim() });
   return;
  }
  move.mutate({ matchId, toStage: to });
 };


 const actionRequired: Array<{ label: string; href?: string }> = [];
 if (summary.delivered > 0) {
 actionRequired.push({
 label: `${summary.delivered} new candidate${summary.delivered === 1 ? "" : "s"} to review`,
 });
 }
 if (summary.offers > 0) {
 actionRequired.push({
 label: `${summary.offers} offer${summary.offers === 1 ? "" : "s"} outstanding`,
 });
 }
 if (position.status === "needs_clarification") {
 actionRequired.push({
 label: "TaaSFlow needs clarification from your team",
 });
 }

 return (
 <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
 {/* Breadcrumb */}
 <div>
 <Link
 to="/client/positions"
 className="text-sm text-muted-foreground hover:underline"
 >
 ← All positions
 </Link>
 </div>

 {/* 1. Header */}
 <header className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-2">
 <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
 {position.title}
 </h1>
 <Badge variant="secondary">
 {STATUS_LABELS[position.status] ?? "Active"}
 </Badge>
 </div>
 <div className="mt-1 text-sm text-muted-foreground">
 {[
 position.department,
 position.location,
 position.work_model,
 position.employment_type,
 position.seniority,
 ]
 .filter(Boolean)
 .join(" · ")}
 </div>
 {support.readOnly ? (
 <div className="mt-2 text-xs text-muted-foreground">
 Kanban movement is disabled while viewing this workspace as a
 TaaSFlow administrator.
 </div>
 ) : !canEdit ? (
 <div className="mt-2 text-xs text-muted-foreground">
 Read-only view — you do not have edit permission for this
 workspace.
 </div>
 ) : null}
 </div>
 <div className="flex items-center gap-2">
 {canEdit && !support.readOnly && (
 <Button asChild variant="outline" size="sm">
 <Link
 to="/client/positions/$id/edit"
 params={{ id: position.id }}
 data-qa-action="edit-position-wizard"
 >
 Edit position
 </Link>
 </Button>
 )}
 <Button asChild variant="outline" size="sm">
 <Link to="/client/messages" search={{ position: position.id } as never}>
 <MessageSquare className="mr-1.5 h-4 w-4" /> Message TaaSFlow
 </Link>
 </Button>
 {canEdit && (
 <Button asChild size="sm">
 <Link
 to="/client/messages"
 search={
 {
 position: position.id,
 intent: "change_request",
 } as never
 }
 >
 Request a change
 </Link>
 </Button>
 )}
 </div>
 {canEdit && !support.readOnly && (
 <div className="mt-4">
 <JobQualityPanel
 positionId={position.id}
 editTo={{ to: "/client/positions/$id/edit", positionId: position.id }}
 />
 </div>
 )}
 </header>

 {/* 2. Hiring summary */}
 <section aria-label="Hiring summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <SummaryTile
 label="Openings"
 value={summary.openings}
 hint={summary.openings > 1 ? "Multiple hires expected" : "Single hire"}
 />
 <SummaryTile
 label="Hired"
 value={summary.hires}
 hint={`${summary.remaining} remaining`}
 />
 <SummaryTile
 label="In pipeline"
 value={
 summary.delivered +
 summary.shortlisted +
 summary.interviewing +
 summary.offers
 }
 hint="Delivered · shortlisted · interviewing · offers"
 />
 <SummaryTile
 label="Delivered total"
 value={matches.length}
 hint="Client-visible candidates only"
 />
 </section>

 {/* 3. Action Required */}
 {actionRequired.length > 0 && (
 <section
 aria-label="Action required"
 className="rounded-xl border taas-bd-warning taas-bg-warning-soft p-4"
 >
 <div className="flex items-center gap-2 mb-2">
 <AlertCircle className="h-4 w-4 taas-fg-warning " />
 <h2 className="text-sm font-semibold">Action required</h2>
 </div>
 <ul className="space-y-1.5 text-sm">
 {actionRequired.map((a, i) => (
 <li key={i} className="text-foreground/90">
 • {a.label}
 </li>
 ))}
 </ul>
 </section>
 )}

 {/* 4. Pipeline (Kanban) */}
 <section aria-label="Pipeline">
 <div className="flex items-center justify-between mb-2">
 <h2 className="text-lg font-semibold">Pipeline</h2>
 <div className="text-xs text-muted-foreground">
 <Users className="inline h-3.5 w-3.5 mr-1" />
 {matches.length} candidate{matches.length === 1 ? "" : "s"} visible
 </div>
 </div>
 <div
 className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
 role="list"
 aria-label="Candidate pipeline"
 >
 {KANBAN_COLUMNS.map((col) => {
 const isDropTarget = dragOver === col.key;
 return (
 <div
 key={col.key}
 role="listitem"
 aria-label={`${col.label} column, ${byStage[col.key].length} candidates`}
 className={`rounded-lg p-2 min-h-[280px] transition-colors ${
 isDropTarget
 ? "bg-primary/10 ring-2 ring-primary"
 : "bg-muted/40"
 }`}
 onDragOver={(e) => {
 if (!canEdit) return;
 e.preventDefault();
 setDragOver(col.key);
 }}
 onDragLeave={() =>
 setDragOver((c) => (c === col.key ? null : c))
 }
 onDrop={(e) => {
 e.preventDefault();
 setDragOver(null);
 if (!canEdit) return;
 const matchId = e.dataTransfer.getData("text/match-id");
 const from = e.dataTransfer.getData(
 "text/from-stage",
 ) as MatchStage;
 if (matchId && from) attemptMove(matchId, from, col.key);
 }}
 >
 <div className="flex items-center justify-between px-1 mb-2">
 <div className="text-xs font-medium uppercase tracking-wide">
 {col.label}
 </div>
 <div className="text-xs text-muted-foreground tabular-nums">
 {byStage[col.key].length}
 </div>
 </div>
 <div className="space-y-2">
 {byStage[col.key].map((m) => {
 const from = col.key;
 const allowed = STAGE_GRAPH[from] ?? [];
 return (
 <div
 key={m.id}
 draggable={canEdit && !move.isPending}
 onDragStart={(e) => {
 e.dataTransfer.setData("text/match-id", m.id);
 e.dataTransfer.setData("text/from-stage", from);
 e.dataTransfer.effectAllowed = "move";
 }}
 className={`rounded border bg-card p-3 ${
 canEdit ? "cursor-grab active:cursor-grabbing" : ""
 }`}
 >
 <Link
 to="/client/candidates/$id"
 params={{ id: m.id }}
 className="block text-sm font-medium hover:underline"
 >
 {m.candidate_profiles?.full_name ?? "Candidate"}
 </Link>
 <div className="text-xs text-muted-foreground truncate">
 {m.candidate_profiles?.headline ?? ""}
 </div>
 <div className="mt-1 flex items-center gap-2 text-xs">
 {m.score_runs?.score != null && (
 <span className="tabular-nums">
 {Number(m.score_runs.score).toFixed(0)}
 </span>
 )}
 {m.score_runs?.fit_label && (
 <span className="capitalize text-muted-foreground">
 {m.score_runs.fit_label}
 </span>
 )}
 </div>
 {canEdit && allowed.length > 0 && (
 <div className="mt-2">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 size="sm"
 variant="outline"
 className="h-7 w-full text-xs"
 disabled={move.isPending}
 aria-label={`Change stage for ${m.candidate_profiles?.full_name ?? "candidate"}`}
 >
 Change stage
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="start">
 {allowed.map((to) => (
 <DropdownMenuItem
 key={to}
 onSelect={() =>
 attemptMove(m.id, from, to)
 }
 >
 {STAGE_LABELS[to]}
 </DropdownMenuItem>
 ))}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 )}
 </div>
 );
 })}
 {byStage[col.key].length === 0 && (
 <div className="text-xs text-muted-foreground px-1 py-4 text-center">
 Empty
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </section>

 {/* 5. Delivered candidates (chronological list) */}
 <section aria-label="Delivered candidates" className="rounded-xl border bg-card p-4">
 <div className="flex items-center justify-between mb-3">
 <h2 className="text-lg font-semibold">Delivered candidates</h2>
 <span className="text-xs text-muted-foreground">
 Most recent first · Client-visible only
 </span>
 </div>
 {delivered.length === 0 ? (
 <div className="text-sm text-muted-foreground py-4">
 No candidates have been delivered yet. TaaSFlow will notify you as
 soon as the first is ready.
 </div>
 ) : (
 <ul className="divide-y">
 {delivered.slice(0, 10).map((m) => (
 <li
 key={m.id}
 className="py-2.5 flex items-center justify-between gap-3"
 >
 <Link
 to="/client/candidates/$id"
 params={{ id: m.id }}
 className="min-w-0 flex-1 group"
 >
 <div className="text-sm font-medium group-hover:underline truncate">
 {m.candidate_profiles?.full_name ?? "Candidate"}
 </div>
 <div className="text-xs text-muted-foreground truncate">
 {m.candidate_profiles?.headline ?? ""}
 </div>
 </Link>
 <div className="text-right shrink-0">
 <div className="text-xs text-muted-foreground capitalize">
 {String(m.stage).replace(/_/g, " ")}
 </div>
 <div className="text-xs text-muted-foreground">
 {m.delivered_at
 ? new Date(m.delivered_at).toLocaleDateString()
 : ""}
 </div>
 </div>
 </li>
 ))}
 </ul>
 )}
 </section>

  {/* 6. Role blueprint — ATS-grade source of truth */}
 <RoleBlueprint position={position} activity={activity} />

 {/* 6b. Silver medalists from talent memory */}
 {orgId && <ResurfacePanel orgId={orgId} positionId={id} />}

 {/* 7. Hiring process */}
 <section aria-label="Hiring process" className="rounded-xl border bg-card p-4">
 <h2 className="text-lg font-semibold mb-3">Hiring process</h2>
 <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
 <ProcessStep
 n={1}
 title="Delivered"
 body="TaaSFlow reviews sourced candidates and only delivers those cleared for your role."
 done={matches.length > 0}
 />
 <ProcessStep
 n={2}
 title="Shortlist"
 body="You mark candidates worth advancing. Others are moved to Not moving forward."
 done={summary.shortlisted + summary.interviewing + summary.offers + summary.hires > 0}
 />
 <ProcessStep
 n={3}
 title="Interview"
 body="Your team runs interviews. Schedule and outcomes are logged automatically."
 done={summary.interviewing + summary.offers + summary.hires > 0}
 />
 <ProcessStep
 n={4}
 title="Offer"
 body="Extend an offer through TaaSFlow so we can track acceptance."
 done={summary.offers + summary.hires > 0}
 />
 <ProcessStep
 n={5}
 title="Hire"
 body={
 summary.openings > 1
 ? `Multiple hires — ${summary.hires} of ${summary.openings} filled.`
 : "Position closes once the first hire is confirmed."
 }
 done={summary.hires >= summary.openings}
 />
 </ol>
 </section>

 {/* 8. Activity */}
 <section aria-label="Activity" className="rounded-xl border bg-card p-4">
 <h2 className="text-lg font-semibold mb-3">Activity</h2>
 {activity.length === 0 ? (
 <div className="text-sm text-muted-foreground">
 No recent activity yet.
 </div>
 ) : (
 <ul className="divide-y text-sm">
 {activity.map((a: AnyRow) => (
 <li key={a.id} className="py-2 flex items-center justify-between gap-3">
 <span className="text-foreground/90">
 {humanizeAction(a.action)}
 </span>
 <span className="text-xs text-muted-foreground">
 {a.created_at
 ? new Date(a.created_at).toLocaleString()
 : ""}
 </span>
 </li>
 ))}
 </ul>
 )}
 </section>

 {/* 9. Collaboration */}
 <section aria-label="Collaboration" className="rounded-xl border bg-card p-4">
 <div className="flex items-start justify-between gap-3">
 <div>
 <h2 className="text-lg font-semibold">Collaboration</h2>
 <p className="text-sm text-muted-foreground mt-1">
 Talk to your TaaSFlow team about this role. Request changes to the
 brief, ask for more candidates, or flag urgency — all in one
 thread scoped to this position.
 </p>
 </div>
 </div>
 <div className="mt-3 flex flex-wrap gap-2">
 <Button asChild variant="outline" size="sm">
 <Link to="/client/messages" search={{ position: position.id } as never}>
 Open thread
 </Link>
 </Button>
 {canEdit && (
 <Button asChild size="sm">
 <Link
 to="/client/messages"
 search={
 {
 position: position.id,
 intent: "change_request",
 } as never
 }
 >
 Request a change
 </Link>
 </Button>
 )}
 </div>
 </section>

 <section className="mt-8">
  <RoleMemoryPanel positionId={position.id} canEdit={true} />
 </section>
 </main>
 );
}

function SummaryTile({
 label,
 value,
 hint,
}: {
 label: string;
 value: number;
 hint?: string;
}) {
 return (
 <div className="rounded-xl border bg-card p-4">
 <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 {label}
 </div>
 <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
 {hint && (
 <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
 )}
 </div>
 );
}


function ProcessStep({
 n,
 title,
 body,
 done,
}: {
 n: number;
 title: string;
 body: string;
 done: boolean;
}) {
 return (
 <li
 className={`rounded-lg border p-3 ${
 done ? "taas-bd-success taas-bg-success-soft" : "bg-muted/30"
 }`}
 >
 <div className="flex items-center gap-2 text-xs font-medium">
 <span
 className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
 done
 ? "taas-bg-success-solid text-white"
 : "bg-muted-foreground/20 text-muted-foreground"
 }`}
 >
 {n}
 </span>
 {title}
 </div>
 <p className="mt-1 text-xs text-muted-foreground">{body}</p>
 </li>
 );
}

// Convert safe audit actions to client-friendly copy.
// Never surface admin_note / scoring_weight / internal review terminology.
function humanizeAction(action: string): string {
 const map: Record<string, string> = {
 "position.status.update": "Position status updated",
 "position.approved": "Position approved",
 "position.published": "Position published",
 "position.closed": "Position closed",
 "candidate_match.stage.update": "Candidate moved between stages",
 "candidate_match.publish": "Candidate delivered",
 "interview.schedule": "Interview scheduled",
 "interview.reschedule": "Interview rescheduled",
 "interview.cancel": "Interview cancelled",
 "client_decision.create": "Client decision recorded",
 "message.external.send": "New message",
 };
 return map[action] ?? action.replace(/[._]/g, " ");
}
