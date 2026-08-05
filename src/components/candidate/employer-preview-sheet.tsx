import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Eye, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getMyEmployerPreview,
  listMyEmployerPreviews,
} from "@/lib/candidate/employer-view.functions";
import {
  ALSO_SHARED,
  CONTACT_FIELDS,
  EMPLOYER_VIEW_GROUPS,
  NEVER_SHARED,
  contactStateCopy,
  fieldsForGroup,
} from "@/lib/candidate/employer-view";

/**
 * Read-only rendering of the real employer DTO. Values are rendered generically
 * from the DTO itself so a new field shows up here as soon as it is described in
 * the manifest — no second copy of the employer view to keep in step.
 */
function Value({ value }: { value: unknown }) {
  if (value == null || value === "") {
    return <span className="text-muted-foreground">Not provided</span>;
  }
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (typeof value === "number" || typeof value === "string") {
    return <span className="break-words">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">Nothing shared</span>;
    return (
      <ul className="space-y-1">
        {value.slice(0, 12).map((v, i) => (
          <li key={i} className="break-words">
            <Value value={v} />
          </li>
        ))}
        {value.length > 12 ? (
          <li className="text-muted-foreground">+ {value.length - 12} more</li>
        ) : null}
      </ul>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0),
  );
  if (entries.length === 0) return <span className="text-muted-foreground">Nothing shared</span>;
  return (
    <dl className="space-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground sm:w-40 sm:shrink-0">
            {k.replace(/_/g, " ")}
          </dt>
          <dd className="min-w-0 break-words">
            <Value value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EmployerPreviewSheet() {
  const [open, setOpen] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const listFn = useServerFn(listMyEmployerPreviews);
  const previewFn = useServerFn(getMyEmployerPreview);

  const list = useQuery({
    queryKey: ["employer-preview-list"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const shared = list.data?.shared ?? [];
  const activeId = matchId ?? shared[0]?.match_id ?? null;
  const active = shared.find((s) => s.match_id === activeId) ?? null;

  const preview = useQuery({
    queryKey: ["employer-preview", activeId],
    queryFn: () => previewFn({ data: { match_id: activeId as string } }),
    enabled: open && !!activeId,
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Eye className="mr-2 h-4 w-4" aria-hidden /> What employers see
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-full overflow-y-auto p-4 sm:max-w-2xl sm:p-6"
        >
          <SheetHeader className="text-left">
            <SheetTitle>What employers see</SheetTitle>
            <SheetDescription>
              This is the exact record we send an employer when we share you for a role. It is read
              only — edit your profile to change it.
            </SheetDescription>
          </SheetHeader>

          {shared.length > 1 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {shared.map((s) => (
                <Button
                  key={s.match_id}
                  size="sm"
                  variant={s.match_id === activeId ? "secondary" : "ghost"}
                  onClick={() => setMatchId(s.match_id)}
                >
                  {s.role_title}
                  {s.company ? ` · ${s.company}` : ""}
                </Button>
              ))}
            </div>
          ) : null}

          {list.isError || preview.isError ? (
            <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4" aria-hidden /> We could not load your preview
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Nothing is shown rather than a partial preview, because a partial one would not be
                the truth.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  void list.refetch();
                  void preview.refetch();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden /> Try again
              </Button>
            </div>
          ) : list.isLoading || (activeId && preview.isLoading) ? (
            <div className="mt-6 space-y-3" aria-busy="true">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-8">
              {active && preview.data ? (
                <>
                  <section className="rounded-xl border bg-card p-4">
                    <h3 className="text-sm font-semibold">Contact details</h3>
                    <p className="mt-1 flex items-center gap-2 text-sm">
                      <Lock className="h-4 w-4" aria-hidden />
                      <span className="font-medium">
                        {contactStateCopy(preview.data.contact_released).label}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {contactStateCopy(preview.data.contact_released).detail}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Applies to: {CONTACT_FIELDS.join(", ")}.
                    </p>
                  </section>

                  {EMPLOYER_VIEW_GROUPS.map((group) => {
                    const fields = fieldsForGroup(group.key);
                    if (fields.length === 0) return null;
                    return (
                      <section key={group.key}>
                        <h3 className="text-sm font-semibold">{group.title}</h3>
                        <p className="text-sm text-muted-foreground">{group.blurb}</p>
                        <dl className="mt-3 space-y-4">
                          {fields.map((f) => (
                            <div key={f.key} className="rounded-xl border bg-card p-3">
                              <dt className="text-sm font-medium">{f.label}</dt>
                              {f.note ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">{f.note}</p>
                              ) : null}
                              <dd className="mt-2 text-sm">
                                <Value
                                  value={
                                    (preview.data.dto as unknown as Record<string, unknown>)[f.key]
                                  }
                                />
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    );
                  })}
                </>
              ) : (
                <section className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold">Nothing has been shared yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    When we share you with an employer, this preview shows the exact record they
                    receive. The lists below apply either way.
                  </p>
                </section>
              )}

              <section>
                <h3 className="text-sm font-semibold">Also shared</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {ALSO_SHARED.map((s) => (
                    <li key={s.item}>
                      <span className="font-medium">{s.item}</span>{" "}
                      <span className="text-muted-foreground">— {s.why}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-semibold">Never shared</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {NEVER_SHARED.map((s) => (
                    <li key={s.item}>
                      <span className="font-medium">{s.item}</span>{" "}
                      <span className="text-muted-foreground">— {s.why}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
