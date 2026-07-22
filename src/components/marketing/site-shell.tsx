import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const NAV = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/industries", label: "Industries" },
  { to: "/enterprise", label: "Enterprise" },
  { to: "/case-studies", label: "Case studies" },
  { to: "/blog", label: "Blog" },
  { to: "/about", label: "About" },
] as const;

function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            T
          </span>
          <span className="text-lg">TaaSFlow</span>
        </Link>
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/jobs"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
          >
            Jobs
          </Link>
          <Link
            to="/auth"
            className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Sign in
          </Link>
          <Link
            to="/intake"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Start hiring
          </Link>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              T
            </span>
            <span>TaaSFlow</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Subscription recruiting. Ranked, enriched candidates in 14 days. No placement fees.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            { to: "/how-it-works", label: "How it works" },
            { to: "/pricing", label: "Pricing" },
            { to: "/pilot", label: "$399 pilot" },
            { to: "/enterprise", label: "Enterprise" },
            { to: "/jobs", label: "Job board" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { to: "/about", label: "About" },
            { to: "/case-studies", label: "Case studies" },
            { to: "/contact", label: "Contact" },
            { to: "/partnerships/staffing", label: "Partnerships" },
          ]}
        />
        <FooterCol
          title="Resources"
          links={[
            { to: "/blog", label: "Blog" },
            { to: "/resources", label: "Resources" },
            { to: "/knowledge-base", label: "Knowledge base" },
            { to: "/faq", label: "FAQ" },
            { to: "/privacy", label: "Privacy" },
            { to: "/terms", label: "Terms" },
          ]}
        />
      </div>
      <div className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
        © {new Date().getFullYear()} TaaSFlow. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
