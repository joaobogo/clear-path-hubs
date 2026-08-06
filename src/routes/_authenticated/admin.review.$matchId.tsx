import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getAdminMatch, applyReviewDecision } from "@/lib/processing.functions";
import { getReviewQueueIds } from "@/lib/admin-ops.functions";
import { EvidenceCompletenessGate } from "@/components/admin/evidence-completeness-gate";
import { CvPreviewPane } from "@/components/admin/cv-preview-pane";
import { ScoreStalenessChip, freshnessFromRow } from "@/components/admin/score-staleness-chip";
import { RejectReasonDialog } from "@/components/admin/reject-reason-dialog";
import { getEvidenceCompleteness } from "@/lib/evidence/completeness.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Check,
  PauseCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Keyboard,
  AlertTriangle,
  Circle,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export const Route = createFileRoute("/_authenticated/admin/review/$matchId")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["admin-candidate", params.matchId],
      queryFn: () => getAdminMatch({ data: { id: params.matchId } }),
    });
    if (!d) throw notFound();
    return d;
  },
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.review.$matchId.tsx",
  ),
  head: () => ({
    meta: [{ title: "Candidate review · TaaSFlow admin" }, { name: "robots", content: "noindex" }],
  }),
  component: ReviewScreen,
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

function reqText(r: Any): string {
  if (!r) return "";
  if (typeof r === "string") return r;
  return r.text ?? r.requirement_text ?? r.label ?? r.name ?? JSON.stringify(r);
}

