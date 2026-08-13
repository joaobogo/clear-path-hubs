import { describe, expect, it } from "vitest";
import { bulkErrorMessage, safeCvFilename, zipFilename } from "@/lib/client/bulk-cv-download";

describe("safeCvFilename", () => {
  it("slugifies a display name", () => {
    expect(safeCvFilename("Ana María Souza", "m1", new Set())).toBe("ana-maria-souza.pdf");
  });

  it("de-duplicates repeated names inside one archive", () => {
    const taken = new Set<string>();
    expect(safeCvFilename("John Doe", "a", taken)).toBe("john-doe.pdf");
    expect(safeCvFilename("John Doe", "b", taken)).toBe("john-doe-2.pdf");
    expect(safeCvFilename("John Doe", "c", taken)).toBe("john-doe-3.pdf");
  });

  it("falls back to the match id when a name has no usable characters", () => {
    expect(safeCvFilename("***", "abcdef1234", new Set())).toBe("candidate-abcdef12.pdf");
  });
});

describe("bulkErrorMessage", () => {
  it("maps known failures to plain language", () => {
    expect(bulkErrorMessage(new Error("No CV on file"))).toBe("No CV on file yet");
    expect(bulkErrorMessage(new Error("Not found"))).toBe("This CV is not available to you yet");
    expect(bulkErrorMessage(new Error("Failed to fetch"))).toBe(
      "Network problem while fetching the CV",
    );
  });

  it("never returns an empty message", () => {
    expect(bulkErrorMessage(undefined)).toBe("Could not download the CV");
  });
});

describe("describeCvDownloadFailure", () => {
  it("marks permanent problems as not retryable", () => {
    expect(describeCvDownloadFailure(new Error("No CV on file")).retryable).toBe(false);
    expect(describeCvDownloadFailure(new Error("Unauthorized")).retryable).toBe(false);
  });

  it("marks transient problems as retryable and always gives a hint", () => {
    for (const raw of ["Failed to fetch", "File missing", "signed url expired", "boom"]) {
      const f = describeCvDownloadFailure(new Error(raw));
      expect(f.retryable).toBe(true);
      expect(f.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("zipFilename", () => {
  it("dates the archive", () => {
    expect(zipFilename(new Date("2026-08-13T04:00:00Z"))).toBe("candidate-cvs-2026-08-13.zip");
  });
});
