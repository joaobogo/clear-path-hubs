import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getMyApplication,
  respondToInfoRequest,
  withdrawApplication,
  type CandidateSafeStatus,
} from "@/lib/candidate.functions";

import {
  CANDIDATE_STATUS_MEANING,
  CANDIDATE_STATUS_NEXT_STEP,
  CANDIDATE_STATUS_TONE,
} from "@/lib/candidate-status";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { TransparencyPanel } from "@/components/candidate/transparency-panel";
import { FileText } from "lucide-react";
import { CandidateInterviews } from "@/components/candidate/CandidateInterviews";
import { useConfirmAction } from "@/components/ds";
import {
  NOTHING_NEEDED_LINE,
  pendingActionDeadline,
  type CandidatePendingAction,
} from "@/lib/candidate/pending-action";

export const Route = createFileRoute("/_authenticated/me/applications/$id")({
  head: () => ({
    meta: [
      { title: "Application · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["me-application", params.id],
      queryFn: () => getMyApplication({ data: { id: params.id } }),
    }),
  pendingComponent: () => (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-4">
      <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded-lg bg-muted" />
    </main>
  ),
  errorComponent: makeRouteErrorComponent("candidate", "src/routes/_authenticated/me.applications.$id.tsx"),
  notFoundComponent: () => (
    <main className="p-8">This application isn&apos;t available.</main>
  ),
  component: TrackPage,
});

type InfoRequest = {
  id: string;
  prompt: string;
  status: string;
  response: string | null;
  responded_at: string | null;
  due_at: string | null;
  created_at: string;
};

type Interview = {
  id: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  interview_type: string | null;
  location: string | null;
  meeting_url: string | null;
  timezone: string | null;
};

type MyApplication = {
  role_title: string;
  role_description: string;
  company: string | null;
  location: string | null;
  work_model: string | null;
  role_closed: boolean;
  status: CandidateSafeStatus;
  next_step: string | null;
  pending_action: CandidatePendingAction | null;
  can_withdraw: boolean;
  portfolio_url: string | null;
  document: {
    filename: string;
    uploaded_at: string;
    received: boolean;
  } | null;
  info_requests: InfoRequest[];
  interviews: Interview[];
  events: Array<{ at: string; label: string }>;
};

function TrackPage() {
  const { id } = Route.useParams();
  const initial = Route.useLoaderData();
  const fn = useServerFn(getMyApplication);
  const withdrawFn = useServerFn(withdrawApplication);
  const respondFn = useServerFn(respondToInfoRequest);
  const qc = useQueryClient();
  const [replies, setReplies] = useState<Record<string, string>>({});

  const {
    data: raw = initial,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["me-application", id],
    queryFn: () => fn({ data: { id } }),
    initialData: initial,
  });
  const data = raw as MyApplication;


  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["me-application", id] });
    qc.invalidateQueries({ queryKey: ["me-applications"] });
    qc.invalidateQueries({ queryKey: ["me-dashboard"] });
  };

  const { confirm, confirmDialog } = useConfirmAction();

  const withdraw = useMutation({
    mutationFn: () => withdrawFn({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Application withdrawn.");
        refresh();
      } else {
        toast.error(r.message);
      }
    },
    onError: (e: Error) => toast.error(e.message.replace(/^Error: /, "")),
  });

  const respond = useMutation({
    mutationFn: (vars: { requestId: string; response: string }) =>
      respondFn({ data: { id: vars.requestId, response: vars.response } }),
    onSuccess: (r, vars) => {
      if (r.ok) {
        toast.success("Thanks — your reply has been sent.");
        setReplies((prev) => ({ ...prev, [vars.requestId]: "" }));
        refresh();
      } else {
        toast.error(r.message);
      }
    },
    onError: (e: Error) => toast.error(e.message.replace(/^Error: /, "")),
  });

  const action = data.pending_action;
  const deadline = action ? pendingActionDeadline(action) : null;

  const openRequests = data.info_requests.filter((r) => r.status === "open");
  const answeredRequests = data.info_requests.filter((r) => r.status !== "open");

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <Link
        to="/me/applications"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All applications
      </Link>

      <header className="mt-3 mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{data.role_title}</h1>
          <p className="text-sm text-muted-foreground">
            {data.company ?? "Company disclosed after review"}
            {data.location ? ` · ${data.location}` : ""}
            {data.work_model ? ` · ${data.work_model}` : ""}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`${CANDIDATE_STATUS_TONE[data.status]} max-w-[9rem] shrink-0 whitespace-normal break-words text-left sm:max-w-none`}
        >
          {data.status}
        </Badge>
      </header>

      {isError ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-5"
        >
          <p className="text-sm font-medium">We couldn&apos;t refresh this application</p>
          <p className="mt-1 text-sm text-muted-foreground">
            What you see below may be out of date. Nothing has changed on your application.
          </p>
          <Button
            variant="outline"
            className="mt-3 min-h-11 w-full sm:w-auto"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-5 mb-6">
        <h2 className="text-sm font-medium mb-2">Where things stand</h2>
        <p className="text-sm">{CANDIDATE_STATUS_MEANING[data.status]}</p>
        {/* Always a next-step line — including an explicit "nothing needed".
            A status word alone is what drives people to email support. */}
        {/* One line saying whose move it is, then — only when a real item is
            pending — the action itself directly beneath it. */}
        {action ? (
          <div className="mt-3 rounded-md border taas-bg-warning-soft p-4">
            <p className="text-sm font-medium">{action.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {action.detail}
              {deadline ? ` ${deadline}.` : ""}
            </p>
            {action.target.startsWith("/") ? (
              <Button asChild className="mt-3 min-h-11 w-full sm:w-auto">
                <Link to={action.target}>{action.actionLabel}</Link>
              </Button>
            ) : (
              <Button asChild className="mt-3 min-h-11 w-full sm:w-auto">
                <a href={action.target}>{action.actionLabel}</a>
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm font-medium">
            {NOTHING_NEEDED_LINE}{" "}
            <span className="font-normal text-muted-foreground">
              {data.next_step ?? CANDIDATE_STATUS_NEXT_STEP[data.status]}
            </span>
          </p>
        )}
        {data.status === "Closed" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {data.role_closed
              ? "The hiring team closed this role, so it is no longer being filled. That is a decision about the role, not about you."
              : "A person reviewed this application and decided not to take it further for this role. It was not decided by an automated score."}{" "}
            Your details stay with us for future roles for as long as you allow, and you can ask us
            to delete them at any time.
          </p>
        ) : null}

        {data.can_withdraw ? (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => {
                void (async () => {
                  const r = await confirm({
                    title: "Withdraw application",
                    object: data.role_title,
                    description:
                      "We'll stop reviewing this application and let the hiring team know.",
                    impact: [
                      "This can't be undone for the same role",
                      "Your profile stays with us for future roles",
                    ],
                    confirmLabel: "Withdraw application",
                    tone: "destructive",
                  });
                  if (r.confirmed) withdraw.mutate();
                })();
              }}
              disabled={withdraw.isPending}
            >
              {withdraw.isPending ? "Withdrawing…" : "Withdraw application"}
            </Button>
          </div>
        ) : null}
      </section>

      {openRequests.length > 0 ? (
        <section id="info-requests" className="rounded-lg border taas-bg-warning-soft p-5 mb-6 scroll-mt-24">
          <h2 className="text-sm font-medium mb-1">The team asked you something</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Reply in your own words. Anything you write here goes to the TaaSFlow team.
          </p>
          <div className="space-y-5">
            {openRequests.map((r) => {
              const expired = !!r.due_at && new Date(r.due_at).getTime() < Date.now();
              const value = replies[r.id] ?? "";
              return (
                <div key={r.id} className="rounded-md border bg-card p-4">
                  <p className="text-sm font-medium">{r.prompt}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Asked {new Date(r.created_at).toLocaleDateString()}
                    {r.due_at ? ` · reply by ${new Date(r.due_at).toLocaleDateString()}` : ""}
                  </p>
                  {expired ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      This request has expired.{" "}
                      <Link to="/me/messages" className="underline underline-offset-2">
                        Send a message
                      </Link>{" "}
                      and we&apos;ll pick it up.
                    </p>
                  ) : (
                    <form
                      className="mt-3 space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (respond.isPending || !value.trim()) return;
                        respond.mutate({ requestId: r.id, response: value.trim() });
                      }}
                    >
                      <label htmlFor={`reply-${r.id}`} className="sr-only">
                        Your reply
                      </label>
                      <Textarea
                        id={`reply-${r.id}`}
                        rows={4}
                        maxLength={4000}
                        required
                        value={value}
                        placeholder="Type your reply…"
                        onChange={(e) =>
                          setReplies((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="min-h-11"
                        disabled={respond.isPending || !value.trim()}
                      >
                        {respond.isPending ? "Sending…" : "Send reply"}
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div id="interviews" className="scroll-mt-24">
        <CandidateInterviews applicationId={id} />
      </div>


      <section className="rounded-lg border bg-card p-5 mb-6">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" /> What you sent
        </h2>
        {data.document ? (
          <p className="text-sm">
            <span className="font-medium">{data.document.filename}</span>
            <span className="text-muted-foreground">
              {" "}
              · submitted {new Date(data.document.uploaded_at).toLocaleDateString()}
            </span>
            <br />
            <span className="text-xs text-muted-foreground">
              {data.document.received
                ? "This is the CV attached to this application. Replacing your CV later won't change it."
                : "We couldn't read this file. Upload a fresh PDF from the CV page."}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No document is attached to this application.
          </p>
        )}
        {data.portfolio_url ? (
          <p className="mt-2 text-sm">
            <a
              href={data.portfolio_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-2"
            >
              Portfolio link
            </a>
          </p>
        ) : null}
        <Link
          to="/me/cv"
          className="mt-3 inline-flex min-h-11 items-center rounded-md border px-3.5 text-sm hover:bg-muted"
        >
          Manage my CV
        </Link>
      </section>

      {answeredRequests.length > 0 ? (
        <section className="rounded-lg border bg-card p-5 mb-6">
          <h2 className="text-sm font-medium mb-3">Your previous replies</h2>
          <ul className="space-y-3">
            {answeredRequests.map((r) => (
              <li key={r.id} className="rounded-md border p-4 text-sm">
                <p className="text-muted-foreground">{r.prompt}</p>
                <p className="mt-1 whitespace-pre-wrap">{r.response ?? "—"}</p>
                {r.responded_at ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sent {new Date(r.responded_at).toLocaleString()}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-5 mb-6">
        <h2 className="text-sm font-medium mb-3">Timeline</h2>
        {data.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to show yet. Each step will appear here as it happens.
          </p>
        ) : (
          <ol className="space-y-3">
            {data.events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex gap-3 text-sm">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <div className="break-words">{e.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>


      {data.role_description ? (
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-medium mb-2">The role</h2>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {data.role_description}
          </p>
        </section>
      ) : null}

      <div className="mt-6">
        <TransparencyPanel company={data.company} />
      </div>

      {confirmDialog}
    </main>
  );
}
