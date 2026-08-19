import { describe, it, expect } from "vitest";
import { toDerivedApproval } from "../derived-approvals";
import type { QueueRow } from "../client-decision-queue";

describe("toDerivedApproval", () => {
  const baseRow: QueueRow = {
    key: "test-1",
    kind: "feedback",
    concerns: "Interview feedback not recorded yet",
    role_title: "Senior Engineer",
    due_at: null,
    waiting_since: null,
    action: "Record",
    to: "/somewhere",
    type_label: "Interview feedback",
    overdue: false,
    days_waiting: null,
    due_label: "No deadline"
  };

  it("renders a combined title when type_label is present", () => {
    const result = toDerivedApproval(baseRow);
    expect(result.title).toBe("Interview feedback — Interview feedback not recorded yet");
  });

  it("renders only concerns when type_label is missing/undefined", () => {
    const result = toDerivedApproval({ ...baseRow, type_label: undefined as any });
    expect(result.title).toBe("Interview feedback not recorded yet");
  });

  it("falls back to QUEUE_TYPE_LABEL for type_label badge when undefined", () => {
    const result = toDerivedApproval({ ...baseRow, type_label: undefined as any });
    expect(result.type_label).toBe("Interview feedback");
  });
});
