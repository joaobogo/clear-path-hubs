import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  intake_id: z.string().uuid().optional(),
});

type Status = {
  id: string;
  company_name: string;
  role_title: string;
  status: string;
  workspace_status: string | null;
  requisition_pending: boolean | null;
  position_id: string | null;
  organization_id: string | null;
  created_at: string;
  trace_id: string | null;
};

export const Route = createFileRoute("/intake_/confirmation")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Intake received — TaaSFlow" },
      { name: "description", content: "Your hiring engagement request has been received by TaaSFlow." },
      { property: "og:title", content: "Intake received — TaaSFlow" },
      {
        property: "og:description",
        content: "Your hiring engagement request has been received by TaaSFlow.",
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
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(intake_id));

  useEffect(() => {
    if (!intake_id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/public/intake-status/${intake_id}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || !body?.ok) {
          setError(body?.error || "lookup_failed");
        } else {
          setStatus(body.intake as Status);
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
    };
  }, [intake_id]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Intake received</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!intake_id && (
            <p className="text-muted-foreground">
              We didn't receive a submission reference. If you just submitted the intake and see this
              page, please contact <a className="underline" href="mailto:hello@taasflow.com">hello@taasflow.com</a>.
            </p>
          )}

          {intake_id && loading && <p className="text-muted-foreground">Loading status…</p>}

          {intake_id && error && (
            <>
              <p className="text-destructive">We couldn't load the status of your intake ({error}).</p>
              <p className="text-muted-foreground">
                Your reference is <span className="font-mono">{intake_id}</span>. Please email{" "}
                <a className="underline" href="mailto:hello@taasflow.com">hello@taasflow.com</a> and
                include this reference.
              </p>
            </>
          )}

          {status && (
            <>
              <p>
                Thanks — we've received your request for{" "}
                <strong>{status.role_title}</strong> at{" "}
                <strong>{status.company_name}</strong>.
              </p>
              <dl className="grid grid-cols-2 gap-y-1 rounded-md border p-3 text-xs">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="font-mono">{status.id.slice(0, 8)}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{status.status}</dd>
                <dt className="text-muted-foreground">Workspace</dt>
                <dd>{status.workspace_status || "pending"}</dd>
                <dt className="text-muted-foreground">Requisition</dt>
                <dd>
                  {status.position_id
                    ? "created"
                    : status.requisition_pending
                      ? "preparing"
                      : "pending"}
                </dd>
                <dt className="text-muted-foreground">Received</dt>
                <dd>{new Date(status.created_at).toLocaleString()}</dd>
              </dl>
              <p className="text-muted-foreground">
                A TaaSFlow reviewer will confirm scope and shortlist criteria within one business day.
                You'll receive workspace access at the email you provided.
              </p>
            </>
          )}

          <div className="pt-2">
            <Button asChild variant="outline">
              <a href="/">Back to home</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
