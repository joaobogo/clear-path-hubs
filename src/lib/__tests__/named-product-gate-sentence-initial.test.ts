/**
 * A requirement that merely STARTS with a capital letter does not name a product.
 *
 * The named-product gate (F4) refuses to credit a requirement that names a
 * specific tool unless the CV names it too — right, and the reason "Experience
 * with Lovable" stopped being satisfied by quotes about MongoDB.
 *
 * It decided what counted as a named product by looking for a capitalised
 * keyword, and the pattern included `^`. That was added so a product written
 * FIRST — "React and Kubernetes and Terraform" — was visible to the gate. But
 * client requirements are sentences, and every sentence starts with a capital,
 * so the gate also swept up ordinary opening words. Since the gate can REJECT,
 * that is fatal:
 *
 *   "Owns features end to end, from schema design to shipped UI"
 *
 * made `Owns` a required product name. A CV reading "I own features end to end,
 * from Postgres schema design through to the shipped UI a finance team signs
 * off on" matched six of the seven derived terms and was still hard-MISSING,
 * because it never contained the literal string "Owns". The comment directly
 * above the filter claimed sentence-initial words were excluded; the regex said
 * otherwise.
 *
 * A first word is now treated as a product name only when the requirement names
 * another one mid-sentence — the "React and Kubernetes" case the `^` existed
 * for, and never a sentence that simply opens with a verb.
 *
 * Found while building a maximum-score fixture: the CV could not exceed 81.3
 * for reasons that had nothing to do with the CV.
 */
import { describe, expect, it } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";

const req = (id: string, text: string, required = true) => ({
  id,
  text,
  required,
  keywords: [] as string[],
});

/** Long enough to clear the thin-CV cut, so status is a real verdict. */
const pad =
  "Delivered production software for paying customers across eleven years, working " +
  "closely with design and finance colleagues on features used daily by thousands of " +
  "people. Comfortable owning a problem from first conversation through to release, " +
  "and keeping the result healthy afterwards with monitoring and follow-up work. ".repeat(3);

function statusOf(cv: string, text: string) {
  const r = scoreCandidate({
    cv_text: `${cv} ${pad}`,
    requirements: [req("r1", text)],
    screening: [],
  });
  return r.requirement_assessment[0]!.status;
}

describe("a sentence-initial capital is grammar, not a product", () => {
  it("credits a requirement that opens with a verb", () => {
    expect(
      statusOf(
        "I own features end to end, from Postgres schema design and migrations through to the shipped UI a finance team signs off on.",
        "Owns features end to end, from schema design to shipped UI",
      ),
      "the CV evidences this plainly; only the literal word 'Owns' was absent",
    ).toBe("met");
  });

  it("credits a requirement that opens with a noun", () => {
    expect(
      statusOf(
        "Shipped an AI feature into the product: a large language model drafts the monthly narrative, reviewed in-app before publication, used on 840 workspaces every month.",
        "Exposure to AI or large language model features in production",
      ),
    ).toBe("met");
  });
});

describe("the gate still holds where it was written to", () => {
  it("refuses a named product the CV never mentions", () => {
    // The F4 case: generic overlap is not evidence of a specific tool.
    expect(
      statusOf(
        "Built and shipped web applications rapidly for small business clients, handling development end to end.",
        "Experience with Lovable for rapid website and application development",
      ),
      "matching 'application' and 'development' must not evidence Lovable",
    ).not.toBe("met");
  });

  it("still sees a product written first when others are named alongside it", () => {
    // The case `^` was added for. React is sentence-initial, but Kubernetes and
    // Terraform are capitalised mid-sentence, so the requirement is naming
    // products and the first word is one of them.
    expect(
      statusOf(
        "Built dashboards and internal tools, handling deployment and infrastructure work.",
        "React and Kubernetes and Terraform in production",
      ),
      "a CV naming none of the three products must not be credited",
    ).not.toBe("met");
  });

  it("credits a named product the CV does mention", () => {
    expect(
      statusOf(
        "Rebuilt the merchant administration console on Remix, the full-stack React framework, cutting first contentful paint to 840 milliseconds.",
        "Experience with Remix, the full-stack React framework",
      ),
    ).toBe("met");
  });
});
