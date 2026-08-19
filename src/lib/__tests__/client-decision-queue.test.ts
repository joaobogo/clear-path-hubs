import { describe, expect, it } from "vitest";
import { buildQueue, dedupeQueue, dueLabel, type QueueItem } from "@/lib/client-decision-queue";

const NOW = new Date("2026-03-10T12:00:00.000Z");
const iso = (dayOffset: number) =>
  new Date(NOW.getTime() + dayOffset * 86_400_000).toISOString();

function item(over: Partial<QueueItem> & { key: string }): QueueItem {
  return {
    kind: "decision",
    concerns: "Alex Rivera",
    role_title: "Reservations Manager",
    due_at: null,
    waiting_since: null,
    action: "Review candidate",
    to: "/client/candidates/m1",
    ...over,
  };
}

describe("dueLabel", () => {
  it("never returns a blank cell", () => {
    expect(dueLabel(null, NOW.getTime())).toBe("No deadline");
    expect(dueLabel("not-a-date", NOW.getTime())).toBe("No deadline");
  });

  it("reads in plain language either side of the due date", () => {
    expect(dueLabel(iso(0), NOW.getTime())).toBe("Due today");
    expect(dueLabel(iso(1), NOW.getTime())).toBe("Due tomorrow");
    expect(dueLabel(iso(4), NOW.getTime())).toBe("Due in 4 days");
    expect(dueLabel(iso(-1), NOW.getTime())).toBe("1 day overdue");
    expect(dueLabel(iso(-3), NOW.getTime())).toBe("3 days overdue");
  });
});

describe("dedupeQueue", () => {
  it("keeps one row per subject, highest precedence wins", () => {
    const out = dedupeQueue([
      item({ key: "decision:m1", kind: "decision", subject_id: "m1" }),
      item({ key: "interview:m1", kind: "interview", subject_id: "m1" }),
      item({ key: "feedback:m1", kind: "feedback", subject_id: "m1" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe("feedback");
  });

  it("leaves subject-less items alone", () => {
    const out = dedupeQueue([
      item({ key: "task:a", kind: "info_request" }),
      item({ key: "task:b", kind: "info_request" }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("buildQueue", () => {
  it("groups overdue items at the top and orders by due date", () => {
    const q = buildQueue(
      [
        item({ key: "a", due_at: iso(3) }),
        item({ key: "b", due_at: iso(-2) }),
        item({ key: "c", due_at: iso(1) }),
        item({ key: "d", due_at: iso(-5) }),
      ],
      NOW,
    );
    expect(q.overdue.map((r) => r.key)).toEqual(["d", "b"]);
    expect(q.upcoming.map((r) => r.key)).toEqual(["c", "a"]);
    expect(q.total).toBe(4);
  });

  it("sorts undated items after every dated item", () => {
    const q = buildQueue(
      [item({ key: "none" }), item({ key: "later", due_at: iso(9) })],
      NOW,
    );
    expect(q.upcoming.map((r) => r.key)).toEqual(["later", "none"]);
    expect(q.upcoming[1]!.due_label).toBe("No deadline");
  });

  it("breaks ties on days waiting, longest first", () => {
    const q = buildQueue(
      [
        item({ key: "new", due_at: iso(2), waiting_since: iso(-1) }),
        item({ key: "old", due_at: iso(2), waiting_since: iso(-9) }),
      ],
      NOW,
    );
    expect(q.upcoming.map((r) => r.key)).toEqual(["old", "new"]);
    expect(q.upcoming[0]!.days_waiting).toBe(9);
  });

  it("labels the item type as text", () => {
    const q = buildQueue([item({ key: "f", kind: "feedback", due_at: iso(1) })], NOW);
    // Type labels name the action the client takes.
    expect(q.upcoming[0]!.type_label).toBe("Give feedback");
  });
});
