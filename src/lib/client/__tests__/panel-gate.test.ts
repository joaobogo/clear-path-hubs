import { describe, expect, it } from "vitest";
import { orgGate, panelState, STUCK_ERROR } from "@/lib/client/panel-gate";

const q = (over: Partial<Parameters<typeof orgGate>[0]> = {}) => ({
  data: undefined as unknown,
  isError: false,
  isFetching: false,
  isPending: false,
  error: undefined as unknown,
  refetch: () => undefined,
  ...over,
});

describe("orgGate", () => {
  it("is pending while the workspace lookup is in flight", () => {
    const gate = orgGate(q({ isPending: true, isFetching: true }), undefined);
    expect(gate).toMatchObject({ pending: true, failed: false });
  });

  it("fails when the workspace lookup errored", () => {
    const gate = orgGate(q({ isError: true, error: new Error("boom") }), undefined);
    expect(gate.failed).toBe(true);
    expect(gate.pending).toBe(false);
  });

  it("fails when the lookup settled with no workspace", () => {
    const gate = orgGate(q({ data: { active: null } }), undefined);
    expect(gate.failed).toBe(true);
    expect(gate.noWorkspace).toBe(true);
  });

  it("is ready with an org id", () => {
    const gate = orgGate(q({ data: { active: {} } }), "org-1");
    expect(gate).toMatchObject({ failed: false, pending: false, orgId: "org-1" });
  });
});

describe("panelState", () => {
  const ready = orgGate(q({ data: { active: {} } }), "org-1");

  it("never leaves a skeleton when the gate failed", () => {
    const gate = orgGate(q({ isError: true, error: new Error("nope") }), undefined);
    const state = panelState({ gate, hasData: false, isFetching: false, isError: false });
    expect(state.loading).toBe(false);
    expect(state.isError).toBe(true);
  });

  it("shows loading only while something is in flight", () => {
    expect(panelState({ gate: ready, hasData: false, isFetching: true, isError: false }).loading).toBe(true);
    expect(panelState({ gate: ready, hasData: true, isFetching: true, isError: false }).loading).toBe(false);
  });

  it("turns a stuck pending panel into an error with a retry", () => {
    const state = panelState({ gate: ready, hasData: false, isFetching: true, isError: false, stuck: true });
    expect(state).toMatchObject({ loading: false, isError: true, error: STUCK_ERROR });
  });

  it("keeps showing data when a refetch fails", () => {
    const state = panelState({ gate: ready, hasData: true, isFetching: false, isError: true, error: new Error("x") });
    expect(state).toMatchObject({ loading: false, isError: false });
  });

  it("reports the panel's own failure when the gate is fine", () => {
    const err = new Error("query failed");
    const state = panelState({ gate: ready, hasData: false, isFetching: false, isError: true, error: err });
    expect(state).toMatchObject({ loading: false, isError: true, error: err });
  });
});
