import { createFileRoute, Link } from "@tanstack/react-router";
import { FormShell } from "@/components/marketing/form-shell";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BLUEPRINT_STAGES, blueprintProgress } from "@/lib/express-intake-schema";
import { CheckCircle2, CircleDashed, Loader2, TriangleAlert } from "lucide-react";

const searchSchema = z.object({
  intake_id: z.string().uuid().optional(),
});

type StatusBody = {
  ok: boolean;
  intakeId: string;
  companyName: string;
  roleTitle: string;
  positionId: string | null;
  workspaceStatus: string | null;
  blueprintStatus: string;
  blueprintFailed: boolean;
  summary: { mustHaves: number; screeningQuestions: number; confidence: number } | null;
  createdAt: string;
};

export const Route = createFileRoute("/intake_/confirmation")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Preparing your role — TaaSFlow" },
      {
        name: "description",
        content: "Your TaaSFlow workspace is live and your role blueprint is being prepared.",
      },
      { property: "og:title", content: "Preparing your role — TaaSFlow" },
      {
        property: "og:description",
        content: "Your TaaSFlow workspace is live and your role blueprint is being prepared.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { intake_id } = Route.useSearch();
  const [status, setStatus] = useState<StatusBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(intake_id));
  const retriedRef = useRef(false);

  useEffect(() => {
    if (!intake_id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const res = await fetch(`/api/public/blueprint-status/${intake_id}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || !body?.ok) {
          setError(body?.error || "lookup_failed");
        } else {
          setError(null);
          setStatus(body as StatusBody);
          const done = body.blueprintStatus === "ready" || body.blueprintStatus === "failed";
          // If nothing has claimed the job yet (e.g. the tab was closed mid-run),
          // nudge it once so the client is never stuck on "queued".
          if (!done && body.blueprintStatus === "queued" && !retriedRef.current) {
            retriedRef.current = true;
            void fetch("/api/public/blueprint-run", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ intakeId: intake_id }),
            }).catch(() => undefined);
          }
          if (!done) timer = setTimeout(load, 4000);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "network_error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intake_id]);

  const stageIndex = status
    ? BLUEPRINT_STAGES.findIndex((s) => s.key === status.blueprintStatus)
    : -1;
  const ready = status?.blueprintStatus === "ready";
  const failed = status?.blueprintFailed === true;

  return (
    <FormShell exitTo="/" exitLabel="Back to home" width="md" eyebrow="Your workspace is live">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {ready
              ? "Your role blueprint is ready"
              : failed
                ? "Your role is saved — a specialist is finishing the brief"
                : "Preparing your role"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          {!intake_id && (
            <p className="text-muted-foreground">
              We didn't receive a submission reference. If you just submitted and see this page, email{" "}
              <a className="underline" href="mailto:hello@taasflow.com">
                hello@taasflow.com
              </a>
              .
            </p>
          )}

          {intake_id && loading && !status && <p className="text-muted-foreground">Loading status…</p>}

          {intake_id && error && !status && (
            <>
              <p className="text-destructive">We couldn't load your status ({error}).</p>
              <p className="text-muted-foreground">
                Your reference is <span className="font-mono">{intake_id.slice(0, 8)}</span>. Email{" "}
                <a className="underline" href="mailto:hello@taasflow.com">
                  hello@taasflow.com
                </a>{" "}
                and include it.
              </p>
            </>
          )}

          {status && (
            <>
              <p>
                <strong>{status.roleTitle}</strong> is live in the {status.companyName} workspace. You can
                open it right now — we'll keep filling in the details.
              </p>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">
                    {failed ? "Handed to a TaaSFlow specialist" : "System progress"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {blueprintProgress(status.blueprintStatus)}%
                  </span>
                </div>
                <Progress value={blueprintProgress(status.blueprintStatus)} />
                <ol className="space-y-2">
                  {BLUEPRINT_STAGES.map((stage, i) => {
                    const complete = ready || (stageIndex > -1 && i < stageIndex);
                    const active = !ready && !failed && i === stageIndex;
                    return (
                      <li key={stage.key} className="flex items-start gap-2">
                        {complete ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                        ) : active ? (
                          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-foreground" aria-hidden />
                        ) : failed ? (
                          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                        ) : (
                          <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className={complete || active ? "text-foreground" : "text-muted-foreground"}>
                          {stage.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {failed && (
                  <p className="text-muted-foreground">
                    We couldn't finish the automated brief from what was provided. Your role and job
                    description are safe — a TaaSFlow specialist is completing it, and you can edit every
                    field yourself in the meantime.
                  </p>
                )}
              </div>

              {ready && status.summary && (
                <dl className="grid grid-cols-3 gap-3 rounded-lg border p-4 text-center">
                  <div>
                    <dt className="text-xs text-muted-foreground">Must-haves</dt>
                    <dd className="text-lg font-semibold">{status.summary.mustHaves}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Screening questions</dt>
                    <dd className="text-lg font-semibold">{status.summary.screeningQuestions}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Confidence</dt>
                    <dd className="text-lg font-semibold">
                      {Math.round(status.summary.confidence * 100)}%
                    </dd>
                  </div>
                </dl>
              )}

              <p className="text-muted-foreground">
                We've emailed {ready ? "your blueprint summary" : "your workspace details"} to the address
                you used. Every generated answer is editable by you and by our team.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {status.positionId ? (
                  <Button asChild>
                    <Link to="/client/positions/$id" params={{ id: status.positionId }}>
                      Open the role
                    </Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link to="/client">Open your workspace</Link>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <a href="/">Back to home</a>
                </Button>
              </div>
            </>
          )}

          {!status && (
            <div className="pt-2">
              <Button asChild variant="outline">
                <a href="/">Back to home</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </FormShell>
  );
}
