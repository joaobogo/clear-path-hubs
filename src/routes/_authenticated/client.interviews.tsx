import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
 listClientInterviews,
 listSchedulableCandidates,
 requestInterview,
 proposeInterviewTimes,
 confirmInterviewTime,
 cancelInterview,
 markInterviewCompleted,
 type InterviewDTO,
 type InterviewStatus,
 type InterviewType,
 type InterviewParticipant,
 type SchedulableCandidate,
} from "@/lib/interviews.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { PageHeader, PageBody, PageShell } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 Dialog,
 DialogContent,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
 CalendarClock,
 CheckCircle2,
 Circle,
 Clock,
 MapPin,
 Plus,
 Users2,
 Video,
 X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/interviews")({
 head: () => ({
 meta: [
 { title: "Interviews · Client workspace" },
 { name: "robots", content: "noindex" },
 ],
 }),
 component: InterviewsPage,
});

const STATUS_TABS: { value: InterviewStatus | "all"; label: string }[] = [
 { value: "all", label: "All" },
 { value: "requested", label: "Requested" },
 { value: "scheduling", label: "Scheduling" },
 { value: "scheduled", label: "Scheduled" },
 { value: "completed", label: "Completed" },
 { value: "cancelled", label: "Cancelled" },
];

const TYPE_OPTIONS: { value: InterviewType; label: string }[] = [
 { value: "phone_screen", label: "Phone screen" },
 { value: "video_call", label: "Video call" },
 { value: "onsite", label: "Onsite" },
 { value: "technical", label: "Technical" },
 { value: "panel", label: "Panel" },
 { value: "final", label: "Final round" },
 { value: "other", label: "Other" },
];

function detectTimezone(): string {
 try {
 return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
 } catch {
 return "UTC";
 }
}

function formatWhen(iso: string | null, tz: string | null): string {
 if (!iso) return "—";
 try {
 const zone = tz || detectTimezone();
 return new Intl.DateTimeFormat(undefined, {
 dateStyle: "medium",
 timeStyle: "short",
 timeZone: zone,
 }).format(new Date(iso));
 } catch {
 return new Date(iso).toLocaleString();
 }
}

function statusBadgeClass(status: InterviewStatus): string {
 switch (status) {
 case "requested":
 return "taas-bg-warning-soft taas-fg-warning border taas-bd-warning";
 case "scheduling":
 return "taas-bg-info-soft taas-fg-info border taas-bd-info";
 case "scheduled":
 return "taas-bg-success-soft taas-fg-success border taas-bd-success";
 case "completed":
 return "taas-bg-neutral-soft taas-fg-neutral border taas-bd-neutral";
 case "cancelled":
 return "taas-bg-danger-soft taas-fg-danger border taas-bd-danger";
 }
}

