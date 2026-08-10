import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from \"@/lib/toast-error\";
import { useState } from "react";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { getClientContext } from "@/lib/client-context.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import {
  getAgentPanel,
  listAgentActivity,
  setAgentEnabled,
  setAgentPaused,
} from "@/lib/agents.functions";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { Button } from "@/components/ui/button";
import { AgentCardView } from "@/components/client/agents/agent-card";
import { AgentActivityList } from "@/components/client/agents/activity-list";

export const Route = createFileRoute("/_authenticated/client/agents")({
  head: () => ({
    meta: [
      { title: "Agent control · Client workspace" },
      {
        name: "description",
        content:
          "See what every recruiting agent is doing, switch it on or off, pause it immediately, and read what it produced this week.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "client",
    "src/routes/_authenticated/client.agents.tsx",
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Not found.</div>
  ),
  component: AgentControlPage,
});

function AgentControlPage() {
  const orgSearch = useClientOrgSearch();
  const qc = useQueryClient();
  const ctxFn = useServerFn(getClientContext);
  const panelFn = useServerFn(getAgentPanel);
  const activityFn = useServerFn(listAgentActivity);
  const toggleFn = useServerFn(setAgentEnabled);
  const pauseFn = useServerFn(setAgentPaused);
  const [filter, setFilter] = useState<string | null>(null);

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctx = ctxQuery.data;
  const orgId = ctx?.active?.organization_id;

  const panelQuery = useQuery({
    queryKey: ["agent-panel", orgId],
    queryFn: () => panelFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });
  const panel = panelQuery.data;
  const isPending = panelQuery.isPending;
  const panelState = useQueryState(panelQuery);

  const activityQuery = useQuery({
    queryKey: ["agent-activity", orgId, filter],
    queryFn: () =>
      activityFn({
        data: {
          organization_id: orgId!,
          ...(filter ? { agent_key: filter } : {}),
        },
      }),
    enabled: !!orgId,
  });
  const activity = activityQuery.data;
  const activityState = useQueryState(activityQuery);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agent-panel", orgId] });
    qc.invalidateQueries({ queryKey: ["agent-activity", orgId] });
  };

  const toggle = useMutation({
    mutationFn: (v: { agent_key: string; enabled: boolean }) =>
      toggleFn({ data: { organization_id: orgId!, ...v } }),
    onSuccess: (r) => {
      const stopped = r.stopped_jobs + r.stopped_messages;
      toast.success(
        r.enabled
          ? "Agent switched on."
          : stopped > 0
            ? `Agent switched off. ${stopped} queued item${stopped === 1 ? "" : "s"} stopped.`
            : "Agent switched off. Nothing was in its queue.",
      );
      invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  const pause = useMutation({
    mutationFn: (v: { agent_key: string; paused: boolean }) =>
      pauseFn({ data: { organization_id: orgId!, ...v } }),
    onSuccess: (r) => {
      toast.success(r.paused_at ? "Paused. Queued work stopped." : "Resumed.");
      invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  if (ctxQuery.isError) {
    return (
      <div className="p-8">
        <QueryErrorCard
          error={ctxQuery.error}
          onRetry={() => ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      </div>
    );
  }

  if (!orgId || (isPending && !panel)) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading agents…</div>
    );
  }

  if (panelState.isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <QueryErrorCard
          error={panelState.error}
          onRetry={panelState.retry}
          retrying={panelState.retrying}
        />
      </div>
    );
  }

  const busy = toggle.isPending || pause.isPending;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Agent control
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          These are the workers on your account. Each one shows what it does,
          what it is doing now, and what it produced this week. Switching one
          off stops its work — it does not just hide the card.
        </p>
        {!panel?.can_manage && (
          <p className="mt-3 text-sm text-muted-foreground">
            You can see every agent. Switching them on or off needs a workspace
            admin.
          </p>
        )}
      </header>

      <section className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {panel?.agents.map((a) => (
          <AgentCardView
            key={a.key}
            agent={a}
            canManage={!!panel.can_manage}
            busy={busy}
            onToggle={(enabled) =>
              toggle.mutateAsync({ agent_key: a.key, enabled })
            }
            onPause={(paused) => pause.mutate({ agent_key: a.key, paused })}
          />
        ))}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Activity</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every action, written as a sentence. When an agent could not act,
              it says why.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={filter === null ? "secondary" : "ghost"}
              onClick={() => setFilter(null)}
            >
              All agents
            </Button>
            {panel?.agents.map((a) => (
              <Button
                key={a.key}
                size="sm"
                variant={filter === a.key ? "secondary" : "ghost"}
                onClick={() => setFilter(a.key)}
              >
                {a.name}
              </Button>
            ))}
          </div>
        </div>

        <AgentActivityList activityState={activityState} activity={activity} />
      </section>
    </main>
  );
}
