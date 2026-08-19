import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/qa-report")({
  head: () => ({
    meta: [
      { title: "TaaSFlow — Scoring System QA Report" },
      { name: "description", content: "Release-level audit of the scoring, publish, and evidence system status tracking." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: QAReport,
});

type Severity = "P0" | "P1" | "P2" | "Info";
type Status = "fixed" | "verified" | "open" | "wontfix" | "unverified";

interface Finding {
  id: string;
  journey: string;
  title: string;
  status: Status;
}

const FINDINGS: Finding[] = [
  { id: "F-001", journey: "6 · Admin publish", title: "Approve-for-client never updated canonical_state", status: "fixed" },
  { id: "F-002", journey: "7 · Client leakage", title: "Shortlist share tokens continued to serve retracted candidates", status: "fixed" },
  { id: "F-003", journey: "4 · Missing evidence", title: "Missing keyword coverage produced irrational zero for thin CVs", status: "fixed" },
  { id: "F-004", journey: "7 · Tenant isolation", title: "getCandidateJourney leaked stage metadata across orgs", status: "fixed" },
  { id: "F-005", journey: "9 · Client detail", title: "candidate_evidence_client view lacked security_invoker", status: "verified" },
  { id: "F-006", journey: "12 · Rollback", title: "score_decisions could commit while candidate_matches update failed", status: "fixed" },
  { id: "F-007", journey: "3 · Semantic evidence", title: "Live scoring engine is keyword-only", status: "open" },
  { id: "F-008", journey: "5 · Disqualifier", title: "Hard disqualifiers cap score but never write eligibility status", status: "fixed" },
  { id: "F-009", journey: "11 · Rubric versioning", title: "rubric_versions missing application writer", status: "open" },
  { id: "F-010", journey: "1 · Identity", title: "Unique index on candidate_matches skipped on duplicates", status: "verified" },
  { id: "F-011", journey: "8 · Realtime sync", title: "candidate_matches realtime channel RLS verification", status: "verified" },
  { id: "F-012", journey: "7 · Future leakage", title: "notification_events RLS visibility join", status: "fixed" },
  { id: "F-013", journey: "13 · A11y / Responsive", title: "Mobile verification at 375px", status: "fixed" },
  { id: "F-014", journey: "1 · Admin overview", title: "Admin Overview widget resilience", status: "verified" },
  { id: "F-015", journey: "1 · Admin dashboard", title: "Delivery failure metrics consistency", status: "open" },
  { id: "F-016", journey: "9 · Org workspace", title: "Org Candidates tab data parity", status: "fixed" },
];

const STATUS_META: Record<Status, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  fixed: { label: "Fixed", className: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-500/30", icon: CheckCircle2 },
  verified: { label: "Verified", className: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-500/30", icon: CheckCircle2 },
  open: { label: "Open", className: "bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30", icon: AlertTriangle },
  unverified: { label: "Unverified", className: "bg-sky-500/15 text-sky-900 dark:text-sky-200 border-sky-500/30", icon: Info },
  wontfix: { label: "Won't fix", className: "bg-muted text-muted-foreground border-border", icon: Info },
};

function QAReport() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "all">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return FINDINGS.filter((f) => {
      if (status !== "all" && f.status !== status) return false;
      if (!needle) return true;
      return (
        f.title.toLowerCase().includes(needle) ||
        f.journey.toLowerCase().includes(needle) ||
        f.id.toLowerCase().includes(needle)
      );
    });
  }, [q, status]);

  const counts = useMemo(() => {
    const acc = { fixed: 0, open: 0 };
    for (const f of FINDINGS) {
      if (f.status === "fixed" || f.status === "verified") acc.fixed++;
      else if (f.status === "open" || f.status === "unverified") acc.open++;
    }
    return acc;
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Release audit</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Scoring System QA Report</h1>
        <p className="text-sm text-muted-foreground">
          Public status tracking for the 12 candidate-scoring journeys — identity, semantic evidence, 
          disqualifier, publish gate, client leakage, sync, rollback, rubric versioning, and presentation.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Findings" value={FINDINGS.length} />
        <Tile label="Resolved" value={`${counts.fixed}/${FINDINGS.length}`} tone="emerald" />
        <Tile label="Open" value={counts.open} tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search issue, journey…"
          className="w-full sm:max-w-xs"
          aria-label="Filter findings"
        />
        <SelectPill label="Status" value={status} setValue={(v) => setStatus(v as Status | "all")}
          options={["all", "fixed", "verified", "open", "unverified", "wontfix"]} />
        <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStatus("all"); }}>
          Reset
        </Button>
      </div>

      <ol className="space-y-3">
        {filtered.map((f) => {
          const StatIcon = STATUS_META[f.status].icon;
          return (
            <li key={f.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{f.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{f.journey}</span>
                  </div>
                  <h2 className="text-sm font-semibold sm:text-base">{f.title}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={`gap-1 border ${STATUS_META[f.status].className}`}>
                    <StatIcon className="size-3" aria-hidden="true" />
                    {STATUS_META[f.status].label}
                  </Badge>
                </div>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No findings match those filters.
          </li>
        ) : null}
      </ol>

      <footer className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        Audit compiled from parallel sub-agent runs. This page is admin-only and marked <code>noindex, nofollow</code>.
      </footer>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: "destructive" | "amber" | "sky" | "emerald" }) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "sky"
          ? "text-sky-700 dark:text-sky-300"
          : tone === "emerald"
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function SelectPill<T extends string>({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: T;
  setValue: (v: T) => void;
  options: readonly T[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as T)}
        className="rounded-md border bg-background px-2 py-1 text-xs"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
