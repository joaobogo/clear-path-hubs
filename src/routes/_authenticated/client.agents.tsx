import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useState } from "react";
import {
  Ban,
  Bot,
  CircleSlash,
  Clock,
  Pause,
  Play,
  ShieldAlert,
} from "lucide-react";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import {
  getAgentPanel,
  listAgentActivity,
  setAgentEnabled,
  setAgentPaused,
  type AgentCard,
} from "@/lib/agents.functions";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

function ago(iso: string | null): string {
  if (!iso) return "nothing yet";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AgentCardView({
  agent,
  canManage,
  onToggle,
  onPause,
  busy,
}: {
  agent: AgentCard;
  canManage: boolean;
  onToggle: (enabled: boolean) => void;
  onPause: (paused: boolean) => void;
  busy: boolean;
}) {
  const paused = !!agent.paused_at;

  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Bot className="h-4 w-4 text-primary" aria-hidden />
            {agent.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{agent.job}</p>
        </div>
        <Switch
          checked={agent.enabled && !paused}
          disabled={!canManage || busy}
          onCheckedChange={onToggle}
          aria-label={`Switch the ${agent.name} agent ${agent.enabled ? "off" : "on"}`}
        />
      </div>

      <p
        className={
          "mt-4 text-sm font-medium " +
          (paused
            ? "text-amber-600 dark:text-amber-400"
            : agent.enabled
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground")
        }
      >
        {agent.state_line}
      </p>

      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Last thing it did
          </dt>
          <dd className="mt-0.5">
            {agent.last_action_summary ?? "Nothing yet."}{" "}
            <span className="text-muted-foreground">
              ({ago(agent.last_action_at)})
            </span>
          </dd>
        </div>
        <div className="flex gap-6">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Produced this week
            </dt>
            <dd className="text-lg font-semibold tabular-nums">
              {agent.produced_this_week}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Blocked by a rule
            </dt>
            <dd className="text-lg font-semibold tabular-nums">
              {agent.blocked_this_week}
            </dd>
          </div>
        </div>
      </dl>

      <Accordion type="single" collapsible className="mt-4">
        <AccordionItem value="detail" className="border-none">
          <AccordionTrigger className="py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:no-underline">
            What it reads, what it makes, what it will never do
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Reads</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {agent.inputs.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium">Produces</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {agent.outputs.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-1.5 font-medium">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                Never without a human
              </p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {agent.never_without_human.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Switching this on requires a workspace admin.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          disabled={!canManage || busy || !agent.enabled}
          onClick={() => onPause(!paused)}
        >
          {paused ? (
            <>
              <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Resume
            </>
          ) : (
            <>
              <Pause className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Pause now
            </>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          Pausing stops queued work immediately.
        </span>
      </div>
    </article>
  );
}

function AgentControlPage() {
  const orgSearch = useClientOrgSearch();
  const qc = useQueryClient();
  const ctxFn = useServerFn(getClientContext);
  const panelFn = useServerFn(getAgentPanel);
  const activityFn = useServerFn(listAgentActivity);
  const toggleFn = useServerFn(setAgentEnabled);
  const pauseFn = useServerFn(setAgentPaused);
  const [filter, setFilter] = useState<string | null>(null);

  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;

  const { data: panel, isPending } = useQuery({
    queryKey: ["agent-panel", orgId],
    queryFn: () => panelFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const { data: activity } = useQuery({
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
    onError: (e: Error) => toast.error(e.message),
  });

  const pause = useMutation({
    mutationFn: (v: { agent_key: string; paused: boolean }) =>
      pauseFn({ data: { organization_id: orgId!, ...v } }),
    onSuccess: (r) => {
      toast.success(r.paused_at ? "Paused. Queued work stopped." : "Resumed.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!orgId || isPending) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading agents…</div>
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
              toggle.mutate({ agent_key: a.key, enabled })
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

        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {(activity ?? []).length === 0 ? (
            <li className="p-6 text-sm text-muted-foreground">
              Nothing recorded yet. When an agent acts — or is stopped by a rule
              — the sentence appears here.
            </li>
          ) : (
            activity!.map((row) => (
              <li key={row.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5">
                  {row.outcome === "blocked" ? (
                    <Ban className="h-4 w-4 text-amber-500" aria-hidden />
                  ) : row.outcome === "failed" ? (
                    <CircleSlash
                      className="h-4 w-4 text-destructive"
                      aria-hidden
                    />
                  ) : (
                    <Bot className="h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {row.link_path ? (
                      <Link
                        to={row.link_path}
                        className="underline-offset-2 hover:underline"
                      >
                        {row.sentence}
                      </Link>
                    ) : (
                      row.sentence
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal">
                      {row.agent_name}
                    </Badge>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden />
                      {stamp(row.occurred_at)}
                    </span>
                    {row.reason && <span>Reason: {row.reason}</span>}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
