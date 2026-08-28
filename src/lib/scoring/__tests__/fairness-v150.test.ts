import { describe, expect, it } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";
import { filler, reqFromText } from "@/lib/scoring/golden-corpus";

/**
 * Fairness pins for engine v1.5.0 — every case is a real one from the
 * production audit (finding S-05), where candidates were penalised for
 * wording, language, or grammar rather than substance. Each test states the
 * candidate's actual text and the verdict a fair reader gives it.
 */

const score = (cv: string, requirement: string) =>
  scoreCandidate({
    cv_text: `${cv} ${filler}`,
    requirements: [reqFromText(requirement)],
    screening: [],
  }).requirement_assessment[0]!;

describe("fairness — language requirements", () => {
  it("'Fluent in English' fully satisfies an English-fluency requirement", () => {
    const row = score(
      "Fluent in English; intermediate Japanese.",
      "Fluent professional English speaking and communication skills",
    );
    expect(row.status).toBe("met");
  });

  it("'English: Fluent (C1)' satisfies it too — same statement, same verdict", () => {
    const row = score(
      "English: Fluent (C1). Portuguese: native.",
      "Fluent professional English speaking and communication skills",
    );
    expect(row.status).toBe("met");
  });
});

describe("fairness — Portuguese CVs express the same capability", () => {
  it("PT security specialisation evidences a security requirement", () => {
    const row = score(
      "Especialização em Segurança Cibernética pela UTFPR. Desenvolvimento web com Laravel.",
      "Understanding of practical web security fundamentals",
    );
    expect(["met", "partial"]).toContain(row.status);
    expect(row.status).not.toBe("missing");
  });

  it("PT interface/user-experience work evidences a UX/UI requirement", () => {
    const row = score(
      "Criação de interfaces modernas, responsivas e orientadas à experiência do usuário. Figma.",
      "Understanding of good UX/UI principles",
    );
    expect(row.status).toBe("met");
  });
});

describe("fairness — capability realisations", () => {
  it("'diagnosed and resolved critical issues' evidences troubleshooting", () => {
    const row = score(
      "Diagnosed and resolved critical issues involving Google OAuth, Auth.js, and account persistence.",
      "Ability to troubleshoot and solve technical problems independently",
    );
    expect(row.status).toBe("met");
  });

  it("'uses AI tools to improve development workflows' evidences AI-tool comfort", () => {
    const row = score(
      "Uses AI tools to improve development workflows. ChatGPT, GitHub Copilot, AI-assisted coding.",
      "Comfortable using AI tools as part of the development workflow",
    );
    expect(row.status).toBe("met");
  });
});

describe("fairness — alternatives lists", () => {
  it("any one of 'Cloudflare, Netlify, or Vercel' satisfies the requirement", () => {
    const row = score(
      "Deployed and operated production workloads on Vercel with edge functions.",
      "Experience with Cloudflare, Netlify, or Vercel",
    );
    expect(row.status).toBe("met");
  });

  it("'React or a similar frontend framework' keeps its normal threshold", () => {
    // Lowercase alternatives are not a proper-noun list — a stray generic
    // word must not clear the whole requirement.
    const row = score(
      "Worked with a framework for internal dashboards.",
      "React or a similar modern frontend framework with TypeScript",
    );
    expect(row.status).not.toBe("met");
  });
});

describe("fairness — inflection does not cross name boundaries", () => {
  it("'reacting to incidents' is NOT evidence of React (5 letters — no inflection)", () => {
    const row = score(
      "On-call engineer reacting to incidents and paging escalations.",
      "React",
    );
    expect(row.status).toBe("missing");
  });

  it("'workflows' satisfies 'workflow' (6+ letters inflect)", () => {
    const row = score(
      "Automated deployment workflows for the platform team.",
      "Experience building automation workflow",
    );
    expect(row.status).not.toBe("missing");
  });

  it("'go' still cannot match 'google'", () => {
    const row = score("Ran Google Ads campaigns and Google Analytics reporting.", "Go");
    expect(row.status).toBe("missing");
  });

  it("'java' still cannot match 'javascript'", () => {
    const row = score("Frontend engineer writing JavaScript daily.", "Java");
    expect(row.status).toBe("missing");
  });
});
