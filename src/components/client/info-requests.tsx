import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { briefField, type InfoRequestCard } from "@/lib/position-info-requests";
import { answerInfoRequest, listInfoRequests } from "@/lib/position-info-requests.functions";

/**
 * "Information needed" — one card per open request.
 *
 * The card names the field, the question, who asked, when, and what the answer
 * unblocks. The answer is written here and the request clears in the same step;
 * a failure keeps the typed answer and offers a retry.
 */
export function InfoRequestCardView({
  request,
  onAnswered,
}: {
  request: InfoRequestCard;
  onAnswered: () => void;
}) {
  const spec = briefField(request.brief_field);
  const submit = useServerFn(answerInfoRequest);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const send = async () => {
    if (value.trim().length === 0) {
      setError("Write an answer before you send it");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await submit({ data: { requestId: request.id, answer: value } });
      if (result.ok) {
        setDone(result.fieldLabel);
        onAnswered();
      } else {
        setError(result.error);
      }
    } catch {
      setError("That did not save. Your answer is still here — try again.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div
        className="rounded-xl border border-border bg-card p-4 text-sm"
        role="status"
        data-testid="info-request-answered"
      >
        Thank you — {done.toLowerCase()} is updated on your brief and the request is cleared.
      </div>
    );
  }

  return (
    <div
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      data-testid="info-request-card"
      data-field={request.brief_field}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Information needed — {request.field_label}</p>
        <p className="text-xs text-muted-foreground">{request.waiting_label}</p>
      </div>

      <p className="text-sm leading-relaxed">{request.question}</p>
      {request.why_needed && (
        <p className="text-sm leading-relaxed text-muted-foreground">{request.why_needed}</p>
      )}
      <p className="text-sm leading-relaxed text-muted-foreground">{request.impact}</p>
      <p className="text-xs text-muted-foreground">
        Asked by {request.asked_by_name ?? "your TaaSFlow recruiter"} on{" "}
        {new Date(request.created_at).toLocaleDateString()}
      </p>

      {!request.answerable || !spec ? (
        <p className="text-sm text-muted-foreground">
          This one needs a conversation — reply in your workspace conversation and we will update the
          brief with you.
        </p>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`answer-${request.id}`}>
            Your answer — {spec.label}
          </label>
          {spec.input === "choice" ? (
            <div className="flex flex-wrap gap-2">
              {(spec.choices ?? []).map((c) => (
                <Button
                  key={c.value}
                  type="button"
                  size="sm"
                  variant={value === c.value ? "default" : "outline"}
                  onClick={() => setValue(c.value)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          ) : spec.input === "textarea" ? (
            <Textarea
              id={`answer-${request.id}`}
              value={value}
              rows={4}
              placeholder={spec.placeholder}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : (
            <Input
              id={`answer-${request.id}`}
              value={value}
              inputMode={spec.input === "number" ? "numeric" : "text"}
              placeholder={spec.placeholder}
              onChange={(e) => setValue(e.target.value)}
            />
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="button" size="sm" onClick={() => void send()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving to your brief…
              </>
            ) : error ? (
              "Try again"
            ) : (
              "Answer and update my brief"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A list of open requests. Renders nothing when there are none. */
export function InfoRequestList({
  requests,
  loading,
  error,
  onAnswered,
  onRetry,
  heading = "Information needed",
}: {
  requests: InfoRequestCard[];
  loading?: boolean;
  error?: boolean;
  onAnswered: () => void;
  onRetry?: () => void;
  heading?: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2" data-testid="info-requests-loading">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm" role="alert">
        <p>We could not load your open requests. Nothing has been lost.</p>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (requests.length === 0) return null;

  return (
    <section className="space-y-3" aria-label={heading}>
      <h2 className="text-sm font-semibold">
        {heading}
        {requests.length > 1 ? ` (${requests.length})` : ""}
      </h2>
      {requests.map((r) => (
        <InfoRequestCardView key={r.id} request={r} onAnswered={onAnswered} />
      ))}
    </section>
  );
}

/**
 * Self-contained panel: loads the open requests for a workspace (optionally one
 * role) and renders them. Used on the /client queue and on the role page.
 */
export function InfoRequestsPanel({
  orgId,
  positionId,
  heading,
  onAnswered,
}: {
  orgId: string | null | undefined;
  positionId?: string;
  heading?: string;
  onAnswered?: () => void;
}) {
  const listFn = useServerFn(listInfoRequests);
  const query = useQuery({
    queryKey: ["client", "info-requests", orgId, positionId ?? null],
    queryFn: () =>
      listFn({ data: { orgId: orgId!, ...(positionId ? { positionId } : {}) } }),
    enabled: !!orgId,
    staleTime: 30_000,
  });

  if (!orgId) return null;

  return (
    <InfoRequestList
      requests={query.data?.requests ?? []}
      loading={query.isLoading}
      error={query.isError}
      heading={heading}
      onRetry={() => void query.refetch()}
      onAnswered={() => {
        void query.refetch();
        onAnswered?.();
      }}
    />
  );
}
