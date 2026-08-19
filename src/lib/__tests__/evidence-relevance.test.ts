import { describe, it, expect } from "vitest";
import { isRelevantEvidence, isCandidateHeadline } from "../evidence/quote-hygiene.ts";

describe("evidence relevance and headline hygiene", () => {
  it("should detect a candidate headline", () => {
    expect(isCandidateHeadline("Beatriz Costa Senior Full-Stack Engineer — product-focused, TypeScript/AWS Lisbon,…")).toBe(true);
    expect(isCandidateHeadline("Sofia Marques | Senior Full-Stack Engineer")).toBe(true);
    expect(isCandidateHeadline("Senior Full-Stack Engineer — product-focused, TypeScript/AWS")).toBe(true);
    // Real prose shouldn't be caught
    expect(isCandidateHeadline("I have 10 years of experience building complex React applications with TanStack Start.")).toBe(false);
  });

  it("should enforce term overlap for relevance", () => {
    const req = "Exposure to AI/LLM product features in production";
    
    // Relevant
    expect(isRelevantEvidence("Implemented an LLM-powered chatbot in production.", req)).toBe(true);
    expect(isRelevantEvidence("Built AI product features using OpenAI API.", req)).toBe(true);
    
    // Irrelevant (Beatriz Costa's headline debris)
    expect(isRelevantEvidence("Beatriz Costa Senior Full-Stack Engineer — product-focused, TypeScript/AWS Lisbon,…", req)).toBe(false);
    
    const req2 = "Familiarity with TanStack Start, Remix or a similar full-stack React framework";
    
    // Relevant
    expect(isRelevantEvidence("Expert in React and Remix for full-stack development.", req2)).toBe(true);
    expect(isRelevantEvidence("Using TanStack Start for internal tools.", req2)).toBe(true);
    
    // Irrelevant
    expect(isRelevantEvidence("Beatriz Costa Senior Full-Stack Engineer — product-focused, TypeScript/AWS Lisbon,…", req2)).toBe(false);
  });

  it("should handle synonym clusters", () => {
    const req = "Experience with relational databases like Postgres";
    expect(isRelevantEvidence("Expert in SQL and data modeling.", req)).toBe(true);
    expect(isRelevantEvidence("Designed PostgreSQL schemas for high-traffic apps.", req)).toBe(true);
  });
});
