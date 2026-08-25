import { type MatchStage } from "@/lib/client-match-stage";
import { PIPELINE_STAGE_DISPLAY } from "@/lib/client/stage-display";

export const KANBAN_COLUMNS: { key: MatchStage; label: string }[] = [
  { key: "delivered", label: PIPELINE_STAGE_DISPLAY.delivered },
  { key: "shortlisted", label: PIPELINE_STAGE_DISPLAY.shortlisted },
  { key: "interview_process", label: PIPELINE_STAGE_DISPLAY.interview_process },
  { key: "offer", label: PIPELINE_STAGE_DISPLAY.offer },
  { key: "hired", label: PIPELINE_STAGE_DISPLAY.hired },
  { key: "not_moving_forward", label: PIPELINE_STAGE_DISPLAY.not_moving_forward },
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
  interview_process: `Move to ${PIPELINE_STAGE_DISPLAY.interview_process}`,
  offer: "Make offer",
  hired: "Mark hired",
  not_moving_forward: "Not moving forward",
};
