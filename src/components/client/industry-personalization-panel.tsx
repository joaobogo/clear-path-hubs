/**
 * IndustryPersonalizationPanel — vertical-aware sample library and rubric hint.
 *
 * Rendered inside the client Overview when an org has `industry` set.
 * Presents four collapsible sections tuned to the resolved profile:
 *   1. Sample requirements (drop-in for a new brief)
 *   2. Role families the vertical typically hires
 *   3. Evidence templates the recruiter will look for
 *   4. Certification checks (when the vertical has them)
 *
 * The panel is read-only and non-blocking — copy is the affordance, no
 * mutating buttons here. Pure UI, no data fetching.
 */

import { useState } from "react";
import { resolveIndustryProfile } from "@/config/industry-profiles";
import { BadgeCheck, ClipboardList, Compass, FileCheck2, ChevronDown } from "lucide-react";

const ACCENT_BG: Record<string, string> = {
  sunset:   "from-amber-50 to-orange-50/40 border-amber-200/60",
  clinical: "from-sky-50 to-cyan-50/40 border-sky-200/60",
  trading:  "from-slate-50 to-blue-50/40 border-slate-200/60",
  code:     "from-violet-50 to-fuchsia-50/40 border-violet-200/60",
  commerce: "from-rose-50 to-pink-50/40 border-rose-200/60",
  steel:    "from-zinc-50 to-slate-100/40 border-zinc-200/60",
  gavel:    "from-stone-50 to-amber-50/30 border-stone-200/60",
  chalk:    "from-emerald-50 to-teal-50/40 border-emerald-200/60",
  route:    "from-indigo-50 to-sky-50/40 border-indigo-200/60",
  grid:     "from-lime-50 to-emerald-50/40 border-lime-200/60",
  neutral:  "from-muted/40 to-muted/10 border-border",
};

type Props = {
  industry: string | null;
};

export function IndustryPersonalizationPanel({ industry }: Props) {
  const profile = resolveIndustryProfile(industry);
  const [open, setOpen] = useState<string | null>("requirements");

  const bg = ACCENT_BG[profile.accent] ?? ACCENT_BG.neutral;
  const showCerts = profile.certifications.length > 0;

  const sections = [
    {
      id: "requirements",
      icon: ClipboardList,
      title: "Sample requirements",
      body: profile.sampleRequirements,
    },
    {
      id: "families",
      icon: Compass,
      title: "Role families we see here",
      body: profile.roleFamilies,
    },
    {
      id: "evidence",
      icon: FileCheck2,
      title: "Evidence we collect",
      body: profile.evidenceTemplates,
    },
    ...(showCerts
      ? [{
          id: "certifications",
          icon: BadgeCheck,
          title: "Certification checks",
          body: profile.certifications,
        }]
      : []),
  ];

  return (
    <section
      aria-labelledby="industry-panel-heading"
      className={`rounded-xl border bg-gradient-to-br p-4 sm:p-5 ${bg}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Tuned for your vertical
          </div>
          <h2
            id="industry-panel-heading"
            className="mt-1 text-lg font-semibold tracking-tight"
          >
            {profile.label}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {profile.strapline}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-current/20 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-foreground/80">
          <BadgeCheck className="h-3 w-3" aria-hidden />
          Rubric preset applied
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground/85">
        {profile.copy.overviewIntro}
      </p>

      <div className="mt-4 space-y-2">
        {sections.map((s) => {
          const Icon = s.icon;
          const isOpen = open === s.id;
          return (
            <div
              key={s.id}
              className="rounded-lg border border-border/60 bg-white/70"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : s.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-white"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {s.title}
                  <span className="text-xs text-muted-foreground">
                    · {s.body.length}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {isOpen && (
                <ul className="border-t border-border/50 px-4 py-2.5 text-sm leading-relaxed">
                  {s.body.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 py-1 text-foreground/85"
                    >
                      <span
                        className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/40"
                        aria-hidden
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs italic text-muted-foreground">
        {profile.copy.scoringHint}
      </p>
    </section>
  );
}
