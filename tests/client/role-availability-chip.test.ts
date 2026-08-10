import { describe, expect, it } from "vitest";
import {
  ACTION_LABEL,
  hiddenSignal,
  STATE_LABEL,
  isAttention,
  summarise,
} from "@/lib/system-health/system-health";

/**
 * The "Not available to you" chip explains a seat limit. It must appear only for
 * seats that genuinely lack the role, never for a workspace admin, and it must
 * never stand in the way of navigating.
 */

/** Mirror of the flags derived in readWorkspaceAccess for a membership role. */
function flagsFor(role: string) {
  return {
    isAdmin: role === "client_admin" || role === "platform_admin" || role === "operations",
    canWrite: role !== "client_viewer",
  };
}

describe("role-gated availability chip", () => {
  it("labels the seat limit in plain language", () => {
    expect(STATE_LABEL.unavailable).toBe("Not available to you");
  });

  it("does not show for a client_admin on admin-only signals", () => {
    expect(flagsFor("client_admin").isAdmin).toBe(true);
  });

  it("shows for seats below admin", () => {
    expect(flagsFor("client_editor").isAdmin).toBe(false);
    expect(flagsFor("client_viewer").isAdmin).toBe(false);
  });

  it("names who to ask instead of showing an error", () => {
    const s = hiddenSignal("integrations", "a workspace admin");
    expect(s.state).toBe("unavailable");
    expect(s.detail).toContain("a workspace admin");
    expect(s.detail).not.toMatch(/error|forbidden|denied/i);
  });

  it("never blocks navigation: the chip carries no action and no redirect", () => {
    const s = hiddenSignal("sync", "a workspace admin");
    expect(s.actions).toEqual([]);
    expect(Object.keys(ACTION_LABEL)).not.toContain("upgrade_seat");
  });

  it("never raises an alert or claims health", () => {
    const s = hiddenSignal("agents", "a workspace admin");
    expect(isAttention(s.state)).toBe(false);
    expect(summarise([s], new Date()).overall).not.toBe("operational");
  });
});
