import * as React from "react";
import {
  UserCheck,
  FileSearch,
  ListOrdered,
  Handshake,
  Eye,
  KeyRound,
} from "lucide-react";

/**
 * Editorial trust band — sits directly under the hero.
 * Six approved proof types. No fake logos. No vanity counters.
 * Design: high contrast on navy, calm fade-in, zero paragraph copy.
 */

const PROOFS = [
  {
    icon: UserCheck,
    title: "Expert oversight",
    line: "Named hiring experts approve every shortlist the agents produce.",
  },
  {
    icon: FileSearch,
    title: "Evidence-first process",
    line: "Every requirement scored with a cited source.",
  },
  {
    icon: ListOrdered,
    title: "Ranked delivery",
    line: "5–12 candidates per role, ordered by fit.",
  },
  {
    icon: Handshake,
    title: "Direct handover",
    line: "You interview the candidate. No middle layer.",
  },
  {
    icon: Eye,
    title: "Live workspace",
    line: "Stage, notes, and decisions visible in real time.",
  },
  {
    icon: KeyRound,
    title: "Client-owned pipeline",
    line: "Export your candidates any month. No lock-in.",
  },
] as const;

export function TrustStrip() {
  return (
    <section
      aria-label="How TaaSFlow earns trust"
      className="relative bg-[color:var(--brand-navy)] text-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-white/15" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            How the work actually gets done
          </span>
          <span className="h-px flex-1 bg-white/15" aria-hidden />
        </div>

        <ul
          className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-6"
          role="list"
        >
          {PROOFS.map((p, i) => (
            <li
              key={p.title}
              className="group flex flex-col gap-2 opacity-0 [animation:trust-in_0.6s_ease-out_forwards] motion-reduce:opacity-100 motion-reduce:[animation:none]"
              style={{ animationDelay: `${80 + i * 60}ms` }}
            >
              <p.icon
                className="h-5 w-5 text-[color:var(--brand-sky)] transition-transform duration-500 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                aria-hidden
              />
              <div className="text-sm font-semibold text-white">{p.title}</div>
              <div className="text-[12px] leading-snug text-white/70">
                {p.line}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <style>{`
        @keyframes trust-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
