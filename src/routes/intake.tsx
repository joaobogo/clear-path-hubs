import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Client Intake — TaaSFlow" },
      { name: "description", content: "Start a new hiring engagement with TaaSFlow." },
      { property: "og:title", content: "Client Intake — TaaSFlow" },
      { property: "og:description", content: "Start a new hiring engagement with TaaSFlow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntakePage,
});

function IntakePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Client Intake</h1>
      <p className="mt-4 text-muted-foreground">
        The intake wizard is being rebuilt against the new canonical data model. It will return in the
        next phase.
      </p>
      <div className="mt-8">
        <Link to="/" className="underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}
