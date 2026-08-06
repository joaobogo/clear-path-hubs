import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { Markdown } from "@/components/marketing/markdown";
import type { ContentEntry } from "@/lib/marketing/content";

const DESTINATION_ARCHITECTURE = [
  {
    role: "Application hosting",
    provider: "Cloudflare Workers",
    purpose: "Serverless edge runtime for the TaaSFlow web application.",
  },
  {
    role: "Backend, database, auth, storage, server functions",
    provider: "Supabase (managed Postgres platform)",
    purpose:
      "Postgres database, authentication, private storage buckets, realtime, and server-side functions.",
  },
  {
    role: "CV parsing and evidence scoring",
    provider: "Google (Gemini models, via TaaSFlow's managed AI gateway)",
    purpose:
      "Structured extraction of CV data and role-specific scoring signals used inside the workspace.",
  },
  {
    role: "Transactional and system email",
    provider: "TaaSFlow transactional email infrastructure",
    purpose: "Auth flows and application lifecycle notifications.",
  },
];

/** Drop a leading markdown H1 when the page header already shows the title. */
function stripLeadingH1(markdown: string, title: string): string {
  const lines = markdown.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i += 1;
  const first = lines[i]?.trim() ?? "";
  if (first.startsWith("# ")) {
    const heading = first.slice(2).trim().toLowerCase();
    if (heading === title.trim().toLowerCase()) {
      return lines.slice(i + 1).join("\n").replace(/^\s+/, "");
    }
  }
  return markdown;
}

export function LegalPage({
  entry,
  fallbackTitle,
  fallbackDescription,
  extraNote,
}: {
  entry: ContentEntry | undefined;
  fallbackTitle: string;
  fallbackDescription?: string;
  extraNote?: ReactNode;
}) {
  const title = entry?.meta.h1 || entry?.meta.title || fallbackTitle;
  const description = entry?.meta.description || fallbackDescription;
  const markdown = entry ? stripLeadingH1(entry.markdown, title) : "";

  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-border/60 pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2.5 text-base leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>

        <section className="mb-8 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
          <p className="text-muted-foreground">
            This notice is under counsel review and may be amended. For the
            current controller of record or a signed copy, contact{" "}
            <Link
              to="/contact"
              className="font-medium text-foreground underline underline-offset-4"
            >
              the TaaSFlow team
            </Link>
            .
          </p>

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Processing environment
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="py-1.5 pr-3 font-semibold">Role</th>
                  <th className="py-1.5 pr-3 font-semibold">Provider</th>
                  <th className="py-1.5 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {DESTINATION_ARCHITECTURE.map((row) => (
                  <tr key={row.role} className="border-b border-border/40">
                    <td className="py-1.5 pr-3 align-top font-medium text-foreground">
                      {row.role}
                    </td>
                    <td className="py-1.5 pr-3 align-top text-foreground">
                      {row.provider}
                    </td>
                    <td className="py-1.5 align-top text-muted-foreground">
                      {row.purpose}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {extraNote ? (
            <div className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {extraNote}
            </div>
          ) : null}
        </section>

        {entry ? (
          <div className="[&_.taasflow-article>*:first-child]:mt-0 [&_.taasflow-article_h2]:mt-9 [&_.taasflow-article_h2]:mb-3 [&_.taasflow-article_h3]:mt-7 [&_.taasflow-article_h3]:mb-2.5 [&_.taasflow-article_h4]:mt-6 [&_.taasflow-article_h4]:mb-2 [&_.taasflow-article_hr]:my-8 [&_.taasflow-article_ol]:my-3.5 [&_.taasflow-article_p]:my-3.5 [&_.taasflow-article_table]:my-5 [&_.taasflow-article_ul]:my-3.5 [&_.taasflow-article]:text-[15.5px] [&_.taasflow-article]:leading-[1.65]">
            <Markdown>{markdown}</Markdown>
          </div>
        ) : (
          <p className="text-muted-foreground">
            The full legal text is being finalized. Contact the TaaSFlow team
            for the current version of this document.
          </p>
        )}
      </article>
    </SiteShell>
  );
}
