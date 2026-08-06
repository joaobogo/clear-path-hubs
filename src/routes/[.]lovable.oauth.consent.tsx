import { createFileRoute, redirect } from "@tanstack/react-router";
import { makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormShell } from "@/components/marketing/form-shell";
import { oauthApi, type OAuthDetails } from "@/lib/lovable/oauth-consent-api";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase session lives in localStorage.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  head: () => ({ meta: [{ title: "Connect an app — TaaSFlow" }, { name: "robots", content: "noindex" }] }),
  component: Consent,
  errorComponent: ({ error }) => (
    <FormShell exitTo="/" exitLabel="Exit" width="sm">
      <Card className="w-full space-y-2 p-6">
        <h1 className="text-lg font-semibold">We couldn't load this request</h1>
        <p className="text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </Card>
    </FormShell>
  ),
  notFoundComponent: makeRouteNotFoundComponent("public"),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "this app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauthApi().approveAuthorization(authorization_id)
      : await oauthApi().denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect was returned. Please start the connection again.");
      return;
    }
    window.location.href = target;
  }

  return (
    <FormShell exitTo="/" exitLabel="Exit" width="sm">
      <Card className="w-full space-y-4 p-6">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold">Connect {clientName} to TaaSFlow</h1>
          <p className="text-sm text-muted-foreground">
            {clientName} will be able to read your roles, your shortlisted candidates and their
            screening summaries — as you, with the same access you already have.
          </p>
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
            Approve
          </Button>
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => decide(false)}
            className="flex-1"
          >
            Deny
          </Button>
        </div>
      </Card>
    </FormShell>
  );
}
