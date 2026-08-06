import { describe, it, expect } from "vitest";
import { scoreCandidate, type RequirementInput } from "@/lib/scoring-engine.server";

/**
 * Engine regression corpus (Prompt 5).
 *
 * Every future engine change must keep these statuses. Each fixture is a
 * real-shaped CV/requirement pair, including the classic false positives
 * (java/javascript, go/google, react/preact) and negated mentions.
 *
 * CVs are deliberately long enough (>=300 chars, >=40 tokens) that a non-match
 * resolves to `missing` rather than `unknown` — the thin-CV regime is covered
 * separately in scoring-engine-unknown.test.ts.
 */

const filler = [
  "Worked across product squads shipping customer facing features on a weekly cadence.",
  "Owned reliability targets, wrote architecture decision records, ran incident reviews,",
  "mentored junior colleagues, improved onboarding documentation, tracked delivery metrics,",
  "partnered with design and support, presented quarterly roadmaps to leadership, and",
  "drove hiring loops for the team across four consecutive quarters of headcount growth.",
].join(" ");

const req = (text: string, keywords: string[], required = true): RequirementInput => ({
  id: `r-${keywords.join("-")}`,
  text,
  required,
  keywords,
});

type Fixture = {
  name: string;
  cv: string;
  requirement: RequirementInput;
  expected: "met" | "partial" | "missing" | "unknown" | "contradicted";
};

