/**
 * Client-friendly humanizer for position audit events.
 * 
 * Maps raw snake_case or internal event keys to warm, human labels.
 * Filters out internal events that shouldn't be visible to clients.
 */

export function humanizeRoleAction(action: string): string {
  const map: Record<string, string> = {
    // Lifecycle
    "position.create": "Role created",
    "position.submit": "Role submitted for review",
    "position.start_review": "TaaSFlow started reviewing your role",
    "position.approved": "Role approved",
    "position.published": "Role published",
    "position.closed": "Role closed",
    "position.archived": "Role archived",
    "position.paused": "Role paused",
    "position.resumed": "Role resumed",
    
    // Updates
    "position.update": "Role details updated",
    "position.edit_wizard": "Role details updated",
    "position.requisition_updated": "Role details updated",
    "position.status.update": "Role status updated",
    
    // Handoff & Memory
    "position.handoff.complete": "Recruitment handoff completed",
    "position.memory.create": "Recruiter note added",
    
    // Candidates (when appearing in role trail)
    "candidate_match.publish": "New candidate delivered",
    "candidate_match.stage.update": "Candidate moved between stages",
    
    // Interviews
    "interview.schedule": "Interview scheduled",
    "interview.reschedule": "Interview rescheduled",
    "interview.cancel": "Interview cancelled",
    
    // Communication
    "message.external.send": "New message sent",
    "message.external.receive": "New message received",
    
    // Decisions
    "client_decision.create": "Client decision recorded",
  };

  // 1. Direct match (e.g. "position.create")
  if (map[action]) return map[action];

  // 2. Normalise dots/underscores to spaces AND spaces/underscores to dots
  const normDot = action.trim().toLowerCase().replace(/[\s_]+/g, ".");
  if (map[normDot]) return map[normDot];

  const normSpace = action.trim().toLowerCase().replace(/[._]+/g, " ");
  if (map[normSpace]) return map[normSpace];

  // 3. One more try: specific common space-to-dot mappings if needed
  if (action === "position start review") return map["position.start_review"]!;
  if (action === "position create") return map["position.create"]!;
  if (action === "position submit") return map["position.submit"]!;

  // 4. Fallback to a generic friendly label for unknown events
  return "Role activity recorded";
}

/**
 * Filter for events that are safe to show to the client.
 */
export const CLIENT_SAFE_ROLE_ACTIONS = [
  "position.create",
  "position.submit",
  "position.start_review",
  "position.approved",
  "position.published",
  "position.closed",
  "position.archived",
  "position.paused",
  "position.resumed",
  "position.update",
  "position.edit_wizard",
  "position.requisition_updated",
  "position.status.update",
  "candidate_match.publish",
  "candidate_match.stage.update",
  "interview.schedule",
  "interview.reschedule",
  "interview.cancel",
  "message.external.send",
  "message.external.receive",
  "client_decision.create",
  // Space-cased variants for older events
  "position create",
  "position submit",
  "position start review",
];
