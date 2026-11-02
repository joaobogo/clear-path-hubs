/**
 * Owner research, Hughes Mushrooms "Mushroom Harvesting Manager" (2 Nov),
 * platform issue 1: the first dealbreaker asked for "hands-on mushroom
 * picking AS WELL AS supervisory experience on a commercial mushroom farm".
 * A candidate with one but not the other could only answer "no" and was
 * auto-excluded. One requirement per dealbreaker question, on every path.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMPOUND_DEALBREAKER_ERROR_PREFIX,
  applyDealbreakerSplit,
  assertNoCompoundDealbreakers,
  findCompoundDealbreakers,
  splitCompoundQuestion,
  splitGeneratedDealbreakers,
} from "@/lib/positions/compound-dealbreaker";
import {
  evaluatePublishGate,
  humanizePublishBlockedMessage,
  publishBlockedMessage,
  type PublishGateInput,
} from "@/lib/publish-gate";
import { assertPositionPublishable } from "@/lib/publish-gate.server";

const HUGHES_BUNDLED =
  "Do you have direct, hands-on mushroom picking experience as well as supervisory experience on a commercial mushroom farm?";

/** The Hughes role's five stored questions, as they are live (2 Nov). */
const hughes = () => [
  {
    id: "7da77185-54dc-4fd9-89ea-1f960fee0fdb",
    question: HUGHES_BUNDLED,
    answer_type: "boolean" as const,
    required: true,
    dealbreaker: true,
  },
  {
    id: "9816fc81-6e28-4d8e-815d-ee86f37b1f2c",
    question:
      "Are you able to work 100% onsite in Holme-on-Spalding-Moor on a 5-days-out-of-7 rota, including weekends and overtime during peak periods?",
    answer_type: "boolean" as const,
    required: true,
    dealbreaker: true,
  },
  {
    id: "7b815ce0-7af7-45ba-a4b5-34e7044ded23",
    question:
      "Are you fluent in English, both written and spoken, to deliver staff training, disciplinary processes, and cross-departmental coordination?",
    answer_type: "boolean" as const,
    required: true,
    dealbreaker: true,
  },
  {
    id: "c5b1023e-0b34-40be-b352-ceda257589d6",
    question: "What is your current UK work authorization status?",
    answer_type: "text" as const,
    required: true,
    dealbreaker: false,
  },
  {
    id: "4b294949-8742-4fcd-847a-2e2823fca88a",
    question:
      "Do you hold an Advanced Food Hygiene qualification or direct experience participating in HACCP/TACCP/VACCP food safety teams?",
    answer_type: "boolean" as const,
    required: false,
    dealbreaker: false,
  },
];

