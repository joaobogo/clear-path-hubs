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
import { GlobalSearchDialog } from "@/components/workspace/global-search-dialog";
import { cn } from "@/lib/utils";
import { useCrumbLabel } from "@/lib/workspace/crumb-label";

export type WorkspaceNavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  /** Query search params to preserve on nav (support-view etc.). */
  search?: Record<string, string | undefined>;
  /** Optional section heading this item belongs to (sidebar grouping). */
  group?: string;
  /** Longer description used as the collapsed tooltip. */
  hint?: string;
  /** Only show when the viewer is a platform administrator, not general staff. */
  requiresPlatformAdmin?: boolean;
  /** Render visually subordinate to the primary entries (smaller, quieter). */
  subdued?: boolean;

};


export type WorkspacePrimaryAction = {
  label: string;
  to: string;
  /** Optional icon rendered before the label. */
  icon?: ComponentType<{ className?: string }>;
  /** Optional short label for the mobile sticky bar (defaults to `label`). */
  shortLabel?: string;
  /** Search params to preserve on nav (e.g. active org id). */
  search?: Record<string, string | undefined>;
};

export type WorkspaceRole = "admin" | "client" | "candidate";

export type WorkspaceShellProps = {
  /**
   * Which workspace posture to render. Drives density, accent and rhythm
   * through `data-workspace-role` (see src/styles/workspace-system.css).
   */
  role?: WorkspaceRole;
  /** "Admin" | client org name | candidate name */
  contextLabel: string;
  /** Small line under contextLabel (role, email, "support view"). */
  contextSubLabel?: string;
  /** Small pill above contextLabel ("Workspace", "Admin", "Signed in as"). */
  contextKicker?: string;
  /**
   * The account chip names the *person*, not the workspace — the sidebar
   * already carries workspace identity, and repeating it in the top bar is
   * the duplication that makes a screen look unedited.
   */
  accountLabel?: string;
  /** Small line under accountLabel in the account menu (role, email). */
  accountSubLabel?: string;
  navItems: WorkspaceNavItem[];
  /** Optional slot rendered above nav (e.g. org switcher, support banner). */
  aboveNav?: ReactNode;
  /** Optional slot rendered below the top bar, above the outlet (e.g. a page-level banner). */
  topBanner?: ReactNode;
  /** Search params merged into every nav link (support-view mode). */
  linkSearch?: Record<string, string | undefined>;
  /** Global search scope. Defaults to "client". Admin layout should pass "admin". */
  searchScope?: "admin" | "client";
  /** Contextual page-level primary action (top-bar CTA + mobile sticky). */
  primaryAction?: WorkspacePrimaryAction;
  /** Optional slot rendered in the top bar, before the notification bell. */
  headerSlot?: ReactNode;
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
  detailLabel?: string | null,
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
  // A detail page publishes the record's own name; only fall back to the raw
  // segment (a uuid, which reads as gibberish) when nothing was published.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last);
  // A raw uuid is never a label. Until the detail page publishes the record's
  // own name, fall back to a short human word, not the id.
  const readable = detailLabel ?? (isUuid ? "Candidate" : last.replace(/[-_]/g, " "));


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
  // Preserve declaration order while collecting items under their section.
  const groups: { name: string | null; items: WorkspaceNavItem[] }[] = [];
  for (const item of navItems) {
    const name = item.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(item);
    else groups.push({ name, items: [item] });
  }

  return (
    <nav className="flex-1 overflow-y-auto p-2" aria-label="Primary">
      {groups.map((group, gi) => (
        <div key={group.name ?? `g${gi}`} className={gi > 0 ? "mt-4" : undefined}>
          {group.name && !collapsed && (
            <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.name}
            </p>
          )}
          {group.name && collapsed && gi > 0 && (
            <div aria-hidden className="mx-3 mb-2 border-t border-border/60" />
          )}
          <ul className="space-y-1" aria-label={group.name ?? undefined}>
            {group.items.map((item) => {
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
                    title={
                      collapsed
                        ? [group.name, item.label, item.hint].filter(Boolean).join(" · ")
                        : item.hint
                    }
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all duration-150",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                      item.subdued && "py-1.5 text-[0.8125rem] font-normal",
                      active
                        ? "text-[color:var(--taas-shell-nav-active-fg)] bg-[color:var(--taas-shell-nav-active-bg)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--taas-brand-primary)_18%,transparent)]"
                        : item.subdued
                          ? "text-muted-foreground/75 hover:bg-[color:var(--taas-shell-nav-hover-bg)] hover:text-foreground"
                          : "text-muted-foreground hover:bg-[color:var(--taas-shell-nav-hover-bg)] hover:text-foreground",
                      collapsed && "justify-center px-2",
                    )}
                  >

                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
                        style={{ background: "var(--taas-shell-nav-rail)" }}
                      />
                    )}
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && <span className="sr-only">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
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
      <div
        className="flex h-16 items-center justify-center border-b"
        style={{ borderColor: "var(--taas-shell-sidebar-border)" }}
      >
        <Link
          to="/"
          aria-label="TaaSFlow home"
          className="grid h-9 w-9 place-items-center rounded-lg font-bold text-sm text-white"
          style={{
            background: "var(--taas-shell-logo-gradient)",
            boxShadow: "var(--taas-shell-logo-shadow)",
            fontFamily: "var(--taas-font-display)",
          }}
        >
          T
        </Link>
      </div>
    );
  }
  return (
    <div
      className="flex h-16 items-center gap-3 border-b px-4"
      style={{ borderColor: "var(--taas-shell-sidebar-border)" }}
    >
      <Link
        to="/"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-bold text-sm text-white"
        style={{
          background: "var(--taas-shell-logo-gradient)",
          boxShadow: "var(--taas-shell-logo-shadow)",
          fontFamily: "var(--taas-font-display)",
        }}
        aria-label="TaaSFlow home"
      >
        T
      </Link>
      <div className="min-w-0 flex-1">
        {kicker && (
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {kicker}
          </div>
        )}
        <div
          className="truncate text-sm font-semibold leading-tight"
          style={{ color: "var(--taas-text-primary)" }}
        >
          {label}
        </div>
        {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  const {
    role = "client",
    contextLabel,
    contextSubLabel,
    contextKicker,
    accountLabel,
    accountSubLabel,
    navItems,
    aboveNav,
    topBanner,
    linkSearch,
    searchScope,
    primaryAction,
    children,
    headerSlot,
  } = props;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebarState();
  const detailLabel = useCrumbLabel();
  const crumbs = buildBreadcrumbs(pathname, navItems, detailLabel);
  const currentPage = crumbs[crumbs.length - 1]?.label ?? "";
  const [searchOpen, setSearchOpen] = useState(false);
  const [railHover, setRailHover] = useState(false);
  const railCollapsed = collapsed && !railHover;


  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform));
  }, []);

  // Cmd/Ctrl-K opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <div
      data-workspace-role={role}
      className="flex min-h-dvh w-full"
      style={{ background: "var(--taas-shell-bg-gradient)" }}
    >
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-40 hidden h-dvh shrink-0 md:block transition-[width] duration-200 ease-out",
          collapsed ? "w-14" : "w-64",
        )}
        aria-label="Workspace navigation"
        onMouseEnter={() => collapsed && setRailHover(true)}
        onMouseLeave={() => setRailHover(false)}
      >
        <div
          onFocus={() => collapsed && setRailHover(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setRailHover(false);
          }}
          className={cn(
            "absolute inset-y-0 left-0 flex h-full flex-col overflow-hidden border-r transition-[width] duration-200 ease-out",
            collapsed ? (railHover ? "w-64 shadow-xl" : "w-14") : "w-full",
          )}
          style={{
            background: "var(--taas-shell-sidebar-bg)",
            borderColor: "var(--taas-shell-sidebar-border)",
          }}
        >
          <ContextHeader
            kicker={contextKicker}
            label={contextLabel}
            sub={contextSubLabel}
            collapsed={railCollapsed}
          />
          {aboveNav && !railCollapsed && (
            <div
              className="border-b px-3 py-2"
              style={{ borderColor: "var(--taas-shell-sidebar-border)" }}
            >
              {aboveNav}
            </div>
          )}
          <NavList
            navItems={navItems}
            pathname={pathname}
            collapsed={railCollapsed}
            linkSearch={linkSearch}
          />
          <div
            className="border-t p-2"
            style={{ borderColor: "var(--taas-shell-sidebar-border)" }}
          >
            <button
              type="button"
              onClick={toggle}
              className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-[color:var(--taas-shell-nav-hover-bg)] hover:text-foreground transition-colors"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
            >
              {collapsed ? (
                <>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  {railHover && <span className="truncate">Pin open</span>}
                </>
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>


      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside
            className="motion-menu-open absolute inset-y-0 left-0 flex w-72 flex-col shadow-2xl"
            style={{ background: "var(--taas-shell-sidebar-bg)" }}
          >
            <div
              className="flex h-16 items-center justify-between border-b px-4"
              style={{ borderColor: "var(--taas-shell-sidebar-border)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg font-bold text-sm text-white"
                  style={{
                    background: "var(--taas-shell-logo-gradient)",
                    boxShadow: "var(--taas-shell-logo-shadow)",
                    fontFamily: "var(--taas-font-display)",
                  }}
                >
                  T
                </span>
                <span className="truncate text-sm font-semibold">{contextLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {aboveNav && (
              <div
                className="border-b px-3 py-2"
                style={{ borderColor: "var(--taas-shell-sidebar-border)" }}
              >
                {aboveNav}
              </div>
            )}
            <NavList
              navItems={navItems}
              pathname={pathname}
              collapsed={false}
              linkSearch={linkSearch}
              onNavigate={() => setMobileOpen(false)}
            />
            <div
              className="border-t p-3"
              style={{ borderColor: "var(--taas-shell-sidebar-border)" }}
            >
              <SignOutButton className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" />
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-3 backdrop-blur-md md:px-6"
          style={{
            background: "var(--taas-shell-topbar-bg)",
            borderColor: "var(--taas-shell-topbar-border)",
          }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            {/* On phones the sidebar is hidden, so this is the one place the
                workspace is named. On desktop the sidebar owns it. */}
            <div className="truncate text-[11px] text-muted-foreground md:hidden">
              {contextLabel}
            </div>
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
                        className="truncate font-medium"
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
            className="h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border bg-card px-3 text-xs text-muted-foreground shadow-sm hover:text-foreground inline-flex"
            onClick={() => setSearchOpen(true)}
            aria-label="Open global search"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="ml-4 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] hidden lg:inline">
              ⌘K
            </kbd>
          </button>

          {primaryAction && (
            <Link
              to={primaryAction.to}
              search={primaryAction.search ? (primaryAction.search as never) : undefined}
              className="hidden h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 md:inline-flex"
              aria-label={primaryAction.label}
              title={primaryAction.label}
            >
              {primaryAction.icon && <primaryAction.icon className="h-4 w-4 shrink-0" />}
              <span className="hidden lg:inline">{primaryAction.label}</span>
            </Link>
          )}

          <a
            href="/faq"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
            aria-label="Help (opens in a new tab)"
            title="Help & documentation (opens in a new tab)"
          >
            <HelpCircle className="h-4 w-4" />
          </a>

          {headerSlot}

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-11 shrink-0 gap-2 px-2 sm:h-9"
                aria-label="Account menu"
              >
                <span
                  aria-hidden
                  className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                >
                  {(accountLabel ?? contextLabel).slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[140px] truncate text-sm lg:inline">
                  {accountLabel ?? contextLabel}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate font-semibold">
                    {accountLabel ?? contextLabel}
                  </span>
                  {role && (
                    <span className="shrink-0 rounded-full border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {role === "admin" ? "Staff" : role === "client" ? "Client" : "Candidate"}
                    </span>
                  )}
                </div>
                {(accountSubLabel ?? contextSubLabel) && (
                  <div className="truncate text-[11px] font-normal text-muted-foreground">
                    {accountSubLabel ?? contextSubLabel}
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
          <div className="mx-auto w-full max-w-[var(--brand-workspace-width,1440px)] px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
            {children}
          </div>
        </main>

        {primaryAction && (
          <div
            data-consent-offset
            className="sticky bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <Link
              to={primaryAction.to}
              search={primaryAction.search ? (primaryAction.search as never) : undefined}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow"
            >
              {primaryAction.icon && <primaryAction.icon className="h-4 w-4" />}
              <span>{primaryAction.shortLabel ?? primaryAction.label}</span>
            </Link>
          </div>
        )}
      </div>
      <GlobalSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        scope={searchScope ?? "client"}
      />
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
