import { useState } from "react";
import { sanitizeInternalMarkers } from "@/lib/human-labels";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOperationalHealth, retryOperationalIssue } from "@/lib/admin-workbench.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDateTime } from "@/lib/format/datetime";
import { humanizeCode } from "@/lib/humanize-codes";
import { TechnicalDetail } from "@/components/admin/technical-detail";
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
      setNote(`Retry queued · ${new Date().toLocaleTimeString(APP_LOCALE, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
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
                      className="h-6 shrink-0 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(i.id);
                          toast.success("Trace ID copied — paste it to support");
                        } catch {
                          toast.error("Clipboard unavailable");
                        }
                      }}
                    >
                      Copy trace ID
                    </Button>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{formatDateTime(i.occurred_at)}</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate({ kind: i.kind, id: i.id })}
                    >
                      Retry
                    </Button>
                    <Link to="/admin/candidates/$id" params={{ id: i.entity_id || i.id }} className="inline-flex min-h-8 items-center px-1 text-xs text-primary hover:underline">Open</Link>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{humanizeCode(i.detail).toLowerCase()}</p>
                {i.last_error ? (
                  <TechnicalDetail
                    className="mt-1"
                    payload={sanitizeInternalMarkers(i.last_error)}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </PanelState>
      </CardContent>
    </Card>
  );
}