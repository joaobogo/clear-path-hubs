import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FileCheck2, Network, PanelsTopLeft, ShieldCheck } from "lucide-react";
import { RunButton } from "@/components/system/run-button";
import { AgentRunsPreview } from "@/components/marketing/product-preview/agent-runs-preview";
import { DecisionWorkspacePreview } from "@/components/marketing/product-preview/decision-workspace-preview";
import { EvidenceReviewPanel } from "@/components/marketing/how-it-works-deep";
import { cn } from "@/lib/utils";

const VIEWS = [
  { id: "sourcing", label: "Outreach", icon: Network, title: "A search you can follow.", description: "Sourcing, screening and follow-ups, with every run recorded.", points: ["Role-specific search", "Agent controls", "Recorded activity"], link: "/agents", linkLabel: "Explore the agents" },
  { id: "evidence", label: "Recruiting", icon: FileCheck2, title: "Proof behind the shortlist.", description: "See the CV evidence, the gaps and the recruiter’s review.", points: ["Requirement-by-requirement evidence", "Missing evidence flagged", "Human approval before release"], link: "/how-it-works", hash: "scoring", linkLabel: "See how review works" },
  { id: "workspace", label: "Your ATS", icon: PanelsTopLeft, title: "One place to decide.", description: "Compare candidates, review their evidence and keep your team aligned.", points: ["Ranked candidate queue", "Side-by-side comparison", "Recorded team decisions"], link: "/how-it-works", hash: "workspace", linkLabel: "Explore your workspace" },
] as const;

export function ProductTour() {
  const [selected, setSelected] = useState(0);
  const active = VIEWS[selected];
  if (!active) return null;

  return (
    <section aria-labelledby="product-tour-title" className="product-tour border-y border-[color:var(--rule)] bg-[color:var(--paper)]">
      <div className="mx-auto max-w-[calc(var(--max)+2*var(--margin))] px-[var(--margin)] py-14 sm:py-20">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="narrow text-xs font-semibold text-[color:var(--blue-600)]">TaaSFlow · the connected system</p>
            <h2 id="product-tour-title" className="mt-3 max-w-[22ch] text-[32px] leading-[1.08] text-[color:var(--ink)] sm:text-[44px]">ATS. Recruiting. Outreach.<br />Together.</h2>
          </div>
          <Link to="/pricing" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-[color:var(--blue-600)]">One package. See pricing <ArrowRight className="size-4" aria-hidden /></Link>
        </div>
        <div role="tablist" aria-label="Explore TaaSFlow" className="mt-6 grid grid-cols-3 border-b border-[color:var(--rule-2)] sm:mt-9">
          {VIEWS.map((view, index) => {
            const Icon = view.icon;
            return <RunButton key={view.id} variant="ghost" role="tab" id={`tour-tab-${view.id}`} aria-selected={selected === index} aria-controls={`tour-panel-${view.id}`} tabIndex={selected === index ? 0 : -1} className={cn("product-tour-tab min-w-0 flex-col gap-2 rounded-none border-0 px-2 py-4 sm:flex-row sm:gap-3", selected === index && "is-active")} onClick={() => setSelected(index)} onKeyDown={(event) => {
              const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              const next = event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : (index + direction + VIEWS.length) % VIEWS.length;
              if (!direction && event.key !== "Home" && event.key !== "End") return;
              event.preventDefault(); setSelected(next);
              document.getElementById(`tour-tab-${VIEWS[next]?.id}`)?.focus();
            }}><Icon className="size-5 shrink-0" aria-hidden /><span>{view.label}</span></RunButton>;
          })}
        </div>
        {VIEWS.map((view, index) => <div key={view.id} id={`tour-panel-${view.id}`} role="tabpanel" aria-labelledby={`tour-tab-${view.id}`} hidden={selected !== index} className="product-tour-panel grid min-w-0 gap-6 pt-6 sm:gap-8 sm:pt-9 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] [&[hidden]]:hidden">
          <div className="min-w-0 lg:pt-6">
            <span className="wide num text-sm font-semibold text-[color:var(--blue-600)]">0{index + 1} / 03</span>
            <h3 className="mt-4 text-[28px] leading-tight text-[color:var(--ink)] sm:text-[36px]">{view.title}</h3>
            <p className="mt-4 max-w-[34ch] text-lg leading-relaxed text-[color:var(--slate)]">{view.description}</p>
            <ul className="mt-5 space-y-2 sm:mt-6 sm:space-y-3">{view.points.map((point) => <li key={point} className="flex items-center gap-3 text-sm text-[color:var(--ink)]"><span className="size-1.5 shrink-0 bg-[color:var(--blue-600)]" aria-hidden />{point}</li>)}</ul>
            <Link to={view.link} hash={"hash" in view ? view.hash : undefined} className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[color:var(--blue-600)]">{view.linkLabel}<ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          <div className="min-w-0">
            {view.id === "sourcing" ? <AgentRunsPreview /> : view.id === "evidence" ? <EvidenceReviewPanel /> : <DecisionWorkspacePreview />}
          </div>
        </div>)}
        <p className="mt-8 flex items-center gap-2 border-t border-[color:var(--rule)] pt-5 text-sm text-[color:var(--slate)]"><ShieldCheck className="size-4 shrink-0 text-[color:var(--brand-success)]" aria-hidden />Agents do the work. People approve the shortlist. You choose who to hire.</p>
      </div>
    </section>
  );
}