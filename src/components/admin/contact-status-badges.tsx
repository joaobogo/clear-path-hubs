/**
 * Contact-status mirror for admin surfaces.
 *
 * This is not a gate. Enforcement lives in the database
 * (`outreach_contact_allowed` plus the BEFORE INSERT trigger on
 * `outreach_touches`); these badges only explain what the database already
 * decided so nobody messages a person who asked not to be contacted. A failed
 * read renders as "Contact status unavailable" and reads as blocked — the same
 * fail-closed posture the server takes.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { getContactStatus } from "@/lib/outreach-suppression.functions";
import { BLOCK_EXPLANATION, BLOCK_LABEL } from "@/lib/outreach-suppression";
import type { ContactStatus } from "@/lib/outreach-suppression";
import { Badge } from "@/components/ui/badge";
import { PanelState } from "@/components/admin/panel-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ContactStatusBadges({
  organizationId,
  candidateProfileId,
  className,
}: {
  organizationId: string | null | undefined;
  candidateProfileId: string | null | undefined;
  className?: string;
}) {
  const load = useServerFn(getContactStatus);
  const enabled = Boolean(organizationId && candidateProfileId);

  const query = useQuery({
    queryKey: ["admin", "contact-status", organizationId, candidateProfileId],
    queryFn: () =>
      load({
        data: {
          organization_id: organizationId as string,
          candidate_profile_id: candidateProfileId as string,
        },
      }),
    enabled,
    staleTime: 30_000,
  });

  if (!enabled) return null;

  return (
    <PanelState
      query={query}
      skeletonRows={1}
      className="h-6 w-40"
    >
      <ContactStatusBadgesLoaded data={query.data as ContactStatus} className={className} />
    </PanelState>
  );
}

function ContactStatusBadgesLoaded({ data, className }: { data: ContactStatus; className?: string }) {
  const status = data;
  const blocked = status.verdicts.filter((v) => !v.allowed);

  return (
    <TooltipProvider>
      <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
        {status.suppressed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15">
                <ShieldAlert className="mr-1 h-3 w-3" />
                {status.fullyBlocked ? "Do not contact" : "Opted out"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {BLOCK_EXPLANATION.opted_out}
            </TooltipContent>
          </Tooltip>
        ) : blocked.length === 0 ? (
          <Badge variant="outline" className="text-muted-foreground">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Contactable on every channel
          </Badge>
        ) : null}

        {blocked.map((v) => (
          <Tooltip key={v.channel}>
            <TooltipTrigger asChild>
              <Badge variant="outline">
                {v.label}: {v.reasonLabel ?? BLOCK_LABEL.unknown}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {v.explanation ?? BLOCK_EXPLANATION.unknown}
            </TooltipContent>
          </Tooltip>
        ))}

        {status.exceptions.some((e) => !e.revoked_at) ? (
          <Badge variant="secondary">Exception on record</Badge>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
