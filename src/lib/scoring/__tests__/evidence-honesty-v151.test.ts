import { describe, expect, it } from "vitest";
import { scoreCandidate, type ScreeningAnswer } from "@/lib/scoring-engine.server";
import { filler, reqFromText } from "@/lib/scoring/golden-corpus";

/**
 * Evidence-honesty pins for engine v1.5.1 — both cases are real, from the
 * post-deploy audit: a requirement naming a product came back "Met" while
 * quoting unrelated tools, and a self-deprecating screening answer credited
 * the very tool it disclaimed.
 */

const assess = (cv: string, requirement: string, screening: ScreeningAnswer[] = []) =>
  scoreCandidate({
    cv_text: `${cv} ${filler}`,
    requirements: [reqFromText(requirement)],
    screening,
  }).requirement_assessment[0]!;

describe("named-product gate (H5)", () => {
  it("does not mark a named product Met when the name is absent", () => {
    const row = assess(
      "Deployed backend services on AWS with Kibana dashboards and PHP/Angular front ends.",
      "Experience with Lovable or a similar AI app builder",
    );
    expect(row.status).not.toBe("met");
  });

  it("marks it Met when the product IS named", () => {
    const row = assess(
      "Built and shipped three internal tools with Lovable, including auth and billing flows.",
      "Experience with Lovable or a similar AI app builder",
    );
    expect(row.status).toBe("met");
  });

  it("an alternatives list still passes on any ONE named alternative", () => {
    const row = assess(
      "Production workloads deployed on Vercel with edge functions.",
      "Experience with Cloudflare, Netlify, or Vercel",
    );
    expect(row.status).toBe("met");
  });

  it("a requirement naming no product keeps its normal threshold", () => {
    const row = assess(
      "Diagnosed and resolved critical production issues across payment flows.",
      "Ability to troubleshoot and solve technical problems independently",
    );
    expect(row.status).toBe("met");
  });
});

describe("self-deprecating qualifiers are not evidence (M6)", () => {
  it("'less experienced with Supabase' does not credit Supabase", () => {
    const row = assess(
      "Strong with React and Node. I'm less experienced with Supabase, though I've read the docs.",
      "Experience with Supabase",
    );
    expect(row.status).not.toBe("met");
  });

  it("'still learning Docker' does not credit Docker", () => {
    const row = assess(
      "Backend engineer. Still learning Docker and container orchestration.",
      "Experience with Docker",
    );
    expect(row.status).not.toBe("met");
  });

  it("Portuguese 'pouca experiência com Kubernetes' does not credit it", () => {
    const row = assess(
      "Desenvolvedor backend. Tenho pouca experiência com Kubernetes até agora.",
      "Experience with Kubernetes",
    );
    expect(row.status).not.toBe("met");
  });

  it("a genuine claim is still credited", () => {
    const row = assess(
      "Ran Kubernetes clusters in production for three years, including upgrades and autoscaling.",
      "Experience with Kubernetes",
    );
    expect(row.status).toBe("met");
  });
});
