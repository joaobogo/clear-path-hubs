// Convert safe audit actions to client-friendly copy.
// Never surface admin_note / scoring_weight / internal review terminology.
export function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    "position.status.update": "Position status updated",
    "position.approved": "Position approved",
    "position.published": "Position published",
    "position.closed": "Position closed",
    "candidate_match.stage.update": "Candidate moved between stages",
    "candidate_match.publish": "Candidate delivered",
    "interview.schedule": "Interview scheduled",
    "interview.reschedule": "Interview rescheduled",
    "interview.cancel": "Interview cancelled",
    "client_decision.create": "Client decision recorded",
    "message.external.send": "New message",
  };
  return map[action] ?? action.replace(/[._]/g, " ");
}
