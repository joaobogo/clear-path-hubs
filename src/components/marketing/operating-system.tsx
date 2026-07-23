import { useState } from "react";
import {
  ClipboardCheck,
  Compass,
  Radar,
  FileText,
  BarChart3,
  Send,
  Handshake,
  Workflow,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";

type Stage = {
  key: string;
  title: string;
  icon: typeof ClipboardCheck;
  taasflow: string;
  client: string;
  output: string;
  visual: "brief" | "search" | "sourcing" | "evidence" | "ranking" | "delivery" | "decision" | "loop";
};

const STAGES: Stage[] = [
  {
    key: "blueprint",
    title: "Role Blueprint",
    icon: ClipboardCheck,
    taasflow: "Runs structured intake and confirms the must-haves.",
    client: "A draft brief to review and approve.",
    output: "Approved requirements and success criteria.",
    visual: "brief",
  },
  {
    key: "search",
    title: "Search Strategy",
    icon: Compass,
    taasflow: "Designs the sourcing plan and target profiles.",
    client: "A summary of where and how we'll search.",
    output: "Search strategy tied to the approved brief.",
    visual: "search",
  },
  {
    key: "sourcing",
    title: "Candidate Sourcing",
    icon: Radar,
    taasflow: "Runs continuous, multi-channel outreach.",
    client: "Live sourcing progress in the workspace.",
    output: "A pool of engaged candidates.",
    visual: "sourcing",
  },
  {
    key: "evidence",
    title: "Evidence Review",
    icon: FileText,
    taasflow: "Validates experience against the approved role requirements.",
    client: "Candidate strengths, gaps, and supporting evidence.",
    output: "A decision-ready candidate profile.",
    visual: "evidence",
  },
  {
    key: "ranking",
    title: "Candidate Ranking",
    icon: BarChart3,
    taasflow: "Ranks profiles against approved criteria.",
    client: "Ranked candidates with fit reasoning.",
    output: "A ranked shortlist, highest fit first.",
    visual: "ranking",
  },
  {
    key: "delivery",
    title: "Workspace Delivery",
    icon: Send,
    taasflow: "Publishes the shortlist to your workspace.",
    client: "Candidates, evidence, and contact — ready to act on.",
    output: "A live shortlist you can move forward.",
    visual: "delivery",
  },
  {
    key: "decision",
    title: "Client Decision",
    icon: Handshake,
    taasflow: "Supports interview scheduling and questions.",
    client: "Full profiles and status controls in one view.",
    output: "Interview, offer, and hiring decisions — yours.",
    visual: "decision",
  },
  {
    key: "loop",
    title: "Feedback Loop",
    icon: Workflow,
    taasflow: "Recalibrates the search from your feedback.",
    client: "A pipeline that gets sharper delivery after delivery.",
    output: "A refined search and a reusable pipeline.",
    visual: "loop",
  },
];

export function OperatingSystem() {
  const [activeIdx, setActiveIdx] = useState(0);
  const stage = STAGES[activeIdx];
  const StageIcon = stage.icon;

  return (
    <div className="mt-10">
      {/* Desktop flow rail */}
      <ol
        className="hidden lg:grid"
        style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))` }}
        aria-label="Hiring stages"
      >
        {STAGES.map((s, i) => {
          const on = i === activeIdx;
          const done = i < activeIdx;
          const SIcon = s.icon;
          return (
            <li key={s.key} className="relative flex flex-col items-center">
              {/* connector */}
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute right-1/2 top-6 h-0.5 w-full ${
                    i <= activeIdx
                      ? "bg-[color:var(--brand-ocean)]"
                      : "bg-[color:var(--brand-navy)]/12"
                  } motion-safe:transition-colors motion-safe:duration-500`}
                />
              )}
              <button
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-current={on ? "step" : undefined}
                className="group relative z-10 flex flex-col items-center gap-2 px-1 focus-visible:outline-none"
              >
                <span
                  className={`grid h-12 w-12 place-items-center rounded-full border-2 motion-safe:transition-all ${
                    on
                      ? "border-[color:var(--brand-ocean)] bg-[color:var(--brand-ocean)] text-white shadow-[var(--brand-shadow-sm)] scale-110"
                      : done
                        ? "border-[color:var(--brand-ocean)] bg-white text-[color:var(--brand-ocean)]"
                        : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/50 group-hover:border-[color:var(--brand-navy)]/40 group-hover:text-[color:var(--brand-navy)]"
                  }`}
                >
                  {done ? (
                    <Check className="h-5 w-5" aria-hidden />
                  ) : (
                    <SIcon className="h-5 w-5" aria-hidden />
                  )}
                </span>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    on ? "text-[color:var(--brand-navy)]" : "text-[color:var(--brand-navy)]/55"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`max-w-[9rem] text-center text-xs font-semibold leading-tight ${
                    on ? "text-[color:var(--brand-navy)]" : "text-[color:var(--brand-navy)]/70"
                  }`}
                >
                  {s.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Detail panel — desktop */}
      <div
        className="mt-8 hidden overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white shadow-[var(--brand-shadow-sm)] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]"
        aria-live="polite"
      >
        <StageDetail stage={stage} StageIcon={StageIcon} activeIdx={activeIdx} />
        <StageVisual stage={stage} />
      </div>

      {/* Mobile progressive */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            Stage {activeIdx + 1} of {STAGES.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous stage"
              disabled={activeIdx === 0}
              onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
              className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)] disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next stage"
              disabled={activeIdx === STAGES.length - 1}
              onClick={() => setActiveIdx((i) => Math.min(STAGES.length - 1, i + 1))}
              className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)] disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* mobile progress bar */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10">
          <div
            className="h-full rounded-full bg-[color:var(--brand-ocean)] motion-safe:transition-all motion-safe:duration-500"
            style={{ width: `${((activeIdx + 1) / STAGES.length) * 100}%` }}
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white shadow-[var(--brand-shadow-sm)]">
          <StageDetail stage={stage} StageIcon={StageIcon} activeIdx={activeIdx} />
          <div className="border-t border-[color:var(--brand-navy)]/8">
            <StageVisual stage={stage} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StageDetail({
  stage,
  StageIcon,
  activeIdx,
}: {
  stage: Stage;
  StageIcon: typeof ClipboardCheck;
  activeIdx: number;
}) {
  return (
    <div key={stage.key} className="p-6 sm:p-8 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean)]">
          <StageIcon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Step {String(activeIdx + 1).padStart(2, "0")}
          </div>
          <h3 className="text-xl font-semibold text-[color:var(--brand-navy)] sm:text-2xl">
            {stage.title}
          </h3>
        </div>
      </div>

      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            TaaSFlow does
          </dt>
          <dd className="mt-1 text-[color:var(--brand-navy)]/85">{stage.taasflow}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            Client sees
          </dt>
          <dd className="mt-1 text-[color:var(--brand-navy)]/85">{stage.client}</dd>
        </div>
        <div className="rounded-lg border border-[color:var(--brand-ocean)]/20 bg-[color:var(--brand-ocean)]/5 p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-ocean)]">
            Output
          </dt>
          <dd className="mt-1 font-medium text-[color:var(--brand-navy)]">{stage.output}</dd>
        </div>
      </dl>
    </div>
  );
}

