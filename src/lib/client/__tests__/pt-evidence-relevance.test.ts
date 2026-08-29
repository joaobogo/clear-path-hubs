import { describe, expect, it } from "vitest";
import { passageSupportsRequirement } from "@/lib/client/evidence-relevance";
describe("PT passages", () => {
  it("credits a Portuguese security passage for an English requirement", () => {
    expect(passageSupportsRequirement(
      "Especialização em Segurança Cibernética pela UTFPR.",
      "Understanding of practical web security fundamentals",
    )).toBe(true);
  });
  it("credits a Portuguese UX passage", () => {
    expect(passageSupportsRequirement(
      "Criação de interfaces modernas, responsivas e orientadas à experiência do usuário.",
      "Understanding of good UX/UI principles",
    )).toBe(true);
  });
  it("still rejects an unrelated passage", () => {
    expect(passageSupportsRequirement(
      "Gerenciamento de campanhas de marketing e redes sociais.",
      "Experience with Kubernetes clusters",
    )).toBe(false);
  });
});
