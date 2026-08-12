import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import type { IncompleteRole } from "@/lib/position-readiness.functions";

/**
 * Optional polish, not a blocker. Intake stays light on purpose: anything still
 * open is something we go over together on the call. This names the details so
 * a client who wants to fill them in now can, and nothing waits on them.
 */
export function RoleDetailsNeededBanner({ roles }: { roles: IncompleteRole[] }) {
  if (roles.length === 0) return null;

  return (
    <div
      data-testid="role-details-needed"
      className="rounded-xl border border-border bg-muted/40 p-4"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        {roles.length === 1
          ? "One role can be sharpened with a few optional details"
          : `${roles.length} roles can be sharpened with a few optional details`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Nothing is blocked — your workspace is live and sourcing is already moving. Add these now if
        you like, or we go over them together on the call.
      </p>

      <ul className="mt-4 space-y-3">
        {roles.map((role) => (
          <li key={role.positionId} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{role.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Optional to add:{" "}
                  {role.gaps.slice(0, 4).map((g) => g.label).join(", ")}
                  {role.gaps.length > 4 ? ` and ${role.gaps.length - 4} more` : ""}.
                </p>
              </div>
              <Link
                to="/client/positions/$id/edit"
                params={{ id: role.positionId }}
                search={{ step: role.gaps[0]?.step }}
                className="shrink-0 whitespace-nowrap rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:bg-muted"
              >
                Add details
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