function InterviewsPage() {
 const org = useClientOrgSearch();
 const support = useSupportView();
 const readOnly = support.readOnly || support.permissionPreview === "client_viewer";
 const qc = useQueryClient();
 const listFn = useServerFn(listClientInterviews);
 const candidatesFn = useServerFn(listSchedulableCandidates);
 const requestFn = useServerFn(requestInterview);
 const proposeFn = useServerFn(proposeInterviewTimes);
 const confirmFn = useServerFn(confirmInterviewTime);
 const cancelFn = useServerFn(cancelInterview);
 const completeFn = useServerFn(markInterviewCompleted);

 const [tab, setTab] = useState<InterviewStatus | "all">("all");
 const [requestOpen, setRequestOpen] = useState(false);
 const [detail, setDetail] = useState<InterviewDTO | null>(null);

 const listQuery = useQuery({
 queryKey: ["client-interviews", org, tab],
 queryFn: () => listFn({ data: { orgId: org!, status: tab } }),
 enabled: !!org,
 });

 const interviews = (listQuery.data?.interviews as InterviewDTO[] | undefined) ?? [];
 const kpis = useMemo(() => {
 const src = interviews;
 return {
 requested: src.filter((i) => i.status === "requested").length,
 scheduling: src.filter((i) => i.status === "scheduling").length,
 scheduled: src.filter((i) => i.status === "scheduled").length,
 completed: src.filter((i) => i.status === "completed").length,
 };
 }, [interviews]);

 const invalidate = () => {
 qc.invalidateQueries({ queryKey: ["client-interviews"] });
 qc.invalidateQueries({ queryKey: ["client-kpis"] });
 qc.invalidateQueries({ queryKey: ["client-candidates"] });
 };

 const requestMut = useMutation({
 mutationFn: (payload: Parameters<typeof requestFn>[0]["data"]) => requestFn({ data: payload }),
 onSuccess: () => {
 toast.success("Interview requested");
 setRequestOpen(false);
 invalidate();
 },
 onError: (e: Error) => {
 if (e.message === "interview_already_active")
 toast.error("This candidate already has an active interview.");
 else if (e.message === "forbidden") toast.error("You don't have permission.");
 else if (e.message === "SUPPORT_VIEW_READ_ONLY")
 toast.error("Support view is read-only.");
 else toast.error(e.message);
 },
 });

 const proposeMut = useMutation({
 mutationFn: (payload: Parameters<typeof proposeFn>[0]["data"]) => proposeFn({ data: payload }),
 onSuccess: () => {
 toast.success("Times proposed");
 invalidate();
 setDetail(null);
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const confirmMut = useMutation({
 mutationFn: (payload: Parameters<typeof confirmFn>[0]["data"]) => confirmFn({ data: payload }),
 onSuccess: () => {
 toast.success("Interview scheduled");
 invalidate();
 setDetail(null);
 },
 onError: (e: Error) => {
 if (e.message === "scheduled_in_past") toast.error("Choose a future time.");
 else toast.error(e.message);
 },
 });

 const cancelMut = useMutation({
 mutationFn: (payload: Parameters<typeof cancelFn>[0]["data"]) => cancelFn({ data: payload }),
 onSuccess: () => {
 toast.success("Interview cancelled");
 invalidate();
 setDetail(null);
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const completeMut = useMutation({
 mutationFn: (payload: Parameters<typeof completeFn>[0]["data"]) =>
 completeFn({ data: payload }),
 onSuccess: () => {
 toast.success("Interview marked completed");
 invalidate();
 setDetail(null);
 },
 onError: (e: Error) => toast.error(e.message),
 });

 return (
 <PageShell>
 <PageHeader
 title="Interviews"
 description="Track every interview from request to completion."
 actions={
 !readOnly ? (
 <Button onClick={() => setRequestOpen(true)}>
 <Plus className="mr-1.5 h-4 w-4" /> Request interview
 </Button>
 ) : null
 }
 />
 <PageBody>
 {/* KPI strip */}
 <div className="grid gap-3 sm:grid-cols-4">
 <KpiTile label="Requested" value={kpis.requested} tone="amber" />
 <KpiTile label="Scheduling" value={kpis.scheduling} tone="blue" />
 <KpiTile label="Scheduled" value={kpis.scheduled} tone="emerald" />
 <KpiTile label="Completed" value={kpis.completed} tone="slate" />
 </div>

 <Tabs value={tab} onValueChange={(v) => setTab(v as InterviewStatus | "all")}>
 <TabsList>
 {STATUS_TABS.map((t) => (
 <TabsTrigger key={t.value} value={t.value}>
 {t.label}
 </TabsTrigger>
 ))}
 </TabsList>
 </Tabs>

 {listQuery.isLoading ? (
 <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
 Loading interviews…
 </div>
 ) : interviews.length === 0 ? (
 <div className="rounded-lg border p-8 text-center">
 <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" />
 <p className="mt-3 text-sm font-medium">No interviews yet</p>
 <p className="mt-1 text-sm text-muted-foreground">
 {readOnly
 ? "Interviews will appear here as they are scheduled."
 : "Request an interview from a shortlisted candidate to get started."}
 </p>
 </div>
 ) : (
 <div className="grid gap-3">
 {interviews.map((iv) => (
 <InterviewRow key={iv.id} interview={iv} onOpen={() => setDetail(iv)} />
 ))}
 </div>
 )}
 </PageBody>

 {requestOpen && org ? (
 <RequestDialog
 orgId={org}
 onClose={() => setRequestOpen(false)}
 submitting={requestMut.isPending}
 onSubmit={(payload) => requestMut.mutate(payload)}
 fetchCandidates={() => candidatesFn({ data: { orgId: org } })}
 />
 ) : null}

 {detail ? (
 <DetailDialog
 interview={detail}
 readOnly={readOnly}
 onClose={() => setDetail(null)}
 onPropose={(times) =>
 proposeMut.mutate({ orgId: detail.organization_id, id: detail.id, proposedTimes: times })
 }
 onConfirm={(payload) =>
 confirmMut.mutate({ orgId: detail.organization_id, id: detail.id, ...payload })
 }
 onCancel={(reason) =>
 cancelMut.mutate({ orgId: detail.organization_id, id: detail.id, reason })
 }
 onComplete={(feedback) =>
 completeMut.mutate({ orgId: detail.organization_id, id: detail.id, feedback })
 }
 pending={
 proposeMut.isPending ||
 confirmMut.isPending ||
 cancelMut.isPending ||
 completeMut.isPending
 }
 />
 ) : null}
 </PageShell>
 );
}

function KpiTile({
 label,
 value,
 tone,
}: {
 label: string;
 value: number;
 tone: "amber" | "blue" | "emerald" | "slate";
}) {
 const dot =
 tone === "amber"
 ? "taas-bg-warning-solid"
 : tone === "blue"
 ? "taas-bg-info-solid"
 : tone === "emerald"
 ? "taas-bg-success-solid"
 : "taas-bg-neutral-solid";
 return (
 <div className="rounded-lg border bg-card p-4">
 <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
 <span className={`h-2 w-2 rounded-full ${dot}`} /> {label}
 </div>
 <div className="mt-2 text-2xl font-semibold">{value}</div>
 </div>
 );
}

function InterviewRow({ interview, onOpen }: { interview: InterviewDTO; onOpen: () => void }) {
 return (
 <button
 onClick={onOpen}
 className="group grid gap-3 rounded-lg border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm sm:grid-cols-[1fr_auto]"
 >
 <div className="space-y-2 min-w-0">
 <div className="flex flex-wrap items-center gap-2">
 <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass(interview.status)}`}>
 {interview.status}
 </span>
 {interview.interview_type ? (
 <Badge variant="outline" className="capitalize">
 {interview.interview_type.replace(/_/g, " ")}
 </Badge>
 ) : null}
 {interview.position?.reference ? (
 <span className="text-xs text-muted-foreground">#{interview.position.reference}</span>
 ) : null}
 </div>
 <div className="font-medium">
 {interview.candidate?.name ?? "Candidate"}
 <span className="mx-1.5 text-muted-foreground">·</span>
 <span className="text-muted-foreground">{interview.position?.title ?? "Position"}</span>
 </div>
 <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
 <span className="inline-flex items-center gap-1">
 <Clock className="h-3.5 w-3.5" />
 {formatWhen(interview.scheduled_at, interview.timezone)}
 {interview.timezone ? <span className="ml-1 text-xs">({interview.timezone})</span> : null}
 </span>
 {interview.participants.length > 0 ? (
 <span className="inline-flex items-center gap-1">
 <Users2 className="h-3.5 w-3.5" />
 {interview.participants.length} participant
 {interview.participants.length === 1 ? "" : "s"}
 </span>
 ) : null}
 {interview.duration_minutes ? (
 <span>{interview.duration_minutes} min</span>
 ) : null}
 </div>
 </div>
 <div className="flex flex-col items-end justify-between gap-2 text-right">
 <span className="text-xs font-medium text-primary">Next: {interview.next_action}</span>
 <span className="text-xs text-muted-foreground">Open →</span>
 </div>
 </button>
 );
}

// ─── Request Dialog ─────────────────────────────────────────────────────────

function RequestDialog({
 orgId: _orgId,
 onClose,
 onSubmit,
 submitting,
 fetchCandidates,
}: {
 orgId: string;
 onClose: () => void;
 onSubmit: (payload: {
 orgId: string;
 matchId: string;
 interviewType: InterviewType;
 timezone: string;
 durationMinutes: number;
 proposedTimes: string[];
 participants: InterviewParticipant[];
 notes?: string;
 }) => void;
 submitting: boolean;
 fetchCandidates: () => Promise<{ candidates: SchedulableCandidate[] }>;
}) {
 const orgId = _orgId;
 const candidatesQ = useQuery({
 queryKey: ["client-schedulable", orgId],
 queryFn: fetchCandidates,
 });
 const [matchId, setMatchId] = useState<string>("");
 const [type, setType] = useState<InterviewType>("video_call");
 const [tz, setTz] = useState<string>(detectTimezone());
 const [duration, setDuration] = useState<number>(45);
 const [times, setTimes] = useState<string[]>([""]);
 const [participants, setParticipants] = useState<InterviewParticipant[]>([{ name: "" }]);
 const [notes, setNotes] = useState<string>("");

 const submit = () => {
 const filteredTimes = times
 .map((t) => t.trim())
 .filter(Boolean)
 .map((t) => new Date(t).toISOString());
 if (filteredTimes.length === 0) {
 toast.error("Add at least one proposed time.");
 return;
 }
 const filteredParticipants = participants
 .filter((p) => p.name.trim().length > 0)
 .map((p) => ({
 name: p.name.trim(),
 email: p.email?.trim() || undefined,
 role: p.role?.trim() || undefined,
 }));
 if (filteredParticipants.length === 0) {
 toast.error("Add at least one participant.");
 return;
 }
 if (!matchId) {
 toast.error("Select a candidate.");
 return;
 }
 onSubmit({
 orgId,
 matchId,
 interviewType: type,
 timezone: tz,
 durationMinutes: duration,
 proposedTimes: filteredTimes,
 participants: filteredParticipants,
 notes: notes.trim() || undefined,
 });
 };

 const candidates = candidatesQ.data?.candidates ?? [];

 return (
 <Dialog open onOpenChange={(v) => !v && onClose()}>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>Request interview</DialogTitle>
 <DialogDescription>
 Propose times to the TaaSFlow team. We&apos;ll coordinate with the candidate and confirm a
 slot.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4">
 <div>
 <label className="text-sm font-medium">Candidate</label>
 <Select value={matchId} onValueChange={setMatchId}>
 <SelectTrigger className="mt-1">
 <SelectValue placeholder="Select a candidate" />
 </SelectTrigger>
 <SelectContent>
 {candidates.length === 0 ? (
 <div className="p-3 text-sm text-muted-foreground">
 No delivered candidates available.
 </div>
 ) : (
 candidates.map((c) => (
 <SelectItem key={c.match_id} value={c.match_id} disabled={c.has_active_interview}>
 {c.candidate_name} — {c.position_title}
 {c.has_active_interview ? " · (has active interview)" : ""}
 </SelectItem>
 ))
 )}
 </SelectContent>
 </Select>
 </div>

 <div className="grid gap-3 sm:grid-cols-3">
 <div>
 <label className="text-sm font-medium">Type</label>
 <Select value={type} onValueChange={(v) => setType(v as InterviewType)}>
 <SelectTrigger className="mt-1">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {TYPE_OPTIONS.map((o) => (
 <SelectItem key={o.value} value={o.value}>
 {o.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <label className="text-sm font-medium">Duration (min)</label>
 <Input
 type="number"
 min={15}
 max={480}
 value={duration}
 onChange={(e) => setDuration(Number(e.target.value) || 45)}
 className="mt-1"
 />
 </div>
 <div>
 <label className="text-sm font-medium">Timezone</label>
 <Input value={tz} onChange={(e) => setTz(e.target.value)} className="mt-1" />
 </div>
 </div>

 <div>
 <div className="flex items-center justify-between">
 <label className="text-sm font-medium">Proposed times</label>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={() => setTimes((t) => [...t, ""])}
 >
 <Plus className="mr-1 h-3 w-3" /> Add
 </Button>
 </div>
 <div className="mt-1 space-y-2">
 {times.map((t, i) => (
 <div key={i} className="flex gap-2">
 <Input
 type="datetime-local"
 value={t}
 onChange={(e) =>
 setTimes((arr) => arr.map((v, idx) => (idx === i ? e.target.value : v)))
 }
 />
 {times.length > 1 ? (
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => setTimes((arr) => arr.filter((_, idx) => idx !== i))}
 >
 <X className="h-4 w-4" />
 </Button>
 ) : null}
 </div>
 ))}
 </div>
 <p className="mt-1 text-xs text-muted-foreground">
 Times are interpreted in the timezone above.
 </p>
 </div>

 <div>
 <div className="flex items-center justify-between">
 <label className="text-sm font-medium">Participants</label>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={() =>
 setParticipants((p) => [...p, { name: "" }])
 }
 >
 <Plus className="mr-1 h-3 w-3" /> Add
 </Button>
 </div>
 <div className="mt-1 space-y-2">
 {participants.map((p, i) => (
 <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
 <Input
 placeholder="Name"
 value={p.name}
 onChange={(e) =>
 setParticipants((arr) =>
 arr.map((v, idx) => (idx === i ? { ...v, name: e.target.value } : v)),
 )
 }
 />
 <Input
 placeholder="Email (optional)"
 value={p.email ?? ""}
 onChange={(e) =>
 setParticipants((arr) =>
 arr.map((v, idx) => (idx === i ? { ...v, email: e.target.value } : v)),
 )
 }
 />
 <Input
 placeholder="Role (optional)"
 value={p.role ?? ""}
 onChange={(e) =>
 setParticipants((arr) =>
 arr.map((v, idx) => (idx === i ? { ...v, role: e.target.value } : v)),
 )
 }
 />
 {participants.length > 1 ? (
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() =>
 setParticipants((arr) => arr.filter((_, idx) => idx !== i))
 }
 >
 <X className="h-4 w-4" />
 </Button>
 ) : (
 <span />
 )}
 </div>
 ))}
 </div>
 </div>

 <div>
 <label className="text-sm font-medium">Notes (optional)</label>
 <Textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 className="mt-1"
 rows={3}
 maxLength={4000}
 placeholder="Focus areas, must-cover topics, anything the team should know."
 />
 </div>
 </div>

 <DialogFooter>
 <Button variant="ghost" onClick={onClose} disabled={submitting}>
 Cancel
 </Button>
 <Button onClick={submit} disabled={submitting || !matchId}>
 {submitting ? "Requesting…" : "Request interview"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}

// ─── Detail Dialog ──────────────────────────────────────────────────────────

function DetailDialog({
 interview,
 readOnly,
 onClose,
 onPropose,
 onConfirm,
 onCancel,
 onComplete,
 pending,
}: {
 interview: InterviewDTO;
 readOnly: boolean;
 onClose: () => void;
 onPropose: (times: string[]) => void;
 onConfirm: (payload: {
 scheduledAt: string;
 timezone: string;
 durationMinutes: number;
 meetingUrl?: string;
 location?: string;
 }) => void;
 onCancel: (reason?: string) => void;
 onComplete: (feedback?: string) => void;
 pending: boolean;
}) {
 const [mode, setMode] = useState<
 "view" | "propose" | "confirm" | "reschedule" | "cancel" | "complete"
 >("view");
 const [times, setTimes] = useState<string[]>(interview.proposed_times.length ? interview.proposed_times : [""]);
 const [scheduledAt, setScheduledAt] = useState<string>(
 interview.scheduled_at ? interview.scheduled_at.slice(0, 16) : "",
 );
 const [tz, setTz] = useState<string>(interview.timezone || detectTimezone());
 const [duration, setDuration] = useState<number>(interview.duration_minutes ?? 45);
 const [meetingUrl, setMeetingUrl] = useState<string>(interview.meeting_url ?? "");
 const [location, setLocation] = useState<string>(interview.location ?? "");
 const [reason, setReason] = useState<string>("");
 const [feedback, setFeedback] = useState<string>(interview.feedback ?? "");

 return (
 <Dialog open onOpenChange={(v) => !v && onClose()}>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>
 {interview.candidate?.name ?? "Interview"}
 <span className="mx-2 text-muted-foreground">·</span>
 {interview.position?.title ?? "Position"}
 </DialogTitle>
 <DialogDescription>
 <span className={`mr-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass(interview.status)}`}>
 {interview.status}
 </span>
 {interview.interview_type ? (
 <span className="capitalize">{interview.interview_type.replace(/_/g, " ")}</span>
 ) : null}
 </DialogDescription>
 </DialogHeader>

 {mode === "view" ? (
 <div className="space-y-4 text-sm">
 <DetailRow icon={<Clock className="h-4 w-4" />} label="When">
 {formatWhen(interview.scheduled_at, interview.timezone)}
 {interview.timezone ? (
 <span className="ml-1 text-muted-foreground">({interview.timezone})</span>
 ) : null}
 {interview.duration_minutes ? (
 <span className="ml-1 text-muted-foreground">
 · {interview.duration_minutes} min
 </span>
 ) : null}
 </DetailRow>
 {interview.meeting_url ? (
 <DetailRow icon={<Video className="h-4 w-4" />} label="Meeting">
 <a
 href={interview.meeting_url}
 target="_blank"
 rel="noreferrer"
 className="text-primary underline break-all"
 >
 {interview.meeting_url}
 </a>
 </DetailRow>
 ) : null}
 {interview.location ? (
 <DetailRow icon={<MapPin className="h-4 w-4" />} label="Location">
 {interview.location}
 </DetailRow>
 ) : null}
 <DetailRow icon={<Users2 className="h-4 w-4" />} label="Participants">
 {interview.participants.length === 0 ? (
 <span className="text-muted-foreground">—</span>
 ) : (
 <ul className="space-y-1">
 {interview.participants.map((p, i) => (
 <li key={i}>
 <span className="font-medium">{p.name}</span>
 {p.role ? (
 <span className="ml-1 text-muted-foreground">· {p.role}</span>
 ) : null}
 {p.email ? (
 <span className="ml-1 text-muted-foreground">· {p.email}</span>
 ) : null}
 </li>
 ))}
 </ul>
 )}
 </DetailRow>
 {interview.proposed_times.length > 0 && interview.status !== "scheduled" ? (
 <DetailRow icon={<CalendarClock className="h-4 w-4" />} label="Proposed times">
 <ul className="space-y-0.5">
 {interview.proposed_times.map((t, i) => (
 <li key={i}>{formatWhen(t, interview.timezone)}</li>
 ))}
 </ul>
 </DetailRow>
 ) : null}
 {interview.notes ? (
 <DetailRow icon={<Circle className="h-4 w-4" />} label="Notes">
 <p className="whitespace-pre-wrap">{interview.notes}</p>
 </DetailRow>
 ) : null}
 {interview.cancel_reason ? (
 <DetailRow icon={<X className="h-4 w-4" />} label="Cancel reason">
 <p className="whitespace-pre-wrap">{interview.cancel_reason}</p>
 </DetailRow>
 ) : null}
 {interview.feedback ? (
 <DetailRow icon={<CheckCircle2 className="h-4 w-4" />} label="Feedback">
 <p className="whitespace-pre-wrap">{interview.feedback}</p>
 </DetailRow>
 ) : null}
 <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
 <div>Interview ID: <span className="font-mono">{interview.id}</span></div>
 {interview.candidate_submission_id ? (
 <div>Application: <span className="font-mono">{interview.candidate_submission_id}</span></div>
 ) : null}
 <div>Position: <span className="font-mono">{interview.position_id}</span></div>
 </div>
 </div>
 ) : null}

 {mode === "propose" ? (
 <ProposeForm times={times} setTimes={setTimes} />
 ) : null}

 {mode === "confirm" || mode === "reschedule" ? (
 <ConfirmForm
 scheduledAt={scheduledAt}
 setScheduledAt={setScheduledAt}
 tz={tz}
 setTz={setTz}
 duration={duration}
 setDuration={setDuration}
 meetingUrl={meetingUrl}
 setMeetingUrl={setMeetingUrl}
 location={location}
 setLocation={setLocation}
 />
 ) : null}

 {mode === "cancel" ? (
 <div className="space-y-2">
 <label className="text-sm font-medium">Reason (optional)</label>
 <Textarea
 rows={3}
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 maxLength={1000}
 />
 </div>
 ) : null}

 {mode === "complete" ? (
 <div className="space-y-2">
 <label className="text-sm font-medium">Feedback (optional)</label>
 <Textarea
 rows={4}
 value={feedback}
 onChange={(e) => setFeedback(e.target.value)}
 maxLength={4000}
 />
 </div>
 ) : null}

 <DialogFooter className="gap-2">
 {mode === "view" && !readOnly ? (
 <>
 {interview.status === "cancelled" || interview.status === "completed" ? null : (
 <Button variant="outline" onClick={() => setMode("cancel")}>
 Cancel
 </Button>
 )}
 {interview.status === "requested" ? (
 <Button variant="outline" onClick={() => setMode("propose")}>
 Propose times
 </Button>
 ) : null}
 {interview.status === "requested" || interview.status === "scheduling" ? (
 <Button onClick={() => setMode("confirm")}>Confirm time</Button>
 ) : null}
 {interview.status === "scheduled" ? (
 <>
 <Button variant="outline" onClick={() => setMode("reschedule")}>
 Reschedule
 </Button>
 <Button onClick={() => setMode("complete")}>Mark completed</Button>
 </>
 ) : null}
 </>
 ) : null}

 {mode !== "view" ? (
 <>
 <Button variant="ghost" onClick={() => setMode("view")} disabled={pending}>
 Back
 </Button>
 {mode === "propose" ? (
 <Button
 disabled={pending}
 onClick={() =>
 onPropose(
 times
 .map((t) => t.trim())
 .filter(Boolean)
 .map((t) => new Date(t).toISOString()),
 )
 }
 >
 {pending ? "Saving…" : "Send proposals"}
 </Button>
 ) : null}
 {mode === "confirm" || mode === "reschedule" ? (
 <Button
 disabled={pending || !scheduledAt}
 onClick={() =>
 onConfirm({
 scheduledAt: new Date(scheduledAt).toISOString(),
 timezone: tz,
 durationMinutes: duration,
 meetingUrl: meetingUrl.trim() || undefined,
 location: location.trim() || undefined,
 })
 }
 >
 {pending ? "Saving…" : mode === "reschedule" ? "Reschedule" : "Confirm"}
 </Button>
 ) : null}
 {mode === "cancel" ? (
 <Button
 variant="destructive"
 disabled={pending}
 onClick={() => onCancel(reason.trim() || undefined)}
 >
 {pending ? "Cancelling…" : "Cancel interview"}
 </Button>
 ) : null}
 {mode === "complete" ? (
 <Button
 disabled={pending}
 onClick={() => onComplete(feedback.trim() || undefined)}
 >
 {pending ? "Saving…" : "Mark completed"}
 </Button>
 ) : null}
 </>
 ) : null}
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}

function DetailRow({
 icon,
 label,
 children,
}: {
 icon: React.ReactNode;
 label: string;
 children: React.ReactNode;
}) {
 return (
 <div className="grid grid-cols-[120px_1fr] gap-3">
 <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
 {icon} {label}
 </div>
 <div>{children}</div>
 </div>
 );
}

function ProposeForm({
 times,
 setTimes,
}: {
 times: string[];
 setTimes: React.Dispatch<React.SetStateAction<string[]>>;
}) {
 return (
 <div>
 <div className="flex items-center justify-between">
 <label className="text-sm font-medium">Proposed times</label>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={() => setTimes((t) => [...t, ""])}
 >
 <Plus className="mr-1 h-3 w-3" /> Add
 </Button>
 </div>
 <div className="mt-1 space-y-2">
 {times.map((t, i) => (
 <div key={i} className="flex gap-2">
 <Input
 type="datetime-local"
 value={t}
 onChange={(e) =>
 setTimes((arr) => arr.map((v, idx) => (idx === i ? e.target.value : v)))
 }
 />
 {times.length > 1 ? (
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => setTimes((arr) => arr.filter((_, idx) => idx !== i))}
 >
 <X className="h-4 w-4" />
 </Button>
 ) : null}
 </div>
 ))}
 </div>
 </div>
 );
}

function ConfirmForm({
 scheduledAt,
 setScheduledAt,
 tz,
 setTz,
 duration,
 setDuration,
 meetingUrl,
 setMeetingUrl,
 location,
 setLocation,
}: {
 scheduledAt: string;
 setScheduledAt: (v: string) => void;
 tz: string;
 setTz: (v: string) => void;
 duration: number;
 setDuration: (v: number) => void;
 meetingUrl: string;
 setMeetingUrl: (v: string) => void;
 location: string;
 setLocation: (v: string) => void;
}) {
 return (
 <div className="space-y-3">
 <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
 <div>
 <label className="text-sm font-medium">Date & time</label>
 <Input
 type="datetime-local"
 value={scheduledAt}
 onChange={(e) => setScheduledAt(e.target.value)}
 className="mt-1"
 />
 </div>
 <div>
 <label className="text-sm font-medium">Timezone</label>
 <Input value={tz} onChange={(e) => setTz(e.target.value)} className="mt-1" />
 </div>
 <div>
 <label className="text-sm font-medium">Duration (min)</label>
 <Input
 type="number"
 min={15}
 max={480}
 value={duration}
 onChange={(e) => setDuration(Number(e.target.value) || 45)}
 className="mt-1"
 />
 </div>
 </div>
 <div>
 <label className="text-sm font-medium">Meeting link (optional)</label>
 <Input
 value={meetingUrl}
 onChange={(e) => setMeetingUrl(e.target.value)}
 className="mt-1"
 placeholder="https://…"
 />
 </div>
 <div>
 <label className="text-sm font-medium">Location (optional)</label>
 <Input
 value={location}
 onChange={(e) => setLocation(e.target.value)}
 className="mt-1"
 placeholder="Office address or room"
 />
 </div>
 </div>
 );
}
