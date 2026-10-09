/**
 * The rest of the job-description pipeline: how a read lands in the form, the
 * browser-side request rules, the link guard, file extraction and job pages.
 */
import { describe, expect, it, vi } from "vitest";
import { planBlueprintApply, mayReplaceRequirements, capMustHaves, requirementsSignature } from "@/lib/jd-apply";
import { jdCacheKey, requestJdParse } from "@/lib/jd-parse-client";
import { checkPublicUrl, fetchPublicPage } from "@/lib/jd-url-guard";
import { decodeTextBytes, extractJdFile, rtfToText, sniffKind } from "@/lib/jd-extract.server";
import { htmlToText, jobPageToText } from "@/lib/jd-html";
import { quickReadJd } from "@/lib/jd-quick-read";
import type { JdBlueprint } from "@/lib/jd-blueprint";

const f = <T,>(value: T) => ({ value, confidence: "high" as const });

describe("a read lands without ever overwriting the client", () => {
  const blank = { roleTitle: "", team: "", currency: "USD", compensationPeriod: "year" };

  it("fills empty fields and the unchosen defaults", () => {
    const plan = planBlueprintApply(blank, { title: f("Nurse"), currency: f("GBP") } as JdBlueprint, {
      edited: new Set(),
      auto: {},
    });
    expect(plan.patch).toEqual({ roleTitle: "Nurse", currency: "GBP" });
    expect(plan.filled).toEqual(["roleTitle", "currency"]);
  });

  it("never writes a field the client typed in", () => {
    const plan = planBlueprintApply({ ...blank, roleTitle: "Ward Sister" }, { title: f("Nurse") } as JdBlueprint, {
      edited: new Set(["roleTitle"]),
      auto: { roleTitle: "Ward Sister" },
    });
    expect(plan.patch).toEqual({});
  });

  it("leaves a restored or carried value alone", () => {
    const plan = planBlueprintApply({ ...blank, team: "Finance" }, { team: f("Ops") } as JdBlueprint, {
      edited: new Set(),
      auto: {},
    });
    expect(plan.patch).toEqual({});
  });

  it("lets the model replace the instant read only where it differs", () => {
    const after = planBlueprintApply(blank, { title: f("Senior Nurse"), team: f("ICU") } as JdBlueprint, {
      edited: new Set(),
      auto: {},
    });
    const model = planBlueprintApply({ ...blank, ...after.patch }, { title: f("Senior Nurse"), team: f("Critical Care") } as JdBlueprint, {
      edited: new Set(),
      auto: after.auto,
    });
    expect(model.patch).toEqual({ team: "Critical Care" });
  });

  it("clears what an old description said when the new full read does not say it", () => {
    const first = planBlueprintApply(blank, { title: f("Chef"), location: f("Leeds") } as JdBlueprint, {
      edited: new Set(),
      auto: {},
    });
    const next = planBlueprintApply({ ...blank, ...first.patch }, { title: f("Barista") } as JdBlueprint, {
      edited: new Set(),
      auto: first.auto,
      clearMissing: true,
    });
    expect(next.patch).toEqual({ roleTitle: "Barista", location: "" });
    expect(next.cleared).toEqual(["location"]);
  });

  it("does not fill one end of a salary range on its own", () => {
    const plan = planBlueprintApply(blank, { salaryMax: f(120000), currency: f("USD") } as JdBlueprint, {
      edited: new Set(),
      auto: {},
    });
    expect(plan.patch.salaryMax).toBeUndefined();
  });

  it("replaces requirements only while the list is untouched", () => {
    const read = [{ text: "CPA licence", tag: "must_have" as const }];
    expect(mayReplaceRequirements([], { edited: false, autoSignature: "" })).toBe(true);
    expect(mayReplaceRequirements(read, { edited: false, autoSignature: requirementsSignature(read) })).toBe(true);
    expect(mayReplaceRequirements(read, { edited: true, autoSignature: requirementsSignature(read) })).toBe(false);
    expect(mayReplaceRequirements(read, { edited: false, autoSignature: "" })).toBe(false);
  });

  it("caps must-haves at six", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ text: `Skill ${i}`, tag: "must_have" as const }));
    expect(capMustHaves(many).filter((r) => r.tag === "must_have")).toHaveLength(6);
  });
});

