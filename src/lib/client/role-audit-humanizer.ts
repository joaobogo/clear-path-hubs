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
    "position.memory.create": "Recruiter note added", // Should be filtered if internal, but here for coverage
    
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

  // Check direct map
  if (map[action]) return map[action];

  // Try dot-replaced match (for space-cased inputs from older events)
  const dotAction = action.replace(/\s+/g, ".");
  if (map[dotAction]) return map[dotAction];

  // Try space-replaced match (original logic for snake_case/dotted fallbacks)
  const spaceAction = action.replace(/[._]/g, " ");
  if (map[spaceAction]) return map[spaceAction];

  // Fallback to a generic friendly label for unknown events
  // Never return the raw key
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
];
