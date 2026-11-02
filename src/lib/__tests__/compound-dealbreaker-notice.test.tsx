/**
 * The notice on the role editor and the admin screening editor. Hughes'
 * role has five questions, the limit: there is no room to split its bundled
 * dealbreaker, and the notice used to show a disabled "Split" button and
 * nothing else to press. It now offers a path that saves.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { CompoundDealbreakerNotice } from "@/components/positions/CompoundDealbreakerNotice";
import {
  applyDealbreakerSplit,
  findCompoundDealbreakers,
} from "@/lib/positions/compound-dealbreaker";

const BUNDLED =
  "Do you have direct, hands-on mushroom picking experience as well as supervisory experience on a commercial mushroom farm?";
const hughes = () => [
  { id: "7da77185-54dc-4fd9-89ea-1f960fee0fdb", question: BUNDLED, dealbreaker: true, required: true },
  { id: "q2", question: "Are you able to work onsite on a 5-of-7 rota?", dealbreaker: true, required: true },
  { id: "q3", question: "Are you fluent in English?", dealbreaker: true, required: true },
  { id: "q4", question: "What is your current UK work authorization status?", dealbreaker: false, required: true },
  { id: "q5", question: "Do you hold an Advanced Food Hygiene qualification?", dealbreaker: false, required: false },
];

function render(questions: ReturnType<typeof hughes>) {
  const findings = findCompoundDealbreakers(questions);
  return renderToStaticMarkup(
    <CompoundDealbreakerNotice
      findings={findings}
      canApply={(f) => applyDealbreakerSplit(questions, f) !== null}
      onApply={vi.fn()}
      onKeepOptional={vi.fn()}
    />,
  );
}

describe("CompoundDealbreakerNotice", () => {
  it("at the question limit: no dead button, a usable 'Keep as an optional question'", () => {
    const html = render(hughes());
    expect(html).not.toContain('data-testid="compound-dealbreaker-apply"');
    expect(html).not.toMatch(/<button[^>]* disabled=""/);
    expect(html).toMatch(
      /<button(?![^>]* disabled="")[^>]*data-testid="compound-dealbreaker-keep-optional"[^>]*>Keep as an optional question<\/button>/,
    );
    expect(html).toContain("this role is at its 5-question limit");
    expect(html).toContain("excludes nobody");
  });

  it("with room: the split, enabled", () => {
    const html = render(hughes().slice(0, 3));
    expect(html).toMatch(
      /<button(?![^>]* disabled="")[^>]*data-testid="compound-dealbreaker-apply"[^>]*>Split into two questions<\/button>/,
    );
    expect(html).not.toContain("compound-dealbreaker-keep-optional");
  });

  it("both editors wire the optional-question path", () => {
    for (const f of [
      "src/components/positions/PositionEditWizard.tsx",
      "src/components/admin/position-detail/tabs.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toMatch(/onKeepOptional=\{[^}]*keepAsOptionalQuestion\(/);
    }
  });
});