describe("the browser request", () => {
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const body = { roleTitle: "", jobDescriptionText: "Job Title: Nurse\nRequirements\n- RN licence" };

  it("retries once after a 5xx and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ ok: false, error: "suggestions_failed" }, 502))
      .mockResolvedValueOnce(ok({ ok: true, suggestions: [], blueprint: { title: f("Nurse") } }));
    const out = await requestJdParse(body, { fetchImpl, retryDelayMs: 1, useCache: false });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(out.kind).toBe("ok");
  });

  it("retries once after a network error, then reports failure", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("offline"));
    const out = await requestJdParse(body, { fetchImpl, retryDelayMs: 1, useCache: false });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(out).toMatchObject({ kind: "failed", error: "network" });
  });

  it("does not retry a 4xx or an unreadable file", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ ok: false, error: "jd_unreadable", message: "scanned", text: undefined }));
    const out = await requestJdParse(body, { fetchImpl, useCache: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ kind: "failed", message: "scanned" });
  });

  it("gives up at the deadline without a second attempt", async () => {
    const fetchImpl = vi.fn((_u: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const out = await requestJdParse(body, { fetchImpl, timeoutMs: 20, useCache: false });
    expect(out).toMatchObject({ kind: "failed", error: "timeout" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports an aborted read as aborted, so it is never applied", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_u: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const p = requestJdParse(body, { fetchImpl, signal: controller.signal, useCache: false });
    controller.abort();
    expect(await p).toEqual({ kind: "aborted" });
  });

  it("keys the cache on the content, not its formatting", () => {
    expect(jdCacheKey({ roleTitle: "", jobDescriptionText: "Nurse\r\n\r\nRN licence" })).toBe(
      jdCacheKey({ roleTitle: "", jobDescriptionText: "Nurse\n\nRN licence  " }),
    );
    expect(jdCacheKey({ roleTitle: "", jobDescriptionText: "Nurse" })).not.toBe(
      jdCacheKey({ roleTitle: "", jobDescriptionText: "Chef" }),
    );
  });
});

describe("the link guard", () => {
  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://127.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/",
    "http://10.0.0.5/",
    "http://172.16.3.4/",
    "http://192.168.1.1/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://intranet/",
    "http://printer.local/",
    "http://db.internal/",
    "https://user:pass@example.com/",
    "https://example.com:8443/",
    "ftp://example.com/",
    "file:///etc/passwd",
    "javascript:alert(1)",
  ])("refuses %s", (url) => {
    expect(checkPublicUrl(url).ok).toBe(false);
  });

  it.each(["https://boards.greenhouse.io/acme/jobs/123", "http://jobs.lever.co/acme/1", "https://8.8.8.8/"])("allows %s", (url) => {
    expect(checkPublicUrl(url).ok).toBe(true);
  });

  it("re-checks every redirect hop", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/" } }),
    );
    const out = await fetchPublicPage("https://jobs.example.com/1", { maxBytes: 1000, timeoutMs: 1000, fetchImpl });
    expect(out).toEqual({ ok: false, reason: "blocked" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });

  it("stops after too many redirects and caps the bytes read", async () => {
    const loop = vi.fn().mockImplementation(
      async () => new Response(null, { status: 301, headers: { location: "https://jobs.example.com/again" } }),
    );
    expect(await fetchPublicPage("https://jobs.example.com/", { maxBytes: 10, timeoutMs: 1000, fetchImpl: loop })).toEqual({
      ok: false,
      reason: "too_many_redirects",
    });
    const big = vi.fn().mockResolvedValue(new Response("x".repeat(5000), { headers: { "content-type": "text/html" } }));
    const page = await fetchPublicPage("https://jobs.example.com/", { maxBytes: 100, timeoutMs: 1000, fetchImpl: big });
    expect(page.ok && page.html.length).toBe(100);
  });

  it("refuses a page that is not HTML", async () => {
    const pdf = vi.fn().mockResolvedValue(new Response("%PDF", { headers: { "content-type": "application/pdf" } }));
    expect(await fetchPublicPage("https://jobs.example.com/", { maxBytes: 100, timeoutMs: 1000, fetchImpl: pdf })).toEqual({
      ok: false,
      reason: "not_html",
    });
  });
});

