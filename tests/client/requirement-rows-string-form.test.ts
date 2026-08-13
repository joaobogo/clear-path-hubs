import { it, expect } from "vitest";
import { buildRequirementRows } from "@/lib/client-fit-presentation";
const reqs = ["5+ years building production web applications","Strong SQL and relational data modelling","Experience owning a service end to end","React and TypeScript in production","Cloud deployment experience (AWS/GCP/Azure)","Clear written communication"];
const ev = reqs.slice(0,4).map((r,i)=>({rubric_criterion_key:r,result:i<3?"strong":"partial",factual_quote:"Led "+r,source_kind:"cv"}));
it("resolves string-form requirements", () => {
  const rows = buildRequirementRows({ requirements: reqs }, null, ev as never);
  expect(rows.length).toBe(6);
  expect(rows[0].id).toMatch(/^must-5-years/);
  const evidenced = rows.filter(r=>r.status==="met"||r.status==="partial").length;
  console.log(`${evidenced} of ${rows.length} of your requirements evidenced`);
  expect(evidenced).toBe(4);
  expect(rows[0].evidence[0].snippet).toContain("Led");
});
