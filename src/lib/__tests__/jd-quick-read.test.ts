/**
 * Contract and property tests for the instant job-description read.
 * The corpus test (jd-quick-read.corpus.test.ts) measures accuracy; these pin
 * the formats the owner named and the guarantees the intake relies on: it is
 * fast on any input, never throws, and never guesses from prose.
 */
import { describe, expect, it } from "vitest";
import { normalizeJdText, parseUnambiguousDate, quickReadJd } from "@/lib/jd-quick-read";

const NOW = new Date("2026-10-08T12:00:00Z");
const read = (t: string) => quickReadJd(t, { now: NOW }).blueprint;
const pay = (t: string) => {
  const b = read(t);
  return {
    min: b.salaryMin?.value,
    max: b.salaryMax?.value,
    currency: b.currency?.value,
    period: b.compensationPeriod?.value,
  };
};

describe("compensation formats", () => {
  it.each([
    ["Salary: $90k–$110k", { min: 90000, max: 110000, currency: "USD", period: "year" }],
    ["Salary: $90,000 - $110,000 per year", { min: 90000, max: 110000, currency: "USD", period: "year" }],
    ["Salary: £45k", { min: 45000, max: 45000, currency: "GBP", period: "year" }],
    ["Salário: R$ 8.000 a 12.000 por mês", { min: 8000, max: 12000, currency: "BRL", period: "month" }],
    ["Salary: €50-60K", { min: 50000, max: 60000, currency: "EUR", period: "year" }],
    ["Pay: $45/hr", { min: 45, max: 45, currency: "USD", period: "hour" }],
    ["Salary: up to $120k", { min: undefined, max: 120000, currency: "USD", period: "year" }],
    ["Salary: from $80k", { min: 80000, max: undefined, currency: "USD", period: "year" }],
    ["Sueldo: 50.000 € - 60.000 € brutos anuales", { min: 50000, max: 60000, currency: "EUR", period: "year" }],
    ["Compensation: 90,000 - 110,000 USD per year", { min: 90000, max: 110000, currency: "USD", period: "year" }],
    ["Salary: $62,000 - $70,000 CAD per year", { min: 62000, max: 70000, currency: "CAD", period: "year" }],
    ["Rate: £12.50 an hour", { min: 12.5, max: 12.5, currency: "GBP", period: "hour" }],
  ])("%s", (text, want) => {
    expect(pay(text)).toEqual(want);
  });

  it.each([
    "Salary: DOE",
    "Salary: competitive",
    "Salário: a combinar",
    "We raised $40M and process $2 billion a year.",
    "Benefits: $1,500 learning budget per year and a $1,000 referral bonus.",
    "Sign-on bonus of $5,000.",
    "Compensation includes a $20,000 sign-on bonus.",
    "Compensation includes a $20,000 signing bonus and a $3,000 relocation allowance.",
    "You also receive a $1,000 annual wellness stipend.",
    "Salary: $80,000 - $95,000 per year. Location: Toronto", // "$" could be CAD
    "Sueldo: $35,000 - $45,000 MXN al mes",
    "Salário: R$ 2.800,00", // BRL with no period: monthly or yearly is a guess
    "Day rate: £350 per day", // a day rate is not a period the form can hold
    "Base pay: $120,000 - $150,000 in California and $130,000 - $160,000 in New York.",
  ])("leaves pay empty for %s", (text) => {
    const b = read(text);
    expect(b.salaryMin).toBeUndefined();
    expect(b.salaryMax).toBeUndefined();
    expect(b.currency).toBeUndefined();
  });
});

describe("labels in three languages", () => {
  it("reads Portuguese", () => {
    const b = read("Cargo: Analista de Dados\nEquipe: Dados\nLocal: Recife - PE\nModalidade: Híbrido\nRegime: CLT");
    expect(b.title?.value).toBe("Analista de Dados");
    expect(b.team?.value).toBe("Dados");
    expect(b.location?.value).toBe("Recife, PE");
    expect(b.workModel?.value).toBe("hybrid");
    expect(b.employmentType?.value).toBe("full_time");
  });

  it("reads Spanish", () => {
    const b = read("Puesto: Desarrollador Senior\nUbicación: Bogotá\nModalidad: Remoto\nJornada: Tiempo completo");
    expect(b.title?.value).toBe("Desarrollador Senior");
    expect(b.seniority?.value).toBe("senior");
    expect(b.workModel?.value).toBe("remote");
    expect(b.employmentType?.value).toBe("full_time");
  });

  it("splits the work model out of the place", () => {
    expect(read("Location: Hybrid — London").location?.value).toBe("London");
    expect(read("Location: Hybrid — London").workModel?.value).toBe("hybrid");
    const remote = read("Location: Remote");
    expect(remote.location).toBeUndefined();
    expect(remote.workModel?.value).toBe("remote");
  });

  it("tolerates 'Job Title :' spacing, markdown, entities and CRLF", () => {
    const b = read("**Job Title :** Head of Sales &amp; Partnerships\r\n**Team:** Revenue\r\n");
    expect(b.title?.value).toBe("Head of Sales & Partnerships");
    expect(b.team?.value).toBe("Revenue");
    expect(b.seniority?.value).toBe("director");
  });
});

