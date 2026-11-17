/**
 * v1.8.0 — warehouse roles in Poland written in Portuguese (Respekt, 17 Nov
 * 2026). Every must-have asks what the candidate will do (relocate, work
 * 12-hour shifts, do warehouse work), and the CVs arrive in Portuguese or
 * English. The fixture is a frozen applicant with the name, employers and
 * contact details replaced.
 */
import { describe, expect, it } from "vitest";
import {
  findTermMatches,
  scoreCandidate,
  tokenize,
  type ScreeningAnswer,
} from "@/lib/scoring-engine.server";
import { expandTerm } from "@/lib/scoring/term-synonyms";
import { isAvailabilityRequirement } from "@/lib/scoring/availability";
import { alternativeItems } from "@/lib/scoring/alternatives";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";

const TODAY = new Date("2026-11-17T00:00:00Z");

const RELOCATE =
  "Disponibilidade para se mudar para a Polônia e trabalhar presencialmente perto de Katowice";
const SHIFTS = "Disponibilidade para turnos de 12 horas, de dia e de noite";
const WAREHOUSE_WORK =
  "Disposição para trabalho operacional em armazém: separação, recebimento e embalagem de mercadorias";
const REQUIREMENTS = [
  { id: "req-0", text: RELOCATE, required: true, keywords: [] },
  { id: "req-1", text: SHIFTS, required: true, keywords: [] },
  { id: "req-2", text: WAREHOUSE_WORK, required: true, keywords: [] },
  {
    id: "pref-0",
    text: "Experiência em armazém, estoque, logística ou centro de distribuição",
    required: false,
    keywords: [],
  },
  {
    id: "pref-1",
    text: "Experiência com leitor de código de barras (scanner)",
    required: false,
    keywords: [],
  },
  {
    id: "pref-2",
    text: "Experiência com empilhadeira ou selecionadora de pedidos",
    required: false,
    keywords: [],
  },
];

/** An applicant from Brazil who wrote the CV in English. */
const FORKLIFT_CV = [
  "PEDRO ALVES COSTA",
  "Location: Centro, Vitória/ES, Brazil",
  "PROFESSIONAL EXPERIENCE (Official Employment Record)",
  "PORTO SUL RECURSOS HUMANOS LTDA (Offshore Contract)",
  "Role: Forklift Operator",
  "Period: 04/09/2026 – Present",
  "RODOVIA TRANSPORTES DEDICADOS LTDA",
  "Role: Driver – Intermittent",
  "Period: 12/15/2025 – 07/20/2026",
  "RAPIDO EXPRESS LOGISTICA SA (Port Contract)",
  "Role: Machinery and Equipment Operator I",
  "Period: 02/01/2025 – 08/06/2025",
  "COMERCIAL PECAS S.A.",
  "Role: Forklift Operator",
  "Period: 08/05/2024 – 11/01/2024",
  "",
  "EDUCATION AND QUALIFICATIONS",
  "● Technical Degree in Logistics: Federal Institute of the South",
  "● NR 11 Standard Certification: Material Handling, Transportation, Storage, and",
  "Operation",
  "Clarifications",
  "1. Operador TB2: certified operator of heavy machinery used in port logistics and cargo",
  "handling.",
  "2. CNH Categoria D (EAR): Exercício de Atividade Remunerada, professional driver status.",
].join("\n");

const yesNo = (
  id: string,
  question: string,
  must_have: string,
  value: boolean,
  dealbreaker = true,
): ScreeningAnswer => ({
  question_id: id,
  question,
  required: true,
  answer_type: "boolean",
  value,
  disqualifying_condition: dealbreaker ? { operator: "equals", value: false } : null,
  must_have,
});
const relocate = (v: boolean) =>
  yesNo(
    "q-relocate",
    "Você tem disponibilidade para se mudar para a Polônia nos próximos 3 meses?",
    RELOCATE,
    v,
  );
const flight = (v: boolean) =>
  yesNo(
    "q-flight",
    "Você consegue pagar a sua passagem aérea até a Polônia?",
    "Pagar a própria passagem aérea até a Polônia",
    v,
  );
const shifts = (v: boolean, dealbreaker = true) =>
  yesNo(
    "q-shifts",
    "Você aceita trabalhar em turnos de 12 horas, das 6h às 18h ou das 18h às 6h?",
    SHIFTS,
    v,
    dealbreaker,
  );

const score = (screening: ScreeningAnswer[], cv = FORKLIFT_CV) =>
  scoreCandidate({
    cv_text: cv,
    requirements: REQUIREMENTS,
    screening,
    candidate_location: "Vitória, ES, Brasil",
    as_of: TODAY,
  });
const row = (r: ReturnType<typeof score>, id: string) =>
  r.requirement_assessment.find((a) => a.id === id)!;

