import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOperationalHealth, retryOperationalIssue } from "@/lib/admin-workbench.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const KIND_LABEL: Record<string, string> = {
  webhook: "Failed webhooks",
  processing: "Stuck jobs",
  email: "Failed emails",
  cv: "Unprocessed CVs",
};

export function OperationalHealthPanel() {
  const qc = useQueryClient();
  const healthFn = useServerFn(getOperationalHealth);
  const retryFn = useServerFn(retryOperationalIssue);
  const [note, setNote] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["ops-health"], queryFn: () => healthFn() });

  const retry = useMutation({
    mutationFn: async (v: { kind: "webhook" | "processing" | "email" | "cv"; id: string }) =>
      retryFn({ data: v }),
    onSuccess: async () => {
      setNote("Retry queued.");
      await qc.invalidateQueries({ queryKey: ["ops-health"] });
    },
    onError: (e: Error) => setNote(`Retry failed: ${e.message}`),
  });

  const issues = data?.issues ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Operational health</CardTitle>
        <p className="text-xs text-muted-foreground">
          Failed webhooks, stuck processing jobs, failed emails and unprocessed CVs — each with its last error and a
          retry.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {(["webhook", "processing", "email", "cv"] as const).map((k) => (
            <div key={k} className="rounded-md border border-border/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{KIND_LABEL[k]}</p>
              <p className="text-2xl font-semibold">{data?.counts?.[k] ?? 0}</p>
            </div>
          ))}
        </div>

        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Checking systems…</p>
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing failing right now. Everything has been picked up.</p>
        ) : (
          <div className="space-y-2">
            {issues.map((i: any) => (
              <div key={`${i.kind}-${i.id}`} className="rounded-md border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{KIND_LABEL[i.kind]}</Badge>
                  <span className="text-sm font-medium">{i.label}</span>
                  <span className="text-xs text-muted-foreground">{new Date(i.occurred_at).toLocaleString()}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate({ kind: i.kind, id: i.id })}
                  >
                    Retry
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
                {i.last_error ? (
                  <p className="mt-1 break-words font-mono text-xs text-destructive">{i.last_error}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
