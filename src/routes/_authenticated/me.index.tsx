import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyContext,
  getMyDashboard,
  listMyApplications,
  listMyCvVersions,
  TERMINAL_STATUSES,
  type CandidateSafeStatus,
} from "@/lib/candidate.functions";
import { CANDIDATE_STATUS_TONE } from "@/lib/candidate-status";
import { profileCompleteness } from "@/lib/candidate/profile-completeness";
import { ProfileGapsBlock } from "@/components/candidate/profile-gaps-block";
import { InterviewResponseCard } from "@/components/candidate/interview-response-card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  FileUp,
  MessageSquare,
  Shield,
  Sparkles,
  User,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/me/")({
  head: () => ({
    meta: [
      { title: "My home · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    const [ctx, apps, cvs, dash] = await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ["me-context"],
        queryFn: () => getMyContext(),
      }),
      context.queryClient.ensureQueryData({
        queryKey: ["me-applications"],
        queryFn: () => listMyApplications(),
      }),
      context.queryClient
        .ensureQueryData({
          queryKey: ["me", "cv"],
          queryFn: () => listMyCvVersions(),
        })
        .catch(() => ({ versions: [] as unknown[] })),
      context.queryClient
        .ensureQueryData({
          queryKey: ["me-dashboard"],
          queryFn: () => getMyDashboard(),
        })
        .catch(() => null),
    ]);
    return { ctx, apps, cvs, dash };
  },
  errorComponent: makeRouteErrorComponent("candidate", "src/routes/_authenticated/me.index.tsx"),
  component: MeHome,
});

const STATUS_TONE = CANDIDATE_STATUS_TONE;


type App = {
  id: string;
  role_title: string;
  company: string | null;
  status: CandidateSafeStatus;
  next_step: string | null;
  last_update: string;
};

const completeness = profileCompleteness;


function firstName(full?: string | null, email?: string | null): string {
  if (full) return full.split(" ")[0]!;
  if (email) return email.split("@")[0]!;
  return "there";
}

