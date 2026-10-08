import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntakeReviewPanel } from "@/components/intake/review-panel";
import type { IntakeReview } from "@/lib/intake-review";

const review: IntakeReview = {
  headline: "Engineer · Example", answeredCount: 2, missing: [],
  groups: [{ id: "role", step: 0, title: "Role overview", rows: [
    { field: "jdFilename", label: "Attached job description", value: "engineering.pdf", step: 0, focusLabel: "Job description" },
    { field: "jobDescriptionText", label: "Job description", value: "First paragraph\n\n" + "Complete detail. ".repeat(100) + "Final paragraph", step: 0, focusLabel: "Job description", fullWidth: true },
  ] }],
};
const render = (extra = {}) => renderToStaticMarkup(createElement(IntakeReviewPanel, { review, onEdit: () => undefined, ...extra }));

describe("intake review presentation", () => {
  it("shows complete text and filename automatically without a disclosure", () => {
    const html = render();
    expect(html).toContain("Review your hiring brief");
    expect(html).toContain("engineering.pdf");
    expect(html).toContain(review.groups[0]?.rows[1]?.value);
    expect(html).not.toContain("Show summary");
    expect(html).not.toContain("<details");
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).toContain('aria-label="Edit Job description"');
  });
  it("names required issues and missing answers accessibly", () => {
    const html = render({ review: { ...review, missing: [{ field: "requirements", label: "Must-have requirements", step: 1, focusLabel: "Requirements" }] }, issues: ["Check compensation"] });
    expect(html).toContain("2 required issues");
    expect(html).toContain("Must-have requirements");
    expect(html).toContain("Check compensation");
    expect(html).toContain('role="alert"');
  });
  it("explains unavailable extraction without pretending the filename is the text", () => {
    const html = render({ review: { ...review, groups: [{ ...review.groups[0], rows: [review.groups[0]?.rows[0]] }] } });
    expect(html).toContain("No extracted job text is available yet");
  });
});