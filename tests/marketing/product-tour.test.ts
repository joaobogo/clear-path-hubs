import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Public product tour", () => {
  const tour = readFileSync("src/components/marketing/product-tour.tsx", "utf8");
  it("demonstrates all three pillars with existing labelled product previews", () => {
    for (const name of ["AgentRunsPreview", "EvidenceReviewPanel", "DecisionWorkspacePreview"]) expect(tour).toContain(`<${name}`);
    for (const label of ["Outreach", "Recruiting", "Your ATS"]) expect(tour).toContain(`label: "${label}"`);
    expect(tour).not.toContain("setInterval");
    expect(tour).not.toContain("supabase");
  });
  it("supports keyboard tabs and hides inactive panels", () => {
    for (const value of ['role="tablist"', 'role="tab"', 'role="tabpanel"', 'aria-controls=', 'aria-labelledby=', 'hidden={selected !== index}', '"ArrowLeft"', '"ArrowRight"', '"Home"', '"End"']) expect(tour).toContain(value);
  });
  it("shows the system before the homepage sector gallery", () => {
    const home = readFileSync("src/routes/index.tsx", "utf8");
    expect(home.indexOf("<ProductTour />")).toBeLessThan(home.indexOf("<SectorBand />"));
    const hero = readFileSync("src/components/home/run-hero.tsx", "utf8");
    expect(hero).toContain("Top 10 · {SAMPLE_SHORTLIST_ROLE}");
    expect(hero).not.toContain("Top 10 · {roleTitle}");
  });
  it("keeps reduced motion and human approval visible", () => {
    const css = readFileSync("src/styles/run.css", "utf8");
    expect(css).toContain(".product-tour-panel:not([hidden]) { animation: none; }");
    const agents = readFileSync("src/routes/agents.tsx", "utf8");
    expect(agents.indexOf("{agent.approval}")).toBeLessThan(agents.indexOf('<details className="group'));
  });
});