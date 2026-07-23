import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
 ArrowLeft,
 BadgeCheck,
 Briefcase,
 Building2,
 CalendarClock,
 CheckCircle2,
 ChevronDown,
 ClipboardCopy,
 Copy,
 ExternalLink,
 Github,
 Globe,
 GraduationCap,
 Info,
 Languages as LanguagesIcon,
 Linkedin,
 MapPin,
 MessageSquare,
 MoreHorizontal,
 ShieldAlert,
 Sparkles,
 XCircle,
} from "lucide-react";
import {
 clientAction,
 getClientCandidate,
 getClientContext,
} from "@/lib/client.functions";
import type { MatchStage } from "@/lib/client-kpi.server";
import { DownloadCvButton } from "@/components/download-cv-button";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
 Accordion,
 AccordionContent,
 AccordionItem,
 AccordionTrigger,
} from "@/components/ui/accordion";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
 DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/client/candidates/$id")({
 head: () => ({
 meta: [
 { title: "Candidate · Client workspace" },
 { name: "robots", content: "noindex" },
 ],
 }),
 notFoundComponent: () => (
 <div className="p-8 text-sm text-muted-foreground">Candidate not found.</div>
 ),
 errorComponent: ({ error }) => (
 <div className="p-8 text-sm text-destructive">Failed to load: {error.message}</div>
 ),
 component: CandidateDetailPage,
});

// ─── Stage → primary + secondary actions ─────────────────────────────────────

type ActionKey =
 | "shortlist"
 | "request_interview"
 | "request_more_information"
 | "submit_feedback"
 | "not_moving_forward"
 | "offer"
 | "hire";

type ActionDef = { key: ActionKey; label: string };