describe("uploaded files", () => {
  const bytes = (s: string) => new TextEncoder().encode(s);

  it("knows a file by its bytes, not its name or mime", () => {
    expect(sniffKind(bytes("%PDF-1.7 ..."), "jd.txt", "text/plain")).toBe("pdf");
    expect(sniffKind(bytes("{\\rtf1\\ansi hello}"), "jd.txt", "application/octet-stream")).toBe("rtf");
    expect(sniffKind(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), "jd.docx")).toBe("doc");
    expect(sniffKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]), "jd.pdf")).toBe("image");
    expect(sniffKind(bytes("Senior Accountant\nRequirements"), "jd", "")).toBe("text");
  });

  it("reads RTF with unicode and hex escapes, paragraphs and skipped groups", () => {
    const rtf =
      "{\\rtf1\\ansi\\uc1{\\fonttbl{\\f0 Arial;}}{\\colortbl;\\red0\\green0\\blue0;}{\\*\\generator Word;}" +
      "\\pard Job Title: Desenvolvedor S\\u234?nior\\par Local: S\\'e3o Paulo\\par\\bullet  Python \\endash  5 anos\\par}";
    expect(rtfToText(rtf)).toBe("Job Title: Desenvolvedor Sênior\nLocal: São Paulo\n• Python – 5 anos");
  });

  it("decodes UTF-8, UTF-16 and Windows-1252 text", () => {
    expect(decodeTextBytes(bytes("São Paulo"))).toBe("São Paulo");
    expect(decodeTextBytes(new Uint8Array([0xff, 0xfe, 0x53, 0, 0xe3, 0]))).toBe("Sã");
    expect(decodeTextBytes(new Uint8Array([0x53, 0xe3, 0x6f]))).toBe("São");
  });

  const cvStub = (text: string, reason?: string) =>
    ({
      extractCvText: async () => ({ text, needs_ocr: !text, extractor: "pdf", page_count: 1, chars: text.length, reason }),
      validateCvTextLayer: async () => ({}),
    }) as unknown as typeof import("@/lib/cv-extractor.server");

  it("says what is wrong with a PDF it cannot read", async () => {
    const pdf = bytes("%PDF-1.4 binary");
    expect(await extractJdFile(pdf, "", "jd.pdf", cvStub("", "cv_unreadable"))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/scanned image/),
    });
    expect(await extractJdFile(pdf, "", "jd.pdf", cvStub("", "encrypted_pdf"))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/password-protected/),
    });
    expect(await extractJdFile(pdf, "", "jd.pdf", cvStub("", "pdf_parse_failed:bad xref"))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/damaged/),
    });
  });

  it("accepts a short text file as long as it says something", async () => {
    const out = await extractJdFile(bytes("Job Title: Barista\nPay: £12 per hour"), "text/plain", "jd.txt", cvStub(""));
    expect(out).toMatchObject({ ok: true, kind: "text" });
  });

  it("explains a legacy .doc and an image", async () => {
    expect(await extractJdFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]), "", "jd.doc", cvStub(""))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Legacy \.doc/),
    });
    expect(await extractJdFile(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", "jd.jpg", cvStub(""))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/image/),
    });
  });
});

describe("job pages", () => {
  it("keeps list items as bullets so requirements survive", () => {
    const text = htmlToText("<h2>Requirements</h2><ul><li>CPA licence</li><li>5 years in audit</li></ul><script>x()</script>");
    expect(text).toBe("Requirements\n\n• CPA licence\n• 5 years in audit");
    expect(quickReadJd(text).requirements.map((r) => r.text)).toEqual(["CPA licence", "5 years in audit"]);
  });

  it("puts a JobPosting's stated facts on top", () => {
    const ld = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Senior Accountant",
      employmentType: "FULL_TIME",
      jobLocation: { "@type": "Place", address: { addressLocality: "Austin", addressRegion: "TX" } },
      baseSalary: { currency: "USD", value: { minValue: 90000, maxValue: 110000, unitText: "YEAR" } },
      description: "<p>" + "We close the books. ".repeat(20) + "</p><h3>Requirements</h3><ul><li>CPA licence</li></ul>",
    };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>menu</body></html>`;
    const text = jobPageToText(html);
    const b = quickReadJd(text).blueprint;
    expect(b.title?.value).toBe("Senior Accountant");
    expect(b.location?.value).toBe("Austin, TX");
    expect(b.employmentType?.value).toBe("full_time");
    expect([b.salaryMin?.value, b.salaryMax?.value, b.currency?.value, b.compensationPeriod?.value]).toEqual([
      90000, 110000, "USD", "year",
    ]);
  });
});
