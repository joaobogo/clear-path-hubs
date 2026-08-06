import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  getIntegrationStrip,
  drainIntegrationQueue,
  type StripChip,
} from "@/lib/integration-strip.functions";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";

const STATE_STYLE: Record<
  StripChip["state"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; dot: string }
> = {
  healthy: { label: "Healthy", variant: "default", dot: "bg-emerald-500" },
  degraded: { label: "Degraded", variant: "secondary", dot: "bg-amber-500" },
  failing: { label: "Failing", variant: "destructive", dot: "bg-destructive" },
  not_configured: { label: "Not configured", variant: "outline", dot: "bg-muted-foreground" },
  unknown: { label: "Unknown", variant: "outline", dot: "bg-muted-foreground" },
};

function ago(iso: string | null) {
  if (!iso) return "never";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function IntegrationHealthStrip({ onRunChecks }: { onRunChecks?: () => void }) {
  const qc = useQueryClient();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const drainFn = useServerFn(drainIntegrationQueue);

  const strip = useQuery({
    queryKey: ["integration-strip"],
    queryFn: () => getIntegrationStrip(),
    refetchInterval: 60_000,
  });

  const drain = useMutation({
    mutationFn: (queue: "crm" | "processing") => drainFn({ data: { queue } }),
    onSuccess: async (r) => {
      toast.success(
        r.processed === 0
          ? "Queue was already empty — nothing to drain."
          : `Drained ${r.processed} item${r.processed === 1 ? "" : "s"}${
              r.failed ? ` · ${r.failed} still failing` : ""
            }.`,
      );
      await qc.invalidateQueries({ queryKey: ["integration-strip"] });
      await qc.invalidateQueries({ queryKey: ["integration-health"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "The queue could not be drained."),
  });

  const chips = strip.data?.chips ?? [];
  const open = chips.find((c) => c.key === openKey) ?? null;

  return (
    <PanelState
      query={strip}
      isEmpty={chips.length === 0}
      empty={
        <PanelEmpty
          title="No integrations configured"
          description="Nothing to check yet — connected integrations will appear here."
        />
      }
    >
      <section className="space-y-3" aria-label="Integration status">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => {
            const style = STATE_STYLE[chip.state];
            const selected = openKey === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setOpenKey(selected ? null : chip.key)}
                aria-expanded={selected}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selected ? "border-foreground/40 bg-muted" : "hover:bg-muted/60"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
                <span className="font-medium">{chip.name}</span>
                <Badge variant={style.variant} className="text-[10px]">
                  {style.label}
                </Badge>
                {chip.queue && chip.queue.depth > 0 ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {chip.queue.depth} queued
                  </span>
                ) : null}
              </button>
            );
          })}
          {onRunChecks ? (
            <Button size="sm" variant="outline" onClick={onRunChecks}>
              Re-run checks
            </Button>
          ) : null}
        </div>

        {open ? (
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{open.name}</h3>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{open.reason}</p>
              </div>
              <Badge variant={STATE_STYLE[open.state].variant}>
                {STATE_STYLE[open.state].label}
              </Badge>
            </div>

            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Last successful sync</dt>
                <dd className="font-medium">{ago(open.last_success_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last failure</dt>
                <dd className="font-medium">{ago(open.last_failure_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last check</dt>
                <dd className="font-medium">
                  {ago(open.last_check_at)}
                  {open.last_check_status ? ` · ${open.last_check_status}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expected interval</dt>
                <dd className="font-medium">
                  {Math.round(open.expected_interval_minutes / 60)}h
                </dd>
              </div>
            </dl>

            {open.queue ? (
              <div className="mt-4 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{open.queue.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {open.queue.error
                        ? `Depth unknown — ${open.queue.error}`
                        : `${open.queue.depth} waiting (threshold ${open.queue.threshold})` +
                          (open.queue.oldest_at
                            ? ` · oldest ${ago(open.queue.oldest_at)}`
                            : " · no unprocessed items")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!open.queue.drainable || open.queue.depth === 0 || drain.isPending}
                    onClick={() => drain.mutate(open.queue!.key)}
                  >
                    {drain.isPending ? "Draining…" : "Drain queue"}
                  </Button>
                </div>
              </div>
            ) : null}

            {open.clients ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Client connections — {open.clients.healthy} healthy · {open.clients.degraded}{" "}
                degraded · {open.clients.failing} failing · {open.clients.not_connected} not
                connected
              </p>
            ) : null}

            {open.last_failure_detail ? (
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                {open.last_failure_detail}
              </pre>
            ) : null}
          </Card>
        ) : null}
      </section>
    </PanelState>
  );
}
