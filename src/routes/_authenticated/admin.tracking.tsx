import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TRACKER_CATEGORY } from "@/lib/tracking/pixels";
import { setTrackingPolicy } from "@/lib/tracking/consent";
import {
  fetchTrackingPolicy,
  saveTrackingPolicy,
} from "@/lib/tracking/policy.functions";

const policyQuery = {
  queryKey: ["tracking-policy"] as const,
  queryFn: () => fetchTrackingPolicy(),
};

export const Route = createFileRoute("/_authenticated/admin/tracking")({
  loader: ({ context }) => context.queryClient.ensureQueryData(policyQuery),
  head: () => ({
    meta: [
      { title: "Consent and tracking · TaaSFlow admin" },
      {
        name: "description",
        content:
          "Choose which trackers are strictly necessary and how the regional consent gate behaves.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrackingPolicyPage,
  errorComponent: makeRouteErrorComponent("admin", "_authenticated/admin.tracking"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

type TrackerKey = keyof typeof TRACKER_CATEGORY;

const TRACKERS: Array<{ key: TrackerKey; name: string; what: string }> = [
  { key: "ga4", name: "Google Analytics 4", what: "Traffic and product measurement" },
  { key: "apollo", name: "Apollo website tracker", what: "Visitor-to-company enrichment" },
  { key: "rb2b", name: "RB2B", what: "Company-level visitor identification" },
  { key: "meta", name: "Meta pixel", what: "Advertising and retargeting" },
  { key: "linkedin", name: "LinkedIn insight tag", what: "Advertising and conversions" },
  { key: "clarity", name: "Microsoft Clarity", what: "Session recording and heatmaps" },
  { key: "hotjar", name: "Hotjar", what: "Session recording and surveys" },
];

function TrackingPolicyPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(policyQuery);
  const save = useServerFn(saveTrackingPolicy);

  const [essential, setEssential] = useState<string[]>(data.essentialTrackers);
  const [strict, setStrict] = useState(data.requirePriorOptInEverywhere);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEssential(data.essentialTrackers);
    setStrict(data.requirePriorOptInEverywhere);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({ data: { essentialTrackers: essential, requirePriorOptInEverywhere: strict } }),
    onSuccess: (result) => {
      qc.setQueryData(policyQuery.queryKey, result);
      // Apply immediately in this browser session too.
      setTrackingPolicy({
        essentialTrackers: result.essentialTrackers,
        requirePriorOptInEverywhere: result.requirePriorOptInEverywhere,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 4000);
    },
  });

  const dirty =
    strict !== data.requirePriorOptInEverywhere ||
    essential.length !== data.essentialTrackers.length ||
    essential.some((k) => !data.essentialTrackers.includes(k));

  const toggle = (key: string, on: boolean) =>
    setEssential((prev) => (on ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Consent and tracking</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Nothing loads until a visitor decides, except the trackers you mark strictly
          necessary here. The choice is stored in the visitor's browser and applies on
          every page and every reload.
        </p>
      </header>

      {saved && (
        <Alert>
          <AlertDescription>
            Saved. New visits use this policy immediately; open sessions pick it up on
            their next page load.
          </AlertDescription>
        </Alert>
      )}
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Could not save: {(mutation.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      <section className="rounded-[var(--brand-radius-lg)] border border-border p-5">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Require prior opt-in everywhere</p>
            <p className="max-w-xl text-sm text-muted-foreground">
              On: every visitor sees the choice first, wherever they are. Off: the gate
              applies in the EU/EEA, UK and Switzerland only, and optional trackers run
              by default elsewhere.
            </p>
          </div>
          <Switch
            checked={strict}
            onCheckedChange={setStrict}
            aria-label="Require prior opt-in everywhere"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Strictly necessary trackers</h2>
          <p className="text-sm text-muted-foreground">
            Only mark a tracker necessary if the site cannot operate without it. Anything
            unchecked stays dormant until the visitor consents to its category.
          </p>
        </div>

        <ul className="divide-y divide-border rounded-[var(--brand-radius-lg)] border border-border">
          {TRACKERS.map((t) => {
            const on = essential.includes(t.key);
            return (
              <li key={t.key} className="flex items-center justify-between gap-4 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{t.name}</p>
                    <Badge variant="outline">{TRACKER_CATEGORY[t.key]}</Badge>
                    {on ? (
                      <Badge>Loads before consent</Badge>
                    ) : (
                      <Badge variant="secondary">Waits for consent</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{t.what}</p>
                </div>
                <Switch
                  checked={on}
                  onCheckedChange={(v) => toggle(t.key, v)}
                  aria-label={`Treat ${t.name} as strictly necessary`}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={() => mutation.mutate()} disabled={!dirty || mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save policy"}
        </Button>
        {dirty && (
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