describe("splitCompoundQuestion", () => {
  it("splits the Hughes dealbreaker into picking and supervision", () => {
    expect(splitCompoundQuestion(HUGHES_BUNDLED)).toEqual({
      connector: "as well as",
      questions: [
        "Do you have direct, hands-on mushroom picking experience?",
        "Do you have supervisory experience on a commercial mushroom farm?",
      ],
    });
  });

  it.each([
    [
      "Do you have hands-on picking experience and also supervisory experience on a commercial farm?",
      "and also",
      [
        "Do you have hands-on picking experience?",
        "Do you have supervisory experience on a commercial farm?",
      ],
    ],
    [
      "Do you have both hands-on picking and supervisory experience on a commercial mushroom farm?",
      "both … and",
      [
        "Do you have hands-on picking experience on a commercial mushroom farm?",
        "Do you have supervisory experience on a commercial mushroom farm?",
      ],
    ],
    [
      "Do you have both a forklift licence and a CSCS card?",
      "both … and",
      ["Do you have a forklift licence?", "Do you have a CSCS card?"],
    ],
    [
      "Do you have hands-on picking experience and supervisory experience on a commercial farm?",
      "and",
      [
        "Do you have hands-on picking experience?",
        "Do you have supervisory experience on a commercial farm?",
      ],
    ],
    [
      "Have you picked mushrooms commercially and supervised a picking team?",
      "and",
      ["Have you picked mushrooms commercially?", "Have you supervised a picking team?"],
    ],
    [
      "Do you have 5 years of experience in sales and marketing and 2 years managing a team?",
      "and",
      [
        "Do you have 5 years of experience in sales and marketing?",
        "Do you have 2 years managing a team?",
      ],
    ],
    [
      "Are you able to work weekends as well as nights?",
      "as well as",
      ["Are you able to work weekends?", "Are you able to work nights?"],
    ],
  ])("%s", (text, connector, questions) => {
    expect(splitCompoundQuestion(text)).toEqual({ connector, questions });
  });

  it.each([
    // The rest of the live dealbreakers on the platform (2 Nov): one requirement each.
    "Are you able to work 100% onsite in Holme-on-Spalding-Moor on a 5-days-out-of-7 rota, including weekends and overtime during peak periods?",
    "Are you fluent in English, both written and spoken, to deliver staff training, disciplinary processes, and cross-departmental coordination?",
    "Do you possess an active Professional Engineer (PE) license?",
    "How many years of structural engineering experience do you have specifically in building design?",
    "Do you have at least 10 years of progressive marketing experience, including at least 5 years in a leadership role?",
    "Do you hold a Bachelor's degree in Marketing, Business Administration, or a related field?",
    "Are you currently based in or willing to relocate to Dubai, UAE, and eligible for UAE employment?",
    "Are you currently authorized to work in Brazil without requiring sponsorship?",
    "How comfortable are you speaking and communicating professionally in English? Please rate your fluency (e.g., conversational, business fluent, native) and describe any experience working in English-speaking teams or with international clients.",
    "Are you fluent in professional English, meaning you are comfortable speaking, explaining technical issues, and participating confidently in meetings?",
    "This role is offered as a PJ (Pessoa Jurídica - independent contractor) in Brazil, with a monthly compensation range of R$3,500–R$4,500. Does this compensation structure and location align with your expectations and capabilities?",
    // The owner's replacement questions.
    "Have you personally picked mushrooms on a commercial farm?",
    "Have you supervised a picking or harvesting team on a commercial farm?",
    // One requirement with a list, a range or a choice in it.
    "Do you have experience with SQL and Python?",
    "Have you worked nights and weekends?",
    "Do you have 5 years and above of experience in harvesting?",
    "Do you have experience picking mushrooms and/or supervising pickers?",
  ])("leaves one requirement alone: %s", (text) => {
    expect(splitCompoundQuestion(text)).toBeNull();
  });
});

describe("findCompoundDealbreakers on a save", () => {
  it("reports a new bundled dealbreaker with its suggested split", () => {
    const found = findCompoundDealbreakers([{ question: HUGHES_BUNDLED, dealbreaker: true }]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      index: 0,
      id: null,
      label: "Screening question 1",
      connector: "as well as",
    });
  });

  it("ignores a bundled question that is not a dealbreaker: it is weighed, never excludes", () => {
    expect(findCompoundDealbreakers([{ question: HUGHES_BUNDLED, dealbreaker: false }])).toEqual(
      [],
    );
  });

  it("an unchanged stored dealbreaker never blocks an unrelated save", () => {
    const stored = hughes();
    const next = stored.map((q) =>
      q.id === "c5b1023e-0b34-40be-b352-ceda257589d6" ? { ...q, required: false } : q,
    );
    expect(findCompoundDealbreakers(next, { stored })).toEqual([]);
    expect(() => assertNoCompoundDealbreakers(next, { stored })).not.toThrow();
    // Whitespace or case is not a rewording.
    const spaced = [
      { ...stored[0]!, question: `  ${HUGHES_BUNDLED.replace(" as well as ", "  as well as ")} ` },
    ];
    expect(findCompoundDealbreakers(spaced, { stored })).toEqual([]);
  });

  it("a reworded one, or one switched to dealbreaker, is checked again", () => {
    const stored = hughes();
    const reworded = stored.map((q, i) =>
      i === 0 ? { ...q, question: `${HUGHES_BUNDLED.slice(0, -1)} in the UK?` } : q,
    );
    expect(findCompoundDealbreakers(reworded, { stored }).map((f) => f.index)).toEqual([0]);

    const asOptional = stored.map((q, i) => (i === 0 ? { ...q, dealbreaker: false } : q));
    const switchedOn = asOptional.map((q, i) => (i === 0 ? { ...q, dealbreaker: true } : q));
    expect(
      findCompoundDealbreakers(switchedOn, { stored: asOptional }).map((f) => f.index),
    ).toEqual([0]);
  });

  it("refuses with the suggestion, never rewriting the text", () => {
    const qs = [{ question: HUGHES_BUNDLED, dealbreaker: true }];
    let message = "";
    try {
      assertNoCompoundDealbreakers(qs);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message.startsWith(COMPOUND_DEALBREAKER_ERROR_PREFIX)).toBe(true);
    expect(message).toContain('Screening question 1 ("' + HUGHES_BUNDLED + '")');
    expect(message).toContain('"Do you have direct, hands-on mushroom picking experience?"');
    expect(message).toContain(
      '"Do you have supervisory experience on a commercial mushroom farm?"',
    );
    expect(message).toMatch(/one but not the other can only answer "no"/);
    expect(qs[0]!.question).toBe(HUGHES_BUNDLED);
  });

  it("publish and blueprint sign-off read every stored dealbreaker", () => {
    expect(findCompoundDealbreakers(hughes()).map((f) => f.id)).toEqual([
      "7da77185-54dc-4fd9-89ea-1f960fee0fdb",
    ]);
  });
});

