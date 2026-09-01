/**
 * A quoted requirement can never read "no direct evidence" to the client.
 *
 * passageSupportsRequirement is a keyword test used to choose between quotes.
 * It was also acting as a veto: any quote whose words did not overlap the
 * requirement label was discarded, and when that emptied the list the client
 * card printed "We found no direct evidence" under "What holds it back".
 *
 * MPO 5afc1b56 carried two verbatim CV quotes with character offsets for
 * "Ability to troubleshoot and solve technical problems independently",
 * marked Met on the staff record and agreed by the AI review. Neither quote
 * shares a literal term with the label — "Diagnosed and resolved critical
 * issues involving Google OAuth, Auth.js, and account persistence" — so both
 * were dropped. Admin counted 3 fully evidenced / 3 thin / 1 missing; the
 * client counted 3 evidenced / 4 no evidence for the same run, and named
 * troubleshooting among the four (audit 1 Sep, F19).
 *
 * This cuts the opposite way to F3 and F4: those inflate a verdict, this one
 * deflates it, and presents a candidate to a paying client as weaker than the
 * record supports.
 */
import { describe, expect, it } from "vitest";
import { evidenceSupport } from "@/lib/client-fit-presentation";

const LABEL = "Ability to troubleshoot and solve technical problems independently";
const REQ = { id: "must-0", label: LABEL };

const QUOTES = [
  {
    requirement: LABEL,
    snippet:
      "Diagnosed and resolved critical issues involving Google OAuth, Auth.js, and " +
      "account persistence, increasing authentication reliability.",
    source: "cv",
    source_location: "cv:435-583",
  },
  {
    requirement: LABEL,
    snippet: "TikTok APIs, preparing integrations for use in production environments.",
    source: "cv",
    source_location: "cv:1180-1264",
  },
];

const coverageWith = (status: string) => ({
  requirement_assessment: [{ id: "must-0", text: LABEL, status }],
});

describe("the relevance filter refines, it does not veto", () => {
  it("keeps the run's quotes when none share a word with the label", () => {
    const out = evidenceSupport(REQ, coverageWith("met"), QUOTES);
    expect(out.evidence.length).toBeGreaterThan(0);
    expect(out.evidence[0]!.snippet).toMatch(/Diagnosed and resolved|TikTok APIs/);
  });

  it("does not report a met requirement as not evidenced", () => {
    const out = evidenceSupport(REQ, coverageWith("met"), QUOTES);
    expect(out.status).not.toBe("not_evidenced");
  });

  it("does the same for a partial verdict", () => {
    const out = evidenceSupport(REQ, coverageWith("partial"), QUOTES);
    expect(out.evidence.length).toBeGreaterThan(0);
    expect(out.status).not.toBe("not_evidenced");
  });

  it("still reports nothing when the run itself found nothing", () => {
    // The rescue is for quotes the run ATTACHED. A requirement the run marked
    // missing must stay missing — this must not become a way to manufacture
    // evidence.
    const out = evidenceSupport(REQ, coverageWith("missing"), []);
    expect(out.evidence).toEqual([]);
    expect(out.status).toBe("not_evidenced");
  });

  it("prefers a quote that does speak to the requirement", () => {
    // When the filter finds a relevant passage, that one leads — the fallback
    // only applies where filtering would leave nothing at all.
    const relevant = {
      requirement: LABEL,
      snippet: "Independently troubleshoot production problems across the stack.",
      source: "cv",
      source_location: "cv:10-70",
    };
    const out = evidenceSupport(REQ, coverageWith("met"), [...QUOTES, relevant]);
    expect(out.evidence.some((e) => e.snippet.includes("Independently troubleshoot"))).toBe(true);
  });

  it("never surfaces a contradiction as supporting evidence", () => {
    const out = evidenceSupport(REQ, coverageWith("met"), [
      { ...QUOTES[0]!, contradiction: true },
    ]);
    expect(out.evidence).toEqual([]);
  });
});
