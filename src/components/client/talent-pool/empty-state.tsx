import { Sparkles } from "lucide-react";

export function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 font-medium">
        {hasFilters ? "No candidates match those filters" : "No past candidates yet"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters
          ? "Try loosening a filter, clearing your query, or switching to a different pool."
          : "As candidates flow through your positions, they'll be searchable here forever."}
      </p>
    </div>
  );
}
