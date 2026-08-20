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
import { ChevronDown, RefreshCw, RotateCcw, Save } from "lucide-react";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

export const BUSINESS_RULES_QUERY = {
  queryKey: ["business-rules-overrides"] as const,
  queryFn: () => listBusinessRuleOverrides(),
};

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

/** Human labels + one-line explanations for each config key. */
const RULE_META: Record<(typeof TOP_KEYS)[number], { label: string; help: string }> = {
  delivery: { label: "Delivery promises", help: "Shortlist turnaround and delivery commitments shown to clients." },
  retention: { label: "Data retention", help: "How long candidate documents and records are kept." },
  packages: { label: "Service packages", help: "Package names, seat counts and inclusions used in proposals." },
  subscriptions: { label: "Subscription plans", help: "Plan tiers and monthly prices used across pricing surfaces." },
  annualDiscountLabel: { label: "Annual discount label", help: "The wording used when annual billing is presented." },
  scoring: { label: "Scoring thresholds", help: "Score bands and gates that decide shortlist eligibility." },
  ctas: { label: "Call-to-action copy", help: "Button and link wording used on marketing pages." },
  contact: { label: "Contact details", help: "Public email, phone and address details." },
  legal: { label: "Legal entity details", help: "Company name and registration details used in legal copy." },
};

/** Compact, human-readable preview of a config value. */
function summarizeValue(value: unknown): string {
  if (value === null || value === undefined) return "Not set";
  if (typeof value === "string") return value.length > 90 ? `${value.slice(0, 90)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) =>
      typeof v === "object" && v !== null
        ? String((v as Record<string, unknown>)["name"] ?? (v as Record<string, unknown>)["label"] ?? "item")
        : String(v),
    );
    const joined = parts.join(", ");
    return joined.length > 110 ? `${parts.length} entries: ${joined.slice(0, 110)}…` : `${parts.length} entries: ${joined}`;
  }
  const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => {
    const label = k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
    const shown =
      v === null || v === undefined
        ? "not set"
        : typeof v === "object"
          ? Array.isArray(v)
            ? `${v.length} entries`
            : `${Object.keys(v as object).length} fields`
          : String(v);
    return `${label}: ${shown}`;
  });
  const joined = entries.join(" · ");
  return joined.length > 140 ? `${joined.slice(0, 140)}…` : joined;
}

export function BusinessRulesPanel() {
  const { data } = useSuspenseQuery(BUSINESS_RULES_QUERY);
  const qc = useQueryClient();
  const save = useServerFn(setBusinessRuleOverride);
  const reset = useServerFn(clearBusinessRuleOverride);

  const overridesByKey = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const row of data.overrides) map.set(row.key, row.value);
    return map;
  }, [data.overrides]);

  const defaultsByKey = data.defaults as Record<string, unknown>;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["business-rules-overrides"] });
    await qc.invalidateQueries({ queryKey: ["business-rules"] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Rule</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Current value</th>
              <th className="px-3 py-2 font-medium sr-only">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {TOP_KEYS.map((key) => (
              <RuleRow
                key={key}
                ruleKey={key}
                defaultValue={defaultsByKey[key]}
                overrideValue={overridesByKey.get(key)}
                onSave={async (value, note) => {
                  try {
                    await save({ data: { key, value, note } });
                    toast.success(`Saved ${RULE_META[key].label}`);
                    await refresh();
                  } catch (err) {
                    toast.error(`That value isn't valid for ${RULE_META[key].label}`, {
                      description: err instanceof Error ? err.message : String(err),
                    });
                  }
                }}
                onReset={async () => {
                  try {
                    await reset({ data: { key } });
                    toast.success(`${RULE_META[key].label} restored to the default`);
                    await refresh();
                  } catch (err) {
                    toast.error("Could not restore the default", {
                      description: err instanceof Error ? err.message : String(err),
                    });
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Recent rule changes</h3>
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
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
                  <div className="flex items-center justify-between gap-3">
                    <span>{RULE_META[row.key as (typeof TOP_KEYS)[number]]?.label ?? row.key}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.action === "clear" ? "Restored to default" : "Override saved"} ·{" "}
                      {new Date(row.created_at).toLocaleString(APP_LOCALE, {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                        timeZone: WORKSPACE_TIMEZONE,
                      })}
                    </span>
                  </div>
                  {row.note ? <p className="mt-1 text-xs text-muted-foreground">{row.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function RuleRow(props: {
  ruleKey: (typeof TOP_KEYS)[number];
  defaultValue: unknown;
  overrideValue: unknown;
  onSave: (value: unknown, note?: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const { ruleKey, defaultValue, overrideValue, onSave, onReset } = props;
  const meta = RULE_META[ruleKey];
  const isOverridden = overrideValue !== undefined;
  const effective = isOverridden ? overrideValue : defaultValue;
  const initial = JSON.stringify(effective ?? null, null, 2);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial);
  const [note, setNote] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  return (
    <>
      <tr className="align-top hover:bg-muted/30">
        <td className="px-3 py-2">
          <div className="font-medium">{meta.label}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{meta.help}</div>
        </td>
        <td className="px-3 py-2">
          {isOverridden ? (
            <Badge variant="secondary" className="text-[10px]">Override active</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Default</Badge>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{summarizeValue(effective)}</td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          {isOverridden ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore default
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => {
              setText(initial);
              setParseError(null);
              setOpen((v) => !v);
            }}
          >
            {open ? "Close" : "Edit"}
            <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </td>
      </tr>
      {open ? (
        <tr className="bg-muted/20">
          <td colSpan={4} className="px-3 py-3">
            <Textarea
              rows={Math.min(20, initial.split("\n").length + 2)}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setParseError(null);
              }}
              className="font-mono text-xs"
              aria-label={`${meta.label} value`}
            />
            {parseError ? <p className="mt-2 text-xs text-destructive">{parseError}</p> : null}
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
                    setOpen(false);
                  } catch (err) {
                    setParseError(
                      err instanceof Error && err.name === "SyntaxError"
                        ? "That isn't valid JSON — check for a missing comma or quote."
                        : err instanceof Error
                          ? err.message
                          : String(err),
                    );
                  }
                }}
              >
                <Save className="mr-1 h-3.5 w-3.5" /> Save override
              </Button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
