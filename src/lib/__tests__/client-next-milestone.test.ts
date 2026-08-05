import { describe, expect, it } from "vitest";
import { computeNextMilestone, type MilestoneInput } from "@/lib/client-next-milestone";

const NOW = new Date("2026-05-20T09:00:00.000Z");
const iso = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

function role(over: Partial<MilestoneInput> = {}): MilestoneInput {
  return {
    position_id: "p1",
    title: "Front Office Manager",
    awaiting_review: 0,
    has_offer: false,
    has_interview: false,
    promised_shortlist_by: null,
    shortlist_delivered_at: null,
    feedback_due_at: null,
    offer_response_due_at: null,
    ...over,
  };
}

describe("computeNextMilestone", () => {
  it("shows the committed first-shortlist date when a commitment exists", () => {
    const m = computeNextMilestone(role({ promised_shortlist_by: iso(6) }), NOW);
    expect(m.stage).toBe("shortlist");
    expect(m.text).toBe("First shortlist expected by 26 May");
    expect(m.behind_schedule).toBe(false);
  });

  it("never invents a date without a stored commitment", () => {
    const m = computeNextMilestone(role(), NOW);
    expect(m.expected_at).toBeNull();
    expect(m.text).toBe("Date confirmed once sourcing starts");
  });

  it("labels a passed date behind schedule in words", () => {
    const m = computeNextMilestone(role({ promised_shortlist_by: iso(-3) }), NOW);
    expect(m.behind_schedule).toBe(true);
    expect(m.schedule_note).toBe("behind schedule");
  });

  it("switches to the review milestone once candidates are delivered", () => {
    const m = computeNextMilestone(
      role({ awaiting_review: 3, promised_shortlist_by: iso(-1) }),
      NOW,
    );
    expect(m.stage).toBe("review");
    expect(m.text).toBe("Your review — 3 candidates waiting");
    expect(m.expected_at).toBeNull();
  });

  it("uses singular wording for one candidate", () => {
    const m = computeNextMilestone(role({ awaiting_review: 1 }), NOW);
    expect(m.text).toBe("Your review — 1 candidate waiting");
  });

  it("reports interview feedback when interviewing", () => {
    const m = computeNextMilestone(
      role({ has_interview: true, awaiting_review: 2, feedback_due_at: iso(1) }),
      NOW,
    );
    expect(m.stage).toBe("interview_feedback");
    expect(m.text).toBe("Interview feedback due by 21 May");
  });

  it("reports the offer response when an offer is out, ahead of every other stage", () => {
    const m = computeNextMilestone(
      role({
        has_offer: true,
        has_interview: true,
        awaiting_review: 4,
        offer_response_due_at: iso(-2),
      }),
      NOW,
    );
    expect(m.stage).toBe("offer_response");
    expect(m.text).toBe("Offer response expected by 18 May");
    expect(m.behind_schedule).toBe(true);
  });

  it("drops the shortlist date once the shortlist has landed", () => {
    const m = computeNextMilestone(
      role({ promised_shortlist_by: iso(-4), shortlist_delivered_at: iso(-2) }),
      NOW,
    );
    expect(m.expected_at).toBeNull();
    expect(m.behind_schedule).toBe(false);
  });
});
