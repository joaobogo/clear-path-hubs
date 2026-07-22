import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TaaSFlow — Hire faster with a curated talent pipeline" },
      {
        name: "description",
        content:
          "TaaSFlow helps teams hire senior specialists faster. Submit an intake and get shortlisted candidates without the recruiting overhead.",
      },
      { property: "og:title", content: "TaaSFlow — Hire faster" },
      {
        property: "og:description",
        content: "Submit a role. Get shortlisted, evidence-backed candidates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">
            TaaSFlow
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/jobs" className="text-muted-foreground hover:text-foreground">
              Jobs
            </Link>
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link to="/intake">Start hiring</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-24 text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
          Hire senior specialists without the recruiting overhead.
        </h1>
        <p className="text-lg text-muted-foreground">
          Tell us about the role in five short steps. We'll shortlist evidence-backed candidates and
          hand you the final decisions.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/intake">Submit an intake</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/jobs">Browse open roles</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          No payment. No pricing selection. Your draft is saved automatically.
        </p>
      </main>
    </div>
  );
}