describe("the author applies the split", () => {
  it("keeps a saved original as an optional non-dealbreaker so its answers survive", () => {
    const qs = hughes().slice(0, 3);
    const [finding] = findCompoundDealbreakers(qs);
    const next = applyDealbreakerSplit(qs, finding!)!;
    expect(next.map((q) => [q.id ?? null, q.question, q.dealbreaker, q.required])).toEqual([
      ["7da77185-54dc-4fd9-89ea-1f960fee0fdb", HUGHES_BUNDLED, false, false],
      [null, "Do you have direct, hands-on mushroom picking experience?", true, true],
      [null, "Do you have supervisory experience on a commercial mushroom farm?", true, true],
      ["9816fc81-6e28-4d8e-815d-ee86f37b1f2c", qs[1]!.question, true, true],
      ["7b815ce0-7af7-45ba-a4b5-34e7044ded23", qs[2]!.question, true, true],
    ]);
    // The result saves: nothing in it bundles two requirements any more.
    expect(findCompoundDealbreakers(next, { stored: qs })).toEqual([]);
  });

  it("replaces an unsaved original and respects the mandatory limit", () => {
    const qs = [
      { question: "Q one is required?", dealbreaker: true, required: true },
      { question: "Q two is required?", dealbreaker: true, required: true },
      { question: "Q three is required?", dealbreaker: true, required: true },
      { question: HUGHES_BUNDLED, dealbreaker: true, required: true },
    ];
    const [finding] = findCompoundDealbreakers(qs);
    const next = applyDealbreakerSplit(qs, finding!)!;
    expect(next).toHaveLength(5);
    expect(next.slice(3).map((q) => [q.dealbreaker, q.required])).toEqual([
      [true, true],
      [true, false],
    ]);
  });

  it("says no when the role is at its question limit (Hughes has five)", () => {
    const qs = hughes();
    const [finding] = findCompoundDealbreakers(qs);
    expect(applyDealbreakerSplit(qs, finding!)).toBeNull();
  });
});

describe("the role generator drafts one requirement per dealbreaker", () => {
  it("splits its own bundled draft and keeps the other settings", () => {
    const drafted = [
      {
        question: HUGHES_BUNDLED,
        dealbreaker: true,
        required: true,
        must_have: "Mushroom picking and supervision",
      },
      { question: "Are you fluent in English?", dealbreaker: true, required: true },
      { question: HUGHES_BUNDLED, dealbreaker: false, required: false },
    ];
    const out = splitGeneratedDealbreakers(drafted);
    expect(out.map((q) => [q.question, q.dealbreaker])).toEqual([
      ["Do you have direct, hands-on mushroom picking experience?", true],
      ["Do you have supervisory experience on a commercial mushroom farm?", true],
      ["Are you fluent in English?", true],
      [HUGHES_BUNDLED, false],
    ]);
    expect(out[1]!.must_have).toBe("Mushroom picking and supervision");
  });

  it("normalizeScreening applies the split before the question and mandatory caps", async () => {
    const { normalizeScreening } = await import("@/lib/blueprint-engine.server");
    const raw = [
      {
        question: HUGHES_BUNDLED,
        answer_type: "boolean",
        required: true,
        dealbreaker: true,
        rationale: "Core of the job.",
      },
      {
        question: "Are you able to work onsite in East Yorkshire on a 5-of-7 rota?",
        answer_type: "boolean",
        required: true,
        dealbreaker: true,
      },
      {
        question: "Are you fluent in written and spoken English?",
        answer_type: "boolean",
        required: true,
        dealbreaker: true,
      },
      {
        question: "What is your current UK work authorisation status?",
        answer_type: "text",
        required: true,
        dealbreaker: false,
      },
      {
        question: "Do you hold an Advanced Food Hygiene qualification?",
        answer_type: "boolean",
        required: false,
        dealbreaker: false,
      },
    ];
    const out = normalizeScreening(raw);
    expect(out).toHaveLength(5);
    expect(out.slice(0, 2).map((q) => q.question)).toEqual([
      "Do you have direct, hands-on mushroom picking experience?",
      "Do you have supervisory experience on a commercial mushroom farm?",
    ]);
    expect(out.slice(0, 2).every((q) => q.dealbreaker && q.rationale === "Core of the job.")).toBe(
      true,
    );
    expect(out.filter((q) => q.required)).toHaveLength(4);
    expect(findCompoundDealbreakers(out)).toEqual([]);
  });
});

