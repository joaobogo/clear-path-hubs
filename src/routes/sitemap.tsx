import { canonicalUrl } from "@/lib/canonical-origin";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { CTA_MESSAGE, CTA_FULL_INTAKE, CTA_PRIMARY } from "@/config/cta";

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
      { label: "Contact", to: "/contact" },
      { label: "Send us a message", to: CTA_MESSAGE.to },
    ],
  },
  {
    title: "Product",
    description: "What the platform does and how it is run.",
    links: [
      { label: "Agents", to: "/agents" },
      { label: "Who TaaSFlow is for", to: "/solutions" },
      { label: "For HR teams", to: "/for-hr-teams" },
      { label: "For founders", to: "/for-founders" },
      { label: "Integrations", to: "/integrations" },
      { label: "Global talent", to: "/global-talent" },
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
      { label: "Job board", to: "/jobs" },
      { label: "Talent network", to: "/talent-network" },
    ],
  },
  {
    title: "Get started",
    description: "Request the pilot, start an intake or sign in to your workspace.",
    links: [
      { label: CTA_PRIMARY.label, to: CTA_PRIMARY.to },
      { label: CTA_FULL_INTAKE.label, to: CTA_FULL_INTAKE.to },
      { label: "Sign in", to: "/login" },
    ],
  },
  {
    title: "Legal and trust",
    description: "Policies, security and platform status.",
    links: [
      { label: "Privacy Notice", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Security", to: "/security" },
      { label: "System status", to: "/status" },
      { label: "Changelog", to: "/changelog" },
    ],
  },
];

export const Route = createFileRoute("/sitemap")({
  head: () => ({
    meta: [
      { title: "Site map | TaaSFlow" },
      {
        name: "description",
        content:
          "Every public page on TaaSFlow, grouped by section. Machine-readable version available at /sitemap.xml.",
      },
      { property: "og:title", content: "Site map | TaaSFlow" },
      {
        property: "og:description",
        content: "Every public page on TaaSFlow, grouped by section.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl("/sitemap") },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [
      { rel: "canonical", href: canonicalUrl("/sitemap") },
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
            Pages
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Site map
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Every page on TaaSFlow, grouped by section. Search engines can also read the machine
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
