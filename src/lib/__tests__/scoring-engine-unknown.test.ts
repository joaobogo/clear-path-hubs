import { describe, it, expect } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";

const reqs = [
  { id: "r1", text: "React and TypeScript", required: true, keywords: ["react", "typescript"] },
  { id: "r2", text: "Postgres", required: true, keywords: ["postgres"] },
  { id: "r3", text: "AWS", required: false, keywords: ["aws"] },
];

describe("scoring engine — unknown vs missing (F-003)", () => {
  it("thin CV with zero keyword overlap does NOT return irrational 0", () => {
    const r = scoreCandidate({
      cv_text: "Short bio. Loves shipping product.",
      requirements: reqs,
      screening: [],
    });
    // Every required requirement flips to 'unknown', not 'missing'.
    const requiredStatuses = r.requirement_assessment.filter((a) => a.required).map((a) => a.status);
    expect(requiredStatuses.every((s) => s === "unknown")).toBe(true);
    expect(r.requirement_assessment.every((a) => (a.status === "unknown" ? a.needs_validation === true : true))).toBe(true);
    // must_have_coverage sits at the unknown floor (0.4), not 0.
    expect(r.must_have_coverage).toBeGreaterThanOrEqual(0.4);
    expect(r.score).toBeGreaterThan(0);
  });

  it("substantial CV with no keyword match returns 'missing' (not unknown)", () => {
    // Rich, varied CV (>300 chars, >40 unique tokens) with none of react/typescript/postgres/aws.
    const cv = `Senior backend engineer with 9 years shipping distributed microservices across event-driven pipelines. Owned reliability, latency budgets, and observability tooling. Deep experience with Kafka streams, gRPC contracts, protobuf schemas, service meshes, canary deployments, blue green rollouts, feature flags, chaos testing, load shedding, backpressure, saga orchestration, idempotency keys, retries, circuit breakers, and rate limiting. Mentored junior engineers, drove incident reviews, wrote architecture decision records, ran migration playbooks, and improved deploy frequency across four product squads.`;
    const r = scoreCandidate({ cv_text: cv, requirements: reqs, screening: [] });
    const req1 = r.requirement_assessment.find((a) => a.id === "r1");
    expect(req1?.status).toBe("missing");
    // must_have_coverage collapses toward 0 for confirmed missing evidence.
    expect(r.must_have_coverage).toBeLessThan(0.4);
  });

  it("strong direct match still resolves to 'met'", () => {
    const cv = [
      "Senior engineer with 8 years of React and TypeScript across large SPAs.",
      "Owned Postgres migrations, wrote SQL, tuned indexes on production workloads.",
      "Deployed AWS ECS services with Terraform.",
    ].join(" ");
    const r = scoreCandidate({ cv_text: cv, requirements: reqs, screening: [] });
    const req1 = r.requirement_assessment.find((a) => a.id === "r1");
    expect(req1?.status).toBe("met");
    expect(r.score).toBeGreaterThan(60);
  });

  it("disqualifying screening answer caps score but does not zero required evidence", () => {
    const cv = "Senior React and TypeScript engineer. Postgres. AWS.";
    const r = scoreCandidate({
      cv_text: cv,
      requirements: reqs,
      screening: [
        {
          question_id: "q1",
          question: "Can you work in the target timezone?",
          required: true,
          answer_type: "boolean",
          value: false,
          disqualifying_condition: { operator: "equals", value: false },
        },
      ],
    });
    expect(r.contradiction_status).toBe("disqualifying_answer");
    expect(r.fit_label).toBe("not_a_fit");
    expect(r.score).toBeLessThanOrEqual(15);
    // But the evidence itself is preserved for admin review — not blanked out.
    expect(r.requirement_assessment.some((a) => a.status === "met")).toBe(true);
  });
});
