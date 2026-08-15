import { Bot, Pause, Play, ShieldAlert } from "lucide-react";
import { HonestSwitch } from "@/components/ds/honest-switch";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { AgentCard } from "@/lib/agents.functions";

export function ago(iso: string | null): string {
  if (!iso) return "nothing yet";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

export function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgentCardView({
  agent,
  canManage,
  onToggle,
  onPause,
  busy,
}: {
  agent: AgentCard;
  canManage: boolean;
  onToggle: (enabled: boolean) => Promise<unknown>;
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
        <HonestSwitch
          checked={agent.enabled && !paused}
          disabled={!canManage || busy}
          onCommit={onToggle}
          label={`Switch the ${agent.name} agent ${agent.enabled ? "off" : "on"}`}
        />
      </div>

      <p
        className={
          "mt-4 text-sm font-medium " +
          (paused
            ? "text-warning-strong"
            : agent.enabled
              ? "text-success"
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
            {agent.last_action_summary ?? "Nothing yet."}
            {agent.last_action_at && agent.last_action_summary && (
              <span className="ml-1 text-muted-foreground">
                ({ago(agent.last_action_at)})
              </span>
            )}
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
