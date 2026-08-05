import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { FormShell } from "@/components/marketing/form-shell";
import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getApplicationReceipt } from "@/lib/apply.functions";
import { Button } from "@/components/ui/button";
import { TransparencyPanel } from "@/components/candidate/transparency-panel";
import { CandidateStatePanel } from "@/components/candidate/candidate-state-panel";
import { SUPPORT_EMAIL } from "@/lib/candidate/candidate-transparency";

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
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl">
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
          <div className="mt-6 inline-flex flex-col rounded-md bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">Reference</span>
            <span className="font-mono text-lg font-semibold tracking-wider">{data.reference}</span>
          </div>
        </div>

        <div className="mt-8">
          <CandidateStatePanel state="application_received" />
        </div>

        <section className="mt-6 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">What happens next</h2>
          <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm text-foreground/90">
            <li>Our tools read your CV and draft a summary of your experience against the role.</li>
            <li>A reviewer reads your application and that summary, then decides what to share with the hiring team.</li>
            <li>We email you when there is news, or a question we need you to answer.</li>
            <li>
              {signedIn
                ? "Your candidate account is ready — track this application and reuse your profile for future roles."
                : "No account needed: check your status any time with your reference and email."}
            </li>
          </ol>
        </section>

        <div className="mt-6">
          <TransparencyPanel company={data.organization_name} />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            {signedIn ? (
              <Link to="/me/applications/$id" params={{ id: applicationId }}>
                Track your application
              </Link>
            ) : (
              <Link to="/apply/status" search={{ ref: data.reference }}>
                Check your status
              </Link>
            )}
          </Button>
          <Button asChild variant="outline">
            <Link to="/jobs">Browse more roles</Link>
          </Button>
        </div>


        <p className="mt-6 text-xs text-muted-foreground">
          Keep this reference handy — email {SUPPORT_EMAIL} with it and a person will help.
        </p>
      </FormShell>
  );
}
