import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOperationalHealth, retryOperationalIssue } from "@/lib/admin-workbench.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
import { humanizeCode } from "@/lib/humanize-codes";
import { Link } from "@tanstack/react-router";

const KIND_LABEL: Record<string, string> = {
  webhook: "Failed webhooks",
  processing: "Processing exceptions",
  email: "Failed emails",
  cv: "Unprocessed CVs",
};

export function OperationalHealthPanel() {
  const qc = useQueryClient();
  const healthFn = useServerFn(getOperationalHealth);
  const retryFn = useServerFn(retryOperationalIssue);
  const [note, setNote] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["ops-health"],
    queryFn: () => healthFn(),
  });
  const { data } = query;

  const retry = useMutation({
    mutationFn: async (v: { kind: "webhook" | "processing" | "email" | "cv"; id: string }) =>
      retryFn({ data: v }),
    onSuccess: async () => {
      setNote("Retry queued.");
      await qc.invalidateQueries({ queryKey: ["ops-health"] });
    },
    onError: (e: Error) => {
      const msg = e.message;
      if (msg.includes("unique or exclusion constraint")) {
        setNote("Could not save — a matching record already exists (duplicate key).");
      } else {
        setNote(`Retry failed: ${msg}`);
      }
    },
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

        <PanelState
          query={query}
          isEmpty={issues.length === 0}
          empty={
            <PanelEmpty
              title="Nothing failing right now"
              description="Everything has been picked up."
            />
          }
        >
          <div className="space-y-2">
            {issues.map((i: any) => (
              <div key={`${i.kind}-${i.id}`} className="rounded-md border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{KIND_LABEL[i.kind]}</Badge>
                  <span className="text-sm font-medium">{i.label}</span>
                  {i.kind === "processing" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-1 text-[10px] text-muted-foreground hover:text-foreground"
                      title="Copy Trace ID"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(i.id);
                          toast.success("Trace ID copied");
                        } catch {
                          toast.error("Clipboard unavailable");
                        }
                      }}
                    >
                      {i.id.slice(0, 8)}…
                    </Button>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{new Date(i.occurred_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate({ kind: i.kind, id: i.id })}
                    >
                      Retry
                    </Button>
                    <Link to="/admin/candidates/$id" params={{ id: i.entity_id || i.id }} className="text-xs text-primary hover:underline">open</Link>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{humanizeCode(i.detail)}</p>
                {i.last_error ? (
                  <div className="mt-1 flex items-start gap-2">
                    <p className="break-words font-mono text-[10px] leading-relaxed text-destructive/80">
                      {i.last_error.includes("unique or exclusion constraint")
                        ? "Could not save — a matching record already exists (duplicate key)."
                        : i.last_error}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(i.last_error);
                          toast.success("Payload copied");
                        } catch {
                          toast.error("Clipboard unavailable");
                        }
                      }}
                    >
                      Copy payload
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </PanelState>
      </CardContent>
    </Card>
  );
}