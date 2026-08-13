import { describe, expect, it, vi, beforeEach } from "vitest";

const fn = vi.fn();
vi.mock("@/lib/cv-download.functions", () => ({ getCandidateCvDownload: (a: unknown) => fn(a) }));

import {
  fetchCvDownloadLink,
  clearCvLinkCache,
  invalidateCvLink,
  cvLinkExpiryMs,
  CACHE_SAFETY_MARGIN_MS,
} from "@/lib/cv-download-cache";

const link = (url: string, ttlMs = 300_000) => ({
  url,
  filename: "a_CV.pdf",
  mime: "application/pdf",
  disposition: "attachment" as const,
  audience: "client",
  expires_at: new Date(Date.now() + ttlMs).toISOString(),
});

describe("cv download link cache", () => {
  beforeEach(() => {
    fn.mockReset();
    clearCvLinkCache();
  });

  it("reuses a fresh link instead of calling the server again", async () => {
    fn.mockResolvedValue(link("https://x/1"));
    const a = await fetchCvDownloadLink({ matchId: "m1", disposition: "attachment" });
    const b = await fetchCvDownloadLink({ matchId: "m1", disposition: "attachment" });
    expect(a.url).toBe(b.url);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent clicks into one request", async () => {
    fn.mockResolvedValue(link("https://x/2"));
    await Promise.all([
      fetchCvDownloadLink({ matchId: "m2", disposition: "attachment" }),
      fetchCvDownloadLink({ matchId: "m2", disposition: "attachment" }),
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("keeps preview and download links separate", async () => {
    fn.mockResolvedValue(link("https://x/3"));
    await fetchCvDownloadLink({ matchId: "m3", disposition: "attachment" });
    await fetchCvDownloadLink({ matchId: "m3", disposition: "inline" });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when a link is near expiry or invalidated or forced fresh", async () => {
    fn.mockResolvedValue(link("https://x/4", CACHE_SAFETY_MARGIN_MS - 1_000));
    await fetchCvDownloadLink({ matchId: "m4", disposition: "attachment" });
    await fetchCvDownloadLink({ matchId: "m4", disposition: "attachment" });
    expect(fn).toHaveBeenCalledTimes(2);

    fn.mockResolvedValue(link("https://x/5"));
    await fetchCvDownloadLink({ matchId: "m5", disposition: "attachment" });
    invalidateCvLink("m5");
    await fetchCvDownloadLink({ matchId: "m5", disposition: "attachment" });
    await fetchCvDownloadLink({ matchId: "m5", disposition: "attachment", fresh: true });
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it("does not cache a failure", async () => {
    fn.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(link("https://x/6"));
    await expect(
      fetchCvDownloadLink({ matchId: "m6", disposition: "attachment" }),
    ).rejects.toThrow();
    const ok = await fetchCvDownloadLink({ matchId: "m6", disposition: "attachment" });
    expect(ok.url).toBe("https://x/6");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("falls back to a default lifetime without a valid expiry", () => {
    const now = Date.now();
    expect(cvLinkExpiryMs({ ...link("u"), expires_at: "nope" }, now)).toBeGreaterThan(now);
  });
});
