// Sticky action rail for the candidate workspace.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from \"@/lib/toast-error\";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirmAction } from "@/components/ds";
import { MoreHorizontal, Wrench, ClipboardCheck } from "lucide-react";
import {
  advanceProcessing,
  applyReviewDecision,
  deleteCandidateMatch,
  markOcrDone,
  rescore,
  retryParse,
  retryHydration,
  retryEnrichment,
} from "@/lib/processing.functions";
import { setMatchClientVisibility } from "@/lib/admin.functions";
import {
  approvePreflightBlock,
  explainApproveFailure,
  type ApproveFailure,
} from "@/lib/scoring/approve-failure";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function ActionRail({
  m,
  currentRun,
  busy,
  onRun,
  onDone,
  onSetTab,
}: {
  m: Any;
  currentRun?: Any;
  busy: string | null;
  onRun: (
    label: string,
    fn: () => Promise<Any>,
    opts?: { onError?: (err: Error) => void; onSuccess?: () => void },
  ) => Promise<void>;
  onDone: () => Promise<void>;
  onSetTab: (t: Any) => void;
}) {
  const [reason, setReason] = useState("");
  const [approveFailure, setApproveFailure] = useState<ApproveFailure | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [override, setOverride] = useState("");
  const setVisFn = useServerFn(setMatchClientVisibility);

  const publish = useMutation({
    mutationFn: (visibility: "visible" | "hidden") =>
      setVisFn({ data: { match_id: m.id, visibility } }),
    onSuccess: async (r) => {
      toast.success(`Visibility updated · ${r.trace_id ?? ""}`);
      await onDone();
    },
    onError: (e: Error) => toastError(e),
  });

  const { confirm, confirmDialog } = useConfirmAction();
  const scored = m.processing_state === "scored";
  const isPublished = m.client_visibility === "visible";
  const approved = m.admin_status === "approved";
  const needsRepair =
    m.processing_state === "failed" ||
    m.processing_state === "provider_blocked" ||
    m.processing_state === "manual_review_required" ||
    m.processing_state === "ocr_required";

  // Approve safety: block doomed requests before they are sent, and never let a
  // non-retryable failure be clicked again.
  const preflightBlock = approvePreflightBlock(m.canonical_state);
  const approveBlocked = !!preflightBlock || approveFailure?.retryable === false;
  const runApprove = () => {
    setApproveFailure(null);
    return onRun(
      "approve",
      () =>
        applyReviewDecision({
          data: { match_id: m.id, action: "approve_for_client", reason },
        }),
      {
        onSuccess: () => setApproveFailure(null),
        onError: (err) => {
          const failure = explainApproveFailure(err.message);
          setApproveFailure(failure);
          toast.error(`${failure.title} — ${failure.detail}`);
        },
      },
    );
  };

  // Context-aware primary action — one at a time, following readiness order.
  let primary: { label: string; qa: string; onClick: () => void; disabled?: boolean };
  if (needsRepair) {
    primary = {
      label: "Review evidence",
      qa: "primary-review-evidence",
      onClick: () => onSetTab("evidence"),
    };
  } else if (scored && !approved) {
    primary = {
      label: approveFailure?.retryable ? "Retry approve score" : "Approve score",
      qa: "primary-approve-score",
      disabled: !!busy || approveBlocked,
      onClick: runApprove,
    };
  } else if (approved && !isPublished) {
    primary = {
      label: "Preview as client",
      qa: "primary-preview-client",
      onClick: () => onSetTab("preview"),
    };
  } else if (approved && isPublished) {
    primary = {
      label: "View client preview",
      qa: "primary-view-preview",
      onClick: () => onSetTab("preview"),
    };
  } else {
    primary = {
      label: "Review evidence",
      qa: "primary-review-evidence",
      onClick: () => onSetTab("evidence"),
    };
  }

  // Publish secondary is shown only when scored & approved.
  const canPublish = scored && approved && !!m.current_score_run_id;

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      {confirmDialog}
      {/* Context-aware primary action bar */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Next step</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Actions follow readiness: review → approve → preview → publish.
        </p>
        {scored && !approved && preflightBlock && (
          <Alert variant="destructive" className="mt-3" data-qa="approve-preflight-block">
            <AlertTitle className="text-xs">Approval unavailable</AlertTitle>
            <AlertDescription className="text-xs">{preflightBlock}</AlertDescription>
          </Alert>
        )}
        {approveFailure && (
          <Alert variant="destructive" className="mt-3" data-qa="approve-failure">
            <AlertTitle className="text-xs">{approveFailure.title}</AlertTitle>
            <AlertDescription className="space-y-1 text-xs">
              <p>{approveFailure.detail}</p>
              {approveFailure.nextStep && (
                <p className="font-medium">Next: {approveFailure.nextStep}</p>
              )}
              <p className="font-mono text-[10px] opacity-70 break-all">
                {approveFailure.raw}
              </p>
              {!approveFailure.retryable && (
                <p className="opacity-80">
                  Retrying will fail the same way — resolve the cause first.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
        <div className="mt-3 flex items-stretch gap-2">
          <Button
            className="flex-1"
            disabled={primary.disabled}
            onClick={primary.onClick}
            data-qa-action={primary.qa}
          >
            {busy === "approve" ? "Approving…" : primary.label}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="More actions"
                data-qa-action="candidate-overflow-menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Repair &amp; processing</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("retry parse", () => retryParse({ data: { match_id: m.id } }))
                }
                data-qa-action="overflow-retry-parse"
              >
                Retry parse
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy || m.processing_state !== "ocr_required"}
                onSelect={() => onSetTab("cv")}
                data-qa-action="overflow-run-ocr"
              >
                Run OCR…
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("retry hydration", () =>
                    retryHydration({ data: { match_id: m.id } }),
                  )
                }
                data-qa-action="overflow-retry-hydration"
              >
                Retry hydration
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("retry enrichment", () =>
                    retryEnrichment({ data: { match_id: m.id } }),
                  )
                }
                data-qa-action="overflow-retry-enrichment"
              >
                Retry enrichment
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("rescore", () => rescore({ data: { match_id: m.id } }))
                }
                data-qa-action="overflow-rescore"
              >
                Rescore
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("advance", () =>
                    advanceProcessing({ data: { match_id: m.id } }),
                  )
                }
                data-qa-action="overflow-advance"
              >
                Advance processing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Review</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={() =>
                  onRun("hold", () =>
                    applyReviewDecision({
                      data: { match_id: m.id, action: "hold", reason },
                    }),
                  )
                }
                data-qa-action="overflow-hold"
              >
                Hold
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!busy}
                onSelect={(event) => {
                  event.preventDefault();
                  void (async () => {
                  const c = await confirm({
                    title: "Delete candidate from this position",
                    object: (m.full_name as string | null) ?? "This candidate",
                    description:
                      "The candidate is removed from the client view and archived on this position.",
                    impact: [
                      "The client immediately loses access to this profile",
                      "Scoring runs and evidence stay on the audit trail",
                      "You are returned to the candidate list",
                    ],
                    reason: {
                      label: "Reason for deletion",
                      required: true,
                      placeholder: "e.g. duplicate application",
                    },
                    typedConfirmation: "DELETE",
                    confirmLabel: "Delete candidate",
                    tone: "destructive",
                  });
                  if (!c.confirmed) return;
                  onRun("delete", async () => {
                    const r = await deleteCandidateMatch({
                      data: { match_id: m.id, reason: c.reason || reason },
                    });
                    // Navigate back to the admin list after delete
                    setTimeout(() => {
                      window.location.href = "/admin/candidates";
                    }, 400);
                    return r;
                  });
                  })();
                }}
                data-qa-action="overflow-delete"
                className="text-destructive"
              >
                Delete candidate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Publish button surfaces only when it is the next real step */}
        {canPublish && !isPublished && (
          <Button
            variant="secondary"
            className="mt-2 w-full"
            disabled={publish.isPending}
            onClick={() => publish.mutate("visible")}
            data-qa-action="publish-to-client"
          >
            Publish candidate
          </Button>
        )}
        {isPublished && (
          <Button
            variant="outline"
            className="mt-2 w-full"
            disabled={publish.isPending}
            onClick={() => publish.mutate("hidden")}
            data-qa-action="unpublish-from-client"
          >
            Unpublish
          </Button>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <Badge variant="outline">processing: {m.processing_state.replace(/_/g, " ")}</Badge>
          <Badge variant="outline">review: {m.admin_status}</Badge>
          <Badge variant={isPublished ? "default" : "outline"}>
            {isPublished ? "Published" : "Not published"}
          </Badge>
        </div>
      </div>

      {/* Review notes + manual override — kept persistent (audit-visible input) */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Review notes</h2>
        <Label htmlFor="reason" className="mt-2 text-xs">
          Reason (attaches to the next review decision)
        </Label>
        <Textarea
          id="reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Note for the audit trail…"
        />

        <Label htmlFor="override" className="mt-3 block text-xs">
          Manual override score
        </Label>
        <div className="flex gap-2">
          <Input
            id="override"
            type="number"
            min={0}
            max={100}
            value={override}
            onChange={(e) => setOverride(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!!busy || override === ""}
            onClick={() =>
              onRun("override", () =>
                applyReviewDecision({
                  data: {
                    match_id: m.id,
                    action: "manual_override",
                    approved_score: Number(override),
                    reason,
                  },
                }),
              )
            }
          >
            Save
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Recorded as a decision — the underlying score run stays immutable.
        </p>
      </div>

      {/* Inline OCR entry — only when the pipeline is blocked on it */}
      {m.processing_state === "ocr_required" && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Attach OCR text</h2>
          <Label htmlFor="ocr" className="mt-2 text-xs">
            Paste OCR output (min 60 chars)
          </Label>
          <Textarea
            id="ocr"
            rows={3}
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
          />
          <Button
            className="mt-2 w-full"
            size="sm"
            disabled={!!busy || ocrText.length < 60}
            onClick={() =>
              onRun("attach OCR", () =>
                markOcrDone({ data: { match_id: m.id, ocr_text: ocrText } }),
              )
            }
          >
            Attach OCR &amp; continue
          </Button>
        </div>
      )}

      {currentRun && (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3 w-3" />
            Every action is auditable and safe to retry.
          </div>
        </div>
      )}

      {isPublished && (
        <div className="rounded-lg border bg-success/10 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-success dark:text-success">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Live for client
          </div>
        </div>
      )}
    </aside>
  );
}


