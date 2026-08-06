import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { requestWorkspaceAccess } from "@/lib/client/access-request.functions";
import {
  AREA_LABELS,
  AREA_ROLES,
  COLLABORATOR_ROLES,
  type WorkspaceArea,
} from "@/lib/collaborator-roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function requiredRoleLabel(area: WorkspaceArea): string {
  return AREA_ROLES[area].map((r) => COLLABORATOR_ROLES[r].label).join(" or ");
}

/**
 * A control a collaborator's role cannot use. It never dead-ends: it names the
 * role required and lets the person ask the workspace admins for it from where
 * they were blocked.
 */
export function RestrictedControl({
  area,
  orgId,
  className,
}: {
  area: WorkspaceArea;
  orgId: string | null | undefined;
  className?: string;
}) {
  const ask = useServerFn(requestWorkspaceAccess);
  const [asked, setAsked] = useState(false);
  const request = useMutation({
    mutationFn: () => ask({ data: { orgId: orgId!, area } }),
    onSuccess: (r: { notified: number; reason: string | null }) => {
      setAsked(true);
      if (r.reason === "no_admin") {
        toast.info("No workspace admin is active right now — message your TaaSFlow recruiter.");
        return;
      }
      toast.success("We asked your workspace admin for this access.");
    },
    onError: () =>
      toast.error("We couldn't send that request. Please try again."),
  });

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden />
          Needs the {requiredRoleLabel(area)} role
        </Badge>
        <Button
          size="sm"
          variant="outline"
          disabled={!orgId || request.isPending || asked}
          onClick={() => request.mutate()}
        >
          {asked ? "Request sent" : request.isPending ? "Asking…" : "Ask an admin for access"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {AREA_LABELS[area]} is limited to the {requiredRoleLabel(area)} role in this workspace.
      </p>
    </div>
  );
}
