// OrgSwitcher — lets a user with memberships in multiple client organizations
// switch between them. On switch we (a) clear the react-query cache so no
// stale previous-organization rows leak into the new context, then
// (b) navigate to /client with the new `?org=` search param, which the client
// layout's loader re-runs to hydrate the new organization context.

import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type OrgSwitcherOrg = { id: string; name: string; role: string };

export function OrgSwitcher({
  activeOrgId,
  organizations,
}: {
  activeOrgId: string;
  organizations: OrgSwitcherOrg[];
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Hide when there's nothing to switch between.
  if (organizations.length < 2) return null;

  const active = organizations.find((o) => o.id === activeOrgId);

  const switchTo = async (orgId: string) => {
    if (orgId === activeOrgId) return;
    // Cancel any in-flight queries and drop cached tenant-scoped data
    // (positions, candidates, messages, KPIs, notifications, search results).
    // Every subsequent query re-runs against the new org context.
    await qc.cancelQueries();
    qc.clear();
    navigate({ to: "/client", search: { org: orgId } });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left text-xs hover:bg-muted"
          aria-label="Switch organization"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium">
            {active?.name ?? "Select organization"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Your organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((o) => {
          const isActive = o.id === activeOrgId;
          return (
            <DropdownMenuItem
              key={o.id}
              onSelect={(e) => {
                e.preventDefault();
                void switchTo(o.id);
              }}
              className="flex items-start gap-2"
            >
              <Check
                className={
                  isActive
                    ? "mt-0.5 h-3.5 w-3.5 text-primary"
                    : "mt-0.5 h-3.5 w-3.5 text-transparent"
                }
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{o.name}</div>
                <div className="truncate text-[11px] capitalize text-muted-foreground">
                  {o.role.replace(/_/g, " ")}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
