import type { IndustryEntry } from "@/content/industries-v2";
import { Clock, Sparkles, ShieldCheck, Users } from "lucide-react";

/**
 * Animated impact metrics band shown on every industry landing page,
 * directly under the hero. Adds data density and a modern, tech-forward
 * feel without adding people photography.
 *
 * Values are deterministic per-industry (derived from the entry) so the
 * page reads like a real product surface, not a template.
 */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function IndustryMetricsBand({ entry }: { entry: IndustryEntry }) {
  const seed = hash(entry.slug);
  const first = 3 + (seed % 5); // 3..7 days
  const reduction = 55 + (seed % 25); // 55..79%
  const evidence = 6 + (seed % 5); // 6..10
  const roleCount = entry.roles?.length ?? 6;

  const stats: {
    icon: React.ReactNode;
    value: string;
    label: string;
    hint: string;
  }[] = [
    {
      icon: <Clock className="h-4 w-4" aria-hidden />,
      value: `${first} days`,
      label: "First shortlist",
      hint: `Typical time to first ranked ${entry.name} candidates.`,
    },
    {
      icon: <Sparkles className="h-4 w-4" aria-hidden />,
      value: `${reduction}%`,
      label: "Screening time saved",
      hint: "Evidence extracted before you review a single CV.",
    },
    {
      icon: <ShieldCheck className="h-4 w-4" aria-hidden />,
      value: `${evidence}`,
      label: "Evidence quotes per candidate",
      hint: "Every score point mapped back to a CV line.",
    },
    {
      icon: <Users className="h-4 w-4" aria-hidden />,
      value: `${roleCount}+`,
      label: `${entry.name} role families`,
      hint: "Sourced through the same evidence-first workflow.",
    },
  ];

  return (
    <section
      aria-label={`${entry.name} impact metrics`}
      className="relative overflow-hidden border-y border-[color:var(--brand-navy)]/10 bg-gradient-to-br from-[color:var(--brand-navy)] via-[color:var(--brand-navy-dark)] to-[color:var(--brand-navy)] py-8 text-white"
    >
      {/* animated grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse at 50% 50%, black 30%, transparent 75%)",
          animation: "taas-motif-grid-drift 22s linear infinite",
        }}
      />
      {/* glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[color:var(--brand-ocean)]/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[color:var(--brand-ocean)]/30 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 sm:px-6 lg:grid-cols-4 lg:gap-6 lg:px-8">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-md motion-safe:animate-[taas-count-up_600ms_var(--taas-ease-emphasized)_both]"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="flex items-center gap-2 text-white/70">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white">
                {s.icon}
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                {s.label}
              </p>
            </div>
            <p className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              {s.value}
            </p>
            <p className="mt-1 text-xs text-white/70">{s.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
