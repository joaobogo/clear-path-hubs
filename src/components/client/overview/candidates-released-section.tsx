// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";
import { QueryErrorCard } from "@/components/client/query-error";
import { CandidateCard } from "@/components/client/candidate-card";
import { SectionHeader, EmptyBlock } from "./section-primitives";

export function CandidatesReleasedSection({
  orgSearch,
  selectedRole,
  data,
  isFetching,
  isError,
  error,
  refetch,
  latest,
}: {
  orgSearch: string | null;
  selectedRole: string;
  data: unknown;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  latest: Any[];
}) {
  return (
    <section aria-labelledby="open-first-heading" className="space-y-3">
      <SectionHeader
        id="open-first-heading"
        icon={<Sparkles className="h-4 w-4 text-primary" />}
        title="Candidates released to you"
        action={
          <Link
            to="/client/candidates"
            search={
              {
                ...(orgSearch ? { org: orgSearch } : {}),
                ...(selectedRole ? { position: selectedRole } : {}),
              } as never
            }
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            All candidates <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      {!data && isFetching ? (
        <div className="grid gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      ) : isError && !data ? (
        <QueryErrorCard
          title="We couldn't load your candidates"
          error={error}
          onRetry={() => refetch()}
          retrying={isFetching}
          compact
        />
      ) : latest.length === 0 ? (
        <EmptyBlock text="No candidates released to you yet. They appear here the moment they're approved for this role." />
      ) : (
        <div className="grid gap-3">
          {latest.slice(0, 3).map((c: Any) => (
            <CandidateCard key={c.match_id} candidate={c} />
          ))}
        </div>
      )}
    </section>
  );
}
