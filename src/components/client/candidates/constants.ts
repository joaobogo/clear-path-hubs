export const STAGE_OPTIONS = [
 { key: "all", label: "All stages" },
 { key: "delivered", label: "New — awaiting review" },
 { key: "shortlisted", label: "Shortlisted" },
 { key: "interview_process", label: "Interview process" },
 { key: "offer", label: "Offer" },
 { key: "hired", label: "Hired" },
 { key: "not_moving_forward", label: "Not moving forward" },
] as const;

export const FIT_OPTIONS = [
 { key: "all", label: "Any fit" },
 { key: "exceptional", label: "Exceptional" },
 { key: "strong", label: "Strong" },
 { key: "good", label: "Good potential" },
 { key: "mixed", label: "Mixed" },
 { key: "limited", label: "Limited" },
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
 { key: "recent", label: "Recently delivered" },
 { key: "score", label: "Highest approved fit" },
 { key: "must", label: "Must-have coverage" },
 { key: "stage", label: "Stage" },
 { key: "name", label: "Candidate name" },
] as const;
