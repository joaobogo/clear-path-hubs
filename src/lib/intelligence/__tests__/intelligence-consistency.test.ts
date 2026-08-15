import { describe, it, expect } from "vitest";
import { buildIntelligence, type IntelligenceRecords } from "../intelligence-builder";

const MOCK_WINDOW = {
  days: 30,
  from: "2026-08-01T00:00:00Z",
  priorFrom: "2026-07-01T00:00:00Z",
  to: "2026-08-31T23:59:59Z",
};

describe("Intelligence Builder - Agent Runs Consistency", () => {
  it("includes feed events in agent run outcomes count", () => {
    const records: IntelligenceRecords = {
      positions: [],
      matches: [],
      history: [],
      scoreRuns: [],
      evidenceItems: [],
      agentRuns: [
        { occurred_at: "2026-08-10T10:00:00Z", outcome: "success" }
      ],
      feedEvents: [
        { occurred_at: "2026-08-11T10:00:00Z", event_type: "candidate_published" },
        { occurred_at: "2026-08-12T10:00:00Z", event_type: "message_sent" }
      ],
      commitments: [],
      interviews: [],
      marketSignals: [],
      window: MOCK_WINDOW,
      positionId: null,
    };

    const result = buildIntelligence(records, new Date("2026-08-15T00:00:00Z"));
    const agentMetric = result.metrics.find(m => m.key === "agent_run_outcomes");
    
    // 1 agentRun + 2 feedEvents = 3
    expect(agentMetric?.sample?.counted).toBe(3);
  });
});
