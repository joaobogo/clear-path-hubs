/**
 * Ageing severity for an SLA breach.
 *
 * Severity is derived only from how long the breach has been true and whether
 * a human has acknowledged it. Nothing is forecast, and an acknowledgement
 * never hides age — it only stops the escalation clock.
 */

export type BreachSeverity = "new" | "elevated" | "critical" | "acknowledged";

export const SEVERITY_LABEL: Record<BreachSeverity, string> = {
  new: "New breach",
  elevated: "Ageing",
  critical: "Critical",
  acknowledged: "Acknowledged",
};

/** Days over which a breach moves up a band. */
export const ELEVATED_AFTER_DAYS = 2;
export const CRITICAL_AFTER_DAYS = 5;

export function resolveBreachSeverity(args: {
  daysOver: number;
  acknowledged: boolean;
}): BreachSeverity {
  if (args.acknowledged) return "acknowledged";
  if (args.daysOver >= CRITICAL_AFTER_DAYS) return "critical";
  if (args.daysOver >= ELEVATED_AFTER_DAYS) return "elevated";
  return "new";
}

/** True when the breach should page its owner. */
export function shouldEscalate(args: { daysOver: number; acknowledged: boolean }): boolean {
  const severity = resolveBreachSeverity(args);
  return severity === "elevated" || severity === "critical";
}

export function severityTone(severity: BreachSeverity): "danger" | "warning" | "muted" {
  if (severity === "critical") return "danger";
  if (severity === "elevated") return "warning";
  return "muted";
}
