import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import {
  AI_PAGE_TITLE,
  AI_PAGE_LEAD,
  AI_PAGE_INTRO,
  AI_SECTIONS,
  AI_LAWS_HEADING,
  AI_LAWS_INTRO,
  AI_LAWS,
  AI_RELATED_LINKS,
} from "@/config/ai-in-hiring";

export const Route = createFileRoute("/ai-in-hiring")({
  head: () =>
    marketingHead(
      undefined,
      "/ai-in-hiring",
      {
        title: "How AI Is Used in Hiring | TaaSFlow",
        description:
          "Where TaaSFlow uses AI on candidate data, what a person still decides, how candidates can ask for human review, and how long records are kept.",
      },
      {
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: "Security and trust", path: "/security" },
          { name: AI_PAGE_TITLE, path: "/ai-in-hiring" },
        ],
      },
    ),
  component: AiInHiringPage,
});

function AiInHiringPage() {
  return (
    <SiteShell>
      <PublicSection className="pb-6 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            AI and your data
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            {AI_PAGE_TITLE}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">{AI_PAGE_LEAD}</p>
          <p className="mt-3 max-w-2xl text-base text-[color:var(--brand-navy)]/70">{AI_PAGE_INTRO}</p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="pt-4">
        <PublicPage className="space-y-8">
          {AI_SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8"
            >
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
                {section.title}
              </h2>
              <div className="mt-3 max-w-2xl space-y-3 text-[15px] leading-relaxed text-[color:var(--brand-navy)]/80">
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="mt-4 max-w-2xl list-disc space-y-1.5 pl-5 text-[15px] text-[color:var(--brand-navy)]/80">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <section
            id="laws"
            className="scroll-mt-24 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8"
          >
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
              {AI_LAWS_HEADING}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] text-[color:var(--brand-navy)]/80">{AI_LAWS_INTRO}</p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[15px] text-[color:var(--brand-navy)]/80">
              {AI_LAWS.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>

          <nav aria-label="Related pages" className="flex flex-wrap gap-4 text-sm font-semibold">
            {AI_RELATED_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-[color:var(--brand-navy)] underline-offset-4 hover:underline"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
