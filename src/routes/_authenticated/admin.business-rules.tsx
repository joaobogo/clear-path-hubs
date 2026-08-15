import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listBusinessRuleOverrides,
  setBusinessRuleOverride,
  clearBusinessRuleOverride,
} from "@/lib/business-rules.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

const TOP_KEYS = [
  "delivery",
  "retention",
  "packages",
  "subscriptions",
  "annualDiscountLabel",
  "scoring",
  "ctas",
  "contact",
  "legal",
] as const;

export const Route = createFileRoute("/_authenticated/admin/business-rules")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["business-rules-overrides"],
      queryFn: () => listBusinessRuleOverrides(),
    }),
  head: () => ({
    meta: [
      { title: "Business rules · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.business-rules.tsx"),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
  component: BusinessRulesEditor,
});

function BusinessRulesEditor() {
  const { data } = useSuspenseQuery({
    queryKey: ["business-rules-overrides"],
    queryFn: () => listBusinessRuleOverrides(),
  });
  const qc = useQueryClient();
  const save = useServerFn(setBusinessRuleOverride);
  const reset = useServerFn(clearBusinessRuleOverride);

  const overridesByKey = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const row of data.overrides) map.set(row.key, row.value);
    return map;
  }, [data.overrides]);

  const defaultsByKey = data.defaults as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to="/admin" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Admin
          </Link>
          <h1 className="text-2xl font-semibold">Business rules</h1>
          <p className="text-sm text-muted-foreground">
            Canonical values used across marketing, dashboards, ROI, proposals, and legal.
            Overrides are validated before save and appended to an audit log.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <ShieldCheck className="h-3 w-3" /> Platform admin
        </Badge>
      </div>

      <div className="space-y-4">
        {TOP_KEYS.map((key) => (
          <RuleSection
            key={key}
            ruleKey={key}
            defaultValue={defaultsByKey[key]}
            overrideValue={overridesByKey.get(key)}
            onSave={async (value, note) => {
              try {
                await save({ data: { key, value, note } });
                toast.success(`Saved ${key}`);
                await qc.invalidateQueries({ queryKey: ["business-rules-overrides"] });
                await qc.invalidateQueries({ queryKey: ["business-rules"] });
              } catch (err) {
                toast.error(`Invalid override for ${key}`, { description: err instanceof Error ? err.message : String(err) });
              }
            }}
            onReset={async () => {
              try {
                await reset({ data: { key } });
                toast.success(`Reset ${key} to default`);
                await qc.invalidateQueries({ queryKey: ["business-rules-overrides"] });
                await qc.invalidateQueries({ queryKey: ["business-rules"] });
              } catch (err) {
                toast.error(`Reset failed`, { description: err instanceof Error ? err.message : String(err) });
              }
            }}
          />
        ))}
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent changes</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["business-rules-overrides"] })}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
        <div className="rounded-lg border bg-card">
          {data.audit.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No changes yet.</p>
          ) : (
            <ul className="divide-y">
              {data.audit.map((row) => (
                <li key={row.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{row.key}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.action} · {new Date(row.created_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
                    </span>
                  </div>
                  {row.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function RuleSection(props: {
  ruleKey: string;
  defaultValue: unknown;
  overrideValue: unknown;
  onSave: (value: unknown, note?: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const { ruleKey, defaultValue, overrideValue, onSave, onReset } = props;
  const initial = JSON.stringify(overrideValue ?? defaultValue, null, 2);
  const [text, setText] = useState(initial);
  const [note, setNote] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const isOverridden = overrideValue !== undefined;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{ruleKey}</h3>
          {isOverridden ? (
            <Badge variant="secondary" className="text-[10px]">Override active</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Default</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOverridden ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset to default
            </Button>
          ) : null}
        </div>
      </div>
      <Textarea
        rows={Math.min(20, initial.split("\n").length + 2)}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setParseError(null);
        }}
        className="font-mono text-xs"
      />
      {parseError ? (
        <p className="mt-2 text-xs text-destructive">{parseError}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Change note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="max-w-xs text-xs"
        />
        <Button
          size="sm"
          onClick={async () => {
            try {
              const parsed = JSON.parse(text) as unknown;
              await onSave(parsed, note.trim() || undefined);
              setNote("");
            } catch (err) {
              setParseError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <Save className="mr-1 h-3.5 w-3.5" /> Save override
        </Button>
      </div>
    </div>
  );
}
