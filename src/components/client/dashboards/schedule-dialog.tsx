import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import {
  listDashboardDeliveries,
  saveDashboardDelivery,
  stopDashboardDelivery,
} from "@/lib/dashboards.functions";
import { QueryErrorCard } from "@/components/client/query-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toastError } from "@/lib/toast-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ScheduleDialog({ orgId, dashboardId }: { orgId: string; dashboardId: string | null }) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveDashboardDelivery);
  const stopFn = useServerFn(stopDashboardDelivery);
  const listFn = useServerFn(listDashboardDeliveries);

  const deliveriesQuery = useQuery({
    queryKey: ["dashboard-deliveries", orgId],
    queryFn: () => listFn({ data: { orgId } }),
    enabled: open,
  });
  const { data } = deliveriesQuery;

  const create = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          orgId,
          dashboardId: dashboardId!,
          format,
          cadence: "weekly" as const,
          recipients: recipients
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (res) => {
      if ("error" in res) return toast.error(res.error);
      toast.success("Scheduled. First send lands Monday morning.");
      setRecipients("");
      queryClient.invalidateQueries({ queryKey: ["dashboard-deliveries", orgId] });
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't create. Nothing was saved — please try again." }),
  });

  const stop = useMutation({
    mutationFn: (id: string) => stopFn({ data: { orgId, id } }),
    onSuccess: () => {
      toast.success("Schedule stopped.");
      queryClient.invalidateQueries({ queryKey: ["dashboard-deliveries", orgId] });
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't stop. Nothing was saved — please try again." }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!dashboardId}>
          <CalendarClock className="mr-1 h-3.5 w-3.5" /> Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send this dashboard every Monday</DialogTitle>
          <DialogDescription>
            We email the saved layout at 07:00 UTC each Monday. Stop it any time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="recips">Recipients</Label>
            <Input
              id="recips"
              placeholder="you@company.com, cfo@company.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as "pdf" | "csv")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {deliveriesQuery.isError && (
            <QueryErrorCard
              compact
              error={deliveriesQuery.error}
              onRetry={() => deliveriesQuery.refetch()}
              retrying={deliveriesQuery.isFetching}
            />
          )}
          {!deliveriesQuery.isError && !!data?.deliveries.length && (
            <ul className="space-y-2 border-t pt-3">
              {data.deliveries
                .filter((d) => d.active)
                .map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {d.format.toUpperCase()} → {d.recipients.join(", ")}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => stop.mutate(d.id)}>
                      Stop
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !recipients.trim() || !dashboardId}
          >
            Schedule it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