describe("never guesses from prose", () => {
  it("takes no title or team from a sentence", () => {
    const b = read("We are looking for a hotel general manager to lead our property and its team of 40.");
    expect(b.title).toBeUndefined();
    expect(b.team).toBeUndefined();
    expect(b.seniority).toBeUndefined();
  });

  it("does not read a company name as a title", () => {
    expect(read("Acme Engineering Ltd\nWe build bridges.").title).toBeUndefined();
  });

  it("says nothing when two readings disagree", () => {
    expect(read("Work model: Remote or hybrid").workModel).toBeUndefined();
    expect(read("Junior/Senior Developer").seniority).toBeUndefined();
    expect(read("Employment type: Full-time or part-time").employmentType).toBeUndefined();
  });

  it("does not let an offer of sponsorship read as 'no sponsorship'", () => {
    expect(read("We do not sponsor visas.").requiresExistingWorkAuth?.value).toBe(true);
    expect(read("Visa sponsorship is available. Must be authorized to work in the US.").requiresExistingWorkAuth).toBeUndefined();
  });

  it("does not read 'Lead Generation' as a lead role or 'Contract Manager' as a contract", () => {
    expect(read("Lead Generation Specialist").seniority).toBeUndefined();
    expect(read("Contract Manager").employmentType).toBeUndefined();
  });

  it("does not read a level out of a noun that only looks like one", () => {
    for (const t of ["Data Entry Clerk", "Senior Care Assistant", "Senior Living Sales Counselor", "Graduate Recruiter", "Senior Citizens Programme Coordinator"]) {
      expect(read(t).seniority, t).toBeUndefined();
    }
    expect(read("Senior Accountant").seniority?.value).toBe("senior");
    expect(read("Entry Level Analyst").seniority?.value).toBe("junior");
    expect(read("Graduate Engineer").seniority?.value).toBe("junior");
  });

  it("does not take the employment type from a benefits sentence", () => {
    expect(read("Health insurance is available for full time employees.").employmentType).toBeUndefined();
    expect(read("We are seeking a full-time pastry chef.").employmentType?.value).toBe("full_time");
  });

  it("does not take a work model from a conditional sentence", () => {
    expect(read("Whether the position is remote depends on the team.").workModel).toBeUndefined();
    expect(read("If the role is remote you will travel quarterly.").workModel).toBeUndefined();
    expect(read("This position is remote.").workModel?.value).toBe("remote");
  });

  it("does not read the Portuguese team label 'time' in an English description", () => {
    const b = read("Job Title: Barista\nTime: Flexible\nArea: Downtown\nRequirements\n- Latte art");
    expect(b.team).toBeUndefined();
    expect(read("Cargo: Barista\nEmpresa: Café Azul\nTime: Atendimento\nRequisitos\n- Experiência").team?.value).toBe("Atendimento");
  });
});

describe("start dates", () => {
  it.each([
    ["Start date: 1 Nov 2026", "2026-11-01"],
    ["Start date: November 1, 2026", "2026-11-01"],
    ["Start date: 1st of November 2026", "2026-11-01"],
    ["Data de início: 3 de novembro de 2026", "2026-11-03"],
    ["Fecha de inicio: 15 de enero de 2027", "2027-01-15"],
    ["Start date: 2026-12-07", "2026-12-07"],
    ["Start date: 25/11/2026", "2026-11-25"],
  ])("%s", (text, iso) => {
    expect(read(text).targetStartDate?.value).toBe(iso);
  });

  it.each(["Start date: ASAP", "Start date: 03/04/2027", "Start date: Q1 2027", "Start date: Nov 2026", "Start date: 1 Jan 2020"])(
    "leaves %s empty",
    (text) => {
      expect(read(text).targetStartDate).toBeUndefined();
    },
  );

  it("refuses impossible dates", () => {
    expect(parseUnambiguousDate("31 February 2027", NOW)).toBeNull();
  });
});

