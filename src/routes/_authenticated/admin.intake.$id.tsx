import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { useDetailCrumb } from "@/lib/workspace/crumb-label";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  getIntakeSubmission,
  convertIntakeToPosition,
  rejectIntake,
  requestIntakeClarification,
} from "@/lib/intake-admin.functions";
import { Badge } from "@/components/ui/badge";
import { PilotWarningsPanel } from "@/components/admin/pilot-warnings-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowLeft, CheckCircle2, MessageSquareWarning, XCircle } from "lucide-react";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

export const Route = createFileRoute("/_authenticated/admin/intake/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "intake", params.id],
      queryFn: () => getIntakeSubmission({ data: { id: params.id } }),
    }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.intake.$id.tsx"),
  notFoundComponent: () => (
    <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
      Intake not found.
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Intake · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntakeDetail,
});

function IntakeDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "intake", id],
    queryFn: () => getIntakeSubmission({ data: { id } }),
  });
  const convert = useServerFn(convertIntakeToPosition);
  const reject = useServerFn(rejectIntake);
  const clarify = useServerFn(requestIntakeClarification);

  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "intake", id] });
    qc.invalidateQueries({ queryKey: ["admin", "intake-inbox"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const convertM = useMutation({
    mutationFn: () => convert({ data: { id } }),
    onSuccess: (res) => {
      invalidate();
      toast.success(
        res.idempotent ? "Already linked to a position." : "Position created.",
      );
      navigate({ to: "/admin/positions/$id", params: { id: res.position_id } });
    },
    onError: (e) => toastError(e, { fallback: "Conversion failed." }),
  });
  const rejectM = useMutation({
    mutationFn: (why?: string) => reject({ data: { id, reason: (why ?? reason).trim() } }),
    onSuccess: () => {
      invalidate();
      toast.success("Intake rejected.");
      setReason("");
    },
    onError: (e) => toastError(e, { fallback: "Reject failed." }),
  });
  const clarifyM = useMutation({
    mutationFn: () => clarify({ data: { id, note } }),
    onSuccess: () => {
      invalidate();
      toast.success("Clarification requested.");
      setNote("");
    },
    onError: (e) => toastError(e, { fallback: "Failed to send." }),
  });

  if (!data) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Intake not found.
      </div>
    );
  }
  const { intake, organization, position, audit, duplicates, completeness } = data;
  useDetailCrumb(organization?.name ?? position?.title ?? null);
  const payload = intake.payload ?? {};
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/admin/intake"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to inbox
        </Link>
        <span className="text-xs text-muted-foreground">trace {intake.trace_id ?? "—"}</span>
      </div>

      <header className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{intake.company_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {intake.role_title} · {intake.primary_email}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  intake.status === "rejected"
                    ? "destructive"
                    : intake.status === "approved"
                      ? "outline"
                      : "secondary"
                }
                className="capitalize"
              >
                {String(intake.status).replace(/_/g, " ")}
              </Badge>
              {intake.requisition_pending && (
                <Badge variant="destructive">needs conversion</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Completeness:{" "}
                <span
                  className={
                    completeness.score >= 80
                      ? "text-success"
                      : completeness.score >= 50
                        ? "text-warning-foreground"
                        : "text-destructive"
                  }
                >
                  {completeness.score}%
                </span>
                {completeness.missing.length > 0 && (
                  <> · missing {completeness.missing.join(", ")}</>
                )}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {position ? (
              <Button variant="secondary" asChild>
                <Link to="/admin/positions/$id" params={{ id: position.id }}>
                  Open position
                </Link>
              </Button>
            ) : (
              <Button
                onClick={() => convertM.mutate()}
                disabled={convertM.isPending}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {convertM.isPending ? "Converting…" : "Convert to position"}
              </Button>
            )}
            {organization && (
              <Button variant="ghost" asChild>
                <Link to="/admin/clients/$id" params={{ id: organization.id }}>
                  Open client
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <PilotWarningsPanel organizationId={organization?.id ?? null} hideWhenEmpty />

      {duplicates.length > 0 && (
        <section
          id="duplicates"
          className="scroll-mt-24 rounded-lg border border-warning/60 bg-warning/60 p-4 dark:bg-warning/20"
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning-foreground dark:text-warning-foreground">
            <AlertTriangle className="h-4 w-4" /> Possible duplicates
          </div>
          <ul className="space-y-1 text-xs">
            {duplicates.map((d) => (
              <li key={d.id}>
                <Link
                  to="/admin/intake/$id"
                  params={{ id: d.id }}
                  className="hover:underline"
                >
                  {d.company_name} — {d.role_title}
                </Link>{" "}
                <span className="text-muted-foreground">
                  · {new Date(d.created_at).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE })} · {d.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Briefs are never merged automatically. Keep the brief you want to work, then close this
            one as a duplicate — the link above stays in the audit trail.
          </p>
          {intake.position_id || intake.status === "rejected" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {intake.position_id
                ? "This brief already has a role, so it can't be closed here."
                : "This brief is already closed."}
            </p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={rejectM.isPending}
              onClick={() => {
                setReason("Duplicate of another brief from the same company");
                rejectM.mutate();
              }}
            >
              {rejectM.isPending ? "Closing…" : "Close as duplicate"}
            </Button>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Submitting company</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k="Company" v={payload.companyName} />
            <Row k="Website" v={payload.companyWebsite} />
            <Row k="Industry" v={payload.industry} />
            <Row k="Headquarters" v={payload.headquarters} />
            <Row
              k="Contact"
              v={`${payload.firstName ?? ""} ${payload.lastName ?? ""}`.trim() || "—"}
            />
            <Row k="Email" v={payload.workEmail} />
            <Row k="Phone" v={payload.phone} />
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Role</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k="Title" v={payload.roleTitle} />
            <Row k="Department" v={payload.department} />
            <Row k="Location" v={payload.location} />
            <Row k="Work model" v={payload.workModel} />
            <Row k="Employment" v={payload.employmentType} />
            <Row k="Seniority" v={payload.seniority} />
            <Row k="Compensation" v={payload.compensation} />
            <Row k="Work auth" v={payload.workAuthorization} />
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Requirements</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                Must-have
              </div>
              <div className="flex flex-wrap gap-1">
                {(payload.mustHaveSkills ?? []).map((s: string) => (
                  <Badge key={s} variant="secondary" className="text-[11px]">
                    {s}
                  </Badge>
                ))}
                {(payload.mustHaveSkills ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                Preferred
              </div>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                {payload.preferredRequirements || "—"}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                Dealbreakers
              </div>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                {payload.dealbreakers || "—"}
              </pre>
            </div>
          </div>
          {payload.jobDescription && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                Description
              </div>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                {payload.jobDescription}
              </pre>
            </div>
          )}
        </section>

        {attachments.length > 0 && (
          <section className="rounded-lg border bg-card p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold">Attachments</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {attachments.map((a: { name?: string; url?: string }, i: number) => (
                <li key={i}>
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {a.name ?? a.url}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{a.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Actions: reject + request clarification */}
      {intake.status !== "rejected" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquareWarning className="h-4 w-4 text-warning-foreground" />
              Request clarification
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sent to the primary contact and logged in the audit trail.
            </p>
            <Textarea
              className="mt-3"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What information is missing?"
            />
            <Button
              className="mt-2"
              variant="secondary"
              disabled={note.trim().length < 3 || clarifyM.isPending}
              onClick={() => clarifyM.mutate()}
            >
              {clarifyM.isPending ? "Sending…" : "Send clarification"}
            </Button>
          </section>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <XCircle className="h-4 w-4 text-destructive" />
              Reject intake
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Closes the submission. Reason is required and audited.
            </p>
            <Textarea
              className="mt-3"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection"
            />
            <Button
              className="mt-2"
              variant="destructive"
              disabled={reason.trim().length < 3 || rejectM.isPending}
              onClick={() => rejectM.mutate()}
            >
              {rejectM.isPending ? "Rejecting…" : "Reject intake"}
            </Button>
          </section>
        </div>
      )}

      <section className="rounded-lg border bg-card">
        <header className="border-b px-4 py-3 text-sm font-semibold">Audit trail</header>
        {audit.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No events recorded.
          </div>
        ) : (
          <ul className="divide-y">
            {audit.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                  {new Date(a.created_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
                </span>
                <span className="font-medium capitalize">
                  {String(a.action).replace(/[._]/g, " ")}
                </span>
                <span className="ml-auto text-muted-foreground">
                  {a.trace_id ?? ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-32 shrink-0 text-xs font-medium uppercase text-muted-foreground">
        {k}
      </dt>
      <dd className="text-sm">{v || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
