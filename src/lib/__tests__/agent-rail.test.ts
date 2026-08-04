import { describe, expect, it } from "vitest";
import {
  ACTION_BACKING,
  collapseItems,
  EMPTY_FILTERS,
  filterGroups,
  groupItems,
  kindFromAgentKey,
  needsAttention,
  RAIL_ACTIONS,
  statusFromOutcome,
  SYSTEM_ACTORS,
  type RailItem,
  type RailStatus,
} from "@/lib/agent-rail/agent-rail";

const BASE = new Date("2026-08-10T12:00:00.000Z").getTime();

function item(over: Partial<RailItem> & { id: string }): RailItem {
  return {
    kind: "evidence_extracted",
    action: "Evidence extracted.",
    result: "3 findings.",
    status: "done",
    actor: SYSTEM_ACTORS.evidence!,
    role: { id: "role-1", title: "Senior Nurse" },
    candidate: { match_id: "m1", label: "A candidate", identified: false },
    occurred_at: new Date(BASE).toISOString(),
    count: 1,
    actions: [],
    ...over,
  };
}

describe("statusFromOutcome", () => {
  it("maps recorded agent outcomes honestly", () => {
    expect(statusFromOutcome("acted")).toBe("done");
    expect(statusFromOutcome("blocked")).toBe("blocked");
    expect(statusFromOutcome("skipped")).toBe("stopped");
    expect(statusFromOutcome("failed")).toBe("failed");
  });
});

describe("kindFromAgentKey", () => {
  it("routes each agent to its rail kind", () => {
    expect(kindFromAgentKey("sourcing")).toBe("discovery_run");
    expect(kindFromAgentKey("screening")).toBe("evidence_extracted");
    expect(kindFromAgentKey("pipeline_watch")).toBe("risk_detected");
    expect(kindFromAgentKey("unknown_key")).toBe("discovery_run");
  });
});

describe("collapseItems", () => {
  it("merges identical work inside the window and keeps a count", () => {
    const out = collapseItems([
      item({ id: "a" }),
      item({ id: "b", occurred_at: new Date(BASE - 60_000).toISOString() }),
      item({ id: "c", occurred_at: new Date(BASE - 120_000).toISOString() }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.count).toBe(3);
  });

  it("does not merge across the window", () => {
    const out = collapseItems([
      item({ id: "a" }),
      item({ id: "b", occurred_at: new Date(BASE - 8 * 3600_000).toISOString() }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("does not merge different candidates or different statuses", () => {
    const out = collapseItems([
      item({ id: "a" }),
      item({ id: "b", candidate: { match_id: "m2", label: "A candidate", identified: false } }),
      item({ id: "c", status: "failed" }),
    ]);
    expect(out).toHaveLength(3);
  });

  it("never merges rows a person has to act on", () => {
    const needs = item({ id: "n1", kind: "approval_requested", status: "needs_you" });
    const out = collapseItems([
      needs,
      { ...needs, id: "n2", occurred_at: new Date(BASE - 60_000).toISOString() },
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((i) => i.count === 1)).toBe(true);
  });

  it("returns newest first", () => {
    const out = collapseItems([
      item({ id: "old", status: "failed", occurred_at: new Date(BASE - 3 * 86_400_000).toISOString() }),
      item({ id: "new", status: "blocked" }),
    ]);
    expect(out[0]!.id).toBe("new");
  });
});

describe("groupItems", () => {
  it("groups by role and puts roles needing attention first", () => {
    const groups = groupItems([
      item({ id: "a", role: { id: "role-1", title: "Senior Nurse" } }),
      item({
        id: "b",
        role: { id: "role-2", title: "Finance Lead" },
        status: "needs_you",
        kind: "approval_requested",
      }),
    ]);
    expect(groups[0]!.role?.id).toBe("role-2");
    expect(groups[0]!.attention_count).toBe(1);
    expect(groups).toHaveLength(2);
  });

  it("keeps role-less work in its own labelled group", () => {
    const groups = groupItems([item({ id: "a", role: null })]);
    expect(groups[0]!.key).toBe("unassigned");
    expect(groups[0]!.heading).toBe("Not tied to one role");
  });
});

describe("filterGroups", () => {
  const groups = groupItems([
    item({ id: "a", actor: SYSTEM_ACTORS.evidence! }),
    item({
      id: "b",
      role: { id: "role-2", title: "Finance Lead" },
      actor: SYSTEM_ACTORS.review!,
      status: "needs_you",
      kind: "approval_requested",
    }),
  ]);

  it("passes everything through with empty filters", () => {
    expect(filterGroups(groups, EMPTY_FILTERS)).toHaveLength(2);
  });

  it("filters by role, agent and status", () => {
    expect(filterGroups(groups, { ...EMPTY_FILTERS, roleId: "role-2" })).toHaveLength(1);
    expect(filterGroups(groups, { ...EMPTY_FILTERS, actorKey: "evidence" })).toHaveLength(1);
    const failed = filterGroups(groups, {
      ...EMPTY_FILTERS,
      status: "failed" as RailStatus,
    });
    expect(failed).toHaveLength(0);
  });

  it("filters to attention only and recounts", () => {
    const out = filterGroups(groups, { ...EMPTY_FILTERS, attentionOnly: true });
    expect(out).toHaveLength(1);
    expect(out[0]!.items.every(needsAttention)).toBe(true);
    expect(out[0]!.attention_count).toBe(1);
  });
});

describe("action wiring", () => {
  it("every offered action names a real backing server function", () => {
    for (const action of RAIL_ACTIONS) {
      expect(ACTION_BACKING[action]).toBeTruthy();
    }
  });
});
