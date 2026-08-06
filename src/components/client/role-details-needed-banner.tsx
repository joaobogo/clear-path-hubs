import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import type { IncompleteRole } from "@/lib/position-readiness.functions";

/**
 * First thing a client sees when a role they submitted can't be approved yet.
 * Names the role and the exact missing details — no "incomplete" with no detail.
 */
export function RoleDetailsNeededBanner({ roles }: { roles: IncompleteRole[] }) {
  if (roles.length === 0) return null;

  return (
    <div
      data-testid="role-details-needed"
      className="rounded-xl border border-amber-500/40 bg-amber-500/8 p-4"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
        {roles.length === 1
          ? "One role needs a few more details before we can approve it"
          : `${roles.length} roles need a few more details before we can approve them`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Sourcing starts as soon as these are in. Everything else in your workspace is ready to use.
      </p>

      <ul className="mt-4 space-y-3">
        {roles.map((role) => (
          <li key={role.positionId} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{role.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Still missing:{" "}
                  {role.gaps.slice(0, 4).map((g) => g.label).join(", ")}
                  {role.gaps.length > 4 ? ` and ${role.gaps.length - 4} more` : ""}.
                </p>
              </div>
              <Link
                to="/client/positions/$id/edit"
                params={{ id: role.positionId }}
                search={{ step: role.gaps[0]?.step }}
                className="shrink-0 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
              >
                Complete the brief
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
