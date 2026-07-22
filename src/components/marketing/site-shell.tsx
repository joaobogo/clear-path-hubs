import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

const PRIMARY_NAV = [
  { to: "/solutions", label: "Solutions" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/industries", label: "Industries" },
  { to: "/enterprise", label: "Enterprise" },
  { to: "/pricing", label: "Pricing" },
  { to: "/journey", label: "Journey" },
  { to: "/blog", label: "Blog" },
] as const;

const SECONDARY_NAV = [
  { to: "/jobs", label: "Browse roles" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span
        aria-hidden
        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm"
      >
        T
      </span>
      <span className="text-lg">TaaSFlow</span>
    </Link>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Brand className="shrink-0" />
        <nav className="hidden flex-1 items-center gap-5 lg:flex">
          {PRIMARY_NAV.map((n) => (
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
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link
            to="/jobs"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Browse roles
          </Link>
          <Link
            to="/auth"
            className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Sign in
          </Link>
          <Link
            to="/intake"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Start a pilot
          </Link>
        </div>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-input lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-border/60 bg-background lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {[...PRIMARY_NAV, ...SECONDARY_NAV].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                activeProps={{ className: "bg-accent font-medium" }}
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="rounded-md border border-input px-3 py-2 text-center text-sm font-medium"
              >
                Sign in
              </Link>
              <Link
                to="/intake"
                onClick={() => setOpen(false)}
                className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
              >
                Start a pilot
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-5 lg:px-8">
        <div className="md:col-span-2">
          <Brand />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Subscription recruiting with a live workspace. Ranked, evidence-backed
            shortlists in 14 days — no placement fees.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/intake"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Start a pilot
            </Link>
            <Link
              to="/contact"
              className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Book a consultation
            </Link>
          </div>
        </div>
        <FooterCol
          title="Product"
          links={[
            { to: "/solutions", label: "Solutions" },
            { to: "/how-it-works", label: "How it works" },
            { to: "/enterprise", label: "Enterprise" },
            { to: "/pricing", label: "Pricing" },
            { to: "/pilot", label: "Pilot" },
          ]}
        />
        <FooterCol
          title="For candidates"
          links={[
            { to: "/jobs", label: "Browse roles" },
            { to: "/journey", label: "Candidate journey" },
            { to: "/talent-network", label: "Talent network" },
            { to: "/auth", label: "Candidate login" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { to: "/about", label: "About" },
            { to: "/case-studies", label: "Case studies" },
            { to: "/blog", label: "Blog" },
            { to: "/resources", label: "Resources" },
            { to: "/contact", label: "Contact" },
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