const ACTIONS_BY_STAGE: Record<MatchStage, { primary: ActionDef | null; more: ActionDef[] }> = {
 delivered: {
 primary: { key: "shortlist", label: "Shortlist" },
 more: [
 { key: "request_interview", label: "Request interview" },
 { key: "request_more_information", label: "Request more information" },
 { key: "not_moving_forward", label: "Not moving forward" },
 ],
 },
 shortlisted: {
 primary: { key: "request_interview", label: "Request interview" },
 more: [
 { key: "request_more_information", label: "Request more information" },
 { key: "not_moving_forward", label: "Not moving forward" },
 ],
 },
 interview_process: {
 primary: { key: "offer", label: "Extend offer" },
 more: [
 { key: "submit_feedback", label: "Submit feedback" },
 { key: "not_moving_forward", label: "Not moving forward" },
 ],
 },
 offer: {
 primary: { key: "hire", label: "Mark hired" },
 more: [{ key: "not_moving_forward", label: "Not moving forward" }],
 },
 hired: { primary: null, more: [{ key: "submit_feedback", label: "Submit feedback" }] },
 not_moving_forward: {
 primary: { key: "shortlist", label: "Re-open — shortlist" },
 more: [],
 },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function CandidateDetailPage() {
 const { id } = Route.useParams();
 const qc = useQueryClient();
 const ctxFn = useServerFn(getClientContext);
 const detailFn = useServerFn(getClientCandidate);
 const actionFn = useServerFn(clientAction);
 const orgSearch = useClientOrgSearch();
 const support = useSupportView();

 const { data: ctx } = useQuery({
 queryKey: ["client-context", orgSearch ?? null],
 queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
 });
 const orgId = ctx?.active?.organization_id;

 const {
 data,
 isPending: detailPending,
 isFetching: detailFetching,
 error: detailError,
 } = useQuery({
 queryKey: ["client-candidate", orgId, id],
 queryFn: () => detailFn({ data: { orgId: orgId!, matchId: id } }),
 enabled: !!orgId,
 });

 const act = useMutation({
 mutationFn: (a: ActionKey) =>
 actionFn({ data: { orgId: orgId!, matchId: id, action: a } }),
 onSuccess: () => {
 toast.success("Recorded");
 qc.invalidateQueries({ queryKey: ["client-candidate", orgId, id] });
 qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
 qc.invalidateQueries({ queryKey: ["client-positions", orgId] });
 qc.invalidateQueries({ queryKey: ["client-candidates", orgId] });
 },
 onError: (e: Error) => toast.error(e.message.replace(/^Error: /, "")),
 });

 if (!orgId || detailPending || (data === undefined && detailFetching)) {
 return <div className="p-8 text-sm text-muted-foreground">Loading candidate…</div>;
 }
 if (detailError) {
 return (
 <main className="mx-auto max-w-3xl px-6 py-10">
 <BackLink />
 <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
 Failed to load candidate: {detailError.message}
 </div>
 </main>
 );
 }
 if (data === null || !data?.candidate) {
 return (
 <main className="mx-auto max-w-3xl px-6 py-12">
 <BackLink />
 <div className="mt-4 rounded-lg border bg-card p-8 text-center">
 <h1 className="text-lg font-semibold">Candidate unavailable</h1>
 <p className="mt-2 text-sm text-muted-foreground">
 This candidate is no longer visible in your workspace. They may have been
 withdrawn, or you may be viewing a different client account.
 </p>
 </div>
 </main>
 );
 }

 const { candidate, interviews, decisions } = data as {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
 interviews: AnyRow[];
 decisions: AnyRow[];
 };
 const isViewer = ctx?.active?.role === "client_viewer";
 const readOnly = support.readOnly || isViewer;
 const actions = ACTIONS_BY_STAGE[candidate.stage] ?? { primary: null, more: [] };

 return (
 <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
 <BackLink />

 {/* HEADER */}
 <CandidateHeader
 candidate={candidate}
 readOnly={readOnly}
 />

 {readOnly && support.readOnly && (
 <div
 role="status"
 className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-muted-foreground"
 >
 <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
 You are viewing this candidate as the Client. Actions are disabled in
 read-only preview.
 </div>
 )}

 <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
 {/* MAIN COLUMN */}
 <div className="space-y-6 lg:col-span-8">
 <FitHero candidate={candidate} />
 <RequirementCoverage candidate={candidate} />
 <WhyThisCandidate candidate={candidate} />
 <WhatNeedsValidation candidate={candidate} />
 <InterviewGuide candidate={candidate} />
 <ExperienceTimeline candidate={candidate} />
 <SkillsAndEducation candidate={candidate} />
 {candidate.screening_answers.length > 0 && (
 <SectionCard title="Screening answers" icon={<MessageSquare className="h-4 w-4" />}>
 <dl className="space-y-3 text-sm">
 {candidate.screening_answers.map((a, i) => (
 <div key={i}>
 <dt className="text-xs font-medium text-muted-foreground">
 {a.question}
 </dt>
 <dd className="mt-0.5 whitespace-pre-wrap">{a.answer || "Not provided"}</dd>
 </div>
 ))}
 </dl>
 </SectionCard>
 )}
 {(interviews.length > 0 || decisions.length > 0) && (
 <ActivitySection interviews={interviews} decisions={decisions} />
 )}
 </div>

        {/* SIDE PANEL — Decision cockpit (sticky on desktop) */}
        <aside className="space-y-6 lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-6">
            <ActionArea
              actions={actions}
              readOnly={readOnly}
              pending={act.isPending}
              onAct={(k) => act.mutate(k)}
              stage={candidate.stage}
            />
            <ProfilePanel candidate={candidate} />
            <LinksPanel candidate={candidate} />
          </div>
        </aside>
      </div>
    </main>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function BackLink() {
 return (
 <Link
 to="/client/candidates"
 className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
 All candidates
 </Link>
 );
}

function CandidateHeader({
 candidate,
 readOnly,
}: {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
 readOnly: boolean;
}) {
 const c = candidate.candidate;
 return (
 <header className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-2">
 <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
 {c.display_name}
 </h1>
 <Badge variant="outline" className="capitalize">
 {String(candidate.stage).replace(/_/g, " ")}
 </Badge>
 </div>
 {c.headline && (
 <p className="mt-1 text-base text-muted-foreground">
 {c.headline}
 </p>
 )}
 {c.headline_chips.length > 0 && (
 <div className="mt-2 flex flex-wrap gap-1.5">
 {c.headline_chips.map((chip) => (
 <Badge key={chip} variant="secondary" className="font-normal">
 {chip}
 </Badge>
 ))}
 </div>
 )}
 <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
 {candidate.position && (
 <Link
 to="/client/positions/$id"
 params={{ id: candidate.position.id }}
 className="inline-flex items-center gap-1 text-foreground hover:underline"
 >
 <Briefcase className="h-3.5 w-3.5" aria-hidden />
 {candidate.position.title}
 </Link>
 )}
 {c.location && (
 <span className="inline-flex items-center gap-1">
 <MapPin className="h-3.5 w-3.5" aria-hidden />
 {c.location}
 </span>
 )}
 {c.availability && (
 <span className="inline-flex items-center gap-1">
 <CalendarClock className="h-3.5 w-3.5" aria-hidden />
 {c.availability}
 </span>
 )}
 {c.years_experience != null && (
 <span>{c.years_experience}+ yrs experience</span>
 )}
 </div>
 {candidate.last_updated && (
 <p className="mt-2 text-xs text-muted-foreground">
 Last updated {new Date(candidate.last_updated).toLocaleString()}
 </p>
 )}
 </div>
 <div className="flex flex-wrap items-center gap-2">
 {c.links.linkedin && (
 <Button asChild variant="outline" size="sm">
 <a
 href={c.links.linkedin}
 target="_blank"
 rel="noopener noreferrer"
 aria-label={`Open LinkedIn profile for ${c.display_name} (opens in new tab)`}
 >
 <Linkedin className="mr-1.5 h-4 w-4" aria-hidden />
 LinkedIn
 <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
 </a>
 </Button>
 )}
 <DownloadCvButton matchId={candidate.match_id} />
 {readOnly && (
 <Badge variant="secondary" className="hidden sm:inline-flex">
 Preview
 </Badge>
 )}
 </div>
 </header>
 );
}

function FitHero({
 candidate,
}: {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
}) {
 const fit = candidate.fit;
 const score = candidate.score;
 const ring = accentToRing(fit.accent);
 const bg = accentToSoftBg(fit.accent);
 const dashArray = 251.2; // 2π·40
 const dashOffset = score != null ? dashArray * (1 - score / 100) : dashArray;

 return (
 <section
 aria-labelledby="fit-heading"
 className={cn("rounded-xl border p-5 sm:p-6", bg)}
 >
 <div className="flex flex-wrap items-start justify-between gap-6">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
 <Sparkles className="h-3.5 w-3.5" aria-hidden />
 Fit recommendation
 </div>
 <h2 id="fit-heading" className="mt-1 text-2xl font-semibold tracking-tight">
 {fit.headline}
 </h2>
 <p className={cn("mt-0.5 text-sm font-medium", ring.text)}>
 {fit.recommendation}
 </p>
 {candidate.summary && (
 <p className="mt-3 text-sm leading-relaxed text-foreground/90">
 {candidate.summary}
 </p>
 )}
 {candidate.last_updated && (
 <p className="mt-2 text-xs text-muted-foreground">
 Scored {new Date(candidate.last_updated).toLocaleDateString()}
 </p>
 )}
 </div>
 {score != null && (
 <div className="flex items-center gap-4">
 <div
 role="img"
 aria-label={`Approved fit score ${Math.round(score)} out of 100 — ${fit.headline}`}
 className="relative"
 >
 <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
 <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" />
 <circle
 cx="48"
 cy="48"
 r="40"
 fill="none"
 className={ring.stroke}
 strokeWidth="8"
 strokeLinecap="round"
 strokeDasharray={dashArray}
 strokeDashoffset={dashOffset}
 transform="rotate(-90 48 48)"
 />
 </svg>
 <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
 <span className="text-2xl font-semibold tabular-nums">
 {Math.round(score)}
 </span>
 <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
 / 100
 </span>
 </div>
 </div>
 </div>
 )}
 </div>
 </section>
 );
}

function RequirementCoverage({
 candidate,
}: {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
}) {
 const { coverage, requirement_rows } = candidate;
 if (requirement_rows.length === 0) return null;
 return (
 <SectionCard
 title="Requirement coverage"
 icon={<CheckCircle2 className="h-4 w-4" />}
 description="Every declared role requirement, mapped to the evidence we found."
 >
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
 <Metric label="Must-have met" value={`${coverage.must_met}/${coverage.must_total || "—"}`} tone="emerald" />
 <Metric label="Partially met" value={coverage.must_partial} tone="amber" />
 <Metric label="Not evidenced" value={coverage.must_missing} tone="slate" />
 <Metric label="Preferred met" value={`${coverage.preferred_met}/${coverage.preferred_total || "—"}`} tone="sky" />
 </div>
 <div className="mt-4">
 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span>Overall coverage</span>
 <span className="tabular-nums">{coverage.overall_pct}%</span>
 </div>
 <Progress value={coverage.overall_pct} className="mt-1" />
 </div>
 <Separator className="my-4" />
 <ul className="space-y-2">
 {requirement_rows.map((r) => (
 <RequirementRowView key={r.id} row={r} />
 ))}
 </ul>
 </SectionCard>
 );
}

function RequirementRowView({
 row,
}: {
 row: import("@/lib/client-fit-presentation").RequirementRow;
}) {
 const badge = statusBadge(row.status);
 return (
 <li className="rounded-md border bg-background/40 p-3">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-2">
 <span className="font-medium">{row.label}</span>
 <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
 {row.importance === "must_have" ? "Must-have" : "Preferred"}
 </Badge>
 </div>
 {row.explanation && (
 <p className="mt-1 text-sm text-muted-foreground">{row.explanation}</p>
 )}
 </div>
 <span
 className={cn(
 "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
 badge.className,
 )}
 aria-label={badge.aria}
 >
 {badge.icon}
 {badge.label}
 </span>
 </div>
 {row.evidence.length > 0 && (
 <Accordion type="single" collapsible className="mt-2">
 <AccordionItem value="evidence" className="border-none">
 <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
 Show evidence ({row.evidence.length})
 </AccordionTrigger>
 <AccordionContent>
 <ul className="mt-1 space-y-2 border-l-2 border-muted pl-3 text-sm">
 {row.evidence.map((e, i) => (
 <li key={i}>
 {e.source && (
 <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
 {e.source}
 </div>
 )}
 <div className="text-foreground/90">{e.snippet}</div>
 </li>
 ))}
 </ul>
 </AccordionContent>
 </AccordionItem>
 </Accordion>
 )}
 </li>
 );
}

function WhyThisCandidate({
 candidate,
}: {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
}) {
 if (candidate.strengths.length === 0) return null;
 return (
 <SectionCard
 title="Why this candidate"
 icon={<Sparkles className="h-4 w-4" />}
 description="The strongest verified reasons to consider this candidate for the role."
 >
 <ul className="grid gap-3 sm:grid-cols-2">
 {candidate.strengths.map((s, i) => (
 <li key={i} className="rounded-md border taas-bd-success taas-bg-success-soft p-3">
 <div className="flex items-start gap-2">
 <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 taas-fg-success" aria-hidden />
 <span className="text-sm">{s}</span>
 </div>
 </li>
 ))}
 </ul>
 </SectionCard>
 );
}

function WhatNeedsValidation({
 candidate,
}: {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
}) {
 const concerns = candidate.concerns;
 const partial = candidate.requirement_rows.filter(
 (r) => r.status === "partial" || r.status === "not_evidenced" || r.status === "contradicted",
 );
 if (concerns.length === 0 && partial.length === 0) return null;
 return (
 <SectionCard
 title="What needs validation"
 icon={<Info className="h-4 w-4" />}
 description="Areas to confirm during the interview before a hiring decision."
 >
 <ul className="space-y-2">
 {concerns.map((c, i) => (
 <li key={`c-${i}`} className="flex items-start gap-2 rounded-md border taas-bd-warning taas-bg-warning-soft p-3 text-sm">
 <Info className="mt-0.5 h-4 w-4 shrink-0 taas-fg-warning" aria-hidden />
 <span>{c}</span>
 </li>
 ))}
 {partial.slice(0, 4).map((r) => (
 <li key={r.id} className="flex items-start gap-2 rounded-md border taas-bd-warning taas-bg-warning-soft p-3 text-sm">
 <Info className="mt-0.5 h-4 w-4 shrink-0 taas-fg-warning" aria-hidden />
 <span>
 <strong className="font-medium">{r.label}</strong> —{" "}
 {r.status === "partial"
 ? "partially evidenced; confirm depth in the interview."
 : r.status === "contradicted"
 ? "the evidence conflicts; ask the candidate to clarify."
 : "no supporting evidence found; validate directly."}
 </span>
 </li>
 ))}
 </ul>
 </SectionCard>
 );
}

function InterviewGuide({
 candidate,
}: {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
}) {
 const guide = candidate.interview_guide;
 const [copied, setCopied] = useState(false);
 const copy = () => {
 const text = guide
 .map(
 (q) =>
 `• ${q.question}\n Why: ${q.why}\n Look for: ${q.indicators.join("; ")}` +
 (q.followUp ? `\n Follow-up: ${q.followUp}` : ""),
 )
 .join("\n\n");
 navigator.clipboard.writeText(text).then(() => {
 setCopied(true);
 toast.success("Interview guide copied");
 setTimeout(() => setCopied(false), 2000);
 });
 };
 if (guide.length === 0) return null;

 const groups = guide.reduce<Record<string, typeof guide>>((acc, q) => {
 (acc[q.group] ||= []).push(q);
 return acc;
 }, {});

 return (
 <SectionCard
 title="Personalised interview guide"
 icon={<MessageSquare className="h-4 w-4" />}
 description="Grounded in this candidate's evidence and this role's requirements."
 action={
 <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy interview guide">
 {copied ? (
 <>
 <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
 Copied
 </>
 ) : (
 <>
 <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
 Copy guide
 </>
 )}
 </Button>
 }
 >
 <div className="space-y-4">
 {Object.entries(groups).map(([group, qs]) => (
 <div key={group}>
 <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 {group}
 </h3>
 <ol className="space-y-3">
 {qs.map((q, i) => (
 <li key={q.id} className="rounded-md border bg-background/40 p-3">
 <p className="font-medium text-sm">
 <span className="mr-2 text-muted-foreground">{i + 1}.</span>
 {q.question}
 </p>
 <p className="mt-1 text-xs text-muted-foreground">
 <span className="font-medium text-foreground/70">Why: </span>
 {q.why}
 </p>
 {q.indicators.length > 0 && (
 <ul className="mt-2 space-y-0.5 text-xs text-foreground/80">
 {q.indicators.map((ind, j) => (
 <li key={j} className="flex gap-1.5">
 <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 taas-fg-success" aria-hidden />
 <span>{ind}</span>
 </li>
 ))}
 </ul>
 )}
 {q.followUp && (
 <p className="mt-2 text-xs text-muted-foreground">
 Follow-up: {q.followUp}
 </p>
 )}
 </li>
 ))}
 </ol>
 </div>
 ))}
 </div>
 </SectionCard>
 );
}

function ExperienceTimeline({
 candidate,
}: {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
}) {
 if (candidate.experience.length === 0) return null;
 return (
 <SectionCard title="Career experience" icon={<Briefcase className="h-4 w-4" />}>
 <ol className="relative space-y-4 border-l border-muted pl-5">
 {candidate.experience.map((e, i) => (
 <li key={i} className="relative">
 <span
 className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary/70"
 aria-hidden
 />
 <div className="text-sm font-medium">{e.title}</div>
 <div className="text-xs text-muted-foreground">
 {[e.company, e.period || "Date not confirmed"].filter(Boolean).join(" · ")}
 </div>
 {e.description && (
 <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
 {e.description}
 </p>
 )}
 </li>
 ))}
 </ol>
 </SectionCard>
 );
}

function SkillsAndEducation({
 candidate,
}: {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
}) {
 const hasAny =
 candidate.skills.length > 0 ||
 candidate.education.length > 0 ||
 candidate.certifications.length > 0 ||
 candidate.languages.length > 0;
 if (!hasAny) return null;

 return (
 <SectionCard title="Skills, education, and languages" icon={<GraduationCap className="h-4 w-4" />}>
 <div className="grid gap-4 sm:grid-cols-2">
 {candidate.skills.length > 0 && (
 <div>
 <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Skills
 </h3>
 <div className="flex flex-wrap gap-1.5">
 {candidate.skills.map((s, i) => (
 <Badge key={i} variant="secondary" className="text-xs font-normal">
 {s}
 </Badge>
 ))}
 </div>
 </div>
 )}
 {candidate.languages.length > 0 && (
 <div>
 <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Languages
 </h3>
 <ul className="space-y-1 text-sm">
 {candidate.languages.map((l, i) => (
 <li key={i}>
 <span className="font-medium">{l.name}</span>
 {l.level && <span className="text-muted-foreground"> — {l.level}</span>}
 </li>
 ))}
 </ul>
 </div>
 )}
 {candidate.education.length > 0 && (
 <div className="sm:col-span-2">
 <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Education
 </h3>
 <ul className="space-y-2 text-sm">
 {candidate.education.map((e, i) => (
 <li key={i}>
 <div className="font-medium">{e.degree ?? "Not specified"}</div>
 <div className="text-xs text-muted-foreground">
 {[e.institution, e.period].filter(Boolean).join(" · ") || "Institution not confirmed"}
 </div>
 </li>
 ))}
 </ul>
 </div>
 )}
 {candidate.certifications.length > 0 && (
 <div className="sm:col-span-2">
 <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Certifications
 </h3>
 <ul className="space-y-1 text-sm">
 {candidate.certifications.map((c, i) => (
 <li key={i}>
 <BadgeCheck className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden />
 <span className="font-medium">{c.name}</span>
 {c.issuer && <span className="text-muted-foreground"> · {c.issuer}</span>}
 {c.date && <span className="text-muted-foreground"> · {c.date}</span>}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 </SectionCard>
 );
}

function ActivitySection({
 interviews,
 decisions,
}: {
 interviews: AnyRow[];
 decisions: AnyRow[];
}) {
 return (
 <SectionCard title="Activity" icon={<CalendarClock className="h-4 w-4" />}>
 {interviews.length > 0 && (
 <div className="mb-3">
 <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Interviews
 </h3>
 <ul className="space-y-1 text-sm">
 {interviews.map((iv) => (
 <li key={iv.id} className="flex items-center justify-between">
 <span className="capitalize">{String(iv.status).replace(/_/g, " ")}</span>
 <span className="text-xs text-muted-foreground">
 {iv.scheduled_at ?? iv.requested_at ?? ""}
 </span>
 </li>
 ))}
 </ul>
 </div>
 )}
 {decisions.length > 0 && (
 <div>
 <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Decisions
 </h3>
 <ul className="space-y-2 text-sm">
 {decisions.map((d) => (
 <li key={d.id} className="border-b pb-2 last:border-b-0">
 <div className="flex items-center justify-between">
 <span className="font-medium capitalize">
 {String(d.decision).replace(/_/g, " ")}
 </span>
 <span className="text-xs text-muted-foreground">
 {new Date(d.created_at).toLocaleString()}
 </span>
 </div>
 {d.feedback && (
 <div className="mt-1 text-muted-foreground">{d.feedback}</div>
 )}
 </li>
 ))}
 </ul>
 </div>
 )}
 </SectionCard>
 );
}

function ActionArea({
 actions,
 readOnly,
 pending,
 onAct,
 stage,
}: {
 actions: { primary: ActionDef | null; more: ActionDef[] };
 readOnly: boolean;
 pending: boolean;
 onAct: (k: ActionKey) => void;
 stage: MatchStage;
}) {
 return (
 <div className="rounded-xl border bg-card p-4">
 <h2 className="mb-2 text-sm font-semibold">Next step</h2>
 {stage === "hired" ? (
 <p className="text-sm text-muted-foreground">Candidate marked as hired.</p>
 ) : (
 <p className="mb-3 text-xs text-muted-foreground">
 Current stage:{" "}
 <span className="font-medium capitalize text-foreground">
 {stage.replace(/_/g, " ")}
 </span>
 </p>
 )}
 <div className="flex items-center gap-2">
 {actions.primary && (
 <Button
 className="flex-1"
 disabled={readOnly || pending}
 onClick={() => onAct(actions.primary!.key)}
 >
 {actions.primary.label}
 </Button>
 )}
 {actions.more.length > 0 && (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="icon" aria-label="More actions" disabled={readOnly}>
 <MoreHorizontal className="h-4 w-4" aria-hidden />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56">
 {actions.more.map((a, i) => (
 <div key={a.key}>
 {i > 0 && a.key === "not_moving_forward" && <DropdownMenuSeparator />}
 <DropdownMenuItem
 onSelect={() => onAct(a.key)}
 disabled={pending}
 className={cn(
 a.key === "not_moving_forward" && "text-destructive focus:text-destructive",
 )}
 >
 {a.label}
 </DropdownMenuItem>
 </div>
 ))}
 </DropdownMenuContent>
 </DropdownMenu>
 )}
 </div>
 {readOnly && (
 <p className="mt-3 text-xs text-muted-foreground">
 Actions unavailable in read-only preview.
 </p>
 )}
 <Link
 to="/client/messages"
 className="mt-3 block text-center text-sm text-primary hover:underline"
 >
 Message TaaSFlow →
 </Link>
 </div>
 );
}

function ProfilePanel({
 candidate,
}: {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
}) {
 const c = candidate.candidate;
 const rows: Array<[string, string | null | undefined]> = [
 ["Location", c.location],
 ["Timezone", c.timezone],
 ["Availability", c.availability],
 ["Years of experience", c.years_experience != null ? `${c.years_experience}` : null],
 ["Current role", c.current_role],
 ["Current company", c.current_company],
 ["Work authorization", candidate.work_authorization],
 [
 "Languages",
 candidate.languages.length > 0
 ? candidate.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(", ")
 : null,
 ],
 ];
 return (
 <div className="rounded-xl border bg-card p-4">
 <h2 className="mb-3 text-sm font-semibold">Profile</h2>
 <dl className="space-y-2 text-sm">
 {rows.map(([label, value]) => (
 <div key={label} className="grid grid-cols-[9rem_1fr] gap-2">
 <dt className="text-xs text-muted-foreground">{label}</dt>
 <dd>{value || <span className="text-muted-foreground">Not provided</span>}</dd>
 </div>
 ))}
 </dl>
 </div>
 );
}

function LinksPanel({
 candidate,
}: {
 candidate: import("@/lib/client-kpi.server").ClientCandidateDTO;
}) {
 const links = candidate.candidate.links;
 const entries: Array<{ label: string; url: string | null; icon: React.ReactNode }> = [
 { label: "LinkedIn", url: links.linkedin, icon: <Linkedin className="h-4 w-4" aria-hidden /> },
 { label: "Portfolio", url: links.portfolio, icon: <Globe className="h-4 w-4" aria-hidden /> },
 { label: "GitHub", url: links.github, icon: <Github className="h-4 w-4" aria-hidden /> },
 { label: "Website", url: links.website, icon: <Building2 className="h-4 w-4" aria-hidden /> },
 ];
 return (
 <div className="rounded-xl border bg-card p-4">
 <h2 className="mb-3 text-sm font-semibold">Links &amp; CV</h2>
 <ul className="space-y-2 text-sm">
 {entries.map((e) => (
 <li key={e.label} className="flex items-center gap-2">
 {e.icon}
 <span className="w-20 text-xs text-muted-foreground">{e.label}</span>
 {e.url ? (
 <a
 href={e.url}
 target="_blank"
 rel="noopener noreferrer"
 className="min-w-0 flex-1 truncate text-primary hover:underline"
 aria-label={`Open ${e.label} (opens in new tab)`}
 >
 {e.url.replace(/^https?:\/\//, "")}
 <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden />
 </a>
 ) : (
 <span className="flex-1 text-muted-foreground">
 {e.label === "LinkedIn" ? "LinkedIn not provided" : "Not provided"}
 </span>
 )}
 </li>
 ))}
 <li className="pt-1">
 <DownloadCvButton matchId={candidate.match_id} />
 </li>
 </ul>
 </div>
 );
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function SectionCard({
 title,
 icon,
 description,
 action,
 children,
}: {
 title: string;
 icon?: React.ReactNode;
 description?: string;
 action?: React.ReactNode;
 children: React.ReactNode;
}) {
 return (
 <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby={`sec-${title}`}>
 <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
 <div>
 <h2 id={`sec-${title}`} className="flex items-center gap-2 text-sm font-semibold">
 {icon}
 {title}
 </h2>
 {description && (
 <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
 )}
 </div>
 {action}
 </header>
 {children}
 </section>
 );
}

function Metric({
 label,
 value,
 tone,
}: {
 label: string;
 value: string | number;
 tone: "emerald" | "amber" | "slate" | "sky";
}) {
 const bg = {
 emerald: "taas-bg-success-soft taas-fg-success ",
 amber: "taas-bg-warning-soft taas-fg-warning ",
 slate: "taas-bg-neutral-soft taas-fg-neutral ",
 sky: "taas-bg-info-soft taas-fg-info ",
 }[tone];
 return (
 <div className="rounded-md border p-3">
 <div className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", bg)}>
 {label}
 </div>
 <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
 </div>
 );
}

function statusBadge(status: import("@/lib/client-fit-presentation").RequirementStatus) {
 switch (status) {
 case "met":
 return {
 label: "Met",
 aria: "Met",
 icon: <CheckCircle2 className="h-3 w-3" aria-hidden />,
 className: "taas-bg-success-soft taas-fg-success ",
 };
 case "partial":
 return {
 label: "Partial",
 aria: "Partially met",
 icon: <Info className="h-3 w-3" aria-hidden />,
 className: "taas-bg-warning-soft taas-fg-warning ",
 };
 case "contradicted":
 return {
 label: "Conflict",
 aria: "Contradicted",
 icon: <XCircle className="h-3 w-3" aria-hidden />,
 className: "taas-bg-danger-soft taas-fg-danger ",
 };
 case "not_applicable":
 return {
 label: "N/A",
 aria: "Not applicable",
 icon: <Info className="h-3 w-3" aria-hidden />,
 className: "taas-bg-neutral-soft taas-fg-neutral ",
 };
 default:
 return {
 label: "Not evidenced",
 aria: "Not evidenced",
 icon: <Info className="h-3 w-3" aria-hidden />,
 className: "taas-bg-neutral-soft taas-fg-neutral ",
 };
 }
}

function accentToRing(accent: import("@/lib/client-fit-presentation").FitPresentation["accent"]) {
 switch (accent) {
 case "emerald":
 return { text: "taas-fg-success ", stroke: "taas-fg-success" };
 case "sky":
 return { text: "taas-fg-info ", stroke: "taas-fg-info" };
 case "amber":
 return { text: "taas-fg-warning ", stroke: "taas-fg-warning" };
 case "rose":
 return { text: "taas-fg-danger ", stroke: "taas-fg-danger" };
 default:
 return { text: "taas-fg-neutral ", stroke: "taas-fg-neutral" };
 }
}

function accentToSoftBg(accent: import("@/lib/client-fit-presentation").FitPresentation["accent"]) {
 switch (accent) {
 case "emerald":
 return "taas-bg-success-soft";
 case "sky":
 return "taas-bg-info-soft";
 case "amber":
 return "taas-bg-warning-soft";
 case "rose":
 return "taas-bg-danger-soft";
 default:
 return "bg-muted/30";
 }
}
