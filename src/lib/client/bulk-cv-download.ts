import { describeCvDownloadFailure } from "@/lib/cv-download-error";
import { useCallback, useRef, useState } from "react";
import { getCandidateCvDownload } from "@/lib/cv-download.functions";

/**
 * Bulk "download the latest CV" for many candidates as one ZIP.
 *
 * Each CV still goes through the same per-candidate authorization path as a
 * single download (`getCandidateCvDownload` issues a short-lived signed URL
 * server-side), so a bulk action can never widen access — a candidate the
 * caller may not read simply fails with its own row-level error while the rest
 * of the ZIP still builds.
 */

export type BulkCvTarget = { matchId: string; name: string };

export type BulkItemState = "pending" | "running" | "done" | "error";

export type BulkItem = {
  matchId: string;
  name: string;
  state: BulkItemState;
  error?: string;
  filename?: string;
};

/** How many signed-URL fetches run at once. Keeps storage load predictable. */
const CONCURRENCY = 3;

/** Human message for a failed row — never a raw stack or storage path. */
export function bulkErrorMessage(raw: unknown): string {
  return describeCvDownloadFailure(raw).message;
}

/** Turn a display name into a safe, readable file name inside the archive. */
export function safeCvFilename(name: string, matchId: string, taken: Set<string>): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || `candidate-${matchId.slice(0, 8)}`;
  let candidate = `${base}.pdf`;
  let n = 2;
  while (taken.has(candidate)) candidate = `${base}-${n++}.pdf`;
  taken.add(candidate);
  return candidate;
}

/** `candidate-cvs-2026-08-13.zip` */
export function zipFilename(date = new Date()): string {
  return `candidate-cvs-${date.toISOString().slice(0, 10)}.zip`;
}

export type BulkPhase = "idle" | "collecting" | "zipping" | "done" | "error";

export function useBulkCvDownload() {
  const [phase, setPhase] = useState<BulkPhase>("idle");
  const [items, setItems] = useState<BulkItem[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const running = useRef(false);

  const reset = useCallback(() => {
    if (running.current) return;
    setPhase("idle");
    setItems([]);
    setFatal(null);
  }, []);

  const patch = useCallback((matchId: string, next: Partial<BulkItem>) => {
    setItems((prev) => prev.map((it) => (it.matchId === matchId ? { ...it, ...next } : it)));
  }, []);

  /**
   * Fetch every target's CV, zip whatever succeeded, and hand the browser one
   * file. Returns the counts so the caller can toast a summary.
   */
  const start = useCallback(
    async (targets: BulkCvTarget[]) => {
      if (running.current || targets.length === 0) return null;
      running.current = true;
      setFatal(null);
      setPhase("collecting");
      setItems(
        targets.map((t) => ({ matchId: t.matchId, name: t.name, state: "pending" as const })),
      );

      const taken = new Set<string>();
      const files: { filename: string; bytes: Uint8Array }[] = [];
      let cursor = 0;

      async function worker() {
        while (cursor < targets.length) {
          const target = targets[cursor++];
          patch(target.matchId, { state: "running", error: undefined });
          try {
            const res = await getCandidateCvDownload({
              data: { matchId: target.matchId, disposition: "attachment" },
            });
            const response = await fetch(res.url);
            if (!response.ok) throw new Error(`Storage responded ${response.status}`);
            const bytes = new Uint8Array(await response.arrayBuffer());
            const filename = safeCvFilename(target.name, target.matchId, taken);
            files.push({ filename, bytes });
            patch(target.matchId, { state: "done", filename });
          } catch (e) {
            patch(target.matchId, { state: "error", error: bulkErrorMessage(e) });
          }
        }
      }

      try {
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()),
        );

        if (files.length === 0) {
          setPhase("error");
          setFatal("None of the selected candidates had a CV we could download.");
          return { ok: 0, failed: targets.length };
        }

        setPhase("zipping");
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (const file of files) zip.file(file.filename, file.bytes);
        const blob = await zip.generateAsync({ type: "blob" });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = zipFilename();
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Revoke after the click has been handed to the browser.
        setTimeout(() => URL.revokeObjectURL(url), 10_000);

        setPhase("done");
        return { ok: files.length, failed: targets.length - files.length };
      } catch (e) {
        setPhase("error");
        setFatal(bulkErrorMessage(e));
        return { ok: 0, failed: targets.length };
      } finally {
        running.current = false;
      }
    },
    [patch],
  );

  /** Re-run only the rows that failed, keeping the successful ones' state. */
  const retryFailed = useCallback(
    async () => {
      const failed = items.filter((it) => it.state === "error");
      if (failed.length === 0) return null;
      return start(failed.map((it) => ({ matchId: it.matchId, name: it.name })));
    },
    [items, start],
  );

  const counts = {
    total: items.length,
    done: items.filter((i) => i.state === "done").length,
    failed: items.filter((i) => i.state === "error").length,
  };

  return { phase, items, counts, fatal, start, retryFailed, reset, busy: phase === "collecting" || phase === "zipping" };
}