const FIXTURES: Fixture[] = [
  // ---- classic false positives -------------------------------------------
  {
    name: "java requirement does not match javascript",
    cv: `Frontend engineer writing JavaScript and modern browser APIs daily. ${filler}`,
    requirement: req("Java", ["java"]),
    expected: "missing",
  },
  {
    name: "javascript requirement does not match java",
    cv: `Backend engineer building Java services on the JVM with Spring Boot. ${filler}`,
    requirement: req("JavaScript", ["javascript"]),
    expected: "missing",
  },
  {
    name: "go requirement does not match google",
    cv: `Analyst who ran Google Ads campaigns and Google Analytics reporting. ${filler}`,
    requirement: req("Go", ["go"]),
    expected: "missing",
  },
  {
    name: "react requirement does not match preact only",
    cv: `Built interfaces with Preact for a low bandwidth market and tuned bundles. ${filler}`,
    requirement: req("React", ["react"]),
    expected: "missing",
  },
  {
    name: "sql requirement does not match nosql-only prose",
    cv: `Data engineer working with NoSQL document stores and key value caches. ${filler}`,
    requirement: req("SQL", ["sql"]),
    expected: "missing",
  },
  {
    name: "rn requirement does not match the word learn",
    cv: `Administrator eager to learn clinical workflows and support charting staff. ${filler}`,
    requirement: req("Registered nurse (RN)", ["rn"]),
    expected: "missing",
  },
  {
    name: "c# requirement does not match the letter c in prose",
    cv: `Consultant covering commercial contracts, category strategy and cost control. ${filler}`,
    requirement: req("C#", ["c#"]),
    expected: "missing",
  },
  {
    name: "r requirement does not match random words",
    cv: `Researcher producing reports, dashboards and recurring reconciliation packs. ${filler}`,
    requirement: req("R", ["r"]),
    expected: "missing",
  },

  // ---- synonym expansion --------------------------------------------------
  {
    name: "k8s in CV satisfies a Kubernetes requirement",
    cv: `Platform engineer running k8s clusters with Helm charts and autoscaling. ${filler}`,
    requirement: req("Kubernetes", ["kubernetes"]),
    expected: "met",
  },
  {
    name: "Kubernetes in CV satisfies a k8s requirement",
    cv: `Ran Kubernetes in production across three regions with blue green rollouts. ${filler}`,
    requirement: req("k8s administration", ["k8s"]),
    expected: "met",
  },
  {
    name: "postgres satisfies a PostgreSQL requirement",
    cv: `Owned Postgres schema migrations, index tuning and replica failover drills. ${filler}`,
    requirement: req("PostgreSQL", ["postgresql"]),
    expected: "met",
  },
  {
    name: "nodejs satisfies a Node.js requirement",
    cv: `Built nodejs services with streaming APIs and background job workers. ${filler}`,
    requirement: req("Node.js", ["node.js"]),
    expected: "met",
  },
  {
    name: "ts satisfies a TypeScript requirement",
    cv: `Migrated the codebase to TS with strict null checks and generated clients. ${filler}`,
    requirement: req("TypeScript", ["typescript"]),
    expected: "met",
  },
  {
    name: "aws satisfies an Amazon Web Services requirement",
    cv: `Managed AWS accounts, IAM boundaries, cost budgets and multi region backups. ${filler}`,
    requirement: req("AWS", ["aws"]),
    expected: "met",
  },
  {
    name: "emr satisfies an EHR requirement",
    cv: `Clinical informatics lead configuring EMR order sets and documentation flows. ${filler}`,
    requirement: req("EHR systems", ["ehr"]),
    expected: "met",
  },
  {
    name: "know your customer satisfies a KYC requirement",
    cv: `Ran know your customer reviews, sanctions screening and escalation reporting. ${filler}`,
    requirement: req("KYC", ["kyc"]),
    expected: "met",
  },
  {
    name: "google sheets satisfies an Excel requirement",
    cv: `Financial analyst modelling in Google Sheets with pivot reporting and macros. ${filler}`,
    requirement: req("Excel", ["excel"]),
    expected: "met",
  },
  {
    name: "continuous integration satisfies a CI/CD requirement",
    cv: `Owned continuous integration pipelines, test sharding and release gating. ${filler}`,
    requirement: req("CI/CD", ["ci/cd"]),
    expected: "met",
  },
  {
    name: "synonyms do not bridge java and javascript",
    cv: `Wrote JS bundles, ES6 modules and browser performance budgets. ${filler}`,
    requirement: req("Java", ["java"]),
    expected: "missing",
  },
  {
    name: "reach truck satisfies a forklift requirement",
    cv: `Warehouse operative certified on reach truck operation and pallet putaway. ${filler}`,
    requirement: req("Forklift licence", ["forklift"]),
    expected: "met",
  },

  // ---- negation -----------------------------------------------------------
  {
    name: "no experience with Kubernetes is contradicted",
    cv: `Backend developer with no experience with Kubernetes so far in production. ${filler}`,
    requirement: req("Kubernetes", ["kubernetes"]),
    expected: "contradicted",
  },
  {
    name: "never used Terraform is contradicted",
    cv: `Infrastructure adjacent engineer; never used Terraform on any project yet. ${filler}`,
    requirement: req("Terraform", ["terraform"]),
    expected: "contradicted",
  },
  {
    name: "unfamiliar with Salesforce is contradicted",
    cv: `Sales operations analyst, unfamiliar with Salesforce reporting objects. ${filler}`,
    requirement: req("Salesforce", ["salesforce"]),
    expected: "contradicted",
  },
  {
    name: "without any AWS exposure is contradicted",
    cv: `Systems engineer without any AWS exposure across the last five years. ${filler}`,
    requirement: req("AWS", ["aws"]),
    expected: "contradicted",
  },
  {
    name: "bare 'no Postgres' is contradicted",
    cv: `Data analyst with no Postgres work; used spreadsheets and BI tools instead. ${filler}`,
    requirement: req("PostgreSQL", ["postgresql"]),
    expected: "contradicted",
  },
  {
    name: "'lacks Python' is contradicted",
    cv: `Strong analyst who lacks Python but automates with low code tooling. ${filler}`,
    requirement: req("Python", ["python"]),
    expected: "contradicted",
  },
  {
    name: "'not familiar with HIPAA' is contradicted",
    cv: `Operations coordinator not familiar with HIPAA obligations in US clinics. ${filler}`,
    requirement: req("HIPAA", ["hipaa"]),
    expected: "contradicted",
  },
  {
    name: "negation in a prior sentence does not poison a later positive mention",
    cv: `No formal design training. Shipped React applications for four years running. ${filler}`,
    requirement: req("React", ["react"]),
    expected: "met",
  },
  {
    name: "'no downtime' does not negate a nearby unrelated skill",
    cv: `Delivered zero downtime migrations. Operated Kafka clusters at high volume. ${filler}`,
    requirement: req("Kafka", ["kafka"]),
    expected: "met",
  },
  {
    name: "negation of one term leaves another requirement intact",
    cv: `No experience with Kubernetes, but deep Docker and Linux packaging work. ${filler}`,
    requirement: req("Docker", ["docker"]),
    expected: "met",
  },

  // ---- plain positives / partials -----------------------------------------
  {
    name: "multi-keyword requirement fully evidenced is met",
    cv: `Engineer shipping React and TypeScript products with Postgres behind them. ${filler}`,
    requirement: req("React and TypeScript", ["react", "typescript"]),
    expected: "met",
  },
  {
    name: "multi-keyword requirement half evidenced is partial",
    cv: `Engineer shipping React interfaces; backend owned by another squad entirely. ${filler}`,
    requirement: req("React and Kubernetes and Terraform", ["react", "kubernetes", "terraform"]),
    expected: "partial",
  },
  {
    name: "preferred requirement is assessed the same way as a must-have",
    cv: `Manager who ran HACCP audits, supplier checks and food safety training. ${filler}`,
    requirement: req("HACCP", ["haccp"], false),
    expected: "met",
  },
  {
    name: "punctuated term still matches inside prose",
    cv: `Built .NET services and migrated legacy WCF endpoints to modern hosting. ${filler}`,
    requirement: req("C#/.NET", [".net"]),
    expected: "met",
  },
];

describe("scoring engine — fixture regression corpus (F-005)", () => {
  it("covers at least 30 CV/requirement pairs", () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(30);
  });

  for (const f of FIXTURES) {
    it(f.name, () => {
      const r = scoreCandidate({
        cv_text: f.cv,
        requirements: [f.requirement],
        screening: [],
      });
      const a = r.requirement_assessment[0]!;
      expect(a.status).toBe(f.expected);
      // Contradictions must always carry the snippet that justifies them.
      if (f.expected === "contradicted") {
        expect(a.evidence.length).toBeGreaterThan(0);
        expect(a.evidence[0]!.snippet.length).toBeGreaterThan(10);
      }
    });
  }
});