function MeHome() {
  const { ctx, apps, cvs, dash } = Route.useLoaderData();
  const ctxFn = useServerFn(getMyContext);
  const appsFn = useServerFn(listMyApplications);
  const dashFn = useServerFn(getMyDashboard);

  const { data: ctxLive = ctx } = useQuery({
    queryKey: ["me-context"],
    queryFn: () => ctxFn(),
    initialData: ctx,
  });
  const { data: appsLive = apps } = useQuery({
    queryKey: ["me-applications"],
    queryFn: () => appsFn(),
    initialData: apps,
  });
  const { data: dashLive = dash } = useQuery({
    queryKey: ["me-dashboard"],
    queryFn: () => dashFn(),
    initialData: dash ?? undefined,
  });

  const profile = (ctxLive?.profile ?? null) as Record<string, unknown> | null;
  const applications = (appsLive?.applications ?? []) as App[];
  const cvVersions = ((cvs as { versions?: unknown[] })?.versions ?? []) as Array<{
    created_at: string;
    filename?: string | null;
  }>;
  const openRequests = dashLive?.open_requests ?? 0;
  const unread = dashLive?.unread_messages ?? 0;
  const upcoming = (dashLive?.upcoming_interviews ?? []) as Array<{
    id: string;
    application_id: string;
    role_title: string;
    scheduled_at: string;
    interview_type: string | null;
    timezone: string | null;
  }>;
  const doc = (dashLive?.document ?? null) as {
    filename: string;
    uploaded_at: string;
    received: boolean;
  } | null;

  const active = applications.filter(
    (a) => !TERMINAL_STATUSES.includes(a.status),
  );
  const spotlight = active[0] ?? applications[0] ?? null;

  const pct = completeness(profile);
  const cv = cvVersions[0] ?? null;
  const name = firstName(
    (profile?.full_name as string | undefined) ?? undefined,
    ctxLive?.email ?? undefined,
  );

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      {/* Reassuring hero */}
      <header className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card p-6 sm:p-8 motion-surface">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Welcome back
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-semibold">
          Hi {name}, we&apos;ve got you.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          This is your calm space. You&apos;ll see status changes, next steps, and messages from
          hiring teams here — nothing is lost, nothing is hidden.
        </p>
      </header>

      <ProfileGapsBlock profile={profile} error={!ctxLive} />

      {/* Outstanding actions — only shown when something needs the candidate */}
      {openRequests > 0 ? (
        <section className="rounded-2xl border taas-bg-warning-soft p-5 motion-surface">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider taas-fg-warning">
                Needs your reply
              </p>
              <h2 className="mt-1 text-base font-semibold">
                {openRequests === 1
                  ? "The team asked you a question"
                  : `${openRequests} questions are waiting for you`}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open the application to read and reply. There&apos;s no rush — take the time you need.
              </p>
            </div>
            <Link
              to="/me/applications"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground min-h-11"
            >
              Review <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      ) : null}

      <InterviewResponseCard compact />



      {/* Application status spotlight */}
      {spotlight ? (
        <section className="rounded-2xl border bg-card p-5 sm:p-6 motion-surface">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Your latest application
              </p>
              <h2 className="mt-1 text-lg sm:text-xl font-semibold truncate">
                {spotlight.role_title}
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {spotlight.company ?? "Company disclosed after review"}
              </p>
            </div>
            <Badge className={STATUS_TONE[spotlight.status]} variant="outline">
              {spotlight.status}
            </Badge>
          </div>
          <div className="mt-4 rounded-lg bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              What&apos;s next
            </p>
            <p className="mt-1 text-sm">
              {spotlight.next_step ?? "You'll get an update here as soon as the hiring team moves forward. No need to check in."}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/me/applications/$id"
              params={{ id: spotlight.id }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Track this application <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/me/applications"
              className="inline-flex items-center rounded-md border px-3.5 py-2 text-sm hover:bg-muted transition-colors"
            >
              All applications ({applications.length})
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed bg-card/40 p-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold">You haven&apos;t applied yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            When you apply to a role, it lands here with real-time status. No dashboards to manage —
            we&apos;ll keep you informed.
          </p>
          <Link
            to="/jobs"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse open roles <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      {/* Calm tiles */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Tile
          to="/me/messages"
          icon={<MessageSquare className="h-4 w-4" />}
          eyebrow="Messages"
          title={unread > 0 ? `${unread} unread message${unread === 1 ? "" : "s"}` : "Hiring team conversations"}
          body="Direct replies from our team appear here. We&apos;ll notify you — you don&apos;t need to refresh."
          cta="Open messages"
        />
        <Tile
          to="/me/profile"
          icon={<User className="h-4 w-4" />}
          eyebrow="Profile"
          title={`Completeness · ${pct}%`}
          body={
            pct >= 80
              ? "Your profile is strong. Small edits still help hiring teams understand you."
              : "A more complete profile helps hiring teams see the real you. Takes ~3 minutes."
          }
          cta={pct >= 80 ? "Review profile" : "Complete profile"}
          progress={pct}
        />
        <Tile
          to="/me/cv"
          icon={<FileUp className="h-4 w-4" />}
          eyebrow="CV"
          title={doc ?? cv ? "CV on file" : "No CV uploaded"}
          body={
            doc
              ? `${doc.filename} · uploaded ${new Date(doc.uploaded_at).toLocaleDateString()}. ${
                  doc.received
                    ? "Received and readable."
                    : "We couldn't read this file — please upload a fresh PDF."
                }`
              : cv
                ? `Last updated ${new Date(cv.created_at).toLocaleDateString()}. You can replace it any time.`
                : "Upload your CV (PDF) so hiring teams can review your experience privately."
          }
          cta={doc ?? cv ? "Manage CV" : "Upload CV"}
        />

        <Tile
          to="/me/settings"
          icon={<Shield className="h-4 w-4" />}
          eyebrow="Privacy"
          title="You control what clients see"
          body="Withdraw anytime. Delete your data anytime. Your CV is never shared publicly."
          cta="Privacy & data controls"
        />
      </section>

      {/* Reassurance footer */}
      <section className="rounded-xl border bg-muted/30 p-4 flex items-start gap-3">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">You&apos;re supported, not processed.</span>{" "}
          A human reviews every application. If you want to talk, use{" "}
          <Link to="/me/messages" className="underline underline-offset-2 text-foreground">
            Messages
          </Link>
          .
        </p>
      </section>
    </main>
  );
}

function Tile({
  to,
  icon,
  eyebrow,
  title,
  body,
  cta,
  progress,
}: {
  to: "/me/messages" | "/me/profile" | "/me/cv" | "/me/settings";
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  progress?: number;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border bg-card p-5 motion-surface transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
        {eyebrow}
      </div>
      <h3 className="mt-3 text-base font-semibold flex items-center gap-2">
        {title}
        {eyebrow === "Profile" ? null : (
          <FileText className="h-3.5 w-3.5 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0 motion-reduce:transition-none" />
        )}
      </h3>
      {typeof progress === "number" ? (
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <p className="mt-3 text-xs font-medium text-primary inline-flex items-center gap-1">
        {cta} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </p>
    </Link>
  );
}
