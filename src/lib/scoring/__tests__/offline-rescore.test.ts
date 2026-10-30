import { describe, expect, it } from "vitest";
import { jsonbText, offlineRescore, type OfflineContext, type OfflineMatch } from "../offline-rescore";
import { ENGINE_VERSION } from "../engine-version";

const ctx: OfflineContext = {
  position: {
    id: "228cd1ec-1ec1-4205-828c-7a92b1be42e1",
    requirements: [
      { label: "Hands-on marketing experience in at least one of: South Korea, Japan, Singapore, Hong Kong, China or Vietnam" },
      { label: "10 or more years of progressive marketing experience" },
    ],
    preferred_requirements: [{ label: "Arabic language skills" }],
  },
  rubric: { id: "05267eed-5042-41b1-aa25-e8fd165b7ea2", calibration: {} },
  role_family: null,
  reason: "test",
};

const match = (cv: string): OfflineMatch => ({
  match_id: "dd7f35f1-7dae-40ec-870e-a8d2fed5d448",
  application_id: "3bfa31dc-91f7-4d42-b332-a7719f75e0cd",
  candidate_profile_id: "07e94312-81fd-4f0c-9d2d-582d42fb31a9",
  position_id: ctx.position.id,
  organization_id: "1def8e51-d266-48a4-8829-065d0201b447",
  eligibility_status: "eligible",
  cv_text: cv,
  location: "Dubai",
  city: "Dubai",
  country: "United Arab Emirates",
  answers: [
    {
      question_id: "ebb353f2-fc97-41a5-ac7a-2af8bde8fba6",
      answer: { value: false },
      q: { question: "Are you fluent in professional business Arabic?", answer_type: "boolean", required: true, dealbreaker: false },
    },
  ],
});

const CV = [
  "Professional Experience",
  "Group Marketing Director, Damas Jewellery, Dubai Jan 2015 – Mar 2025",
  "Lead the regional marketing strategy of international brands: Graff Dubai, Mikomoto UAE, Queelin UAE.",
  "Marketing Manager, ABC Group, Beirut Feb 2005 – Dec 2014",
].join("\n");

describe("jsonbText", () => {
  it("orders keys as Postgres jsonb does: by length, then bytes", () => {
    expect(jsonbText({ bb: 1, a: [true, null, "x\n"], c: { z: 0.5 } })).toBe('{"a": [true, null, "x\\n"], "c": {"z": 0.5}, "bb": 1}');
  });
});

describe("offlineRescore", () => {
  it("writes one guarded transaction on the current engine without carrying the CV text", () => {
    const out = offlineRescore(match(CV), ctx, { run_id: "11111111-1111-4111-8111-111111111111", trace_id: "sc_test" });
    expect(out.kind).toBe("scored");
    if (out.kind !== "scored") return;
    expect(out.sql).toMatch(/^DO \$do\$/);
    expect(out.sql).toContain(`'${ENGINE_VERSION}'`);
    expect(out.sql).toMatch(/md5\(r::text\) <> '[0-9a-f]{32}'/);
    expect(out.sql).toMatch(/md5\(cv\) <> '[0-9a-f]{32}'/);
    // Evidence quotes are part of the result; the whole CV is not.
    expect(out.sql).not.toContain(JSON.stringify(CV).slice(1, -1));
    expect(out.sql).toContain("'eligible'");
  });

  it("credits the brand from a named market on the engine it ships with", () => {
    const out = offlineRescore(match(CV), ctx);
    expect(out.kind).toBe("scored");
    if (out.kind !== "scored") return;
    expect(out.sql).toMatch(/Mikomoto \(Japan\)/);
  });

  it("sends a CV with no dated roles to manual review and a missing CV is skipped", () => {
    expect(offlineRescore(match("A cover letter about my marketing career and my passion for brands and retail."), ctx).kind).toBe("no_dated_roles");
    expect(offlineRescore(match(""), ctx)).toMatchObject({ kind: "skipped", why: "cv_unparsed" });
  });
});
