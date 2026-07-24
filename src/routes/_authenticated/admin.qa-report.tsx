import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/qa-report")({
  head: () => ({
    meta: [
      { title: "TAASFlow — Scoring System QA Report" },
      { name: "description", content: "Release-level audit of the scoring, publish, and evidence system with findings, severity, repro, and status." },
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
  route: string;
  severity: Severity;
  repro: string;
  correction: string;
  status: Status;
  notes?: string;
}

const FINDINGS: Finding[] = [
  {
    id: "F-001",
    journey: "6 · Admin publish",
    title: "Approve-for-client never updated canonical_state, risking publish-gate failure",
    route: "src/lib/processing.functions.ts · applyReviewDecision → approve_for_client",
    severity: "P0",
    repro: "Approve a match. Trigger tg_candidate_matches_publish_gate expects canonical_state='published_to_client' when client_visibility='visible'; app previously only flipped visibility and admin_status.",
    correction: "Two ordered UPDATEs: human_review→approved, then approved→published_to_client with visibility+approved_score_run_id+integrity_status='ok'. Partial failure leaves visibility=hidden.",
    status: "fixed",
  },
  {
    id: "F-002",
    journey: "7 · Client leakage",
    title: "Shortlist share tokens continued to serve retracted candidates",
    route: "src/lib/shares.functions.ts · getShortlistShareByToken",
    severity: "P0",
    repro: "Create share for a visible match, then admin hides/retracts. Share token continued returning the candidate profile+score to any holder.",
    correction: "Added .eq('client_visibility','visible') on the read; visibility is re-checked on every share access, not just at share creation.",
    status: "fixed",
  },
  {
    id: "F-003",
    journey: "4 · Missing evidence",
    title: "Missing keyword coverage produced irrational zero for thin CVs",
    route: "src/lib/scoring-engine.server.ts · scoreCandidate",
    severity: "P0",
    repro: "Score a candidate whose CV parsed under 300 chars or <40 tokens against 5 required keywords. Every requirement was marked status='missing' with scoreOf=0, driving must_have_coverage to 0.",
    correction: "Added 'unknown' status. When CV is thin, missing keywords resolve to unknown → 0.4 (validate) instead of 0 (fail). needs_validation flag surfaces to reviewers.",
    status: "fixed",
  },
  {
    id: "F-004",
    journey: "7 · Tenant isolation",
    title: "getCandidateJourney leaked stage metadata across orgs",
    route: "src/lib/journey.functions.ts · getCandidateJourney",
    severity: "P1",
    repro: "Any authenticated user calling with a known/guessed applicationId or candidateMatchId in another org received stage-progression events.",
    correction: "Added is_platform_staff / is_org_member gate. Non-editor roles additionally require client_visibility='visible' on the underlying match.",
    status: "fixed",
  },
  {
    id: "F-005",
    journey: "9 · Client detail",
    title: "candidate_evidence_client view lacked security_invoker",
    route: "supabase/migrations/*_candidate_evidence_client.sql",
    severity: "P1",
    repro: "Report from static audit; view could execute as owner and bypass RLS on candidate_evidence_items.",
    correction: "Follow-up migration 20260724071730 already created the view WITH (security_invoker = true).",
    status: "verified",
  },
  {
    id: "F-006",
    journey: "12 · Rollback",
    title: "score_decisions could commit while candidate_matches update failed",
    route: "src/lib/processing.functions.ts · approve_for_client",
    severity: "P1",
    repro: "Force the visibility UPDATE to raise (e.g. publish-gate check_violation). Prior score_decisions INSERT already committed, leaving an 'approve' decision with no visible publication.",
    correction: "Publish-gate assertion now runs before the score_decisions insert; the two ordered UPDATEs guarantee any failure leaves client_visibility='hidden'. Follow-up: wrap the full sequence in a Postgres SECURITY DEFINER RPC.",
    status: "open",
    notes: "Root cause reduced but full transactional guarantee still requires an RPC.",
  },
  {
    id: "F-007",
    journey: "3 · Semantic evidence",
    title: "Live scoring engine is keyword-only; semantic-engine.ts is unshipped",
    route: "src/lib/scoring-engine.server.ts vs src/lib/scoring/semantic-engine.ts",
    severity: "P1",
    repro: "Score CV containing 'microservices, event-driven' against requirement 'distributed systems'. Zero keyword overlap → status='missing'.",
    correction: "Interim: unknown-status floor prevents irrational zero on thin CVs. Long-term: wire LLM evidence extraction + semantic-engine into scoring-service.server.ts.",
    status: "open",
    notes: "Requires LLM extraction step; tracked separately.",
  },
  {
    id: "F-008",
    journey: "5 · Disqualifier",
    title: "Hard disqualifiers cap score but never write eligibility_checks / eligibility_status",
    route: "src/lib/scoring-service.server.ts, src/lib/scoring-engine.server.ts",
    severity: "P0",
    repro: "Answer a disqualifying screening question. score is capped to 0.15 and fit_label='not_a_fit', but no eligibility_checks row is inserted and candidate_matches.eligibility_status remains untouched — admin filtering by eligibility misses the candidate.",
    correction: "Extend scoring-service.server.ts to upsert an eligibility_checks row (kind='disqualifier', status='failed') and set candidate_matches.eligibility_status on disqualifying_answer.",
    status: "open",
  },
  {
    id: "F-009",
    journey: "11 · Rubric versioning",
    title: "rubric_versions has DB immutability but no application writer",
    route: "src/lib/scoring.functions.ts (noted TODO), admin.scoring.orphans.tsx",
    severity: "P0",
    repro: "grep -rln 'rubric_versions' src returns only types.ts. score_runs.rubric_version_id is null in practice; publish gate requires it, so publish is unreliable once rubric versions become mandatory.",
    correction: "Ship rubric builder that inserts new rubric_versions (increment version_number, supersede prior). Wire semantic-engine to consume rubric_version_id.",
    status: "open",
  },
  {
    id: "F-010",
    journey: "1 · Identity",
    title: "Unique index on candidate_matches(position_id, candidate_profile_id) silently skipped on duplicates",
    route: "supabase/migrations/20260722212905_cb2ab22a…sql:159-170",
    severity: "P1",
    repro: "Migration wraps CREATE UNIQUE INDEX in a DO block that RAISE NOTICE on unique_violation. If pre-existing duplicates existed, index is missing today.",
    correction: "Dedup follow-up migration + unconditional CREATE UNIQUE INDEX. Currently unverified in this environment.",
    status: "unverified",
  },
  {
    id: "F-011",
    journey: "8 · Realtime sync",
    title: "candidate_matches realtime channel not proven to enforce RLS",
    route: "src/hooks/use-realtime-refresh.ts",
    severity: "P2",
    repro: "Static audit could not confirm Supabase Realtime publication respects RLS on postgres_changes for candidate_matches; a transiently visible→hidden flap could push hidden rows to client tabs.",
    correction: "Verify Realtime RLS in project config; if not enforced, subscribe only to client-visible views.",
    status: "unverified",
  },
  {
    id: "F-012",
    journey: "7 · Future leakage",
    title: "notification_events RLS lacks visibility join",
    route: "supabase/migrations/20260722134911…sql · events_org_read",
    severity: "P2",
    repro: "Not exploited today (no client-facing code reads notification_events directly). Any future feature reading this table would leak pre-publish payloads to org viewers.",
    correction: "Tighten events_org_read to require candidate_matches.client_visibility='visible' via a security-definer join, or restrict to staff-only.",
    status: "open",
  },
  {
    id: "F-013",
    journey: "UX · Presentation",
    title: "A11y + responsive audit incomplete (agent bailed before capture)",
    route: "admin.candidates.$id, client.candidates.$id, /jobs, /me",
    severity: "P2",
    repro: "Third audit sub-agent stopped before capturing 375/768/1280 screenshots and running WCAG matrix.",
    correction: "Rerun with focused Playwright script; check clipped panels, keyboard focus rings, aria-labels on score-band chips, non-color status conveyance.",
    status: "open",
  },
];

const SEV_META: Record<Severity, { color: string; icon: typeof AlertOctagon }> = {
  P0: { color: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertOctagon },
  P1: { color: "bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30", icon: AlertTriangle },
  P2: { color: "bg-sky-500/15 text-sky-900 dark:text-sky-200 border-sky-500/30", icon: Info },
  Info: { color: "bg-muted text-muted-foreground border-border", icon: Info },
};

const STATUS_META: Record<Status, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  fixed: { label: "Fixed", className: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-500/30", icon: CheckCircle2 },
  verified: { label: "Verified", className: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-500/30", icon: CheckCircle2 },
  open: { label: "Open", className: "bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30", icon: AlertTriangle },
  unverified: { label: "Unverified", className: "bg-sky-500/15 text-sky-900 dark:text-sky-200 border-sky-500/30", icon: Info },
  wontfix: { label: "Won't fix", className: "bg-muted text-muted-foreground border-border", icon: Info },
};

function QAReport() {
  const [q, setQ] = useState("");
  const [sev, setSev] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return FINDINGS.filter((f) => {
      if (sev !== "all" && f.severity !== sev) return false;
      if (status !== "all" && f.status !== status) return false;
      if (!needle) return true;
      return (
        f.title.toLowerCase().includes(needle) ||
        f.route.toLowerCase().includes(needle) ||
        f.journey.toLowerCase().includes(needle) ||
        f.id.toLowerCase().includes(needle)
      );
    });
  }, [q, sev, status]);

  const counts = useMemo(() => {
    const acc = { P0: 0, P1: 0, P2: 0, fixed: 0, open: 0 };
    for (const f of FINDINGS) {
      if (f.severity === "P0") acc.P0++;
      else if (f.severity === "P1") acc.P1++;
      else if (f.severity === "P2") acc.P2++;
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
          Full audit of the 12 candidate-scoring journeys — identity, semantic evidence, disqualifier,
          publish gate, client leakage, sync, rollback, rubric versioning, and presentation. Each row
          lists the route, severity, reproduction, correction, and current status.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Findings" value={FINDINGS.length} />
        <Tile label="P0" value={counts.P0} tone="destructive" />
        <Tile label="P1" value={counts.P1} tone="amber" />
        <Tile label="P2" value={counts.P2} tone="sky" />
        <Tile label="Resolved" value={`${counts.fixed}/${FINDINGS.length}`} tone="emerald" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search issue, route, journey…"
          className="w-full sm:max-w-xs"
          aria-label="Filter findings"
        />
        <SelectPill label="Severity" value={sev} setValue={(v) => setSev(v as Severity | "all")}
          options={["all", "P0", "P1", "P2", "Info"]} />
        <SelectPill label="Status" value={status} setValue={(v) => setStatus(v as Status | "all")}
          options={["all", "fixed", "verified", "open", "unverified", "wontfix"]} />
        <Button variant="ghost" size="sm" onClick={() => { setQ(""); setSev("all"); setStatus("all"); }}>
          Reset
        </Button>
      </div>

      <ol className="space-y-3">
        {filtered.map((f) => {
          const SevIcon = SEV_META[f.severity].icon;
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
                  <Badge variant="outline" className={`gap-1 border ${SEV_META[f.severity].color}`}>
                    <SevIcon className="size-3" aria-hidden="true" />
                    {f.severity}
                  </Badge>
                  <Badge variant="outline" className={`gap-1 border ${STATUS_META[f.status].className}`}>
                    <StatIcon className="size-3" aria-hidden="true" />
                    {STATUS_META[f.status].label}
                  </Badge>
                </div>
              </div>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-[7rem_1fr] sm:text-sm">
                <dt className="text-muted-foreground">Route</dt>
                <dd className="break-all font-mono text-[11px] sm:text-xs">{f.route}</dd>
                <dt className="text-muted-foreground">Repro</dt>
                <dd>{f.repro}</dd>
                <dt className="text-muted-foreground">Correction</dt>
                <dd>{f.correction}</dd>
                {f.notes ? (
                  <>
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="text-muted-foreground">{f.notes}</dd>
                  </>
                ) : null}
              </dl>
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
        Audit compiled from parallel sub-agent runs (scoring-isolation, publish-gate, and
        UX/a11y). This page is admin-only and marked <code>noindex, nofollow</code>. Update
        <code className="mx-1">FINDINGS</code> in <code>admin.qa-report.tsx</code> as items move.
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
