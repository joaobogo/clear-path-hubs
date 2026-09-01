import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedTextInput } from "@/hooks/use-debounced-text-input";
import { REASON_LABELS, type SilverReason } from "@/lib/talent-memory.functions";
import { plural, pluralWord } from "@/lib/format/plural";

export type PoolFilterState = {
  q: string;
  reason: string;
  consent: string;
  status: string;
  skill: string;
};

/** Consent decides who may be contacted, so it is a first-class filter here. */
const CONSENT_OPTIONS = [
  { key: "all", label: "Any consent" },
  { key: "granted", label: "Consent granted" },
  { key: "pending", label: "Consent pending" },
  { key: "declined", label: "Consent declined" },
  { key: "withdrawn", label: "Consent withdrawn" },
];

const STATUS_OPTIONS = [
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "Active and archived" },
];

export function PoolFilters({
  filters,
  setF,
  skillOptions,
  resultCount,
  totalCount,
}: {
  filters: PoolFilterState;
  setF: (patch: Partial<PoolFilterState>) => void;
  skillOptions: string[];
  resultCount: number;
  totalCount: number;
}) {
  // Keystrokes stay local; only the applied term is debounced.
  const qInput = useDebouncedTextInput(filters.q, (q) => setF({ q }));

  const chips = [
    filters.q && { key: "q" as const, label: `Search: ${filters.q}`, reset: "" },
    filters.reason !== "all" && {
      key: "reason" as const,
      label: REASON_LABELS[filters.reason as SilverReason] ?? filters.reason,
      reset: "all",
    },
    filters.consent !== "all" && {
      key: "consent" as const,
      label: CONSENT_OPTIONS.find((c) => c.key === filters.consent)?.label,
      reset: "all",
    },
    filters.skill && { key: "skill" as const, label: `Skill: ${filters.skill}`, reset: "" },
    filters.status !== "active" && {
      key: "status" as const,
      label: STATUS_OPTIONS.find((s) => s.key === filters.status)?.label,
      reset: "active",
    },
  ].filter(Boolean) as { key: keyof PoolFilterState; label: string; reset: string }[];

  const clearAll = () =>
    setF({ q: "", reason: "all", consent: "all", status: "active", skill: "" });

  return (
    <section aria-label="Search and filters" className="mb-6 rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input
          className="md:flex-1 md:min-w-[14rem]"
          placeholder="Search by name, skill, role, notes…"
          value={qInput.value}
          onChange={(e) => qInput.onChange(e.target.value)}
          aria-label="Search talent pool"
        />
        <Select value={filters.reason} onValueChange={(v) => setF({ reason: v })}>
          <SelectTrigger className="md:w-52" aria-label="Reason not selected">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any reason</SelectItem>
            {(Object.keys(REASON_LABELS) as SilverReason[]).map((k) => (
              <SelectItem key={k} value={k}>
                {REASON_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.consent} onValueChange={(v) => setF({ consent: v })}>
          <SelectTrigger className="md:w-48" aria-label="Consent status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONSENT_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {skillOptions.length > 0 && (
          <Select
            value={filters.skill || "all"}
            onValueChange={(v) => setF({ skill: v === "all" ? "" : v })}
          >
            <SelectTrigger className="md:w-44" aria-label="Skill">
              <SelectValue placeholder="Any skill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any skill</SelectItem>
              {skillOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filters.status} onValueChange={(v) => setF({ status: v })}>
          <SelectTrigger className="md:w-44" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground" data-testid="pool-result-count">
          {resultCount !== totalCount
            ? `${resultCount} of ${totalCount} ${pluralWord(totalCount, "candidate")}`
            : plural(resultCount, "candidate")}
        </span>
        {chips.map((c) => (
          <span
            key={c.key}
            className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
          >
            {c.label}
            <button
              onClick={() => setF({ [c.key]: c.reset } as Partial<PoolFilterState>)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${c.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {chips.length > 0 && (
          <Button size="sm" variant="ghost" onClick={clearAll}>
            Clear all
          </Button>
        )}
      </div>
    </section>
  );
}
