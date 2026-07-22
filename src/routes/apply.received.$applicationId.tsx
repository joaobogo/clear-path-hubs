import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getApplicationReceipt } from "@/lib/apply.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/apply/received/$applicationId")({
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
  const { data } = useSuspenseQuery({
    queryKey: ["application-receipt", applicationId],
    queryFn: () => getApplicationReceipt({ data: { id: applicationId } }),
  });
  if (!data) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link to="/" className="font-semibold tracking-tight">TaaSFlow</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-16">
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

        <section className="mt-8 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">What happens next</h2>
          <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm text-foreground/90">
            <li>Our team reviews your CV and screening answers.</li>
            <li>If there's a fit, we'll reach out by email within a few business days.</li>
            <li>
              You can create a candidate account any time to track this application and reuse your
              profile for future roles.
            </li>
          </ol>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/auth">Create account to track application</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/jobs">Browse more roles</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Keep this reference handy — we'll ask for it if you contact us about this application.
        </p>
      </main>
    </div>
  );
}
