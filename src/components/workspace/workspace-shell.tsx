import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Menu,
  Search,
  X,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { SignOutButton } from "@/components/sign-out-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceNavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  /** Query search params to preserve on nav (support-view etc.). */
  search?: Record<string, string | undefined>;
};

export type WorkspaceShellProps = {
  /** "Admin" | client org name | candidate name */
  contextLabel: string;
  /** Small line under contextLabel (role, email, "support view"). */
  contextSubLabel?: string;
  /** Small pill above contextLabel ("Workspace", "Admin", "Signed in as"). */
  contextKicker?: string;
  navItems: WorkspaceNavItem[];
  /** Optional slot rendered above nav (e.g. org switcher, support banner). */
  aboveNav?: ReactNode;
  /** Optional slot rendered below the top bar, above the outlet (e.g. a page-level banner). */
  topBanner?: ReactNode;
  /** Search params merged into every nav link (support-view mode). */
  linkSearch?: Record<string, string | undefined>;
  children: ReactNode;
};

const COLLAPSED_KEY = "taasflow:sidebar:collapsed";

function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  return { collapsed, toggle, mobileOpen, setMobileOpen };
}

function buildBreadcrumbs(
  pathname: string,
  navItems: WorkspaceNavItem[],
): { label: string; to?: string }[] {
  // Sort by longest match so /admin/positions wins over /admin.
  const sorted = [...navItems].sort((a, b) => b.to.length - a.to.length);
  const section = sorted.find((n) =>
    n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/"),
  );
  if (!section) return [];
  if (pathname === section.to) return [{ label: section.label }];
  // Add a trailing crumb from the remaining path segments (Title-cased last segment).
  const tail = pathname.slice(section.to.length).split("/").filter(Boolean);
  const last = tail[tail.length - 1];
  if (!last) return [{ label: section.label }];
  const readable =
    last.length > 24 ? last.slice(0, 6) + "…" + last.slice(-4) : last.replace(/[-_]/g, " ");
  return [
    { label: section.label, to: section.to },
    { label: readable },
  ];
}

function NavList({
  navItems,
  pathname,
  collapsed,
  linkSearch,
  onNavigate,
}: {
  navItems: WorkspaceNavItem[];
  pathname: string;
  collapsed: boolean;
  linkSearch?: Record<string, string | undefined>;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto p-2" aria-label="Primary">
      <ul className="space-y-1">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(item.to + "/");
          const search = { ...(linkSearch ?? {}), ...(item.search ?? {}) };
          const hasSearch = Object.keys(search).length > 0;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                search={hasSearch ? (search as never) : undefined}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-2",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
                  />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ContextHeader({
  kicker,
  label,
  sub,
  collapsed,
}: {
  kicker?: string;
  label: string;
  sub?: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <div className="flex h-14 items-center justify-center border-b">
        <Link
          to="/"
          aria-label="TaaSFlow home"
          className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-bold text-sm"
        >
          T
        </Link>
      </div>
    );
  }
  return (
    <div className="flex h-14 items-center gap-2 border-b px-4">
      <Link
        to="/"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground font-bold text-sm"
        aria-label="TaaSFlow home"
      >
        T
      </Link>
      <div className="min-w-0 flex-1">
        {kicker && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {kicker}
          </div>
        )}
        <div className="truncate text-sm font-semibold leading-tight">{label}</div>
        {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  const {
    contextLabel,
    contextSubLabel,
    contextKicker,
    navItems,
    aboveNav,
    topBanner,
    linkSearch,
    children,
  } = props;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebarState();
  const crumbs = buildBreadcrumbs(pathname, navItems);
  const currentPage = crumbs[crumbs.length - 1]?.label ?? "";

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card md:flex transition-[width] duration-200 ease-out",
          collapsed ? "w-14" : "w-60",
        )}
        aria-label="Workspace navigation"
      >
        <ContextHeader
          kicker={contextKicker}
          label={contextLabel}
          sub={contextSubLabel}
          collapsed={collapsed}
        />
        {aboveNav && !collapsed && <div className="border-b px-3 py-2">{aboveNav}</div>}
        <NavList
          navItems={navItems}
          pathname={pathname}
          collapsed={collapsed}
          linkSearch={linkSearch}
        />
        <div className="border-t p-2">
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-card shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-sm font-semibold">{contextLabel}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {aboveNav && <div className="border-b px-3 py-2">{aboveNav}</div>}
            <NavList
              navItems={navItems}
              pathname={pathname}
              collapsed={false}
              linkSearch={linkSearch}
              onNavigate={() => setMobileOpen(false)}
            />
            <div className="border-t p-3">
              <SignOutButton className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" />
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
              {crumbs.length === 0 ? (
                <li className="truncate font-medium">{contextLabel}</li>
              ) : (
                crumbs.map((c, i) => (
                  <li key={i} className="flex min-w-0 items-center gap-1.5">
                    {i > 0 && (
                      <span aria-hidden className="text-muted-foreground/60">/</span>
                    )}
                    {c.to && i < crumbs.length - 1 ? (
                      <Link
                        to={c.to}
                        search={linkSearch ? (linkSearch as never) : undefined}
                        className="truncate text-muted-foreground hover:text-foreground"
                      >
                        {c.label}
                      </Link>
                    ) : (
                      <span
                        aria-current="page"
                        className="truncate font-medium capitalize"
                      >
                        {c.label}
                      </span>
                    )}
                  </li>
                ))
              )}
            </ol>
          </nav>

          <button
            type="button"
            className="hidden h-9 items-center gap-2 rounded-md border bg-card px-3 text-xs text-muted-foreground shadow-sm hover:text-foreground md:inline-flex"
            onClick={() => {
              /* Global search entry point — hook up when search index ships. */
              const el = document.getElementById("workspace-search");
              el?.focus();
            }}
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="ml-4 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>

          <a
            href="/faq"
            className="hidden rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
            aria-label="Help"
            title="Help & documentation"
          >
            <HelpCircle className="h-4 w-4" />
          </a>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-2 px-2"
                aria-label="Account menu"
              >
                <span
                  aria-hidden
                  className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                >
                  {contextLabel.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[140px] truncate text-sm md:inline">
                  {contextLabel}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                {contextLabel}
                {contextSubLabel && (
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {contextSubLabel}
                  </div>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/me/profile">My profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/me/settings">Privacy & settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/faq">Help & FAQ</a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <div className="p-0">
                  <SignOutButton className="flex w-full items-center gap-2 px-2 py-1.5 text-sm" />
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {topBanner}

        <main
          id="workspace-main"
          className="flex-1"
          aria-label={currentPage || contextLabel}
        >
          <div className="mx-auto w-full max-w-[var(--brand-workspace-width,1440px)] px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function WorkspaceLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      <span
        aria-hidden
        className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
      />
      {label}
    </div>
  );
}

export function WorkspaceError({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button onClick={onRetry} size="sm" className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}
