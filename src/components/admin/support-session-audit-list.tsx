import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSupportAudit } from "@/lib/support-audit.functions";
import { endSupportSession } from "@/lib/support.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toastError } from "@/lib/toast-error";

const PERIODS = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
] as const;

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

function duration(startIso: string, endIso: string | null) {
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - new Date(startIso).getTime()) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function SupportSessionAuditList() {
  const qc = useQueryClient();
  const auditFn = useServerFn(getSupportAudit);
  const endFn = useServerFn(endSupportSession);
  const [days, setDays] = useState<number>(7);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ["support-audit", days],
    queryFn: () => auditFn({ data: { days } }),
  });

  const end = useMutation({
    mutationFn: (session_id: string) => endFn({ data: { session_id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["support-audit"] });
      await qc.invalidateQueries({ queryKey: ["admin-support"] });
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't end. Nothing was saved — please try again." }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-base">Support session audit</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Every staff visit into a client workspace, the reason given, and each action taken
            inside that session. Sessions close themselves after 30 minutes.
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Audit period">
          {PERIODS.map((p) => (
            <Button
              key={p.days}
              size="sm"
              variant={days === p.days ? "secondary" : "ghost"}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <PanelState
          query={query}
          isEmpty={(query.data?.sessions.length ?? 0) === 0}
          empty={<PanelEmpty title="No support sessions in this period." />}
        >
          {query.data && (
            <>
              {query.data.expired_now > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {query.data.expired_now} session
                  {query.data.expired_now === 1 ? "" : "s"} closed automatically at expiry.
                </p>
              ) : null}
              <ul className="space-y-2">
                {query.data.sessions.map((s) => {
                  const isOpen = open[s.id] ?? false;
                  return (
                    <li key={s.id} className="rounded-md border border-border/60">
                      <div className="flex flex-wrap items-center gap-3 p-3 text-sm">
                        <button
                          type="button"
                          onClick={() => setOpen((prev) => ({ ...prev, [s.id]: !isOpen }))}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? "Hide session actions" : "Review session actions"}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <Badge variant={s.mode === "interactive" ? "destructive" : "secondary"}>
                          {s.mode === "interactive" ? "Interactive" : "Read-only"}
                        </Badge>
                        <span className="font-medium">{s.staff_name}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{s.organization_name}</span>
                        <span className="text-muted-foreground">
                          {fmt(s.started_at)} · {duration(s.started_at, s.ended_at)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.actions.length} action{s.actions.length === 1 ? "" : "s"}
                        </span>
                        <span className="ml-auto flex items-center gap-2">
                          {s.is_active ? (
                            <>
                              <Badge variant="outline">Open · expires {fmt(s.expires_at)}</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => end.mutate(s.id)}
                                disabled={end.isPending}
                              >
                                End
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {s.end_reason === "expired" ? "Expired" : "Closed"}{" "}
                              {s.ended_at ? fmt(s.ended_at) : ""}
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
                        Reason: <span className="text-foreground">{s.reason}</span> · role{" "}
                        {s.actor_role} · scope {s.scope}
                      </p>
                      {isOpen ? (
                        <div className="border-t border-border/60 p-3">
                          {s.actions.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No actions were recorded inside this session.
                            </p>
                          ) : (
                            <ol className="space-y-1">
                              {s.actions.map((a) => (
                                <li key={a.id} className="text-xs text-muted-foreground">
                                  <span className="text-foreground">{a.action}</span> ·{" "}
                                  {a.target_type ?? "—"} · {fmt(a.occurred_at)}
                                  {a.reason ? ` · ${a.reason}` : ""}
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </PanelState>
      </CardContent>
    </Card>
  );
}
