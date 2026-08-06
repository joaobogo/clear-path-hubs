import { describe, expect, it } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";
import { DEFAULT_CALIBRATION } from "@/lib/scoring/engine-calibration";

const cal = DEFAULT_CALIBRATION;

const STRONG_CV = `
Senior Kubernetes Platform Engineer with 9 years of experience.
Led Kubernetes and Terraform migrations across AWS, building CI/CD pipelines
with GitHub Actions and ArgoCD. Deep TypeScript and Node.js background,
Postgres schema design, observability with Prometheus and Grafana.
Managed a team of six engineers and owned SRE on-call rotation.
Kubernetes operators, Helm charts, service mesh with Istio.
TypeScript, Node.js, Postgres, Terraform, AWS, CI/CD, Prometheus.
`.repeat(3);

const REQS = [
  { id: "r1", text: "Kubernetes and Terraform on AWS", required: true, keywords: null },
  { id: "r2", text: "TypeScript and Node.js services", required: true, keywords: null },
  { id: "r3", text: "Postgres schema design", required: true, keywords: null },
  { id: "r4", text: "Observability with Prometheus and Grafana", required: false, keywords: null },
];

describe("applied caps", () => {
  it("records no cap — and no mirrored value — for a clean strong run", () => {
    const r = scoreCandidate({ cv_text: STRONG_CV, requirements: REQS, screening: [], calibration: cal });
    expect(r.applied_caps).toEqual([]);
    expect(r.score).toBeCloseTo(r.raw_score, 5);
  });

  it("caps a dealbreaker candidate and names the dealbreaker in the reason", () => {
    const r = scoreCandidate({
      cv_text: STRONG_CV,
      requirements: REQS,
      screening: [
        {
          question_id: "q1",
          question: "Do you have the right to work in Germany?",
          required: true,
          answer_type: "boolean",
          value: false,
          disqualifying_condition: { operator: "equals", value: false },
        },
      ],
      calibration: cal,
    });
    expect(r.raw_score).toBeGreaterThan(50);
    const cap = r.applied_caps.find((c) => c.reason.startsWith("disqualifying_answer"));
    expect(cap).toBeDefined();
    expect(cap!.reason).toContain("right to work in Germany");
    expect(cap!.cap).toBe(cal.disqualified_cap);
    expect(r.score).toBeLessThanOrEqual(cal.disqualified_cap * 100 + 0.05);
    expect(r.score).toBeLessThan(r.raw_score);
    expect(r.fit_label).toBe("not_a_fit");
  });

  it("caps an unparsed CV and says so", () => {
    const r = scoreCandidate({ cv_text: "k8s", requirements: REQS, screening: [], calibration: cal });
    const cap = r.applied_caps.find((c) => c.reason.startsWith("unparsed_cv"));
    expect(cap?.cap).toBe(cal.unparsed_cv_cap);
    expect(r.score).toBeLessThanOrEqual(cal.unparsed_cv_cap * 100 + 0.05);
    expect(r.fit_label).toBe("unknown");
  });

  it("caps runs whose must-have coverage sits below the rubric floor", () => {
    const cv = `
      Graphic designer with eight years in brand identity, print production and
      motion graphics. Ran studio operations, managed vendor relationships and
      built a Postgres schema design reference for the asset catalogue.
    `.repeat(4);
    const r = scoreCandidate({ cv_text: cv, requirements: REQS, screening: [], calibration: cal });
    expect(r.must_have_coverage).toBeLessThan(cal.must_have_floor);
    const cap = r.applied_caps.find((c) => c.reason.startsWith("must_have_floor"));
    expect(cap?.cap).toBe(cal.must_have_floor_cap);
    expect(cap!.reason).toContain("below the rubric floor");
    expect(r.score).toBeLessThanOrEqual(cal.must_have_floor_cap * 100 + 0.05);
  });
});