function ReviewScreen() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const decide = useServerFn(applyReviewDecision);

  const { data } = useSuspenseQuery({
    queryKey: ["admin-candidate", matchId],
    queryFn: () => getAdminMatch({ data: { id: matchId } }),
  });
  const { data: queue } = useQuery({
    queryKey: ["admin-review-queue-ids"],
    queryFn: () => getReviewQueueIds(),
    staleTime: 60_000,
  });

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const m = (data as Any).match;
  const cv = (data as Any).cv;
  const evidence = (data as Any).evidence;
  const currentRun = ((data as Any).runs ?? []).find((r: Any) => r.id === m.current_score_run_id);
  const result = currentRun?.result ?? {};
  void result;
  void evidence;

  // Submission gate: must-have criteria without evidence block approval.
  const { data: completeness } = useQuery({
    queryKey: ["evidence-completeness", matchId],
    queryFn: () => getEvidenceCompleteness({ data: { matchId } }),
  });
  const blockingLabels: string[] = completeness?.report.blockingLabels ?? [];
  const approvalBlocked = blockingLabels.length > 0;

  const ids: string[] = queue?.ids ?? [];
  const idx = ids.indexOf(matchId);
  const nextId = idx >= 0 ? ids[idx + 1] : ids[0];
  const prevId = idx > 0 ? ids[idx - 1] : undefined;

  const requirements = useMemo(() => {
    const must = (m.positions?.requirements ?? []) as Any[];
    const nice = (m.positions?.preferred_requirements ?? []) as Any[];
    return [
      ...must.map((r) => ({ text: reqText(r), required: true })),
      ...nice.map((r) => ({ text: reqText(r), required: false })),
    ].filter((r) => r.text);
  }, [m]);

  const go = (id?: string) => {
    if (!id) {
      toast.success("Queue clear — back to the work queue.");
      navigate({ to: "/admin" });
      return;
    }
    navigate({ to: "/admin/review/$matchId", params: { matchId: id } });
  };

  async function run(action: "approve_for_client" | "hold", label: string) {
    if (busy) return;
    if (action === "approve_for_client" && approvalBlocked) {
      toast.error(`Missing evidence for: ${blockingLabels.join(", ")}`);
      return;
    }
    setBusy(action);
    try {
      await decide({ data: { match_id: matchId, action, reason: note || undefined } });
      toast.success(`${label} — ${m.candidate_profiles?.full_name ?? "candidate"}`);
      qc.invalidateQueries({ queryKey: ["admin-work-queues"] });
      qc.invalidateQueries({ queryKey: ["admin-review-queue-ids"] });
      qc.invalidateQueries({ queryKey: ["admin-candidate", matchId] });
      setNote("");
      go(nextId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/_/g, " ") : "Decision failed");
    } finally {
      setBusy(null);
    }
  }

  // Rejections always carry a controlled reason; errors bubble to the dialog.
  async function rejectNow(p: { reasonCode: string; detail?: string }) {
    await decide({
      data: {
        match_id: matchId,
        action: "archive",
        reason_code: p.reasonCode,
        reason: p.detail || note || undefined,
      },
    });
    toast.success(`Rejected — ${m.candidate_profiles?.full_name ?? "candidate"}`);
    qc.invalidateQueries({ queryKey: ["admin-work-queues"] });
    qc.invalidateQueries({ queryKey: ["admin-review-queue-ids"] });
    qc.invalidateQueries({ queryKey: ["admin-candidate", matchId] });
    setNote("");
    go(nextId);
  }

  // Keyboard shortcuts for the repetitive parts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) {
        if (e.key === "Escape") (el as HTMLElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          void run("approve_for_client", "Approved for client");
          break;
        case "h":
          e.preventDefault();
          void run("hold", "Held");
          break;
        case "r":
          e.preventDefault();
          setRejectOpen(true);
          break;
        case "n":
        case "j":
          e.preventDefault();
          go(nextId);
          break;
        case "p":
        case "k":
          e.preventDefault();
          go(prevId);
          break;
        case "c":
          e.preventDefault();
          noteRef.current?.focus();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const score = currentRun?.score != null ? Math.round(Number(currentRun.score)) : null;

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-3">
      {/* Header: who, for what, where in the queue */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {m.candidate_profiles?.full_name ?? "Candidate"}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {m.positions?.title ?? "—"} · {m.positions?.organizations?.name ?? "—"}
            {m.candidate_profiles?.location ? ` · ${m.candidate_profiles.location}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {score != null && (
            <span className="inline-flex items-center gap-1">
              <Badge variant="secondary" className="tabular-nums">
                score {score}
              </Badge>
              {/* Staff should never weigh a score without knowing what it was
                  measured against. */}
              <ScoreStalenessChip
                freshness={freshnessFromRow({
                  scored_at: currentRun?.completed_at ?? null,
                  scored_input_hash: currentRun?.input_hash ?? null,
                  scored_engine_version: currentRun?.engine_version ?? null,
                  profile_updated_at: m.candidate_profiles?.updated_at ?? null,
                  brief_updated_at: m.positions?.updated_at ?? null,
                })}
              />
            </span>
          )}
          {currentRun?.must_have_coverage != null && (
            <span className="tabular-nums">
              must-haves {Math.round(Number(currentRun.must_have_coverage) * 100)}%
            </span>
          )}
          {idx >= 0 && ids.length > 0 && (
            <span className="tabular-nums">
              {idx + 1} of {ids.length} in queue
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => go(prevId)}
            disabled={!prevId}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => go(nextId)}
            disabled={!nextId}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
            <Link to="/admin/candidates/$id" params={{ id: matchId }}>
              Full record <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </header>

      {currentRun?.contradiction_status && currentRun.contradiction_status !== "none" && (
        <Alert variant="destructive">
          <AlertTitle>Contradiction detected</AlertTitle>
          <AlertDescription>
            {String(currentRun.contradiction_status).replace(/_/g, " ")} — read the evidence before
            approving.
          </AlertDescription>
        </Alert>
      )}

      {/* One screen: evidence · CV · requirements */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_260px]">
        {/* Evidence completeness checklist — also gates submission */}
        <div className="min-h-0 overflow-y-auto">
          <EvidenceCompletenessGate matchId={matchId} showSubmit={false} />
        </div>

        {/* CV preview owns its own signed-link lifetime. */}
        <CvPreviewPane
          matchId={matchId}
          candidateName={m.candidate_profiles?.full_name ?? "candidate"}
          initialUrl={cv?.signed_url ?? null}
          initialExpiresAt={cv?.url_expires_at ?? null}
        />

        {/* Requirements as stated by the client */}
        <aside className="min-h-0 overflow-y-auto rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Role requirements</h2>
          {requirements.length === 0 ? (
            <p className="text-xs text-muted-foreground">No requirements recorded on this role.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {requirements.map((r, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className={r.required ? "text-destructive" : "text-muted-foreground"}>
                    {r.required ? "*" : "·"}
                  </span>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {/* Blockers stated out loud. A disabled button with a tooltip is not an
          explanation — the reviewer needs to see what is missing. */}
      {approvalBlocked && (
        <div className="rounded-lg border taas-bd-warning taas-bg-warning-soft p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 taas-tx-warning" aria-hidden />
            Approval is blocked until these have evidence
          </div>
          <ul className="mt-2 space-y-1">
            {blockingLabels.map((label) => (
              <li key={label} className="flex items-start gap-2 text-xs">
                <Circle className="mt-0.5 h-3 w-3 shrink-0 taas-tx-warning" aria-hidden />
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Add the evidence in the checklist above, or hold the candidate instead.
            Hold and reject stay available.
          </p>
        </div>
      )}

      {/* Decision bar */}
      <footer className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <Textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note recorded with the decision (press C to focus)"
          rows={1}
          className="min-h-9 flex-1 resize-none text-sm"
          aria-label="Decision note"
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => run("approve_for_client", "Approved for client")}
            disabled={!!busy || approvalBlocked}
            className="gap-1.5"
            title={
              approvalBlocked
                ? `Blocked — no evidence for: ${blockingLabels.join(", ")}`
                : undefined
            }
          >
            <Check className="h-4 w-4" /> Approve{" "}
            <kbd className="ml-1 text-[10px] opacity-70">A</kbd>
          </Button>

          <Button
            variant="secondary"
            onClick={() => run("hold", "Held")}
            disabled={!!busy}
            className="gap-1.5"
          >
            <PauseCircle className="h-4 w-4" /> Hold{" "}
            <kbd className="ml-1 text-[10px] opacity-70">H</kbd>
          </Button>
          <Button
            variant="destructive"
            onClick={() => setRejectOpen(true)}
            disabled={!!busy}
            className="gap-1.5"
          >
            <X className="h-4 w-4" /> Reject <kbd className="ml-1 text-[10px] opacity-70">R</kbd>
          </Button>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Keyboard className="h-3 w-3" /> J/K next & previous
        </span>
      </footer>
      <RejectReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={rejectNow}
      />
    </div>
  );
}
