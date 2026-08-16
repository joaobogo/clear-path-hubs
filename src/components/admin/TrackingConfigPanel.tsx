import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TRACKER_CATEGORY, verifyTrackers } from "@/lib/tracking/pixels";
import { readConsent } from "@/lib/tracking/consent";

/**
 * Tracking configuration panel (TF-013 / TF-014).
 *
 * Makes the state of every tag visible: whether an identifier is configured,
 * which consent category gates it, and whether it is actually running in this
 * browser session. "Not configured" means the environment variable below is
 * empty — the tag ships dormant until an identifier is supplied.
 */
const ENV_VAR: Record<string, string> = {
  ga4: "VITE_GA_MEASUREMENT_ID",
  rb2b: "VITE_RB2B_ID",
  meta: "VITE_META_PIXEL_ID",
  linkedin: "VITE_LINKEDIN_PARTNER_ID",
  clarity: "VITE_CLARITY_ID",
  hotjar: "VITE_HOTJAR_ID",
};

const LABEL: Record<string, string> = {
  ga4: "Google Analytics 4",
  rb2b: "RB2B visitor identification",
  meta: "Meta pixel",
  linkedin: "LinkedIn insight tag",
  clarity: "Microsoft Clarity",
  hotjar: "Hotjar",
};

export function TrackingConfigPanel() {
  const [rows, setRows] = useState<
    Array<{ key: string; status: string; id: string | null; detail: string }>
  >([]);
  const [consent, setConsent] = useState<string>("no decision recorded");

  useEffect(() => {
    const statuses = verifyTrackers();
    setRows(
      Object.entries(statuses).map(([key, v]) => ({
        key,
        status: v.status,
        id: v.id,
        detail: v.detail,
      })),
    );
    const decision = readConsent();
    setConsent(
      decision
        ? `analytics ${decision.analytics ? "allowed" : "declined"}, marketing ${
            decision.marketing ? "allowed" : "declined"
          }`
        : "no decision recorded",
    );
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tracking configuration</CardTitle>
        <p className="text-xs text-muted-foreground">
          Trackers are only injected once their consent category is granted.
          GA4 boots restricted and upgrades if allowed. Consent recorded in this
          browser: {consent}.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--brand-radius-md)] border border-border/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{LABEL[r.key] ?? r.key}</p>
              <p className="truncate text-xs text-muted-foreground">
                {TRACKER_CATEGORY[r.key as keyof typeof TRACKER_CATEGORY]} category ·{" "}
                {r.id ? `id ${r.id}` : ENV_VAR[r.key]} · {r.detail}
              </p>
            </div>
            <Badge
              variant={
                r.status === "loaded"
                  ? "default"
                  : r.status === "missing-config"
                    ? "outline"
                    : "secondary"
              }
            >
              {r.status === "missing-config" ? "not configured" : r.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
