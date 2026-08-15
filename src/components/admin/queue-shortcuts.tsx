import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { loadWorkQueues } from "@/lib/admin-ops.server";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkQueueRow } from "./work-queue-row";
import { Button } from "@/components/ui/button";

export function QueueShortcuts({ includeTest }: { includeTest: boolean }) {
  const load = useServerFn(loadWorkQueues);
  const { data: queues, isLoading } = useQuery({
    queryKey: ["admin-work-queues", includeTest],
    queryFn: () => load({ data: { includeTest } }),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {queues?.map((q) => (
        <Card key={q.key} className="flex flex-col">
          <div className="flex items-center justify-between border-b p-3 px-4">
            <h3 className="text-sm font-semibold">{q.label}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
              {q.count}
            </span>
          </div>
          <div className="flex-1">
            <ul className="divide-y">
              {q.items.slice(0, 3).map((item) => (
                <WorkQueueRow key={item.id} item={item} secondary_badge={q.secondary_badge} />
              ))}
              {q.items.length === 0 && (
                <li className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No items in this queue
                </li>
              )}
            </ul>
          </div>
          {q.see_all && (
            <div className="border-t p-2">
              <Button asChild variant="ghost" className="w-full justify-start text-xs h-8">
                <Link to={q.see_all.to}>See all {q.label}...</Link>
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