function StageVisual({ stage }: { stage: Stage }) {
  return (
    <div
      key={`v-${stage.key}`}
      className="relative bg-[color:var(--brand-paper)] p-6 sm:p-8 animate-fade-in"
    >
      {stage.visual === "brief" && <VisualBrief />}
      {stage.visual === "search" && <VisualSearch />}
      {stage.visual === "sourcing" && <VisualSourcing />}
      {stage.visual === "evidence" && <VisualEvidence />}
      {stage.visual === "ranking" && <VisualRanking />}
      {stage.visual === "delivery" && <VisualDelivery />}
      {stage.visual === "decision" && <VisualDecision />}
      {stage.visual === "loop" && <VisualLoop />}
    </div>
  );
}

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "ocean" | "navy" }) {
  const c =
    tone === "ocean"
      ? "bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean)]"
      : tone === "navy"
        ? "bg-[color:var(--brand-navy)] text-white"
        : "bg-white text-[color:var(--brand-navy)]/70 border border-[color:var(--brand-navy)]/12";
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
}

function MiniCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-3 text-xs text-[color:var(--brand-navy)]/80">
      {children}
    </div>
  );
}

/* ---------- Individual visuals (static, illustrative) ---------- */

function VisualBrief() {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">Role brief</div>
      <MiniCard><div className="font-semibold text-[color:var(--brand-navy)]">Senior Backend Engineer</div><div className="mt-1 text-[color:var(--brand-navy)]/60">Approved · Berlin · Hybrid</div></MiniCard>
      <MiniCard>Must-haves: Go, distributed systems, on-call ownership</MiniCard>
      <MiniCard>Nice-to-haves: Kafka, k8s, SRE background</MiniCard>
    </div>
  );
}
function VisualSearch() {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">Search plan</div>
      <div className="flex flex-wrap gap-1.5"><Chip tone="ocean">LinkedIn</Chip><Chip tone="ocean">GitHub</Chip><Chip tone="ocean">Community</Chip><Chip tone="ocean">Referrals</Chip></div>
      <MiniCard>Target: Series B-D infra teams, 5-9 yrs Go, EU time zones.</MiniCard>
      <MiniCard>Outreach angle: platform reliability ownership over feature velocity.</MiniCard>
    </div>
  );
}
function VisualSourcing() {
  const rows = [{ n: "Contacted", v: 128 }, { n: "Replied", v: 42 }, { n: "Screened", v: 18 }, { n: "Advancing", v: 6 }];
  const max = 128;
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">Pipeline funnel</div>
      {rows.map((r) => (
        <div key={r.n}>
          <div className="flex justify-between text-xs text-[color:var(--brand-navy)]/70"><span>{r.n}</span><span className="tabular-nums font-semibold">{r.v}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8"><div className="h-full rounded-full bg-[color:var(--brand-ocean)]" style={{ width: `${(r.v / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
function VisualEvidence() {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">Requirement coverage</div>
      {[{ r: "Go, 5+ yrs", ok: true }, { r: "Distributed systems", ok: true }, { r: "On-call ownership", ok: true }, { r: "Kafka", ok: false }].map((e) => (
        <div key={e.r} className="flex items-center justify-between rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2 text-xs">
          <span className="text-[color:var(--brand-navy)]/80">{e.r}</span>
          <Chip tone={e.ok ? "ocean" : "muted"}>{e.ok ? "Evidence found" : "Not evidenced"}</Chip>
        </div>
      ))}
    </div>
  );
}
function VisualRanking() {
  const rows = [{ n: "Alex R.", s: 92 }, { n: "Priya M.", s: 84 }, { n: "Dan K.", s: 71 }];
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">Ranked shortlist</div>
      {rows.map((r, i) => (
        <div key={r.n} className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-3">
          <div className="flex items-center justify-between text-xs"><span className="font-semibold text-[color:var(--brand-navy)]">#{i + 1} · {r.n}</span><span className="tabular-nums font-semibold text-[color:var(--brand-ocean)]">{r.s}</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8"><div className="h-full rounded-full bg-[color:var(--brand-ocean)]" style={{ width: `${r.s}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
function VisualDelivery() {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">Workspace</div>
      <div className="grid grid-cols-3 gap-2">
        {["Delivered", "In review", "Interview"].map((c) => (
          <div key={c} className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">{c}</div>
            <div className="mt-1 h-1.5 rounded-full bg-[color:var(--brand-ocean)]/60" />
            <div className="mt-1.5 h-1.5 rounded-full bg-[color:var(--brand-ocean)]/30" />
          </div>
        ))}
      </div>
      <MiniCard>Every candidate: evidence, CV access, contact, and stage controls.</MiniCard>
    </div>
  );
}
function VisualDecision() {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">Decision controls</div>
      <div className="flex flex-wrap gap-1.5"><Chip tone="navy">Advance</Chip><Chip>Hold</Chip><Chip>Reject with reason</Chip></div>
      <MiniCard>Interview kit: 5 personalized questions tied to the evidence file.</MiniCard>
      <MiniCard>Audit trail preserved on every status change.</MiniCard>
    </div>
  );
}
function VisualLoop() {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">Recalibration</div>
      <MiniCard>Feedback: "more platform ownership, less pure product engineering."</MiniCard>
      <div className="flex flex-wrap gap-1.5"><Chip tone="ocean">Search updated</Chip><Chip tone="ocean">Weights adjusted</Chip><Chip tone="ocean">Bench refreshed</Chip></div>
      <MiniCard>Next delivery inherits the calibration — no restart from zero.</MiniCard>
    </div>
  );
}
