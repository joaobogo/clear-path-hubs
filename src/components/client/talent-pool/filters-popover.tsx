import { formatEnumLabel } from "@/lib/human-labels";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface TalentPoolSearchFilters {
  stage: string;
  position: string;
  seniority: string;
  geo: string;
  recency: number;
}

export function FiltersPopover({
  search,
  onChange,
  stages,
  seniorities,
  positions,
  filterCount,
}: {
  search: TalentPoolSearchFilters;
  onChange: (patch: Partial<TalentPoolSearchFilters>) => void;
  stages: string[];
  seniorities: string[];
  positions: { id: string; title: string }[];
  filterCount: number;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <Filter className="h-3.5 w-3.5" /> Filters
          {filterCount > 0 && (
            <Badge className="ml-1 h-4 px-1 text-[10px]">{filterCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Stage</label>
          <Select
            value={search.stage || "all"}
            onValueChange={(v) => onChange({ stage: v === "all" ? "" : v })}
          >
            <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any stage</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s} value={s}>{formatEnumLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <Select
            value={search.position || "all"}
            onValueChange={(v) => onChange({ position: v === "all" ? "" : v })}
          >
            <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="Any role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any role</SelectItem>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Seniority</label>
          <Select
            value={search.seniority || "all"}
            onValueChange={(v) => onChange({ seniority: v === "all" ? "" : v })}
          >
            <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any seniority</SelectItem>
              {seniorities.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Location</label>
          <Input
            className="mt-1 h-8"
            placeholder="e.g. Berlin, remote EU"
            value={search.geo}
            onChange={(e) => onChange({ geo: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Recency</label>
          <Select
            value={String(search.recency || 0)}
            onValueChange={(v) => onChange({ recency: Number(v) })}
          >
            <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any time</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="1095">Last 3 years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
