import { createFileRoute, useRouter } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientContext } from "@/lib/client-context.functions";
import { createWorkspacePosition } from "@/lib/client-positions.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { QueryErrorCard } from "@/components/client/query-error";
import { toastError } from "@/lib/toast-error";

/**
 * In-app role creation. A signed-in workspace never sees the public signup
 * wizard: this creates a draft in the current organization and hands the user
 * straight to the same edit wizard they use for any other role, so the draft
 * belongs to this workspace only.
 */
export const Route = createFileRoute("/_authenticated/client/positions/new")({
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.positions.new.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  head: () => ({
    meta: [
      { title: "New role · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewRolePage,
});

function NewRolePage() {
  const router = useRouter();
  const ctxFn = useServerFn(getClientContext);
  const createFn = useServerFn(createWorkspacePosition);
  const orgSearch = useClientOrgSearch();
  const [title, setTitle] = useState("");

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctxQuery.data?.active?.organization_id;
  const orgName = ctxQuery.data?.active?.name;

  const create = useMutation({
    mutationFn: (input: { orgId: string; title: string }) => createFn({ data: input }),
    onSuccess: (res) => {
      toast.success("Draft role created");
      void router.navigate({
        to: "/client/positions/$id/edit",
        params: { id: res.id },
        search: { step: undefined },
      });
    },
    onError: (e: unknown) =>
      toast.error(
        (e as Error).message?.replace(/^Error:\s*/, "") || "We could not create the role",
      ),
  });

  const valid = !!orgId && title.trim().length >= 2;

  // A failed workspace read must not look like an empty form that silently
  // refuses to submit: show the shared failure surface with a way out.
  if (ctxQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-xl p-6">
        <QueryErrorCard
          title="We couldn't open the role form"
          error={ctxQuery.error}
          onRetry={() => ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>New role</CardTitle>
          <CardDescription>
            {orgName
              ? `Creates a draft in ${orgName} and opens the role wizard. Nothing goes live until it passes the publish gate.`
              : "Creates a draft in your workspace and opens the role wizard."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-role-title">Role title</Label>
            <Input
              id="new-role-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Senior Backend Engineer"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid && !create.isPending) {
                  create.mutate({ orgId: orgId!, title: title.trim() });
                }
              }}
              data-qa-action="client-new-role-title"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => void router.navigate({ to: "/client/positions" })}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={!valid || create.isPending}
              onClick={() => create.mutate({ orgId: orgId!, title: title.trim() })}
              data-qa-action="client-new-role-submit"
            >
              {create.isPending ? "Creating…" : "Create role"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
