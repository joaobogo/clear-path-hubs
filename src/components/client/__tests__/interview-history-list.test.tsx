import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { InterviewHistoryList } from "@/components/client/interview-history-list";
import type { InterviewDTO } from "@/lib/interviews.functions";

const legacy = (over: Partial<InterviewDTO> = {}): InterviewDTO => ({
  id: "iv1",
  organization_id: "o1",
  position_id: "p1",
  candidate_match_id: "m1",
  candidate_submission_id: null,
  status: "scheduled",
  interview_type: "video_call",
  scheduled_at: "2026-09-01T10:00:00Z",
  notes: null,
  feedback: null,
  requested_at: "2026-08-20T10:00:00Z",
  completed_at: null,
  cancelled_at: null,
  created_at: "2026-08-20T10:00:00Z",
  updated_at: "2026-08-20T10:00:00Z",
  candidate: { id: "c1", name: "Ana Silva", email: null },
  position: { id: "p1", title: "Head of Ops", reference: null },
  ...over,
});

const render = (rows: InterviewDTO[], readOnly = false) =>
  renderToStaticMarkup(
    createElement(InterviewHistoryList, { interviews: rows, readOnly, onFeedback: () => {} }),
  );

describe("/client/interviews renders an old interview row read-only", () => {
  it("shows candidate, role, date and status with no scheduling controls", () => {
    const html = render([legacy()]);
    expect(html).toContain("Ana Silva");
    expect(html).toContain("Head of Ops");
    expect(html).toMatch(/Scheduled/i);
    expect(html).not.toMatch(/<button/i);
    expect(html).not.toMatch(/propose|reschedule|confirm|cancel|availability/i);
  });

  it("offers only Feedback on a completed row, and nothing to a read-only viewer", () => {
    const done = legacy({ status: "completed", completed_at: "2026-09-01T11:00:00Z" });
    expect(render([done])).toContain("Feedback");
    expect(render([done], true)).not.toContain("Feedback");
  });
});