describe("availability requirements", () => {
  it("are recognised in Portuguese, Spanish and English", () => {
    for (const t of [
      RELOCATE,
      SHIFTS,
      WAREHOUSE_WORK,
      "Disponibilidad para trabajar turnos de noche",
      "Willing to relocate to Dubai",
      "Available to start within four weeks",
      "Able to work night shifts and weekends",
    ]) {
      expect(isAvailabilityRequirement(t), t).toBe(true);
    }
  });

  it("experience requirements are not availability, whatever else they say", () => {
    for (const t of [
      "Experiência em armazém, estoque, logística ou centro de distribuição",
      "Experiência com empilhadeira ou selecionadora de pedidos",
      "5+ years of billing experience",
      "Able to work from the Woodbridge, New Jersey office at least 3 days a week",
      "Command of billing mechanics: engagement terms, rate structures",
    ]) {
      expect(isAvailabilityRequirement(t), t).toBe(false);
    }
  });

  it("a yes to the question asked for one is met, with the answer as its evidence", () => {
    const r = score([relocate(true), flight(true), shifts(true)]);
    for (const id of ["req-0", "req-1"]) {
      const a = row(r, id);
      expect(a.status).toBe("met");
      expect(a.needs_validation).toBe(false);
      expect(a.evidence[0]!.source).toBe("screening");
      expect(a.evidence[0]!.snippet).toMatch(/^Answered yes to:/);
    }
    // A CV cannot back a commitment, so a yes is not an unverified claim.
    expect(r.unverified_screening_claims).toEqual([]);
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("a no is not met, and says so", () => {
    const r = score([relocate(true), flight(true), shifts(false, false)]);
    const a = row(r, "req-1");
    expect(a.status).toBe("missing");
    expect(a.rule_note).toContain("The candidate answered no to");
    expect(a.evidence[0]!.snippet).toMatch(/^Answered no to:/);
  });

  it("the rows say what the candidate answered even when another answer disqualifies", () => {
    const r = score([relocate(true), flight(false), shifts(true)]);
    expect(r.score).toBe(15);
    expect(r.contradiction_status).toBe("disqualifying_answer");
    expect(row(r, "req-0").status).toBe("met");
    expect(row(r, "req-1").status).toBe("met");
  });

  it("an availability row nobody asked about is unknown, not missing", () => {
    const cv = [
      "Ana Lima",
      "PROFESSIONAL EXPERIENCE",
      "Cashier, Mercado Bom | Jan 2022 – Present",
      "Served customers at the till.",
    ].join("\n");
    const r = score([relocate(true), flight(true), shifts(true)], cv);
    const a = row(r, "req-2");
    expect(a.status).toBe("unknown");
    expect(a.needs_validation).toBe(true);
  });
});

describe("Portuguese requirements against an English CV", () => {
  it("reads whole words, not fragments, and drops connectives", () => {
    expect(
      tokenize("Experiência em armazém, estoque, logística ou centro de distribuição"),
    ).toEqual(["experiência", "armazém", "estoque", "logística", "centro", "distribuição"]);
  });

  it("a word is not found inside a longer word in any alphabet", () => {
    expect(findTermMatches("Técnico em logística", "log")).toEqual([]);
    expect(findTermMatches("ARMAZÉM CENTRAL", "armazém")).toHaveLength(1);
  });

  it("matches Portuguese terms to their English and unaccented forms", () => {
    expect(expandTerm("empilhadeira")).toContain("forklift");
    expect(expandTerm("forklift")).toContain("empilhadeira");
    expect(expandTerm("logística")).toEqual(expect.arrayContaining(["logistics", "logistica"]));
    expect(expandTerm("armazém")).toEqual(expect.arrayContaining(["warehouse", "armazem"]));
  });

  it("a forklift operator meets 'empilhadeira ou selecionadora de pedidos'", () => {
    const r = score([relocate(true), flight(true), shifts(true)]);
    expect(row(r, "pref-2").status).toBe("met");
    expect(row(r, "pref-2").matched_terms).toEqual(["empilhadeira"]);
    // Logistics (employer and degree) meets the list of warehouse settings.
    expect(row(r, "pref-0").status).toBe("met");
    // Nothing about scanners: missing, not a match on "de".
    expect(row(r, "pref-1").status).toBe("missing");
    expect(row(r, "pref-1").matched_terms).toEqual([]);
  });
});

describe("plain lists of alternatives", () => {
  const framing = new Set(["experiência", "experience"]);
  it("are read in Portuguese and Spanish", () => {
    expect(
      alternativeItems("Experiência com empilhadeira ou selecionadora de pedidos", framing),
    ).toEqual([["empilhadeira"], ["selecionadora", "pedidos"]]);
  });

  it("English lists are left as they were", () => {
    expect(
      alternativeItems(
        "Experience within retail, shopping malls, hospitality or mixed use developments",
        framing,
      ),
    ).toBeNull();
    expect(alternativeItems("React or a similar frontend framework", framing)).toBeNull();
  });

  it("an item joined by 'e' or 'com' is not a list", () => {
    expect(alternativeItems("Experiência com Excel e Word ou Google Sheets", framing)).toBeNull();
  });
});

it("is engine v1.8.0", () => {
  expect(ENGINE_VERSION).toBe("taasflow-scoring-v1.8.0");
});
