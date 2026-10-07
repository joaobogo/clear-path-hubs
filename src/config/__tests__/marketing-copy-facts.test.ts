import { describe, expect, it } from "vitest";
import { CHANNEL_AGENT_COUNT, CHANNEL_FAMILIES } from "@/config/channel-agents";
import { ROSTER, ROSTER_COUNTS, countWordCapitalised } from "@/config/agent-roster";
import {
  INTEGRATIONS,
  INTEGRATIONS_LAST_REVIEWED,
  PUBLIC_INTEGRATIONS,
} from "@/config/integrations-directory";
import { ACCEPTED_UPLOADS, PROCESS_STEPS } from "@/config/offer-facts";
import { SOURCING_GROUPS } from "@/components/marketing/how-it-works-deep";

describe("public marketing facts derive from config", () => {
  it("how-it-works channel groups match the channel-agent families", () => {
    expect(SOURCING_GROUPS.map((g) => g.channels.length)).toEqual(
      CHANNEL_FAMILIES.map((f) => f.channels),
    );
    const total = SOURCING_GROUPS.reduce((n, g) => n + g.channels.length, 0);
    expect(total).toBe(CHANNEL_AGENT_COUNT);
  });

  it("how-it-works does not state volume or database-size figures", () => {
    const text = JSON.stringify(
      SOURCING_GROUPS.map((g) => g.channels.map((c) => [c.label, c.note])),
    );
    expect(text).not.toMatch(/900M|20,000|2M\+|50\+ countries|Indeed|Otta|Wellfound/);
  });

  it("roster counts are derived by kind", () => {
    expect(ROSTER_COUNTS.agents + ROSTER_COUNTS.automations).toBe(ROSTER.length);
    expect(ROSTER_COUNTS.agents).toBe(ROSTER.filter((r) => r.kind === "agent").length);
    expect(countWordCapitalised(8)).toBe("Eight");
  });

  it("roster sample candidate is not the enterprise top pick", () => {
    const evidence = ROSTER.find((r) => r.id === "evidence")!;
    expect(evidence.representative.activity).not.toContain("A-1042");
  });

  it("roster states job-description formats and keeps the registry's PDF-only rule for candidate CVs", () => {
    const all = ROSTER.flatMap((r) => r.inputs).join(" ");
    expect(all).toContain(`Job description uploads (${ACCEPTED_UPLOADS})`);
    // Never claim DOCX/TXT/RTF for candidate CVs.
    expect(all).not.toMatch(/CVs? \(PDF, DOCX/);
  });

  it("internal plumbing is kept out of the public integrations list", () => {
    const hidden = INTEGRATIONS.filter((i) => i.public === false).map((i) => i.id);
    expect(hidden).toEqual(
      expect.arrayContaining(["attio", "payment-webhooks", "web-analytics", "workspace-analytics"]),
    );
    expect(PUBLIC_INTEGRATIONS.some((i) => hidden.includes(i.id))).toBe(false);
    expect(INTEGRATIONS_LAST_REVIEWED).toBe("7 October 2026");
  });

  it("the process is four steps", () => {
    expect(PROCESS_STEPS).toHaveLength(4);
  });
});
