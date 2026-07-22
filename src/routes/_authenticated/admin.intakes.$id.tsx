import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getIntakeDetail,
  requestClarification,
  approvePosition,
  activatePosition,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/intakes/$id")({
  head: () => ({
    meta: [
      { title: "Intake detail — Admin" },
      { name: "description", content: "Review intake and position." },
      { property: "og:title", content: "Intake detail — Admin" },
      { property: "og:description", content: "Review intake and position." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntakeDetail,
});

function IntakeDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const detail = useServerFn(getIntakeDetail);
  const req = useServerFn(requestClarification);
  const approve = useServerFn(approvePosition);
  const activate = useServerFn(activatePosition);
  const [visibility, setVisibility] = useState<"public" | "private">("private");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "intake", id],
    queryFn: () => detail({ data: { intakeId: id } }),
  });

  const mutate = (fn: () => Promise<any>, label: string) => async () => {
    try {
      await fn();
      toast.success(label);
      qc.invalidateQueries({ queryKey: ["admin", "intake", id] });
      qc.invalidateQueries({ queryKey: ["admin", "intakes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-6 text-sm text-destructive">Failed to load</div>;
  if (!data?.intake) return <div className="p-6 text-sm">Not found</div>;

  const { intake, org, position, questions } = data as any;
  const payload = intake.payload as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      <Link to="/admin/intakes" className="text-sm text-muted-foreground hover:underline">
        ← All intakes
      </Link>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{payload.roleTitle as string}</h1>
        <Badge>{intake.status}</Badge>
        {position && <Badge variant="secondary">position: {position.status}</Badge>}
      </div>

      <Card className="p-4 space-y-2">
        <h2 className="font-medium">Submitter</h2>
        <dl className="text-sm grid grid-cols-3 gap-y-1">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="col-span-2">
            {payload.firstName as string} {payload.lastName as string}
          </dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="col-span-2">{payload.workEmail as string}</dd>
          <dt className="text-muted-foreground">Company</dt>
          <dd className="col-span-2">
            {payload.companyName as string} {org && <span className="text-muted-foreground">(org {org.id.slice(0, 8)})</span>}
          </dd>
          <dt className="text-muted-foreground">Trace</dt>
          <dd className="col-span-2 font-mono text-xs">{intake.trace_id}</dd>
          {intake.error && (
            <>
              <dt className="text-muted-foreground">Error</dt>
              <dd className="col-span-2 text-destructive text-xs">{intake.error}</dd>
            </>
          )}
        </dl>
      </Card>

      {position ? (
        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Position</h2>
          <dl className="text-sm grid grid-cols-3 gap-y-1">
            <dt className="text-muted-foreground">Work model</dt>
            <dd className="col-span-2">{position.work_model}</dd>
            <dt className="text-muted-foreground">Must-have skills</dt>
            <dd className="col-span-2">
              {(position.must_have_skills ?? []).join(", ") || "—"}
            </dd>
            <dt className="text-muted-foreground">Job description</dt>
            <dd className="col-span-2 whitespace-pre-wrap">{position.job_description || "—"}</dd>
            <dt className="text-muted-foreground">Compensation</dt>
            <dd className="col-span-2">{position.compensation || "—"}</dd>
            <dt className="text-muted-foreground">Countries</dt>
            <dd className="col-span-2">{(position.target_countries ?? []).join(", ") || "—"}</dd>
          </dl>

          <div className="border-t pt-3 space-y-2">
            <h3 className="font-medium text-sm">Screening questions</h3>
            <ol className="list-decimal list-inside text-sm space-y-1">
              {questions.map((q: any) => (
                <li key={q.id}>
                  {q.prompt}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({q.kind}
                    {q.required ? " · required" : ""})
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="border-t pt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Visibility on activate:</span>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={mutate(
                () => req({ data: { positionId: position.id } }),
                "Marked as needs clarification",
              )}
            >
              Request clarification
            </Button>
            <Button
              variant="outline"
              onClick={mutate(
                () => approve({ data: { positionId: position.id, visibility } }),
                "Position approved",
              )}
            >
              Approve
            </Button>
            <Button
              onClick={mutate(
                () => activate({ data: { positionId: position.id, visibility } }),
                "Position activated",
              )}
            >
              Activate
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 space-y-2 border-dashed">
          <h2 className="font-medium">Preparation in progress</h2>
          <p className="text-sm text-muted-foreground">
            The intake is safely stored but the position isn't ready yet. The client can safely retry
            submission — no duplicates will be created.
          </p>
        </Card>
      )}
    </div>
  );
}
