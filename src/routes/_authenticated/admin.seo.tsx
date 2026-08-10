/**
 * Search visibility — shows the generated indexing surfaces and submits the
 * sitemap to Google Search Console in one click.
 */
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from \"@/lib/toast-error\";
import { ExternalLink, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getSitemapSubmissionState,
  submitSitemapToSearchConsole,
} from "@/lib/seo/search-console.functions";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  head: () => ({
    meta: [
      { title: "Search visibility · TaaSFlow admin" },
      { name: "description", content: "Generated sitemap and robots.txt, and Search Console submission." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SeoPage,
});

function SeoPage() {
  const loadState = useServerFn(getSitemapSubmissionState);
  const submit = useServerFn(submitSitemapToSearchConsole);
  const [pending, setPending] = React.useState(false);
  const [choices, setChoices] = React.useState<string[] | null>(null);

  const state = useQuery({
    queryKey: ["admin", "seo", "submission-state"],
    queryFn: () => loadState(),
  });

  async function run(siteUrl?: string) {
    setPending(true);
    try {
      const result = await submit({ data: siteUrl ? { siteUrl } : {} });
      if (result.status === "submitted") {
        setChoices(null);
        toast.success(`Sitemap submitted for ${result.siteUrl}`);
      } else if (result.status === "selection_required") {
        setChoices(result.candidates);
        toast.info("Pick which property to submit to.");
      } else {
        toastError(result);
      }
    } catch (err) {
      toastError(err, { fallback: "Submission failed" });
    } finally {
      setPending(false);
    }
  }

  const data = state.data;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Search visibility</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          <code>/sitemap.xml</code> and <code>/robots.txt</code> are generated on every
          request from one route source, so new pages and published posts appear without a
          manual edit.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Generated files</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {["/sitemap.xml", "/robots.txt"].map((path) => (
            <li key={path} className="flex items-center justify-between gap-3">
              <code>{path}</code>
              <a
                href={path}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium underline"
              >
                View <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Google Search Console</h2>
          {state.isLoading ? (
            <Badge variant="secondary">Checking…</Badge>
          ) : data?.connected ? (
            <Badge variant="secondary">Connection linked</Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Submits <code>{data?.sitemapUrl ?? "/sitemap.xml"}</code> to the verified property
          that covers this site.
        </p>

        {data?.error ? (
          <p className="mt-3 text-sm text-destructive">{data.error}</p>
        ) : null}
        {data && data.connected && !data.error && data.candidates.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No verified property covers this domain yet — verify it in Search Console first.
          </p>
        ) : null}
        {data && !data.connected ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Link a Search Console connection to this project to enable submission.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => run()} disabled={pending || !data?.connected}>
            <Send className="mr-2 h-4 w-4" aria-hidden />
            {pending ? "Submitting…" : "Submit sitemap"}
          </Button>
          <Button variant="outline" onClick={() => state.refetch()} disabled={state.isFetching}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Recheck
          </Button>
        </div>

        {choices ? (
          <div className="mt-4 space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">Which property?</p>
            {choices.map((siteUrl) => (
              <Button
                key={siteUrl}
                variant="outline"
                size="sm"
                className="mr-2"
                disabled={pending}
                onClick={() => run(siteUrl)}
              >
                {siteUrl}
              </Button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
