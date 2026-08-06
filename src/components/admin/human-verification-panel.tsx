/**
 * Human verification panel (Prompt 10) — staff surface.
 *
 * Shows, per criterion, whether the machine decided it or a person did, how
 * much of the score rests on human-verified evidence, and lets a reviewer mark
 * a requirement met, not met or not applicable with a mandatory written reason.
 * Submitting produces a new human-adjusted score run; nothing is edited in
 * place.
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getHumanVerification, submitHumanAdjustment } from "@/lib/scoring-review.functions";
import { HUMAN_VERDICTS, MIN_REASON_LENGTH, type HumanVerdict } from "@/lib/scoring/human-adjustment";

const VERDICT_LABEL: Record<HumanVerdict, string> = {
  met: "Met",
  not_met: "Not met",
  not_applicable: "Not applicable",
};

type Draft = { verdict: HumanVerdict; reason: string };

export function HumanVerificationPanel({
  matchId,
  onChanged,
}: {
  matchId: string;
  onChanged?: () => void | Promise<void>;
}) {
  const load = useServerFn(getHumanVerification);
  const submit = useServerFn(submitHumanAdjustment);
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: ["human-verification", matchId],
    queryFn: () => load({ data: { match_id: matchId } }),
  });

  const data = query.data ?? null;
  const pending = useMemo(
    () =>
      Object.entries(drafts)
        .filter(([, d]) => d.reason.trim().length >= MIN_REASON_LENGTH)
        .map(([requirement_id, d]) => ({ requirement_id, verdict: d.verdict, reason: d.reason.trim() })),
    [drafts],
  );

  const mutation = useMutation({
    mutationFn: () =>
      submit({ data: { match_id: matchId, reason: reason.trim(), verdicts: pending } }),
    onSuccess: async (res) => {
      toast.success(
        `Recorded — new reviewed assessment at ${(res as { final_score: number }).final_score.toFixed(1)}/100`,
      );
      setDrafts({});
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["human-verification", matchId] });
      await onChanged?.();
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "no_completed_run"
          ? "There is no completed assessment to adjust yet."
          : e.message === "no_requirement_assessment"
            ? "This assessment has no recorded criteria to adjust."
            : `Could not record the review: ${e.message}`,
      ),
  });

  const canSubmit =
    pending.length > 0 && reason.trim().length >= MIN_REASON_LENGTH && !mutation.isPending;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Human verification</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {query.isLoading
              ? "Loading criteria…"
              : (data?.verified.line ?? "No assessment recorded for this candidate yet.")}
          </p>
        </div>
        {data?.humanAdjusted ? (
          <Badge variant="outline" className="border-primary/30 text-primary">
            Reviewed by {data.actorName ?? "a reviewer"}
          </Badge>
        ) : null}
      </div>

      {data?.reason ? (
        <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          Last review note: “{data.reason}”
        </p>
      ) : null}

      {data && data.rows.length > 0 ? (
        <ul className="space-y-2">
          {data.rows.map((row) => {
            const draft = drafts[row.id];
            return (
              <li key={row.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      row.source === "human"
                        ? "border-primary/30 text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {row.source === "human" ? "Human-verified" : "Machine-derived"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {row.not_applicable ? "not applicable" : row.status.replace(/_/g, " ")}
                  </span>
                  {row.required ? <Badge variant="secondary">must-have</Badge> : null}
                  {row.machine_status && row.source === "human" ? (
                    <span className="text-[11px] text-muted-foreground">
                      machine said {row.machine_status.replace(/_/g, " ")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm">{row.text}</p>
                {row.source === "human" && row.reason ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.actor_name ?? "A reviewer"}: “{row.reason}”
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {HUMAN_VERDICTS.map((v) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant={draft?.verdict === v ? "default" : "outline"}
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.id]: { verdict: v, reason: prev[row.id]?.reason ?? "" },
                        }))
                      }
                    >
                      {VERDICT_LABEL[v]}
                    </Button>
                  ))}
                  {draft ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDrafts((prev) => {
                          const next = { ...prev };
                          delete next[row.id];
                          return next;
                        })
                      }
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                {draft ? (
                  <Textarea
                    className="mt-2"
                    rows={2}
                    placeholder={`Why is this ${VERDICT_LABEL[draft.verdict].toLowerCase()}? (required, min ${MIN_REASON_LENGTH} characters)`}
                    value={draft.reason}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: { verdict: draft.verdict, reason: e.target.value },
                      }))
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {data && data.rows.length > 0 ? (
        <div className="space-y-2 border-t pt-3">
          <Textarea
            rows={2}
            placeholder={`Why are you adjusting this assessment? (required, min ${MIN_REASON_LENGTH} characters — staff-only, never shown to the client)`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {pending.length === 0
                ? "Pick a verdict and write a reason to record a review."
                : `${pending.length} verdict${pending.length === 1 ? "" : "s"} ready. This creates a new reviewed assessment; the machine assessment stays on record.`}
            </p>
            <Button type="button" disabled={!canSubmit} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Recording…" : "Record human review"}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
