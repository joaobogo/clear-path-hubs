import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ViewerReadOnlyNotice } from "@/components/client/states";
import { Award, Search, Users } from "lucide-react";
import { plural } from "@/lib/format/plural";
import {
  listSilverMedalists,
  REASON_LABELS,
  type SilverReason,
} from "@/lib/talent-memory.functions";
import { getClientContext } from "@/lib/client-context.functions";
import { QueryErrorCard } from "@/components/client/query-error";
import { SkeletonCards } from "@/components/client/states";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { EmptyState, MemoryCard } from "@/components/client/talent-memory/memory-list";
import { MemorySheet } from "@/components/client/talent-memory/memory-sheet";

const searchSchema = z.object({
  id: z.string().uuid().optional(),
  reason: z
    .enum([
      "role_filled",
      "timing",
      "comp_gap",
      "level_mismatch",
      "geo",
      "better_fit_selected",
      "skills_gap",
      "other",
    ])
    .optional(),
  status: z.enum(["active", "archived", "all"]).optional(),
  q: z.string().optional(),
});


export const RoutePending = makeWorkspacePending({ shape: "cards", kpis: false, width: "7xl" });
export const Route = createFileRoute("/_authenticated/client/talent-memory")({
	pendingMs: 150,
	pendingComponent: RoutePending,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Talent memory · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.talent-memory.tsx"),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Not found.</div>
  ),
  component: TalentMemoryPage,
});

function TalentMemoryPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(listSilverMedalists);

  const {
    data: ctx,
    isError: ctxIsError,
    error: ctxError,
    isFetching: ctxIsFetching,
    refetch: refetchCtx,
  } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const readOnly = ctx?.active?.role === "client_viewer";

  const [qDraft, setQDraft] = useState(search.q ?? "");

  const {
    data,
    isPending,
    isError: listIsError,
    error: listError,
    isFetching: listIsFetching,
    refetch: refetchList,
  } = useQuery({
    queryKey: [
      "talent-memory",
      orgId,
      search.status ?? "active",
      search.reason ?? "all",
      search.q ?? "",
    ],
    queryFn: () =>
      listFn({
        data: {
          orgId: orgId!,
          status: search.status ?? "active",
          reason: search.reason,
          q: search.q,
        },
      }),
    enabled: !!orgId,
  });

  const memories = data?.memories ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of memories) c[m.reason_category] = (c[m.reason_category] ?? 0) + 1;
    return c;
  }, [memories]);

  if (ctxIsError) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <QueryErrorCard
          title="We couldn't load your workspace"
          error={ctxError}
          onRetry={() => refetchCtx()}
          retrying={ctxIsFetching}
        />
      </div>
    );
  }

  if (!orgId) return <RoutePending />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Award className="h-6 w-6 text-warning-strong" aria-hidden />
            Talent memory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Candidates you&apos;ve chosen to remember after a search closes.
            Reusable across future roles.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {listIsError ? "— entries" : plural(memories.length, "entry", "entries")}
        </div>
      </header>

      {readOnly ? (
        <ViewerReadOnlyNotice className="mt-5" area="editing talent memory" />
      ) : null}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, q: qDraft || undefined }) });
          }}
        >
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Search by name, headline, role, skill…"
            className="h-9 w-72 pl-8"
          />
        </form>

        <Select
          value={search.reason ?? "all"}
          onValueChange={(v) =>
            navigate({
              search: (s: z.infer<typeof searchSchema>) => ({
                ...s,
                reason: v === "all" ? undefined : (v as SilverReason),
              }),
            })
          }
        >
          <SelectTrigger className="h-9 w-52"><SelectValue placeholder="All reasons" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reasons</SelectItem>
            {(Object.keys(REASON_LABELS) as SilverReason[]).map((k) => (
              <SelectItem key={k} value={k}>
                {REASON_LABELS[k]} {counts[k] ? `(${counts[k]})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border">
          {(["active", "archived", "all"] as const).map((s) => {
            const active = (search.status ?? "active") === s;
            return (
              <button
                key={s}
                onClick={() =>
                  navigate({
                    search: (cur: z.infer<typeof searchSchema>) => ({
                      ...cur,
                      status: s === "active" ? undefined : s,
                    }),
                  })
                }
                className={`px-3 py-1.5 text-xs capitalize ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="mt-6">
        {listIsError ? (
          <QueryErrorCard
            title="We couldn't load talent memory"
            error={listError}
            onRetry={() => refetchList()}
            retrying={listIsFetching}
          />
        ) : isPending ? (
          <SkeletonCards cards={3} />
        ) : memories.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {memories.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                onOpen={() => navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, id: m.id }) })}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Detail sheet */}
      <MemorySheet
        orgId={orgId}
        id={search.id ?? null}
        readOnly={readOnly}
        onClose={() => navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, id: undefined }) })}
      />
    </div>
  );
}
