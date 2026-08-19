import { useStuckAfter } from "@/lib/client/panel-gate";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import { getClientContext } from "@/lib/client-context.functions";
import { getClientOverview } from "@/lib/client-overview.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { getStaffAccess } from "@/lib/admin-staff-gate.functions";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  Sparkles,
} from "lucide-react";
import {
  PRICE_PILOT_DISPLAY,
  PRICE_MULTI_DISPLAY,
  PRICE_SPRINT_DISPLAY,
  PRICE_ENTERPRISE_DISPLAY,
  PILOT_ROLES_LABEL,
  MULTI_ROLES_LABEL,
  SPRINT_ROLES_LABEL,
  ENTERPRISE_ROLES_LABEL,
} from "@/config/pricing-core";

/**
 * /boardroom — in-product Boardroom Mode.
 * Fullscreen, distraction-free presentation for stakeholder meetings.
 * Uses live client-workspace data where available; falls back to safe demo
 * data if no org is selected or the workspace is empty.
 *
 * Views (⟵ / ⟶):
 *   1. What TaaSFlow is
 *   2. Active roles
 *   3. Ranked shortlist snapshot
 *   4. Economics
 *   5. Industry fit
 *   6. Next steps
 */

export const Route = createFileRoute("/_authenticated/boardroom")({
  head: () => ({
    meta: [
      { title: "Boardroom Mode · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    // Same staff gate the /admin layout uses: fail closed to /access-denied.
    try {
      const access = await getStaffAccess();
      if (!access.staff) {
        throw redirect({ to: "/access-denied", search: { reason: "permission" } });
      }
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (e && typeof e === "object" && (e as any).isRedirect) throw e;
      throw redirect({ to: "/access-denied", search: { reason: "permission" } });
    }
  },
  component: BoardroomPage,
});

/* Boardroom shows live workspace records only. When a workspace has no
   records yet, every slide says so plainly — never invented roles or
   candidates in front of a client. */


/* ─── Page ─────────────────────────────────────────────────────────────── */

function BoardroomPage() {
  const orgId = useClientOrgSearch();
  const ctx = useServerFn(getClientContext);
  const overview = useServerFn(getClientOverview);

  const contextQ = useQuery({
    queryKey: ["boardroom-ctx"],
    queryFn: () => ctx({ data: {} }),
  });
  const resolvedOrgId = orgId ?? contextQ.data?.organizations?.[0]?.id;

  const overviewQ = useQuery({
    queryKey: ["boardroom-overview", resolvedOrgId],
    queryFn: () => overview({ data: { orgId: resolvedOrgId! } }),
    enabled: !!resolvedOrgId,
  });

  const orgName =
    contextQ.data?.organizations?.find((o: { id: string; name: string }) => o.id === resolvedOrgId)?.name ??
    "Your workspace";
  const hasBoundWorkspace = orgName !== "Your workspace";

  const kpis = overviewQ.data?.kpis as
    | { active_positions?: number; delivered_this_month?: number; time_to_shortlist_days?: number }
    | undefined;
  const whatsNext = (overviewQ.data?.whats_next ?? []) as Array<{
    position_id: string;
    title: string;
    status: string;
    delivered_pending: number;
  }>;
  const latestCandidates = (overviewQ.data?.latest_candidates ?? []) as Array<{
    full_name?: string;
    fit_score?: number;
    strengths?: string[];
  }>;

  const pendingRead = overviewQ.isPending && !!resolvedOrgId;
  // A slide must never sit on "Loading…" forever: after a bounded wait we
  // present it as a failed read, which already has honest copy below.
  const stuck = useStuckAfter(pendingRead);
  const isLoading = pendingRead && !stuck;
  // Kept distinct from "empty" everywhere below: a failed read must never be
  // presented as a workspace with no roles or no candidates.
  const loadFailed = overviewQ.isError || contextQ.isError || stuck;

  const positions = whatsNext.slice(0, 6).map((p) => ({
    title: p.title,
    status: p.status,
    pending: p.delivered_pending ?? 0,
  }));

  const candidates = latestCandidates.slice(0, 3).map((c, i) => ({
    rank: i + 1,
    name: c.full_name ?? `Candidate ${i + 1}`,
    score: c.fit_score ?? 0,
    note: c.strengths?.[0] ?? "Evidence available in workspace.",
  }));

  /* Slides */
  const slides = useMemo(
    () => [
      { key: "intro", render: () => <SlideIntro orgName={orgName} /> },
      { key: "positions", render: () => <SlidePositions positions={positions} kpis={kpis} isLoading={isLoading} loadFailed={loadFailed} /> },
      { key: "shortlist", render: () => <SlideShortlist candidates={candidates} isLoading={isLoading} loadFailed={loadFailed} /> },

      { key: "economics", render: () => <SlideEconomics /> },
      { key: "industry", render: () => <SlideIndustry /> },
      { key: "next", render: () => <SlideNext /> },
    ],
    [orgName, positions, candidates, kpis, isLoading],

  );

  const [i, setI] = useState(0);
  const total = slides.length;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);

  const go = useCallback(
    (delta: number) => setI((v) => Math.max(0, Math.min(total - 1, v + delta))),
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-dvh flex-col bg-[color:var(--brand-navy)] text-white"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 text-xs text-white/60">
        <div className="flex items-center gap-3">
          <Link to="/client" className="inline-flex items-center gap-1 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Exit boardroom
          </Link>
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-widest">
            Live · {orgName}
          </span>

        </div>
        <div className="flex items-center gap-4">
          <span>
            {i + 1} / {total}
          </span>
          <button
            type="button"
            onClick={toggleFs}
            className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1 text-xs hover:bg-white/10"
          >
            {isFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {isFs ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {/* Slide */}
      <div className="relative flex flex-1 items-center justify-center px-6 pb-24 sm:px-12">
        <div className="w-full max-w-5xl">{slides[i].render()}</div>
      </div>

      {/* Nav */}
      <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(-1)}
          disabled={i === 0}
          className="text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Button>
        <div className="flex gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-8 bg-white" : "w-4 bg-white/25 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(1)}
          disabled={i === total - 1}
          className="text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/* ─── Slides ─────────────────────────────────────────────────────────── */

function SlideEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
      {children}
    </p>
  );
}

function SlideIntro({ orgName }: { orgName: string }) {
  return (
    <div>
      <SlideEyebrow>Boardroom · TaaSFlow</SlideEyebrow>
      <h1 className="mt-4 font-[family-name:var(--brand-font-display)] text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
        What TaaSFlow is doing for {orgName}.
      </h1>

      <p className="mt-6 max-w-2xl text-lg text-white/70">
        A subscription recruiting function — human recruiters, evidence-first
        scoring, and a workspace you own. This is the ten-minute overview.
      </p>
    </div>
  );
}

function SlideNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-10 rounded-xl border border-white/15 bg-white/5 px-6 py-8 text-white/70">
      {children}
    </div>
  );
}

function SlidePositions({
  positions,
  kpis,
  isLoading,
  loadFailed,
}: {
  positions: { title: string; status: string; pending: number }[];
  kpis?: { active_positions?: number; delivered_this_month?: number; time_to_shortlist_days?: number };
  isLoading?: boolean;
  loadFailed?: boolean;
}) {
  return (
    <div>
      <SlideEyebrow>Active roles</SlideEyebrow>
      <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
        The searches running right now.
      </h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <Stat label="Active roles" value={loadFailed ? "—" : (kpis?.active_positions ?? positions.length)} />
        <Stat label="Delivered this month" value={loadFailed ? "—" : (kpis?.delivered_this_month ?? "—")} />
        <Stat label="Days to shortlist" value={loadFailed ? "—" : (kpis?.time_to_shortlist_days ?? "—")} />
      </div>
      {isLoading ? (
        <SlideNote>Loading your roles…</SlideNote>
      ) : loadFailed ? (
        <SlideNote>
          We couldn't load your roles. This is a loading problem on our side — it does not
          mean the workspace is empty.
        </SlideNote>
      ) : positions.length === 0 ? (
        <SlideNote>
          No active roles in this workspace yet. Once a role goes live, it appears
          here with its review count.
        </SlideNote>

      ) : (
        <ul className="mt-10 space-y-3">
          {positions.map((p) => (
            <li
              key={p.title}
              className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-5 py-4"
            >
              <div>
                <p className="font-semibold">{p.title}</p>
                <p className="text-xs text-white/60 capitalize">{p.status}</p>
              </div>
              {p.pending > 0 ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  {p.pending} to review
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SlideShortlist({
  candidates,
  isLoading,
  loadFailed,
}: {
  candidates: { rank: number; name: string; score: number; note: string }[];
  isLoading?: boolean;
  loadFailed?: boolean;
}) {
  return (
    <div>
      <SlideEyebrow>Ranked shortlist</SlideEyebrow>
      <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
        Top candidates, with the reasoning attached.
      </h2>
      {isLoading ? (
        <SlideNote>Loading your shortlist…</SlideNote>
      ) : loadFailed ? (
        <SlideNote>
          We couldn't load your shortlist. This is a loading problem on our side — it does
          not mean no candidates have been released.
        </SlideNote>
      ) : candidates.length === 0 ? (
        <SlideNote>
          No candidates released to this workspace yet. Approved candidates appear
          here in rank order with the evidence behind each score.
        </SlideNote>

      ) : (
        <div className="mt-10 space-y-4">
          {candidates.map((c) => (
            <div
              key={c.rank}
              className="flex items-center gap-6 rounded-xl border border-white/15 bg-white/5 px-6 py-5"
            >
              <span className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold text-white/40">
                #{c.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{c.name}</p>
                <p className="mt-1 text-sm text-white/70">"{c.note}"</p>
              </div>
              <div className="text-right">
                <p className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold">
                  {c.score}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-white/50">fit</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function SlideEconomics() {
  return (
    <div>
      <SlideEyebrow>Economics</SlideEyebrow>
      <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
        Priced like software. Delivered by people.
      </h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { tier: "Pilot", price: PRICE_PILOT_DISPLAY, unit: " one-time", body: PILOT_ROLES_LABEL + ". Test the model on one critical hire." },
          { tier: "Multi Position", price: PRICE_MULTI_DISPLAY, unit: " one-time", body: MULTI_ROLES_LABEL + ". Parallel searches, shared context.", highlight: true },
          { tier: "Hiring Sprint", price: PRICE_SPRINT_DISPLAY, unit: " one-time", body: SPRINT_ROLES_LABEL + ". Concurrent, priority support." },
          { tier: "Custom", price: PRICE_ENTERPRISE_DISPLAY, unit: "", body: ENTERPRISE_ROLES_LABEL + ". Continuous portfolio hiring." },
        ].map((t) => (
          <div
            key={t.tier}
            className={`rounded-xl border p-6 ${
              t.highlight ? "border-white bg-white/10" : "border-white/15 bg-white/5"
            }`}
          >
            <p className="text-xs uppercase tracking-widest text-white/60">{t.tier}</p>
            <p className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold">
              {t.price}
              <span className="text-sm font-normal text-white/60">{t.unit}</span>
            </p>
            <p className="mt-3 text-sm text-white/70">{t.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-white/60">
        A single €120k placement at a 20% fee equals more than five Hiring Sprints — with no candidate ownership.
      </p>
    </div>
  );
}

function SlideIndustry() {
  return (
    <div>
      <SlideEyebrow>Industry fit</SlideEyebrow>
      <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
        The rubric adapts to your vertical.
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          "Technology & SaaS",
          "Healthcare & clinical",
          "Financial services",
          "Hospitality & travel",
          "Industrial & manufacturing",
          "Professional services",
        ].map((v) => (
          <div key={v} className="rounded-xl border border-white/15 bg-white/5 px-5 py-4">
            <Sparkles className="h-4 w-4 text-white/50" aria-hidden />
            <p className="mt-2 font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-white/60">
        Each vertical carries a scoring rubric tuned to what "good" looks like there.
      </p>
    </div>
  );
}

function SlideNext() {
  return (
    <div>
      <SlideEyebrow>Next steps</SlideEyebrow>
      <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
        What happens after this meeting.
      </h2>
      <ol className="mt-10 space-y-4">
        {[
          "Confirm the roles for the next 90 days.",
          "Select the package (Pilot, Multi, Sprint, or Custom) and start date.",
          "Kick off intake — first shortlist in days.",
          "Weekly operating review starts week two.",
        ].map((t, idx) => (
          <li
            key={t}
            className="flex items-start gap-4 rounded-xl border border-white/15 bg-white/5 px-5 py-4"
          >
            <span className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-white/40">
              0{idx + 1}
            </span>
            <p className="pt-1 text-lg">{t}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-5">
      <p className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold">
        {value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-widest text-white/55">{label}</p>
    </div>
  );
}
