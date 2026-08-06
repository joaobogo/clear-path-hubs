import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { FormShell } from "@/components/marketing/form-shell";
import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getApplicationReceipt } from "@/lib/apply.functions";
import { Button } from "@/components/ui/button";
import { TransparencyPanel } from "@/components/candidate/transparency-panel";
import { CandidateStatePanel } from "@/components/candidate/candidate-state-panel";
import { SUPPORT_EMAIL } from "@/lib/candidate/candidate-transparency";
import { ReferenceBlock } from "@/components/candidate/reference-block";
import {
  APPLICATION_NEXT_STEPS,
  CONTACT_METHOD_SENTENCE,
  applicationReference,
} from "@/lib/candidate/response-commitment";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/apply/received/$applicationId")({
  validateSearch: (search: Record<string, unknown>) => ({
    again: search.again === true || search.again === "true" || search.again === "1",
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData({
      queryKey: ["application-receipt", params.applicationId],
      queryFn: () => getApplicationReceipt({ data: { id: params.applicationId } }),
    });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({
    meta: [
      { title: "Application received — TaaSFlow" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Your application has been received." },
    ],
  }),
  pendingComponent: ReceivedSkeleton,
  errorComponent: ReceivedError,
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <h1 className="text-2xl font-semibold">Application not found</h1>
      <div className="mt-6">
        <Button asChild><Link to="/jobs">Back to job board</Link></Button>
      </div>
    </div>
  ),
  component: Received,
});

function ReceivedSkeleton() {
  return (
    <FormShell exitTo="/jobs" exitLabel="Browse more roles" width="md">
      <div className="rounded-lg border bg-card p-8">
        <Skeleton className="mx-auto h-12 w-12 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-7 w-56" />
        <Skeleton className="mx-auto mt-3 h-4 w-full max-w-sm" />
        <Skeleton className="mt-6 h-16 w-56" />
      </div>
      <div className="mt-6 space-y-3 rounded-lg border p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-10/12" />
      </div>
    </FormShell>
  );
}

/**
 * The receipt failed to load. The reference is derived from the application id
 * in the URL, so it is still known and shown — losing it is the one outcome the
 * candidate cannot recover from.
 */
function ReceivedError() {
  const { applicationId } = Route.useParams();
  const reference = applicationReference(applicationId);
  return (
    <FormShell exitTo="/jobs" exitLabel="Browse more roles" width="md">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6" role="alert">
        <h1 className="text-xl font-semibold">Your application was submitted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We could not load the full confirmation just now. Your application is safe — keep the
          reference below and use it to check your status.
        </p>
        <ReferenceBlock reference={reference} className="mt-4 bg-background" />
        <p className="mt-4 text-sm text-muted-foreground">{CONTACT_METHOD_SENTENCE}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/apply/status" search={{ ref: reference }}>
              Check your status
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Application%20${reference}`}>
              Email {SUPPORT_EMAIL}
            </a>
          </Button>
        </div>
      </div>
    </FormShell>
  );
}

function Received() {
  const { applicationId } = Route.useParams();
  const { again } = Route.useSearch();
  const { data } = useSuspenseQuery({
    queryKey: ["application-receipt", applicationId],
    queryFn: () => getApplicationReceipt({ data: { id: applicationId } }),
  });
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: u } = await supabase.auth.getUser();
      if (alive) setSignedIn(Boolean(u.user));
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (!data) return null;

  const reference = data.reference ?? applicationReference(applicationId);

  return (
    <FormShell exitTo="/jobs" exitLabel="Browse more roles" width="md">
        {again ? (
          <p
            className="mb-4 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
            data-testid="apply-fresh-after-closed"
            role="status"
          >
            Your earlier application for this role was closed, so this is a new application — it
            starts fresh with the reference below.
          </p>
        ) : null}
        <div className="rounded-lg border bg-card p-6 sm:p-8">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl">
            ✓
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Application received</h1>
          <p className="mt-2 text-muted-foreground">
            Thanks{data.candidate_name ? `, ${data.candidate_name.split(" ")[0]}` : ""} — your
            application for{" "}
            <span className="font-medium text-foreground">{data.position_title ?? "this role"}</span>
            {data.organization_name && (
              <>
                {" "}at <span className="font-medium text-foreground">{data.organization_name}</span>
              </>
            )}{" "}
            has been received.
          </p>
          <ReferenceBlock reference={reference} className="mt-6 max-w-xs bg-muted" />
        </div>

        <section className="mt-6 rounded-lg border p-6" aria-labelledby="next-heading">
          <h2 id="next-heading" className="text-lg font-semibold">
            What happens next
          </h2>
          <ol className="mt-4 space-y-4">
            {APPLICATION_NEXT_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-sm font-medium">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t pt-4 text-sm text-muted-foreground">
            {CONTACT_METHOD_SENTENCE} The five business day window is our commitment to review your
            application — it is not a promise of an interview.
          </p>
        </section>

        <section className="mt-6 rounded-lg border p-6" aria-labelledby="check-heading">
          <h2 id="check-heading" className="text-lg font-semibold">
            Where to check your status
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {signedIn
              ? "Your candidate account is ready — track this application any time, and reuse your profile for future roles."
              : "No account needed: open the tracker with your reference and the email address you applied with."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              {signedIn ? (
                <Link to="/me/applications/$id" params={{ id: applicationId }}>
                  Track your application
                </Link>
              ) : (
                <Link to="/apply/status" search={{ ref: reference }}>
                  Track your application
                </Link>
              )}
            </Button>
            <Button asChild variant="outline">
              <Link to="/jobs">Browse more roles</Link>
            </Button>
          </div>
        </section>

        <div className="mt-6">
          <CandidateStatePanel state="application_received" />
        </div>

  
        <div className="mt-6">
          <TransparencyPanel company={data.organization_name} />
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Keep reference <span className="select-all font-mono font-medium">{reference}</span> handy
          — email {SUPPORT_EMAIL} with it and a person will help.
        </p>
      </FormShell>
  );
}
