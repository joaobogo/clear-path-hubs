import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { acknowledgeBreach } from "@/lib/admin-sla-breach.functions";
import type { SlaBreachList, SlaBreachRow } from "@/lib/admin-sla-breach.server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  data: SlaBreachList | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  queryKey: readonly unknown[];
};

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: SlaBreachRow[]): string {
  const header = [
    "client",
    "position",
    "commitment",
    "target",
    "actual_to_date",
    "days_over",
    "owner",
    "first_breach_at",
    "acknowledged_at",
    "acknowledged_by",
    "acknowledgement_note",
    "basis",
  ];
  const lines = rows.map((r) =>
    [
      r.client_name,
      r.position_title,
      r.metric_label,
      r.target_label,
      r.actual_label,
      r.days_over,
      r.owner_name,
      r.first_breach_at,
      r.acknowledged?.at ?? "",
      r.acknowledged?.by ?? "",
      r.acknowledged?.note ?? "",
      r.basis,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function SlaBreachPanel({ data, isLoading, isError, error, onRetry, queryKey }: Props) {
  const queryClient = useQueryClient();
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const rows = data?.rows ?? [];
  const unacknowledged = useMemo(() => rows.filter((r) => !r.acknowledged).length, [rows]);

  const ack = useMutation({
    mutationFn: (vars: { commitmentId: string; metric: SlaBreachRow["metric"]; note: string }) =>
      acknowledgeBreach({ data: vars }),
    onSuccess: () => {
      toast.success("Breach acknowledged");
      setOpenRow(null);
      setNote("");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sla-breaches-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Breach list could not load</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Something went wrong reading commitments."}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Breached commitments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">No commitments breached</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {data?.commitments_monitored ?? 0} commitment
            {(data?.commitments_monitored ?? 0) === 1 ? "" : "s"} monitored, all inside target.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-base">Breached commitments</CardTitle>
          <p className="text-xs text-muted-foreground">
            {rows.length} breach{rows.length === 1 ? "" : "es"} across{" "}
            {data?.commitments_monitored ?? 0} monitored commitments · {unacknowledged} unacknowledged
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Commitment</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Actual to date</TableHead>
              <TableHead className="text-right">Days over</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>First breach</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const muted = Boolean(r.acknowledged);
              return (
                <>
                  <TableRow
                    key={r.id}
                    className={muted ? "opacity-70" : "bg-destructive/5"}
                  >
                    <TableCell className="font-medium">{r.client_name}</TableCell>
                    <TableCell>
                      <Link
                        to="/admin/positions/$id"
                        params={{ id: r.position_id }}
                        className="hover:underline"
                      >
                        {r.position_title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.basis}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={muted ? "outline" : "destructive"}>{r.metric_label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.target_label}</TableCell>
                    <TableCell className="text-right">{r.actual_label}</TableCell>
                    <TableCell className="text-right font-semibold">{r.days_over}</TableCell>
                    <TableCell>{r.owner_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.first_breach_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.acknowledged ? (
                        <span className="text-xs text-muted-foreground">
                          Acknowledged by {r.acknowledged.by}
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOpenRow(openRow === r.id ? null : r.id);
                            setNote("");
                          }}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {r.acknowledged ? (
                    <TableRow key={`${r.id}-ack`} className="opacity-70">
                      <TableCell colSpan={9} className="pt-0 text-xs text-muted-foreground">
                        {new Date(r.acknowledged.at).toLocaleString()} — {r.acknowledged.note}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {openRow === r.id ? (
                    <TableRow key={`${r.id}-form`}>
                      <TableCell colSpan={9}>
                        <div className="space-y-2">
                          <label
                            htmlFor={`note-${r.id}`}
                            className="text-xs font-medium text-muted-foreground"
                          >
                            Acknowledgement note (required)
                          </label>
                          <Textarea
                            id={`note-${r.id}`}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="What happened, and what happens next?"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={note.trim().length < 5 || ack.isPending}
                              onClick={() =>
                                ack.mutate({
                                  commitmentId: r.commitment_id,
                                  metric: r.metric,
                                  note: note.trim(),
                                })
                              }
                            >
                              {ack.isPending ? "Saving..." : "Save acknowledgement"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setOpenRow(null);
                                setNote("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
