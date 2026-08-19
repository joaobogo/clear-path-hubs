/**
 * Derived approvals — workspace actions that live outside the tasks table.
 *
 * The approvals page promises to be the single inbox for "every next action".
 * Some of those actions are not stored rows: interview feedback that is due,
 * an interview waiting on times, an offer awaiting a response. They are derived
 * from live pipeline state by the overview decision queue.
 *
 * This module maps those queue rows onto the approvals vocabulary (task type,
 * view membership) so one inbox can render both kinds without inventing data.
 */
import { type QueueRow, type QueueKind, QUEUE_TYPE_LABEL } from "@/lib/client-decision-queue";
import type { TaskType, TaskView } from "@/lib/tasks.functions";

export type DerivedApproval = {
  key: string;
  kind: QueueKind;
  title: string;
  type_label: string;
  task_type: TaskType;
  role_title: string;
  due_at: string | null;
  due_label: string;
  overdue: boolean;
  days_waiting: number | null;
  action: string;
  to: string;
};

/** Which approvals type filter each queue kind answers to. */
export const KIND_TASK_TYPE: Record<QueueKind, TaskType> = {
  decision: "candidate_review",
  feedback: "feedback_submission",
  offer: "offer_decision",
  interview: "interview_scheduling",
  info_request: "document_request",
};

export function toDerivedApproval(row: QueueRow): DerivedApproval {
  return {
    key: row.key,
    kind: row.kind,
    title: row.type_label && row.concerns ? `${row.type_label} — ${row.concerns}` : (row.concerns || row.type_label || "Approval request"),
    type_label: row.type_label || QUEUE_TYPE_LABEL[row.kind] || "",
    task_type: KIND_TASK_TYPE[row.kind],
    role_title: row.role_title,
    due_at: row.due_at,
    due_label: row.due_label,
    overdue: row.overdue,
    days_waiting: row.days_waiting,
    action: row.action,
    to: row.to,
  };
}

/**
 * Derived items belong to the workspace, not to one assignee. They show in the
 * views where "what needs us" is the question: the default inbox, overdue
 * (only when actually overdue) and blocking (overdue work blocks delivery).
 * They never show under Team (nobody is assigned) or Completed (nothing to
 * complete here — the item disappears when the underlying state changes).
 */
export function filterDerived(
  items: DerivedApproval[],
  view: TaskView,
  taskType: TaskType | "all",
): DerivedApproval[] {
  const byType =
    taskType === "all" ? items : items.filter((i) => i.task_type === taskType);
  switch (view) {
    case "my":
    case "all":
      return byType;
    case "overdue":
    case "blocking":
      return byType.filter((i) => i.overdue);
    default:
      return [];
  }
}
