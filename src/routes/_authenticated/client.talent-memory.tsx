import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import {
  Archive,
  ArchiveRestore,
  Award,
  Clock,
  History,
  RotateCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  listSilverMedalists,
  getSilverMedalist,
  updateSilverMedalist,
  logReengagement,
  REASON_LABELS,
  type SilverConsent,
  type SilverReason,
  type TalentMemoryDTO,
} from "@/lib/talent-memory.functions";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export const Route = createFileRoute("/_authenticated/client/talent-memory")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Talent memory · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Failed to load: {error.message}</div>
  ),
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

  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const readOnly = ctx?.active?.role === "client_viewer";

  const [qDraft, setQDraft] = useState(search.q ?? "");

  const { data, isPending } = useQuery({
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

  if (!orgId) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Award className="h-6 w-6 text-amber-500" aria-hidden />
            Talent memory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Candidates you&apos;ve chosen to remember after a search closes.
            Reusable across future roles.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {memories.length} entries
        </div>
      </header>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: (s) => ({ ...s, q: qDraft || undefined }) });
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
              search: (s) => ({
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
                    search: (cur) => ({
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
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : memories.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {memories.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                onOpen={() => navigate({ search: (s) => ({ ...s, id: m.id }) })}
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
        onClose={() => navigate({ search: (s) => ({ ...s, id: undefined }) })}
      />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
      <Award className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 font-medium">No silver medalists yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tag strong candidates who weren&apos;t selected — they&apos;ll resurface
        automatically when you open similar roles.
      </p>
      <Link to="/client/candidates" className="mt-4 inline-block text-sm text-primary hover:underline">
        Browse candidates
      </Link>
    </div>
  );
}

function MemoryCard({
  memory,
  onOpen,
}: {
  memory: TalentMemoryDTO;
  onOpen: () => void;
}) {
  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md">
      <button className="w-full text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{memory.candidate.display_name}</p>
            {memory.candidate.headline && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {memory.candidate.headline}
              </p>
            )}
          </div>
          {memory.status === "archived" ? (
            <Badge variant="outline" className="text-[10px]">archived</Badge>
          ) : (
            <Badge className="border-amber-300/60 bg-amber-100/60 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 text-[10px]">
              silver
            </Badge>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {REASON_LABELS[memory.reason_category]}
          </Badge>
          {memory.role_title_snapshot && (
            <span className="text-[11px] text-muted-foreground">
              from <span className="font-medium">{memory.role_title_snapshot}</span>
            </span>
          )}
        </div>
        {memory.skills_snapshot.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {memory.skills_snapshot.slice(0, 5).map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
            ))}
            {memory.skills_snapshot.length > 5 && (
              <span className="text-[10px] text-muted-foreground">
                +{memory.skills_snapshot.length - 5} more
              </span>
            )}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            consent: {memory.consent_status}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(memory.tagged_at).toLocaleDateString()}
          </span>
        </div>
      </button>
    </li>
  );
}

function MemorySheet({
  orgId,
  id,
  readOnly,
  onClose,
}: {
  orgId: string;
  id: string | null;
  readOnly: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getSilverMedalist);
  const updateFn = useServerFn(updateSilverMedalist);
  const reengageFn = useServerFn(logReengagement);

  const { data } = useQuery({
    queryKey: ["talent-memory", "detail", orgId, id],
    queryFn: () => getFn({ data: { orgId, id: id! } }),
    enabled: !!id,
  });

  const update = useMutation({
    mutationFn: (patch: Parameters<typeof updateFn>[0]["data"]) =>
      updateFn({ data: patch }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["talent-memory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reengage = useMutation({
    mutationFn: (memId: string) => reengageFn({ data: { orgId, id: memId } }),
    onSuccess: () => {
      toast.success("Re-engagement logged");
      qc.invalidateQueries({ queryKey: ["talent-memory"] });
    },
  });

  const m = data?.memory;
  const events = data?.events ?? [];
  const history = data?.match_history ?? [];

  return (
    <Sheet open={!!id} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {!m ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                {m.candidate.display_name}
              </SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-6 text-sm">
              {m.candidate.headline && (
                <p className="text-muted-foreground">{m.candidate.headline}</p>
              )}

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Why they were passed
                </h3>
                <div className="mt-2 rounded-md border bg-muted/30 p-3">
                  <p className="font-medium">{REASON_LABELS[m.reason_category]}</p>
                  {m.role_title_snapshot && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      From role {m.role_title_snapshot}
                      {m.score_snapshot != null && (
                        <> · score {Math.round(m.score_snapshot)}/100</>
                      )}
                    </p>
                  )}
                  {m.reason_notes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">{m.reason_notes}</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Consent &amp; ownership
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["granted", "pending", "declined", "withdrawn"] as SilverConsent[]).map(
                    (c) => (
                      <button
                        key={c}
                        disabled={readOnly || update.isPending}
                        onClick={() =>
                          update.mutate({ orgId, id: m.id, consent_status: c })
                        }
                        className={`rounded-full border px-3 py-1 text-xs capitalize ${
                          m.consent_status === c
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {c}
                      </button>
                    ),
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Owner:{" "}
                  <span className="font-medium text-foreground">
                    {m.owner_name ?? "Unassigned"}
                  </span>{" "}
                  · Tagged by {m.tagged_by_name ?? "team"} on{" "}
                  {new Date(m.tagged_at).toLocaleDateString()}
                </p>
              </section>

              {m.skills_snapshot.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Skills snapshot
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.skills_snapshot.map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] font-normal">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {history.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Match history
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {history.map((h) => (
                      <li
                        key={h.match_id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="font-medium">{h.position_title}</p>
                          <p className="text-muted-foreground">
                            stage: {h.stage.replace(/_/g, " ")} ·{" "}
                            {new Date(h.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Link
                          to="/client/candidates/$id"
                          params={{ id: h.match_id }}
                          className="text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <History className="h-3 w-3" /> Timeline
                </h3>
                <ol className="mt-2 space-y-2 border-l pl-3">
                  {events.length === 0 ? (
                    <li className="text-xs text-muted-foreground">No events yet.</li>
                  ) : (
                    events.map((e) => (
                      <li key={e.id} className="text-xs">
                        <p className="font-medium capitalize">
                          {e.event_type.replace(/_/g, " ")}
                        </p>
                        <p className="text-muted-foreground">
                          {new Date(e.created_at).toLocaleString()}
                          {e.actor_name && <> · {e.actor_name}</>}
                        </p>
                        {e.notes && <p className="mt-0.5">{e.notes}</p>}
                      </li>
                    ))
                  )}
                </ol>
              </section>

              <div className="sticky bottom-0 -mx-6 border-t bg-background/95 px-6 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => reengage.mutate(m.id)}
                    disabled={readOnly || reengage.isPending}
                  >
                    <RotateCw className="mr-1 h-3.5 w-3.5" />
                    Log re-engagement
                  </Button>
                  {m.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        update.mutate({ orgId, id: m.id, status: "archived" })
                      }
                      disabled={readOnly || update.isPending}
                    >
                      <Archive className="mr-1 h-3.5 w-3.5" />
                      Archive
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => update.mutate({ orgId, id: m.id, status: "active" })}
                      disabled={readOnly || update.isPending}
                    >
                      <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
                      Re-open
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
