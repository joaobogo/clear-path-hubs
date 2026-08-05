/**
 * Evidence completeness gate.
 *
 * Shows which rubric criteria have evidence, which are unsupported, the source
 * of each item, and any overrides applied. Submission to the client is blocked
 * while a must-have criterion has zero evidence and no written override.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  getEvidenceCompleteness,
  addManualEvidence,
  overrideMissingCriterion,
} from "@/lib/evidence/completeness.functions";
import { applyReviewDecision } from "@/lib/processing.functions";
import type { CriterionRow } from "@/lib/evidence/completeness";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Check,
  CircleSlash,
  Minus,
  Plus,
  RefreshCw,
  ShieldAlert,
  Send,
} from "lucide-react";

const RESULT_OPTIONS = [
  { value: "strong", label: "Strong — directly evidenced" },
  { value: "partial", label: "Partial — some support" },
  { value: "weak", label: "Weak — indirect only" },
  { value: "needs_validation", label: "Needs validation — must be confirmed" },
  { value: "contradictory", label: "Contradictory — conflicts with the record" },
] as const;

const SOURCE_OPTIONS = [
  { value: "cv", label: "CV" },
  { value: "application_answer", label: "Application answer" },
  { value: "interview", label: "Interview" },
  { value: "manual", label: "Reviewer verified" },
] as const;

function StatusBadge({ status }: { status: CriterionRow["status"] }) {
  if (status === "supported")
    return (
      <Badge className="shrink-0 gap-1">
        <Check className="h-3 w-3" /> Evidenced
      </Badge>
    );
  if (status === "thin")
    return (
      <Badge variant="secondary" className="shrink-0 gap-1">
        <Minus className="h-3 w-3" /> Thin
      </Badge>
    );
  return (
    <Badge variant="destructive" className="shrink-0 gap-1">
      <CircleSlash className="h-3 w-3" /> No evidence
    </Badge>
  );
}

export function EvidenceCompletenessGate({
  matchId,
  showSubmit = true,
}: {
  matchId: string;
  showSubmit?: boolean;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getEvidenceCompleteness);
  const addEvidence = useServerFn(addManualEvidence);
  const overrideCriterion = useServerFn(overrideMissingCriterion);
  const decide = useServerFn(applyReviewDecision);

  const query = useQuery({
    queryKey: ["evidence-completeness", matchId],
    queryFn: () => load({ data: { matchId } }),
  });

  const [addTarget, setAddTarget] = useState<CriterionRow | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<CriterionRow | null>(null);
  const [passage, setPassage] = useState("");
  const [result, setResult] = useState<string>("strong");
  const [sourceKind, setSourceKind] = useState<string>("manual");
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["evidence-completeness", matchId] });
    void qc.invalidateQueries({ queryKey: ["admin-candidate", matchId] });
  };

  if (query.isPending) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Evidence completeness</h2>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <Alert variant="destructive">
          <AlertTitle>Could not load the evidence checklist</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>
              {query.error instanceof Error ? query.error.message : "Unexpected error."}
            </span>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const payload = query.data;
  const report = payload.report;
  const criteria = report.criteria;

  async function submitAdd() {
    if (!addTarget || busy) return;
    setBusy(true);
    try {
      await addEvidence({
        data: {
          matchId,
          criterionKey: addTarget.key,
          criterionLabel: addTarget.label,
          passage,
          result: result as "strong",
          sourceKind: sourceKind as "manual",
        },
      });
      toast.success("Evidence recorded");
      setAddTarget(null);
      setPassage("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/_/g, " ") : "Could not save evidence");
    } finally {
      setBusy(false);
    }
  }

  async function submitOverride() {
    if (!overrideTarget || busy) return;
    setBusy(true);
    try {
      await overrideCriterion({
        data: {
          matchId,
          criterionKey: overrideTarget.key,
          criterionLabel: overrideTarget.label,
          justification,
        },
      });
      toast.success("Override recorded in the audit history");
      setOverrideTarget(null);
      setJustification("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/_/g, " ") : "Could not record override");
    } finally {
      setBusy(false);
    }
  }

  async function submitToClient() {
    if (busy) return;
    setBusy(true);
    try {
      await decide({ data: { match_id: matchId, action: "approve_for_client" } });
      toast.success("Submitted to client");
      refresh();
      void qc.invalidateQueries({ queryKey: ["admin-work-queues"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/_/g, " ") : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Evidence completeness</h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {report.requiredSupported} of {report.requiredTotal} must-have criteria evidenced
          </p>
        </div>
        {showSubmit && (
          <div className="flex items-center gap-2">
            {payload.alreadySubmitted ? (
              <Badge variant="secondary">Already submitted</Badge>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={!report.canSubmit || busy}
                onClick={() => void submitToClient()}
                data-qa-action="submit-to-client"
              >
                <Send className="h-3.5 w-3.5" /> Submit to client
              </Button>
            )}
          </div>
        )}
      </header>

      {!report.canSubmit && (
        <Alert variant="destructive" className="mb-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Submission blocked — missing evidence</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {report.blockingLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              Add evidence for each, or override with a written justification.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {criteria.length === 0 || !report.hasAnyEvidence ? (
        <div className="rounded-md border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">No evidence extracted yet.</p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link to="/admin/candidates/$id" params={{ id: matchId }} hash="processing">
              Reprocess this candidate
            </Link>
          </Button>
        </div>
      ) : null}

      <ul className="space-y-2">
        {criteria.map((c) => (
          <li key={c.key} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">
                  {c.required && <span className="text-destructive">* </span>}
                  {c.label}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {c.required ? "Must have" : "Preferred"}
                </p>
              </div>
              <StatusBadge status={c.status} />
            </div>

            {c.sources.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {c.sources.map((s, i) => (
                  <li key={i} className="border-l-2 border-primary/30 pl-2">
                    <p className="text-xs italic text-muted-foreground">
                      {s.snippet ?? "No passage recorded"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      source: {s.source}
                      {s.result ? ` · ${s.result}` : ""}
                      {s.confidence != null ? ` · confidence ${s.confidence.toFixed(2)}` : ""}
                      {s.reviewerStatus ? ` · ${s.reviewerStatus}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {c.override && (
              <div className="mt-2 rounded-md bg-muted/50 p-2">
                <p className="flex items-center gap-1 text-[11px] font-medium">
                  <ShieldAlert className="h-3 w-3" /> Overridden by{" "}
                  {c.override.actorName ?? "staff"} on{" "}
                  {new Date(c.override.at).toLocaleDateString()}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.override.reason}</p>
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => {
                  setAddTarget(c);
                  setPassage("");
                  setResult("strong");
                  setSourceKind("manual");
                }}
              >
                <Plus className="h-3 w-3" /> {c.sources.length ? "Add or correct" : "Add evidence"}
              </Button>
              {c.required && c.status === "unsupported" && !c.override && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => {
                    setOverrideTarget(c);
                    setJustification("");
                  }}
                >
                  <ShieldAlert className="h-3 w-3" /> Override with justification
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Add / correct evidence */}
      <Dialog open={!!addTarget} onOpenChange={(o) => !o && setAddTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record evidence</DialogTitle>
            <DialogDescription>
              {addTarget?.label} — paste the exact passage you verified. Write it yourself; nothing
              is generated here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="evidence-passage">Passage</Label>
              <Textarea
                id="evidence-passage"
                rows={4}
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                placeholder="Quote from the CV, application answer or interview notes"
              />
              <p className="text-[11px] text-muted-foreground">Minimum 10 characters.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Strength</Label>
                <Select value={result} onValueChange={setResult}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={sourceKind} onValueChange={setSourceKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submitAdd()} disabled={busy || passage.trim().length < 10}>
              Save evidence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override a missing must-have */}
      <Dialog open={!!overrideTarget} onOpenChange={(o) => !o && setOverrideTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override missing evidence</DialogTitle>
            <DialogDescription>
              {overrideTarget?.label} has no evidence. Your justification is stored against your
              name in the candidate&apos;s audit history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="override-justification">Written justification</Label>
            <Textarea
              id="override-justification"
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why is it safe to submit without evidence for this must-have?"
            />
            <p className="text-[11px] text-muted-foreground">
              Minimum 20 characters. {justification.trim().length}/20
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOverrideTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submitOverride()}
              disabled={busy || justification.trim().length < 20}
            >
              Record override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
