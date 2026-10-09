/**
 * A task on the feed names the record it is about, and leaves when it is done.
 *
 * Two defects on the admin notifications panel, one finding (audit 1 Sep, F40).
 *
 *   1. Three ACTION REQUIRED items read "CV parsing failed — A CV could not be
 *      parsed and needs attention. Affects: One application document", none
 *      naming its document, over a /admin/parse-failures queue listing ONE
 *      unreadable CV and a Pipeline Health tile reporting UNPROCESSED CVS: 2.
 *      The operator saw three identical tasks, a queue of one and a tile of
 *      two, with no way to tell whether that was one document failing
 *      repeatedly or three documents.
 *
 *   2. Rui Almeida's interview was reported to staff as "Interview slot passed
 *      with no outcome — nobody marked it complete or cancelled" while the
 *      client-facing row for the same person read "Interview cancelled" and
 *      Operations counted it among 3 cancelled (7d). One interview, four
 *      accounts of it, one of them a task asking an operator to chase
 *      something already resolved.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  attemptLabel,
  audienceMaySeeSubject,
  subjectBody,
} from "@/lib/notifications/subject-body";
import {
  INTERVIEW_NO_OUTCOME_TITLE,
  interviewHasOutcome,
  resolvedActionableIds,
  subjectIds,
} from "@/lib/notifications/reconcile-actionable";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("the staff feed names its subject", () => {
  it("names the document for staff", () => {
    expect(subjectBody("admin", "A CV could not be parsed and needs attention.", "GGM.pdf")).toBe(
      "GGM.pdf — A CV could not be parsed and needs attention.",
    );
  });

  it("counts the attempt so a sixth failure does not read like a first", () => {
    expect(attemptLabel("GGM.pdf", 6, null)).toBe("GGM.pdf, attempt 6");
    expect(attemptLabel("GGM.pdf", 6, 6)).toBe("GGM.pdf, attempt 6 of 6");
  });

  it("names nobody to a client or a candidate", () => {
    // The rule that predates this change: client and candidate copy never
    // names an individual. A subject label must not be the hole in it.
    for (const audience of ["client", "candidate", null, undefined, ""]) {
      expect(audienceMaySeeSubject(audience), String(audience)).toBe(false);
      expect(subjectBody(audience, "Something happened.", "Rui Almeida"), String(audience)).toBe(
        "Something happened.",
      );
    }
  });

  it("leaves the body untouched when there is no subject", () => {
    expect(subjectBody("admin", "A CV could not be parsed.", null)).toBe(
      "A CV could not be parsed.",
    );
    expect(subjectBody("admin", "A CV could not be parsed.", "  ")).toBe(
      "A CV could not be parsed.",
    );
  });

  it("does not name the subject twice", () => {
    expect(subjectBody("admin", "GGM.pdf failed to parse.", "GGM.pdf")).toBe(
      "GGM.pdf failed to parse.",
    );
  });

  it("reads the attempt count from the same column the desk shows", () => {
    // /admin/parse-failures lists files.extraction_attempts. Deriving a second
    // counter here (countRecentFailures over processing_jobs is in the same
    // file) is how the feed and the desk would report different numbers for
    // one document — the defect class this finding belongs to.
    const runner = read("src/lib/pipeline-runner.server.ts");
    const subject = runner.slice(runner.indexOf("async function parseFailureSubject"));
    const body = subject.slice(0, subject.indexOf("\n}"));
    expect(body).toMatch(/extraction_attempts/);
    expect(body).not.toMatch(/countRecentFailures|processing_jobs/);
    expect(read("src/lib/parse-failure/parse-failure.functions.ts")).toMatch(
      /extraction_attempts/,
    );
  });
});

describe("a resolved task leaves the feed", () => {
  const open = [
    { id: "n1", entity_type: "candidate_match", entity_id: "m1", title: INTERVIEW_NO_OUTCOME_TITLE },
    { id: "n2", entity_type: "candidate_match", entity_id: "m1", title: "Shortlist needs approval" },
    { id: "n3", entity_type: "candidate_match", entity_id: "m2", title: INTERVIEW_NO_OUTCOME_TITLE },
    { id: "n4", entity_type: "position", entity_id: "m1", title: INTERVIEW_NO_OUTCOME_TITLE },
  ];

  it("retires the no-show task once the interview has an outcome", () => {
    const ids = resolvedActionableIds(
      open,
      "candidate_match",
      new Set(["m1"]),
      INTERVIEW_NO_OUTCOME_TITLE,
    );
    expect(ids).toEqual(["n1"]);
  });

  it("leaves an unrelated approval on the same match alone", () => {
    // Resolving more than the condition answers is worse than the stale row:
    // the operator never sees the item at all.
    const ids = resolvedActionableIds(
      open,
      "candidate_match",
      new Set(["m1"]),
      INTERVIEW_NO_OUTCOME_TITLE,
    );
    expect(ids).not.toContain("n2");
  });

  it("does not cross entity types on a colliding id", () => {
    const ids = resolvedActionableIds(open, "candidate_match", new Set(["m1"]));
    expect(ids).not.toContain("n4");
  });

  it("resolves every open actionable when the client has decided", () => {
    // No title filter: the decision is what all of them were waiting for.
    expect(resolvedActionableIds(open, "candidate_match", new Set(["m1"]))).toEqual(["n1", "n2"]);
  });

  it("counts a cancellation as an outcome — that is the reported case", () => {
    expect(interviewHasOutcome({ status: "cancelled" })).toBe(true);
    expect(interviewHasOutcome({ status: "scheduled", cancelled_at: "2026-08-30T10:00:00Z" })).toBe(
      true,
    );
    expect(interviewHasOutcome({ status: "completed" })).toBe(true);
    expect(interviewHasOutcome({ status: "no_show" })).toBe(true);
  });

  it("does not treat a rebooking as an account of the slot that passed", () => {
    for (const status of ["scheduled", "scheduling", "requested", "proposed", null, ""]) {
      expect(interviewHasOutcome({ status }), String(status)).toBe(false);
    }
  });

  it("queries only the subjects it has open items for", () => {
    expect(subjectIds(open, "candidate_match").sort()).toEqual(["m1", "m2"]);
  });
});

describe("the no-outcome title", () => {
  it("is the title the reader actually sees", () => {
    expect(INTERVIEW_NO_OUTCOME_TITLE).toBe("Interview slot passed with no outcome");
  });
});
