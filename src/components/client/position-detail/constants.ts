import { type MatchStage } from "@/lib/client-match-stage";

export const KANBAN_COLUMNS: { key: MatchStage; label: string }[] = [
  { key: "delivered", label: "Delivered" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview_process", label: "Interview Process" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "not_moving_forward", label: "Not Moving Forward" },
];

// Canonical transition matrix (mirrors server STAGE_GRAPH in client-shared.server.ts).
export const STAGE_GRAPH: Record<MatchStage, MatchStage[]> = {
  delivered: ["shortlisted", "interview_process", "not_moving_forward"],
  shortlisted: ["interview_process", "not_moving_forward"],
  interview_process: ["offer", "shortlisted", "not_moving_forward"],
  offer: ["hired", "not_moving_forward"],
  hired: [],
  not_moving_forward: ["shortlisted"],
};

export const STAGE_LABELS: Record<MatchStage, string> = {
  delivered: "Delivered",
  shortlisted: "Shortlist",
  interview_process: "Move to Interview Process",
  offer: "Make offer",
  hired: "Mark hired",
  not_moving_forward: "Not moving forward",
};
