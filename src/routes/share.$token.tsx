import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  MessageSquare,
  Presentation,
  ScrollText,
  Send,
  ShieldAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  addShareComment,
  getShortlistShareByToken,
  type PublicShareView,
  type ShareMode,
} from "@/lib/shares.functions";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "Shortlist review · TaaSFlow" },
      {
        name: "description",
        content:
          "A stakeholder review of a TaaSFlow shortlist — read only, evidence backed, and time limited.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { token } = Route.useParams();
  const fn = useServerFn(getShortlistShareByToken);
  const query = useQuery({
    queryKey: ["share", token],
    queryFn: () => fn({ data: { token } }),
    staleTime: 30_000,
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const data = query.data;
  if (!data || "error" in data) {
    return (
      <ShareGate
        message={
          (data && "error" in data && data.error) ||
          "This share link is no longer available."
        }
      />
    );
  }

  return <ShareShell view={data} token={token} onReload={query.refetch} />;
}

function ShareGate({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-8 text-center">
      <ShieldAlert className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold">Access unavailable</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <p className="mt-6 text-xs text-muted-foreground">
        Contact your TaaSFlow client contact for a fresh link.
      </p>
    </div>
  );
}

function ShareShell({
  view,
  token,
  onReload,
}: {
  view: PublicShareView;
  token: string;
  onReload: () => void;
}) {
  const [mode, setMode] = useState<ShareMode>(view.share.default_mode);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>(
    view.candidates.slice(0, Math.min(3, view.candidates.length)).map((c) => c.match_id),
  );

  const expires = new Date(view.share.expires_at);
  const daysLeft = Math.max(
    0,
    Math.round((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  return (
    <div className="min-h-screen bg-muted/20 print:bg-white">
      <header className="border-b bg-background/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              {view.share.organization_name}
              <span>·</span>
              <span>Shared shortlist</span>
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight">
              {view.share.title ??
                (view.share.position
                  ? `Shortlist — ${view.share.position.title}`
                  : "Shortlist review")}
            </h1>
            {view.share.position?.location && (
              <p className="text-xs text-muted-foreground">
                {view.share.position.location}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {daysLeft} day{daysLeft === 1 ? "" : "s"} left
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied");
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy link
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>

        {view.share.message && (
          <div className="mx-auto max-w-6xl px-6 pb-4">
            <div className="rounded-md border bg-primary/5 p-3 text-sm">
              <div className="font-medium">Note from the recruiting team</div>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">
                {view.share.message}
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-6xl gap-1 px-6 pb-3">
          <ModeTab
            active={mode === "review"}
            icon={<ScrollText className="h-4 w-4" />}
            label="Review"
            onClick={() => setMode("review")}
          />
          <ModeTab
            active={mode === "presentation"}
            icon={<Presentation className="h-4 w-4" />}
            label="Present"
            onClick={() => setMode("presentation")}
          />
          <ModeTab
            active={mode === "compare"}
            icon={<Users className="h-4 w-4" />}
            label="Compare"
            onClick={() => setMode("compare")}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 print:max-w-none print:px-0">
        {mode === "review" && <ReviewMode candidates={view.candidates} />}
        {mode === "presentation" && (
          <PresentationMode
            candidates={view.candidates}
            activeIdx={activeIdx}
            setActiveIdx={setActiveIdx}
          />
        )}
        {mode === "compare" && (
          <CompareMode
            candidates={view.candidates}
            selected={selected}
            setSelected={setSelected}
          />
        )}

        {view.share.allow_comments && (
          <section className="mt-10 print:hidden">
            <CommentsPanel
              token={token}
              comments={view.comments}
              candidates={view.candidates}
              onSubmitted={onReload}
            />
          </section>
        )}

        <footer className="mt-10 border-t pt-4 text-center text-xs text-muted-foreground print:mt-6">
          Powered by TaaSFlow — evidence-first talent operations.
        </footer>
      </main>
    </div>
  );
}

function ModeTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-border bg-background text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Review mode ─────────────────────────────────────────────────────────────
function ReviewMode({ candidates }: { candidates: ClientCandidateDTO[] }) {
  return (
    <div className="space-y-6">
      {candidates.map((c, idx) => (
        <CandidateCard key={c.match_id} c={c} index={idx + 1} />
      ))}
    </div>
  );
}

function CandidateCard({
  c,
  index,
}: {
  c: ClientCandidateDTO;
  index: number;
}) {
  return (
    <article className="rounded-xl border bg-card p-6 shadow-sm print:break-inside-avoid print:shadow-none">
      <header className="flex flex-wrap items-start gap-4 border-b pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {index}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">
            {c.candidate.display_name}
          </h2>
          <div className="text-sm text-muted-foreground">
            {c.candidate.headline ?? c.candidate.current_role ?? "—"}
            {c.candidate.current_company && (
              <> · {c.candidate.current_company}</>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {c.candidate.location && <span>{c.candidate.location}</span>}
            {c.candidate.years_experience != null && (
              <span>{c.candidate.years_experience} yrs experience</span>
            )}
            {c.candidate.availability && (
              <span>Availability: {c.candidate.availability}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">
            {c.score ?? "—"}
          </div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {c.fit_label ?? "unrated"} · {c.stage.replace(/_/g, " ")}
          </div>
        </div>
      </header>

      {c.summary && (
        <p className="mt-4 text-sm leading-relaxed">{c.summary}</p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Block title="Why this candidate">
          {c.strengths.length ? (
            <ul className="ml-4 list-disc space-y-1 text-sm">
              {c.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No structured strengths recorded.
            </p>
          )}
        </Block>
        <Block title="What to validate">
          {c.concerns.length ? (
            <ul className="ml-4 list-disc space-y-1 text-sm">
              {c.concerns.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : c.main_consideration ? (
            <p className="text-sm">{c.main_consideration}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No open concerns flagged.
            </p>
          )}
        </Block>
      </div>

      {c.evidence.length > 0 && (
        <Block title="Evidence" className="mt-4">
          <ul className="space-y-2 text-sm">
            {c.evidence.slice(0, 6).map((e, i) => (
              <li
                key={i}
                className="rounded-md border-l-2 border-primary/60 bg-muted/40 px-3 py-2"
              >
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {e.label}
                </div>
                <div className="mt-0.5 italic">"{e.snippet}"</div>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {c.interview_guide.length > 0 && (
        <Block title="Interview focus" className="mt-4">
          <ol className="ml-4 list-decimal space-y-1 text-sm">
            {c.interview_guide.slice(0, 5).map((q, i) => (
              <li key={i}>{q.question}</li>
            ))}
          </ol>
        </Block>
      )}

      <footer className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        Last updated{" "}
        {c.last_updated
          ? new Date(c.last_updated).toLocaleDateString()
          : "—"}{" "}
        · Stage: {c.stage.replace(/_/g, " ")}
      </footer>
    </article>
  );
}

function Block({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Presentation mode ──────────────────────────────────────────────────────
function PresentationMode({
  candidates,
  activeIdx,
  setActiveIdx,
}: {
  candidates: ClientCandidateDTO[];
  activeIdx: number;
  setActiveIdx: (i: number) => void;
}) {
  const c = candidates[activeIdx];
  if (!c) return null;
  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Candidate {activeIdx + 1} of {candidates.length}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={activeIdx === 0}
            onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={activeIdx >= candidates.length - 1}
            onClick={() =>
              setActiveIdx(Math.min(candidates.length - 1, activeIdx + 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl font-semibold text-primary">
          {c.candidate.display_name.slice(0, 1)}
        </div>
        <h2 className="mt-4 text-3xl font-semibold">
          {c.candidate.display_name}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {c.candidate.headline ?? c.candidate.current_role ?? ""}
        </p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border bg-background px-6 py-3">
          <Award className="h-5 w-5 text-primary" />
          <span className="text-5xl font-semibold tabular-nums">
            {c.score ?? "—"}
          </span>
          <span className="text-sm uppercase tracking-wide text-muted-foreground">
            {c.fit_label ?? "unrated"}
          </span>
        </div>
      </div>
      {c.summary && (
        <p className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed">
          {c.summary}
        </p>
      )}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Strengths
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {c.strengths.slice(0, 4).map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            To validate
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {(c.concerns.length
              ? c.concerns
              : c.main_consideration
                ? [c.main_consideration]
                : []
            )
              .slice(0, 4)
              .map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  {s}
                </li>
              ))}
          </ul>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {candidates.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            aria-label={`Go to candidate ${i + 1}`}
            className={`h-2 w-8 rounded-full transition ${
              i === activeIdx ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Compare mode ───────────────────────────────────────────────────────────
function CompareMode({
  candidates,
  selected,
  setSelected,
}: {
  candidates: ClientCandidateDTO[];
  selected: string[];
  setSelected: (v: string[]) => void;
}) {
  const shown = candidates.filter((c) => selected.includes(c.match_id));
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {candidates.map((c) => {
          const on = selected.includes(c.match_id);
          return (
            <button
              key={c.match_id}
              onClick={() => {
                if (on) setSelected(selected.filter((x) => x !== c.match_id));
                else if (selected.length < 4)
                  setSelected([...selected, c.match_id]);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {c.candidate.display_name} · {c.score ?? "—"}
            </button>
          );
        })}
      </div>
      {shown.length < 2 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Select at least two candidates to compare.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b p-3 text-left"></th>
                {shown.map((c) => (
                  <th
                    key={c.match_id}
                    className="border-b p-3 text-left align-bottom"
                  >
                    <div className="font-semibold">
                      {c.candidate.display_name}
                    </div>
                    <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                      {c.candidate.headline ?? ""}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow
                label="Fit"
                shown={shown}
                render={(c) => (
                  <span className="text-lg font-semibold">
                    {c.score ?? "—"}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {c.fit_label ?? "—"}
                    </span>
                  </span>
                )}
              />
              <CompareRow
                label="Stage"
                shown={shown}
                render={(c) => c.stage.replace(/_/g, " ")}
              />
              <CompareRow
                label="Location"
                shown={shown}
                render={(c) => c.candidate.location ?? "—"}
              />
              <CompareRow
                label="Experience"
                shown={shown}
                render={(c) =>
                  c.candidate.years_experience != null
                    ? `${c.candidate.years_experience} yrs`
                    : "—"
                }
              />
              <CompareRow
                label="Availability"
                shown={shown}
                render={(c) => c.candidate.availability ?? "—"}
              />
              <CompareRow
                label="Strengths"
                shown={shown}
                render={(c) =>
                  c.strengths.length ? (
                    <ul className="ml-4 list-disc space-y-1">
                      {c.strengths.slice(0, 3).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              <CompareRow
                label="To validate"
                shown={shown}
                render={(c) =>
                  c.concerns.length ? (
                    <ul className="ml-4 list-disc space-y-1">
                      {c.concerns.slice(0, 3).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompareRow<T>({
  label,
  shown,
  render,
}: {
  label: string;
  shown: T[];
  render: (c: T) => React.ReactNode;
}) {
  return (
    <tr>
      <td className="border-b p-3 align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </td>
      {shown.map((c, i) => (
        <td key={i} className="border-b p-3 align-top">
          {render(c)}
        </td>
      ))}
    </tr>
  );
}

// ─── Comments panel ─────────────────────────────────────────────────────────
function CommentsPanel({
  token,
  comments,
  candidates,
  onSubmitted,
}: {
  token: string;
  comments: PublicShareView["comments"];
  candidates: ClientCandidateDTO[];
  onSubmitted: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [matchId, setMatchId] = useState<string>("");
  const [sentiment, setSentiment] = useState<
    "positive" | "neutral" | "concern" | "request"
  >("neutral");

  const send = useServerFn(addShareComment);
  const mut = useMutation({
    mutationFn: () =>
      send({
        data: {
          token,
          matchId: matchId ? matchId : null,
          authorName: name,
          authorEmail: email || undefined,
          body,
          sentiment,
        },
      }),
    onSuccess: () => {
      toast.success("Feedback shared with the recruiting team");
      setBody("");
      onSubmitted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of candidates) m.set(c.match_id, c.candidate.display_name);
    return m;
  }, [candidates]);

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-2 border-b pb-3">
        <MessageSquare className="h-4 w-4" aria-hidden />
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          Leave feedback
        </h3>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Your name</Label>
          <Input
            id="c-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Chen"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-email">Email (optional)</Label>
          <Input
            id="c-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@company.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>About</Label>
          <Select value={matchId || "general"} onValueChange={(v) => setMatchId(v === "general" ? "" : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General feedback</SelectItem>
              {candidates.map((c) => (
                <SelectItem key={c.match_id} value={c.match_id}>
                  {c.candidate.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tone</Label>
          <Select
            value={sentiment}
            onValueChange={(v) =>
              setSentiment(v as "positive" | "neutral" | "concern" | "request")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="concern">Concern</SelectItem>
              <SelectItem value="request">Request</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="c-body">Feedback</Label>
        <Textarea
          id="c-body"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What did you like, what needs validation, or any next-step requests?"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !name.trim() || !body.trim()}
        >
          <Send className="mr-2 h-4 w-4" /> Send feedback
        </Button>
      </div>

      {comments.length > 0 && (
        <div className="mt-6 space-y-3 border-t pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Previous notes ({comments.length})
          </h4>
          {comments.map((c) => (
            <div key={c.id} className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {c.author_name}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {c.sentiment}
                </Badge>
                {c.match_id && nameById.get(c.match_id) && (
                  <span>· on {nameById.get(c.match_id)}</span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <Calendar className="h-3 w-3" aria-hidden />
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-line">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
