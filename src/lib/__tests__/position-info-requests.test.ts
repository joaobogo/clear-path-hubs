import { describe, expect, it } from "vitest";
import {
  briefField,
  briefPatch,
  toInfoRequestCard,
  type InfoRequestRow,
} from "@/lib/position-info-requests";

const row = (over: Partial<InfoRequestRow> = {}): InfoRequestRow => ({
  id: "r1",
  position_id: "p1",
  brief_field: "salary_range",
  question: "What is the budget for this role?",
  why_needed: null,
  unblocks: null,
  asked_by_name: "Maya",
  created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  status: "open",
  ...over,
});

describe("information requests", () => {
  it("names the waiting time and what the answer unblocks", () => {
    const card = toInfoRequestCard(row());
    expect(card.waiting_label).toContain("Waiting on you since");
    expect(card.days_waiting).toBe(3);
    expect(card.impact).toContain("unblocks");
    expect(card.answerable).toBe(true);
  });

  it("marks unknown fields as needing a conversation", () => {
    const card = toInfoRequestCard(row({ brief_field: "something_else" }));
    expect(card.answerable).toBe(false);
  });

  it("rejects empty answers", () => {
    const field = briefField("salary_range")!;
    expect(field.validate("   ").ok).toBe(false);
  });

  it("writes a valid answer into the brief without dropping other values", () => {
    const field = briefField("salary_range")!;
    const checked = field.validate("60000-80000");
    expect(checked.ok).toBe(true);
    const patch = briefPatch(field, (checked as { value: unknown }).value, {
      compensation: { currency: "GBP" },
    }) as { compensation: Record<string, unknown> };
    expect(patch.compensation["currency"]).toBe("GBP");
    expect(patch.compensation["min"]).toBe(60000);
    expect(patch.compensation["max"]).toBe(80000);
  });
});
