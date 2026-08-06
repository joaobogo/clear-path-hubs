import { Lock, Radar, ShieldCheck } from "lucide-react";

import {
  CHANNEL_AGENT_COUNT,
  CHANNEL_AGENT_INVARIANTS,
  CHANNEL_AGENT_WITHHELD,
  CHANNEL_FAMILIES,
} from "@/config/channel-agents";

/**
 * Public coverage panel: states that every sourcing channel has its own agent,
 * by family and count, without publishing how any of them work.
 */
export function ChannelAgentCoverage({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
          Channel coverage
        </p>
        <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
          {CHANNEL_AGENT_COUNT} channels. {CHANNEL_AGENT_COUNT} agents.
        </h2>
        <p className="mt-3 text-[color:var(--brand-navy)]/80">
          Every sourcing channel we run has its own agent — tuned to that
          channel, reporting into the same rubric and the same log. Coverage is
          public. The method is not.
        </p>
      </div>

      <ul className="mt-8 grid gap-3 md:grid-cols-2">
        {CHANNEL_FAMILIES.map((f) => (
          <li
            key={f.name}
            className="flex min-w-0 flex-col rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-sm font-semibold text-[color:var(--brand-navy)]">
                {f.name}
              </span>
              <span className="shrink-0 rounded-full bg-[color:var(--brand-ocean)]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--brand-ocean-text)]">
                {f.agents} agents
              </span>
            </div>
            <p className="mt-2 text-sm leading-snug text-[color:var(--brand-navy)]/85">
              {f.responsibility}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--brand-navy)]">
            <ShieldCheck
              className="h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]"
              aria-hidden
            />
            The same rules on all {CHANNEL_AGENT_COUNT}
          </p>
          <ul className="mt-3 grid gap-2">
            {CHANNEL_AGENT_INVARIANTS.map((line) => (
              <li
                key={line}
                className="flex min-w-0 items-start gap-2 text-sm leading-snug text-[color:var(--brand-navy)]/85"
              >
                <Radar
                  className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/60"
                  aria-hidden
                />
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-dashed border-[color:var(--brand-navy)]/25 bg-white p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--brand-navy)]">
            <Lock
              className="h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/70"
              aria-hidden
            />
            What we keep off this page
          </p>
          <ul className="mt-3 grid gap-2">
            {CHANNEL_AGENT_WITHHELD.map((line) => (
              <li
                key={line}
                className="min-w-0 text-sm leading-snug text-[color:var(--brand-navy)]/80"
              >
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-snug text-[color:var(--brand-navy)]/70">
            Clients see the channel mix, message bodies and per-channel
            attribution for their own roles inside the workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
