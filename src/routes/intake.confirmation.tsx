import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const searchSchema = z.object({
  intake: z.string().uuid().optional(),
  position: z.string().uuid().optional().or(z.literal("")),
  trace: z.string().optional(),
  status: z.enum(["created", "already_processed", "preparation"]).optional(),
});

export const Route = createFileRoute("/intake/confirmation")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Intake received — TaaSFlow" },
      { name: "description", content: "Your intake has been received. Here is what happens next." },
      { property: "og:title", content: "Intake received" },
      { property: "og:description", content: "We'll be in touch shortly." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Confirmation,
});

function Confirmation() {
  const { intake, position, trace, status } = Route.useSearch();
  const prep = status === "preparation";
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="max-w-lg w-full p-8 space-y-4">
        <div className="space-y-1">
          <Badge variant={prep ? "secondary" : "default"}>
            {status === "already_processed"
              ? "Already received"
              : prep
                ? "Setting things up"
                : "Received"}
          </Badge>
          <h1 className="text-2xl font-semibold">
            {prep ? "We received your intake" : "Thanks — your intake is in"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {prep
              ? "We saved your details safely. A TaaSFlow team member is finishing the setup and will follow up shortly."
              : "A TaaSFlow team member will review your role and reach out within one business day."}
          </p>
        </div>
        <dl className="text-sm border rounded-md divide-y">
          {intake && (
            <div className="p-3 grid grid-cols-3 gap-2">
              <dt className="text-muted-foreground">Intake ID</dt>
              <dd className="col-span-2 font-mono text-xs break-all">{intake}</dd>
            </div>
          )}
          {position && (
            <div className="p-3 grid grid-cols-3 gap-2">
              <dt className="text-muted-foreground">Position ID</dt>
              <dd className="col-span-2 font-mono text-xs break-all">{position}</dd>
            </div>
          )}
          {trace && (
            <div className="p-3 grid grid-cols-3 gap-2">
              <dt className="text-muted-foreground">Trace ID</dt>
              <dd className="col-span-2 font-mono text-xs break-all">{trace}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-muted-foreground">
          Refreshing this page is safe — we won't create duplicates.
        </p>
        <div className="flex gap-2">
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back home
          </Link>
          <a
            href="mailto:hello@taasflow.example"
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Talk to TaaSFlow
          </a>
        </div>
      </Card>
    </div>
  );
}
