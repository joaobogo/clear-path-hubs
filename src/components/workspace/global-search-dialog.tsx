import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Building2, Briefcase, Users, MessageSquare, Loader2, Clock, CheckSquare, Zap, LineChart, PlusCircle, Bot, Gauge, Send, ClipboardList, AlertTriangle, RotateCw } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { globalSearch, type SearchResult } from "@/lib/global-search.functions";

const RECENT_KEY = "taasflow:search:recent";
// Session-scoped: recents disappear when the tab closes.
const store = () => (typeof window === "undefined" ? null : window.sessionStorage);
const MAX_RECENT = 6;

function readRecent(): string[] {
  try {
    const v = JSON.parse(store()?.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}
function pushRecent(q: string) {
  try {
    const list = readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    store()?.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const ICONS: Record<SearchResult["type"], React.ComponentType<{ className?: string }>> = {
  client: Building2,
  position: Briefcase,
  candidate: Users,
  intake: ClipboardList,
  message: MessageSquare,
  task: CheckSquare,
};

const LABELS: Record<SearchResult["type"], string> = {
  client: "Client",
  position: "Role",
  candidate: "Candidate",
  intake: "Intake",
  message: "Message",
  task: "Task",
};

type QuickAction = {
  id: string;
  label: string;
  keywords: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const CLIENT_QUICK_ACTIONS: QuickAction[] = [
  { id: "qa-new-role", label: "Create new role", keywords: "create new role position intake", href: "/intake", icon: PlusCircle },
  { id: "qa-overdue", label: "View overdue tasks", keywords: "overdue tasks approvals", href: "/client/tasks?view=overdue", icon: CheckSquare },
  { id: "qa-blocking", label: "View blocking tasks", keywords: "blocking urgent approvals", href: "/client/tasks?view=blocking", icon: Zap },
  { id: "qa-agents", label: "Turn agents on or off", keywords: "agents sourcing screening outreach scheduling turn on off pause control", href: "/client/agents", icon: Bot },
  { id: "qa-pace", label: "Change how hard we work a role", keywords: "pace intensity steady standard aggressive dial control room", href: "/client", icon: Gauge },
  { id: "qa-outreach", label: "Set outreach rules", keywords: "outreach channels contact rules frequency caps", href: "/client/outreach", icon: Send },
  { id: "qa-analytics", label: "Open analytics", keywords: "analytics metrics conversion", href: "/client/analytics", icon: LineChart },
  { id: "qa-inbox", label: "Open inbox", keywords: "messages notifications inbox", href: "/client/inbox", icon: MessageSquare },
];

const ADMIN_QUICK_ACTIONS: QuickAction[] = [
  { id: "qa-admin-copilot", label: "Open Copilot", keywords: "copilot assistant admin", href: "/admin/copilot", icon: Zap },
  { id: "qa-admin-clients", label: "Open clients list", keywords: "clients", href: "/admin/clients", icon: Building2 },
];

export function GlobalSearchDialog({
  open,
  onOpenChange,
  scope,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: "admin" | "client";
}) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q.trim(), 200);
  const search = useServerFn(globalSearch);
  const navigate = useNavigate();
  const [recent, setRecent] = useState<string[]>([]);
  const lastCommitted = useRef<string>("");

  useEffect(() => {
    if (open) setRecent(readRecent());
    if (!open) setQ("");
  }, [open]);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["global-search", scope, debounced],
    queryFn: () => search({ data: { q: debounced, scope } }),
    enabled: debounced.length >= 2,
    retry: false,
    staleTime: 15_000,
  });

  const quickActions = scope === "admin" ? ADMIN_QUICK_ACTIONS : CLIENT_QUICK_ACTIONS;

  const allResults: SearchResult[] = useMemo(() => {
    if (!data) return [];
    return [
      ...data.groups.clients,
      ...data.groups.positions,
      ...data.groups.candidates,
      ...data.groups.intakes,
      ...data.groups.messages,
      ...data.groups.tasks,
    ];
  }, [data]);

  function commit(term: string) {
    if (!term || lastCommitted.current === term) return;
    lastCommitted.current = term;
    pushRecent(term);
  }

  function go(r: SearchResult) {
    commit(debounced);
    onOpenChange(false);
    navigate({
      to: r.href,
      search: r.search as never,
    });
  }

  const groups = data?.groups;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={
          scope === "admin"
            ? "Search clients, positions, candidates, messages…"
            : "Search positions, candidates, messages…"
        }
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        {debounced.length < 2 && (
          <>
            <CommandGroup heading="Quick actions">
              {quickActions.map((qa) => {
                const Icon = qa.icon;
                return (
                  <CommandItem
                    key={qa.id}
                    value={`qa:${qa.id}:${qa.keywords}`}
                    onSelect={() => {
                      onOpenChange(false);
                      navigate({ to: qa.href });
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {qa.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {recent.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recent searches">
                  {recent.map((r) => (
                    <CommandItem key={r} value={`recent:${r}`} onSelect={() => setQ(r)}>
                      <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                      {r}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}

        {debounced.length >= 2 && (
          <>
            {isFetching && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </div>
            )}
            {isError && (
              <div className="px-4 py-6 text-center text-sm">
                <div className="flex items-center justify-center gap-2 font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Search unavailable
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  We could not reach search. Your results are not empty — they did not load.
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            )}
            {!isError && !isFetching && data && allResults.length === 0 && (
              <CommandEmpty>
                No matches for &ldquo;{debounced}&rdquo;.
              </CommandEmpty>
            )}

            {groups &&
              !isError &&
              (["clients", "positions", "candidates", "intakes", "tasks", "messages"] as const).map((key, idx) => {
                const items = groups[key];
                if (!items || items.length === 0) return null;
                return (
                  <div key={key}>
                    {idx > 0 && <CommandSeparator />}
                    <CommandGroup heading={key.charAt(0).toUpperCase() + key.slice(1)}>
                      {items.map((r) => {
                        const Icon = ICONS[r.type];
                        return (
                          <CommandItem
                            key={`${r.type}:${r.id}`}
                            value={`${r.type}:${r.id}:${r.label}`}
                            onSelect={() => go(r)}
                          >
                            <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm">{r.label}</span>
                                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                  {LABELS[r.type]}
                                </span>
                              </div>
                              {(r.context || r.state) && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {r.context}
                                  {r.context && r.state ? " · " : ""}
                                  {r.state && <span className="font-medium text-foreground/70">{r.state}</span>}
                                </div>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </div>
                );
              })}
          </>
        )}
      </CommandList>
      {scope === "admin" && (
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>↑↓ to navigate · Enter to open</span>
          <span>Test records follow the global admin setting</span>
        </div>
      )}
    </CommandDialog>
  );
}

