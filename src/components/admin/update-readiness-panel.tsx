import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, RotateCcw } from "lucide-react";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import {
  getUpdateReadiness,
  markClientUpdateSent,
  revertClientUpdateSent,
} from "@/lib/client-update-readiness.functions";
import { formatDate, readinessToText } from "@/lib/client-update-readiness";

const BASELINE_LABEL: Record<string, string> = {
  update_sent: "last update marked as sent",
  client_activity: "last client-visible activity",
  organization_created: "client created",
};

export function UpdateReadinessPanel({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ["client-update-readiness", organizationId],
    queryFn: () => getUpdateReadiness({ data: { organization_id: organizationId } }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["client-update-readiness", organizationId] });

  const markSent = useMutation({
    mutationFn: () =>
      markClientUpdateSent({
        data: {
          organization_id: organizationId,
          ...(query.data ? { previous_baseline_at: query.data.baseline_at } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Update marked as sent", { description: "Reversible for 24 hours." });
      void invalidate();
    },
    onError: (e: unknown) =>
      toast.error("Could not mark the update as sent", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const revert = useMutation({
    mutationFn: (eventId: string) =>
      revertClientUpdateSent({ data: { organization_id: organizationId, event_id: eventId } }),
    onSuccess: () => {
      toast.success("Baseline restored");
      void invalidate();
    },
    onError: (e: unknown) =>
      toast.error("Could not reverse the update", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const summaryText = useMemo(
    () => (query.data ? readinessToText(query.data) : ""),
    [query.data],
  );

  return (
    <PanelState query={query} isEmpty={false} skeletonRows={4} className="rounded-lg border p-5">
      {query.data && (
        <section className="rounded-lg border" data-qa="update-readiness">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
            <div>
              <h3 className="font-medium">Update readiness</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Since {formatDate(query.data.baseline_at)} ({BASELINE_LABEL[query.data.baseline_source]}) ·{" "}
                {query.data.total_items} item{query.data.total_items === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(summaryText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    toast.error("Could not copy the summary");
                  }
                }}
                data-qa-action="copy-readiness"
              >
                {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy summary"}
              </Button>
              {query.data.revert_event_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revert.isPending}
                  onClick={() => revert.mutate(query.data!.revert_event_id as string)}
                  data-qa-action="revert-readiness"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Undo last “sent”
                </Button>
              )}
              <Button
                size="sm"
                disabled={markSent.isPending}
                onClick={() => markSent.mutate()}
                data-qa-action="mark-update-sent"
              >
                Mark update as sent
              </Button>
            </div>
          </header>

          {query.data.revert_available_until && (
            <p className="border-b bg-muted/40 px-5 py-2 text-xs text-muted-foreground">
              Baseline set by a staff member. Reversible until{" "}
              {new Date(query.data.revert_available_until).toLocaleString()}.
            </p>
          )}

          {query.data.total_items === 0 ? (
            <PanelEmpty
              className="m-5"
              title="Nothing to report"
              description={`Nothing has changed since the last update on ${formatDate(query.data.baseline_at)}.`}
            />
          ) : (
            <div className="divide-y">
              {query.data.sections
                .filter((s) => s.items.length > 0)
                .map((section) => (
                  <div key={section.key} className="p-5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{section.title}</h4>
                      <Badge variant="secondary">{section.items.length}</Badge>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {section.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <Link
                              to={
                                item.link_kind === "candidate"
                                  ? "/admin/candidates/$id"
                                  : "/admin/positions/$id"
                              }
                              params={{ id: item.link_id }}
                              className="font-medium hover:underline"
                            >
                              {item.label}
                            </Link>
                            {item.detail && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {item.detail}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDate(item.at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}
    </PanelState>
  );
}
