import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useIncludeTestRecords } from "@/lib/admin-scope";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { QueueShortcuts } from "@/components/admin/queue-shortcuts";
import { QUEUE_ROW_ACTIVE_CLASS, useQueueKeyboard } from "@/lib/admin/queue-keyboard";

import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SurfaceState, SurfaceLoading } from "@/components/ds/surface-state";
import { resolveQueueState, resolveQueueVariant } from "@/lib/empty-states/queue-states";
import { listParseFailures } from "@/lib/parse-failure/parse-failure.functions";
import { listEvidenceGaps } from "@/lib/evidence-gaps/evidence-gaps.functions";
import { buildIntakeQuality } from "@/lib/intake-quality/root-causes";

export const Route = createFileRoute("/_authenticated/admin/intake-quality")({
  head: () => ({
    meta: [
      { title: "Intake quality by root cause · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Parse failures and evidence gaps folded into root-cause groups, each with one owner and one next action.",
      },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.intake-quality.tsx",
  ),
  component: IntakeQuality,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const OWNER_LABEL: Record<string, string> = {
  engineering: "Engineering",
  recruiter: "Recruiter",
  candidate: "Candidate",
};

function IntakeQuality() {
  const fetchParse = useServerFn(listParseFailures);
  const fetchGaps = useServerFn(listEvidenceGaps);
  // Global admin scope, shared with every other desk.
  const showTest = useIncludeTestRecords();
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  const [parseQuery, gapQuery] = useQueries({
    queries: [
      {
        queryKey: ["admin", "intake-quality", "parse", showTest],
        queryFn: () => fetchParse({ data: { include_test: showTest } }),
      },
      {
        queryKey: ["admin", "intake-quality", "gaps", showTest],
        queryFn: () => fetchGaps({ data: { include_test: showTest } }),
      },
    ],
  });

  const summary = useMemo(
    () =>
      buildIntakeQuality({
        parseFailures: ((parseQuery.data as Any)?.rows ?? []) as Any,
        evidenceGaps: ((gapQuery.data as Any)?.rows ?? []) as Any,
      }),
    [parseQuery.data, gapQuery.data],
  );

  const groups = useMemo(
    () =>
      ownerFilter === "all"
        ? summary.groups
        : summary.groups.filter((g) => g.owner === ownerFilter),
    [summary.groups, ownerFilter],
  );

  const isLoading = parseQuery.isLoading || gapQuery.isLoading;
  const isError = parseQuery.isError || gapQuery.isError;
  const activeFilters = [
    ownerFilter !== "all" ? `Owner: ${OWNER_LABEL[ownerFilter]}` : null,
    !showTest ? "Test records hidden" : null,
  ].filter((v): v is string => v !== null);

  const variant = resolveQueueVariant({
    isError,
    rowCount: groups.reduce((s, g) => s + g.items.length, 0),
    activeFilters,
  });

  // Rows are rendered group by group, capped at 25 each, so the keyboard order
  // is the same flattening.
  const visibleItems = useMemo(
    () => groups.flatMap((g) => g.items.slice(0, 25)),
    [groups],
  );
  const openItem = useCallback(
    (index: number) => {
      const path = visibleItems[index]?.link_path;
      if (path) window.location.assign(path);
    },
    [visibleItems],
  );
  const kb = useQueueKeyboard({
    count: visibleItems.length,
    onPrimary: openItem,
    onOpen: openItem,
  });


  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Intake quality</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Parse failures and evidence gaps grouped by the cause they share, so one fix clears a whole
          group instead of one row at a time.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {["all", "engineering", "recruiter", "candidate"].map((owner) => (
          <Button
            key={owner}
            size="sm"
            variant={ownerFilter === owner ? "default" : "outline"}
            onClick={() => setOwnerFilter(owner)}
          >
            {owner === "all" ? "All owners" : OWNER_LABEL[owner]}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {summary.parse_failures} parse failures · {summary.evidence_gaps} evidence gaps ·{" "}
          {summary.our_fault_items} caused by us · {summary.misinformed_items} where our message hid
          the cause
        </span>
      </div>

      {isLoading ? (
        <SurfaceLoading label="Loading intake quality" />
      ) : variant ? (
        <SurfaceState
          content={resolveQueueState({
            variant,
            queueLabel: "Intake quality",
            populates:
              "Rows appear when a CV cannot be read or when a candidate reaches us with no evidence attached.",
            activeFilters,
            errorMessage:
              (parseQuery.error as Error | null)?.message ??
              (gapQuery.error as Error | null)?.message ??
              null,
          })}
          onAction={
            variant === "error"
              ? () => {
                  void parseQuery.refetch();
                  void gapQuery.refetch();
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          <QueueShortcuts className="mb-4" />
          {groups.map((group) => (
            <Card key={group.cause_code}>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{group.cause_label}</CardTitle>
                  <Badge variant="secondary">{group.items.length} affected</Badge>
                  <Badge variant="outline">{OWNER_LABEL[group.owner]}</Badge>
                  {group.our_fault && (
                    <Badge variant="outline" className="text-destructive">
                      Ours to fix
                    </Badge>
                  )}
                  {group.misinformed && (
                    <Badge variant="outline" className="text-destructive">
                      Candidate message hid the cause
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{group.cause}</p>
                <p className="text-sm font-medium">Next action: {group.next_action}</p>
              </CardHeader>
              <CardContent className="space-y-1 text-sm" {...kb.listProps}>
                {group.items.slice(0, 25).map((item) => {
                  const index = visibleItems.findIndex((i) => i.key === item.key);
                  const rowProps = kb.rowProps(index);
                  return (
                    <div
                      key={item.key}
                      {...rowProps}
                      ref={rowProps.ref as (node: HTMLDivElement | null) => void}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-2 py-1.5 last:border-b-0 ${QUEUE_ROW_ACTIVE_CLASS}`}
                    >
                      <span className="font-medium">{item.candidate_name ?? "Unnamed candidate"}</span>
                      {item.reference && (
                        <span className="text-xs text-muted-foreground">Ref {item.reference}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {item.position_title ?? "No role attached"}
                        {item.client_name ? ` · ${item.client_name}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Since {item.first_seen.slice(0, 10)}
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.source === "parse_failure" ? "Parse" : "Evidence"}
                        </Badge>
                        {item.link_path ? (
                          <Button asChild size="sm">
                            <Link to={item.link_path}>Open candidate</Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No record to open — this row came from an intake with no candidate saved.
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
                {group.items.length > 25 && (
                  <p className="pt-2 text-xs text-muted-foreground">
                    Showing the 25 oldest of {group.items.length}.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

      )}
    </div>
  );
}