describe("requirements", () => {
  it("reads bullets under requirement headings and tags them by heading", () => {
    const { requirements } = quickReadJd(
      "Responsibilities\n- Run the close\n\nRequirements\n- CPA licence\n- 5 years in audit\n\nNice to have\n- NetSuite\n",
      { now: NOW },
    );
    expect(requirements).toEqual([
      { text: "CPA licence", tag: "must_have" },
      { text: "5 years in audit", tag: "must_have" },
      { text: "NetSuite", tag: "nice_to_have" },
    ]);
  });

  it("keeps the tag the description gives, even past six must-haves", () => {
    // The form's own "I want all N treated as must-haves" acknowledgement
    // handles the cap; silently re-tagging the 7th item would mislabel it
    // while saying it was "read from your job description".
    const bullets = Array.from({ length: 10 }, (_, i) => `- Requirement number ${i + 1}`).join("\n");
    const { requirements } = quickReadJd(`Requirements\n${bullets}`, { now: NOW });
    expect(requirements.filter((r) => r.tag === "must_have")).toHaveLength(10);
  });

  it("closes the section at a sub-heading it does not recognise", () => {
    const { requirements } = quickReadJd(
      "Requirements\n- 3 years with React\n\nOur stack:\n- React 19\n- Postgres\n\nTechnical skills:\n- TypeScript\n",
      { now: NOW },
    );
    expect(requirements.map((r) => r.text)).toEqual(["3 years with React", "TypeScript"]);
  });

  it("returns nothing when there is no requirements section", () => {
    expect(quickReadJd("- Greet clients\n- Light bookkeeping", { now: NOW }).requirements).toEqual([]);
  });
});

describe("properties", () => {
  const adversarial: Array<[string, string]> = [
    ["dollar signs", "$".repeat(50_000)],
    ["digits and commas", "$" + "9,".repeat(25_000)],
    ["separators", "Salary: " + "$1 - ".repeat(10_000)],
    ["labels", "Location: ".repeat(5_000)],
    ["one long line", "a ".repeat(25_000)],
    ["many lines", "Requirements\n" + "- x and\n".repeat(6_000)],
    ["spaces", " ".repeat(50_000) + "x"],
    ["entities", "&amp;".repeat(10_000)],
    ["html", "<p>".repeat(16_000)],
    ["euro after", "1.000 € ".repeat(6_000)],
    ["code after", "1 USD ".repeat(8_000)],
    ["dates", "Start date: 1 1 1 1 ".repeat(2_500)],
    ["parentheses", "Location: " + "(".repeat(50_000)],
  ];

  it.each(adversarial)("finishes 50k characters of %s in under 100 ms", (_name, text) => {
    quickReadJd(text); // warm
    const t0 = performance.now();
    quickReadJd(text);
    expect(performance.now() - t0).toBeLessThan(100);
  });

  it("reads a realistic 50k-character description in under 50 ms", () => {
    const body = "We build tools for operations teams. You will work across product and engineering.\n".repeat(600);
    const text = `Job Title: Senior Accountant\nLocation: Austin, TX\nSalary: $90,000 - $110,000 per year\n${body}`;
    expect(text.length).toBeGreaterThan(48_000);
    quickReadJd(text);
    const t0 = performance.now();
    const r = quickReadJd(text, { now: NOW });
    expect(performance.now() - t0).toBeLessThan(50);
    expect(r.blueprint.title?.value).toBe("Senior Accountant");
  });

  it("never throws on garbage, empty or binary-looking input", () => {
    const junk: unknown[] = [
      "", " ", "\n\n", "\u0000\u0001\u0002", "%PDF-1.7\n%âãÏÓ\n1 0 obj<<>>stream\nxœ+\u0000endstream",
      "PK\u0003\u0004\u0014\u0000", "\ud800", "💼📍🏠", null, undefined, 42,
    ];
    for (const j of junk) {
      expect(() => quickReadJd(j as string)).not.toThrow();
      const r = quickReadJd(j as string);
      expect(Array.isArray(r.requirements)).toBe(true);
    }
  });

  it("is deterministic and its normalisation is idempotent", () => {
    const text = "**Job Title:** Nurse &amp; Midwife\r\nSalary: £30k\r\n\r\nRequirements\r\n• NMC pin\r\n";
    expect(quickReadJd(text, { now: NOW })).toEqual(quickReadJd(text, { now: NOW }));
    const once = normalizeJdText(text);
    expect(normalizeJdText(once)).toBe(once);
    expect(quickReadJd(once, { now: NOW })).toEqual(quickReadJd(text, { now: NOW }));
  });
});
