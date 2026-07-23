import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Building2, Briefcase, Users, MessageSquare, Loader2, Clock } from "lucide-react";
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
const MAX_RECENT = 6;

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}
function pushRecent(q: string) {
  try {
    const list = readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
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
  message: MessageSquare,
};

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  client: "Clients",
  position: "Positions",
  candidate: "Candidates",
  messages: "Messages",
} as unknown as Record<SearchResult["type"], string>;

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

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", scope, debounced],
    queryFn: () => search({ data: { q: debounced, scope } }),
    enabled: debounced.length >= 2,
    staleTime: 15_000,
  });

  const allResults: SearchResult[] = useMemo(() => {
    if (!data) return [];
    return [
      ...data.groups.clients,
      ...data.groups.positions,
      ...data.groups.candidates,
      ...data.groups.messages,
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
            {recent.length > 0 ? (
              <CommandGroup heading="Recent searches">
                {recent.map((r) => (
                  <CommandItem
                    key={r}
                    value={`recent:${r}`}
                    onSelect={() => setQ(r)}
                  >
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    {r}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </div>
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
            {!isFetching && allResults.length === 0 && (
              <CommandEmpty>
                No results for &ldquo;{debounced}&rdquo;.
              </CommandEmpty>
            )}

            {groups &&
              (["clients", "positions", "candidates", "messages"] as const).map((key, idx) => {
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
                              <div className="truncate text-sm">{r.label}</div>
                              {r.context && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {r.context}
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
    </CommandDialog>
  );
}

// Suppress unused-var lint on the labels helper (kept for reference / future i18n).
void TYPE_LABELS;
