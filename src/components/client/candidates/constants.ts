import { PIPELINE_STAGE_DISPLAY } from "@/lib/client/stage-display";

export const STAGE_OPTIONS = [
 { key: "all", label: "All stages" },
 { key: "delivered", label: PIPELINE_STAGE_DISPLAY.delivered },
 { key: "shortlisted", label: PIPELINE_STAGE_DISPLAY.shortlisted },
 { key: "interview_process", label: PIPELINE_STAGE_DISPLAY.interview_process },
 { key: "offer", label: PIPELINE_STAGE_DISPLAY.offer },
 { key: "hired", label: PIPELINE_STAGE_DISPLAY.hired },
 { key: "not_moving_forward", label: PIPELINE_STAGE_DISPLAY.not_moving_forward },
] as const;

export const FIT_OPTIONS = [
 { key: "all", label: "Any fit" },
 { key: "exceptional", label: "Exceptional" },
 { key: "top", label: "Top" },
 { key: "strong", label: "Strong" },
 { key: "consider", label: "Consider" },
 { key: "not_recommended", label: "Not recommended" },
] as const;

export const CRITICAL_OPTIONS = [
 { key: "all", label: "Any critical status" },
 { key: "met", label: "All critical requirements met" },
 { key: "gaps", label: "Has critical gaps" },
 { key: "missing_evidence", label: "Missing evidence" },
] as const;

export const REVIEW_OPTIONS = [
 { key: "all", label: "Any review status" },
 { key: "awaiting", label: "Awaiting your review" },
 { key: "in_progress", label: "In progress with your team" },
 { key: "closed", label: "Closed" },
] as const;

export const SORT_OPTIONS = [
  { key: "score", label: "Best match (score)" },
  { key: "recent", label: "Recently delivered" },
  { key: "must", label: "Must-have coverage" },
  { key: "stage", label: "Stage" },
  { key: "name", label: "Candidate name" },
] as const;
