import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getServiceExpectations } from "@/lib/client-service-expectations.functions";
import type { ServiceExpectations } from "@/lib/client-service-expectations";
import { PLAN_BEING_SET_UP } from "@/lib/client-service-expectations";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/**
 * The table a client can point to when a delay feels like a failure: what we
 * committed to, and how we have actually performed where that is measurable.
 * Every figure states its sample size; nothing appears that the plan does not
 * include.
 */
export function ServiceExpectationsTable({ orgId }: { orgId: string }) {
  const fn = useServerFn(getServiceExpectations);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["client-service-expectations", orgId],
    queryFn: () => fn({ data: { orgId } }),
    placeholderData: (prev) => prev,
  });

  if (isLoading && !data) {
    return (
      <section aria-label="Service commitments" className="rounded-xl border bg-card p-4">
        <Skeleton className="h-5 w-48" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-3 gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError && !data) {
    return (
      <section
        aria-label="Service commitments"
        role="alert"
        className="rounded-xl border bg-card p-4"
      >
        <h2 className="text-base font-semibold">Service commitments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We could not load your commitments.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
          Retry
        </Button>
      </section>
    );
  }

  if (!data) return null;
  const expectations: ServiceExpectations = data;

  if (!expectations.hasPlan) {
    return (
      <section aria-label="Service commitments" className="rounded-xl border bg-card p-4">
        <h2 className="text-base font-semibold">Service commitments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {PLAN_BEING_SET_UP}. Your recruiter confirms these terms with you and they appear here.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Service commitments" className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Service commitments</h2>
        {expectations.planLabel ? (
          <span className="text-xs text-muted-foreground">
            {expectations.planLabel}
            {isFetching ? " · refreshing" : ""}
          </span>
        ) : null}
      </div>

      <div className="taas-stack-scroll mt-4 overflow-x-auto">
        <table className="taas-stack-table w-full text-sm">
          <caption className="sr-only">
            Your stored service commitments and measured performance against them
          </caption>
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">
                Commitment
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                What your plan says
              </th>
              <th scope="col" className="py-2 font-medium">
                How we have performed
              </th>
            </tr>
          </thead>
          <tbody>
            {expectations.rows.map((row) => (
              <tr key={row.key} className="border-b last:border-0 align-top">
                <th scope="row" data-label="Commitment" className="py-3 pr-4 text-left font-medium">
                  {row.commitment}
                </th>
                <td data-label="Your plan" className="py-3 pr-4 text-muted-foreground">{row.promised}</td>
                <td data-label="Performance" className="py-3">
                  {row.performance ? (
                    <>
                      <span>{row.performance}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {row.sampleNote}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{row.sampleNote}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{expectations.footnote}</p>
    </section>
  );
}
