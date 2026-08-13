import { describe, expect, it } from "vitest";

import {
  BACKLOG_PARTIAL_OUTAGE_COUNT,
  degradedNotice,
  statusFromBacklog,
  type PlatformStatus,
  type ServiceStatus,
} from "@/lib/status/platform-status";

function service(over: Partial<ServiceStatus>): ServiceStatus {
  return {
    key: "agents",
    name: "Agent processing",
    covers: "Background work.",
    measured_by: "Background work still waiting or in progress at page load.",
    status: "operational",
    detail: "",
    measured: true,
    window: "at page load",
    covers_now: true,
    maintenance_note: null,
    ...over,
  } as ServiceStatus;
}

function status(services: ServiceStatus[]): PlatformStatus {
  return {
    checked_at: new Date().toISOString(),
    overall: "operational",
    headline: "",
    services,
    active_incidents: [],
    incident_history: [],
    maintenance: [],
    history_since: null,
    subscription_supported: true,
  } as PlatformStatus;
}

describe("live backlog status", () => {
  it("is operational when nothing is pending", () => {
    const v = statusFromBacklog({ pending: 0, overdue: 0, oldestOverdueMinutes: 0 });
    expect(v.status).toBe("operational");
    expect(v.measured).toBe(true);
    expect(v.detail).toBe("No background work is waiting.");
  });

  it("is operational while pending work is still inside its threshold", () => {
    const v = statusFromBacklog({ pending: 4, overdue: 0, oldestOverdueMinutes: 0 });
    expect(v.status).toBe("operational");
    expect(v.detail).toContain("none is behind");
  });

  it("degrades only for work overdue right now", () => {
    const v = statusFromBacklog({ pending: 3, overdue: 1, oldestOverdueMinutes: 42 });
    expect(v.status).toBe("degraded_performance");
    expect(v.detail).toContain("42 minutes");
  });

  it("escalates a real backlog to a partial outage", () => {
    const v = statusFromBacklog({
      pending: 30,
      overdue: BACKLOG_PARTIAL_OUTAGE_COUNT,
      oldestOverdueMinutes: 90,
    });
    expect(v.status).toBe("partial_outage");
  });
});

describe("banner reacts to agent backlog, not history", () => {
  it("stays hidden when agent processing is operational", () => {
    const notice = degradedNotice(status([service({ status: "operational" })]));
    expect(notice.show).toBe(false);
  });

  it("shows when live agent work is genuinely behind", () => {
    const notice = degradedNotice(
      status([service({ status: "degraded_performance", detail: "2 of 5 runs behind." })]),
    );
    expect(notice.show).toBe(true);
    expect(notice.title).toContain("Agent processing");
  });

  it("ignores a historical 24-hour window verdict", () => {
    const notice = degradedNotice(
      status([
        service({ status: "degraded_performance", window: "last 24 hours", covers_now: false }),
      ]),
    );
    expect(notice.show).toBe(false);
  });
});
