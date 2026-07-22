import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/intake/confirmation")({
  head: () => ({
    meta: [
      { title: "Intake Received — TaaSFlow" },
      { name: "description", content: "Your intake has been received." },
      { property: "og:title", content: "Intake Received — TaaSFlow" },
      { property: "og:description", content: "Your intake has been received." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Intake pipeline offline</h1>
      <p className="mt-4 text-muted-foreground">
        The confirmation view is being rewired for the new canonical schema.
      </p>
      <div className="mt-8">
        <Link to="/" className="underline">Back to home</Link>
      </div>
    </main>
  ),
});