describe("publish", () => {
  const ready: PublishGateInput = {
    status: "approved",
    payment_status: "paid",
    approved_at: "2026-10-27T16:45:53Z",
    published_at: null,
    title: "Mushroom Harvesting Manager",
    description:
      "Lead the harvesting team at a commercial mushroom farm in East Yorkshire, planning picking and labour.",
    employment_type: "full_time",
    work_model: "onsite",
    seniority: "senior",
    location: "Holme-on-Spalding-Moor",
    requirements: [{ label: "Hands-on mushroom picking" }],
  };

  it("blocks a role whose stored dealbreaker bundles two requirements", () => {
    expect(evaluatePublishGate(ready)).toEqual([]);
    expect(evaluatePublishGate({ ...ready, screening_questions: hughes() })).toEqual([
      "compound_dealbreaker",
    ]);
    const split = [
      ...hughes().map((q, i) => (i === 0 ? { ...q, dealbreaker: false } : q)),
      { question: "Have you personally picked mushrooms on a commercial farm?", dealbreaker: true },
      {
        question: "Have you supervised a picking or harvesting team on a commercial farm?",
        dealbreaker: true,
      },
    ];
    expect(evaluatePublishGate({ ...ready, screening_questions: split })).toEqual([]);
  });

  it("names the question and its split when going live is refused", async () => {
    const tables: Record<string, unknown> = {
      positions: { ...ready, id: "9466d8ac-0b74-4b14-94e9-0e9d56021fa2" },
      screening_questions: hughes(),
    };
    const admin = {
      from: (t: string) => {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: tables[t], error: null }),
          then: (res: (v: unknown) => unknown) =>
            Promise.resolve({ data: tables[t], error: null }).then(res),
        };
        return q;
      },
    };
    const err = await assertPositionPublishable(
      admin,
      "9466d8ac-0b74-4b14-94e9-0e9d56021fa2",
    ).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain(publishBlockedMessage(["compound_dealbreaker"]));
    expect(message).toContain(
      '"Do you have supervisory experience on a commercial mushroom farm?"',
    );
    expect(humanizePublishBlockedMessage(message)).toMatch(
      /^Approval blocked: a dealbreaker screening question asks for two requirements at once\. One dealbreaker question asks/,
    );
  });
});

describe("every save path for screening questions runs the check before writing", () => {
  const read = (p: string) => readFileSync(p, "utf8");
  const between = (src: string, start: string, end: string) => {
    const from = src.indexOf(start);
    expect(from, start).toBeGreaterThan(-1);
    return src.slice(from, src.indexOf(end, from + start.length));
  };

  it("role editor: against the stored questions, before the position or any question is written", () => {
    const body = between(
      read("src/lib/position-edit.functions.ts"),
      "export const savePositionEdit",
      "export const publishPosition",
    );
    const check = body.indexOf("assertNoCompoundDealbreakers(data.screening_questions, { stored:");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(body.indexOf('.from("positions")\n      .update(patch)'));
    expect(check).toBeLessThan(body.indexOf(".delete()"));
  });

  it("admin screening editor: against the stored questions, before delete or insert", () => {
    const body = between(
      read("src/lib/admin.functions.ts"),
      "export const saveScreeningQuestions",
      "export const getPositionActivity",
    );
    const check = body.indexOf("assertNoCompoundDealbreakers(data.questions, { stored:");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(body.indexOf(".delete()"));
    expect(check).toBeLessThan(body.indexOf(".insert(row)"));
  });

  it("blueprint sign-off: every stored dealbreaker, before it is recorded", () => {
    const body = between(
      read("src/lib/client-positions.functions.ts"),
      "export const confirmRoleBlueprint",
      "export const createWorkspacePosition",
    );
    const check = body.indexOf("findCompoundDealbreakers(");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(body.indexOf("blueprint_confirmed_at: new Date()"));
  });

  it("publish: the gate reads the dealbreaker flag with each question", () => {
    expect(read("src/lib/publish-gate.server.ts")).toContain('.select("question,dealbreaker")');
  });
});
