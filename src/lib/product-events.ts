// Canonical product-event catalogue (browser-safe: constants and pure maps only).
// Every product event is written to audit_events through the single emitter in
// product-events.server.ts. Do not insert ad-hoc `action` strings elsewhere.

export const PRODUCT_EVENTS = [
  // Intake
  "intake.submitted",
  "intake.assigned",
  "intake.converted",
  "intake.declined",
  // Position lifecycle
  "position.created",
  "position.published",
  "position.publish_blocked",
  "position.owner_changed",
  "position.closed",
  // Candidate pipeline
  "candidate.applied",
  "candidate.processed",
  "candidate.processing_failed",
  "candidate.scored",
  "candidate.evidence_overridden",
  "candidate.stage_changed",
  "candidate.submitted_to_client",
  "candidate.rejected",
  // Client actions
  "client.decision_recorded",
  "client.contact_released",
  "client.update_sent",
  "client.nudged",
  // Approvals
  "approval.requested",
  "approval.granted",
  "approval.declined",
  // SLA
  "sla.breached",
  "sla.acknowledged",
  // Outreach
  "outreach.sent",
  "outreach.bounced",
  "outreach.replied",
  "outreach.opted_out",
  "outreach.blocked_by_suppression",
  // Operational
  "integration.sync_failed",
  "notification.delivery_failed",
  "export.requested",
  "support.session_started",
] as const;

export type ProductEvent = (typeof PRODUCT_EVENTS)[number];

/** Entity type recorded on audit_events for each event, keeping queries cheap. */
export const PRODUCT_EVENT_ENTITY: Record<ProductEvent, string> = {
  "intake.submitted": "intake_submission",
  "intake.assigned": "intake_submission",
  "intake.converted": "intake_submission",
  "intake.declined": "intake_submission",
  "position.created": "position",
  "position.published": "position",
  "position.publish_blocked": "position",
  "position.owner_changed": "position",
  "position.closed": "position",
  "candidate.applied": "application",
  "candidate.processed": "application",
  "candidate.processing_failed": "application",
  "candidate.scored": "score_run",
  "candidate.evidence_overridden": "candidate_evidence",
  "candidate.stage_changed": "candidate_match",
  "candidate.submitted_to_client": "candidate_match",
  "candidate.rejected": "candidate_match",
  "client.decision_recorded": "client_decision",
  "client.contact_released": "candidate_match",
  "client.update_sent": "organization",
  "client.nudged": "organization",
  "approval.requested": "approval",
  "approval.granted": "approval",
  "approval.declined": "approval",
  "sla.breached": "sla",
  "sla.acknowledged": "sla",
  "outreach.sent": "outreach_touch",
  "outreach.bounced": "outreach_touch",
  "outreach.replied": "outreach_touch",
  "outreach.opted_out": "outreach_touch",
  "outreach.blocked_by_suppression": "outreach_touch",
  "integration.sync_failed": "integration",
  "notification.delivery_failed": "notification",
  "export.requested": "export_job",
  "support.session_started": "support_session",
};

/** Events that indicate a failure worth surfacing in the exception digest. */
export const PRODUCT_EVENT_EXCEPTIONS: ProductEvent[] = [
  "candidate.processing_failed",
  "position.publish_blocked",
  "sla.breached",
  "integration.sync_failed",
  "notification.delivery_failed",
  "outreach.bounced",
  "outreach.blocked_by_suppression",
];

export function isProductEvent(value: string): value is ProductEvent {
  return (PRODUCT_EVENTS as readonly string[]).includes(value);
}
