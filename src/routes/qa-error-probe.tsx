import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { qaBoomLoader, qaBoomAction } from "@/lib/qa-error-probe.functions";

// TEMPORARY QA probe route. Delete after verifying error boundaries.
export const Route = createFileRoute("/qa-error-probe")({
  loader: async ({ location }) => {
    if (location.search && (location.search as { mode?: string }).mode === "loader") {
      return await qaBoomLoader();
    }
    return { ok: true };
  },
  validateSearch: (s: Record<string, unknown>) => ({ mode: (s.mode as string) ?? "" }),
  errorComponent: makeRouteErrorComponent("public", "qa-error-probe"),
  notFoundComponent: makeRouteNotFoundComponent("public"),
  component: Probe,
});

function Probe() {
  const boom = useServerFn(qaBoomAction);
  const [msg, setMsg] = useState("idle");
  return (
    <div className="p-8">
      <h1>QA error probe</h1>
      <button
        type="button"
        data-testid="boom"
        onClick={async () => {
          try {
            await boom();
          } catch (e) {
            setMsg(`caught: ${(e as Error).message}`);
          }
        }}
      >
        Trigger action failure
      </button>
      <p data-testid="msg">{msg}</p>
    </div>
  );
}
