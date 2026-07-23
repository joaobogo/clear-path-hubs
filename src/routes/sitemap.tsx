import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";

type Group = {
  title: string;
  description: string;
  links: { label: string; to: string }[];
};

const GROUPS: Group[] = [
  {
    title: "Company",
    description: "Who TaaSFlow is and how we work.",
    links: [
      { label: "Home", to: "/" },
      { label: "About", to: "/about" },
      { label: "Journey", to: "/journey" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "How it works",
    description: "Delivery model, engagement paths, and pricing.",
    links: [
      { label: "How it works", to: "/how-it-works" },
      { label: "Pricing", to: "/pricing" },
      { label: "Enterprise", to: "/enterprise" },
      { label: "Pilot", to: "/pilot" },
      { label: "Employer onboarding", to: "/employer-onboarding" },
      { label: "Partnerships for staffing firms", to: "/partnerships/staffing" },
    ],
  },
  {
    title: "Industries",
    description: "Hiring context by industry.",
    links: [{ label: "Industry hub", to: "/industries" }],
  },
  {
    title: "Resources",
    description: "Guides, insights, and reference material.",
    links: [
      { label: "Resources", to: "/resources" },
      { label: "Blog", to: "/blog" },
      { label: "Case studies", to: "/case-studies" },
      { label: "Knowledge base", to: "/knowledge-base" },
      { label: "FAQ", to: "/faq" },
    ],
  },
  {
    title: "Candidates",
    description: "For candidates exploring roles.",
    links: [
      { label: "Browse jobs", to: "/jobs" },
      { label: "Talent network", to: "/talent-network" },
    ],
  },
  {
    title: "Get started",
    description: "Start hiring or sign in to your workspace.",
    links: [
      { label: "Start hiring", to: "/intake" },
      { label: "Sign in", to: "/login" },
    ],
  },
  {
    title: "Legal",
    description: "Policies governing use of TaaSFlow.",
    links: [
      { label: "Privacy Notice", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
    ],
  },
];

export const Route = createFileRoute("/sitemap")({
  head: () => ({
    meta: [
      { title: "Sitemap — TaaSFlow" },
      {
        name: "description",
        content:
          "Every public page on TaaSFlow, grouped by section. Machine-readable version available at /sitemap.xml.",
      },
      { property: "og:title", content: "Sitemap — TaaSFlow" },
      {
        property: "og:description",
        content: "Every public page on TaaSFlow, grouped by section.",
      },
      { property: "og:url", content: "https://clear-path-hubs.lovable.app/sitemap" },
    ],
    links: [
      { rel: "canonical", href: "https://clear-path-hubs.lovable.app/sitemap" },
    ],
  }),
  component: SitemapPage,
});

function SitemapPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Sitemap
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Every page on TaaSFlow
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Grouped by section. Search engines can also read the machine
            version at{" "}
            <a
              href="/sitemap.xml"
              className="font-semibold text-primary hover:underline"
            >
              /sitemap.xml
            </a>
            .
          </p>
        </header>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h2 className="text-lg font-semibold tracking-tight">{g.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {g.description}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {g.links.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className="text-foreground hover:text-primary hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-16 text-xs text-muted-foreground">
          Dynamic pages such as individual jobs, blog articles, and industry
          detail pages are enumerated in{" "}
          <a href="/sitemap.xml" className="underline hover:text-primary">
            /sitemap.xml
          </a>
          .
        </p>
      </section>
    </SiteShell>
  );
}
