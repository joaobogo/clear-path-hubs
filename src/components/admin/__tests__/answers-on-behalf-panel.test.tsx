/**
 * Scoring fix spec, 26 Nov 2026, Fix 6: the staff screen for screening answers
 * a recruiter entered for a candidate. It says how many answers wait on the
 * candidate, offers the confirm step before publishing, and only lets a
 * recruiter fill questions the candidate has not answered personally.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const buttons: Array<{ children?: ReactNode; onClick?: () => void; disabled?: boolean }> = [];

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => vi.fn(),
}));
vi.mock("@/lib/candidate/answers-on-behalf.functions", () => ({
  acknowledgeRecruiterAnswers: vi.fn(),
  recordAnswersOnBehalf: vi.fn(),
}));
vi.mock("@/components/ui/button", () => ({
  Button: (props: { children?: ReactNode; onClick?: () => void; disabled?: boolean }) => {
    buttons.push(props);
    return <button type="button">{props.children}</button>;
  },
}));

import { AnswersOnBehalfPanel } from "@/components/admin/answers-on-behalf-panel";

const questions = [
  {
    id: "q-deal",
    question: "Closed a $2M+ deal?",
    answer_type: "boolean",
    required: true,
    dealbreaker: true,
  },
  {
    id: "q-target",
    question: "Annual bookings target?",
    answer_type: "number",
    required: true,
    dealbreaker: false,
  },
  {
    id: "q-story",
    question: "Largest new-logo deal?",
    answer_type: "long_text",
    required: false,
    dealbreaker: false,
  },
];
const recruiter = (question_id: string, value: unknown) => ({
  question_id,
  answer: { value },
  answered_by: "recruiter_on_behalf",
  candidate_confirmed_at: null,
});

const html = (props: Partial<Parameters<typeof AnswersOnBehalfPanel>[0]>) =>
  renderToStaticMarkup(
    <AnswersOnBehalfPanel
      matchId="9f0c4c00-f8ea-423b-87a5-b40e443a99ac"
      questions={questions}
      answers={[]}
      state={null}
      hasApplication
      onChanged={() => {}}
      {...props}
    />,
  );
const labels = () => buttons.map((b) => String(b.children));

beforeEach(() => {
  buttons.length = 0;
});

describe("screening answers a recruiter entered for the candidate", () => {
  it("says how many wait on the candidate and offers the confirm step before publishing", () => {
    const out = html({
      answers: [
        recruiter("q-deal", true),
        recruiter("q-target", 3000000),
        recruiter("q-story", "BA"),
      ],
      state: { pending: 3, needs_acknowledgement: true, acknowledged_at: null },
    });
    expect(out).toContain("3 answers were entered by a recruiter");
    expect(out).toContain("The candidate has not confirmed them yet.");
    expect(out).toContain("labelled as recruiter-entered");
    expect(labels()).toContain("Confirm: publish with recruiter-entered answers");
    // The questions are still enterable, so a recruiter can correct their own entry.
    expect(labels()).toContain("Enter answers on the candidate's behalf");
  });

  it("shows the confirmation once given instead of asking again", () => {
    const out = html({
      answers: [recruiter("q-deal", true)],
      state: { pending: 1, needs_acknowledgement: false, acknowledged_at: "2026-11-26T21:00:00Z" },
    });
    expect(out).toContain("1 answer was entered by a recruiter");
    expect(out).toContain("Confirmed for publishing with recruiter-entered answers.");
    expect(labels()).not.toContain("Confirm: publish with recruiter-entered answers");
  });

  it("offers nothing to enter when the candidate answered every question personally", () => {
    const own = (question_id: string) => ({
      question_id,
      answer: { value: true },
      answered_by: "candidate",
      candidate_confirmed_at: null,
    });
    const out = html({
      answers: [own("q-deal"), own("q-target"), own("q-story")],
      state: { pending: 0, needs_acknowledgement: false, acknowledged_at: null },
    });
    expect(out).not.toContain("entered by a recruiter");
    expect(buttons).toHaveLength(0);
  });

  it("offers nothing to enter for a candidate with no application on the role", () => {
    html({ hasApplication: false });
    expect(buttons).toHaveLength(0);
  });
});
