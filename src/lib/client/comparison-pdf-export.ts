import { useCallback, useRef, useState } from "react";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { CompareMatrixRow } from "@/lib/client-compare";

export type PdfPhase = "idle" | "building" | "done" | "error";

export type PdfItem = {
  matchId: string;
  name: string;
  state: "pending" | "running" | "done" | "error";
  error?: string;
};

/** How long to yield back to the browser between PDF sections (ms). */
const YIELD_MS = 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a candidate comparison PDF and hand it to the browser as one
 * downloaded file. The work is chunked with short sleeps so the tab stays
 * responsive throughout the export.
 */
export function useComparisonPdfExport() {
  const [phase, setPhase] = useState<PdfPhase>("idle");
  const [items, setItems] = useState<PdfItem[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const running = useRef(false);

  const reset = useCallback(() => {
    if (running.current) return;
    setPhase("idle");
    setItems([]);
    setFatal(null);
  }, []);

  const patch = useCallback((matchId: string, next: Partial<PdfItem>) => {
    setItems((prev) => prev.map((it) => (it.matchId === matchId ? { ...it, ...next } : it)));
  }, []);

  const start = useCallback(
    async (
      candidates: ClientCandidateDTO[],
      matrix: CompareMatrixRow[],
      observations: string[],
      positionTitle: string | null,
    ) => {
      if (running.current || candidates.length === 0) return null;
      running.current = true;
      setFatal(null);
      setPhase("building");
      setItems(
        candidates.map((c) => ({
          matchId: c.match_id,
          name: c.candidate.display_name,
          state: "pending" as const,
        })),
      );

      try {
        const { jsPDF } = await import("jspdf");
        const autoTable = (await import("jspdf-autotable")).default;

        const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let y = 20;

        // Title
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("Candidate comparison", margin, y);
        y += 8;

        // Metadata
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        if (positionTitle) {
          doc.text(`Role: ${positionTitle}`, margin, y);
          y += 5;
        }
        doc.text(`Generated: ${formatDateTime(new Date())}`, margin, y);
        y += 8;

        // Candidates table
        const candidateRows = candidates.map((c) => [
          c.candidate.display_name,
          c.candidate.headline ?? "—",
          `${c.coverage.must_met}/${c.coverage.must_total} must-haves`,
          c.stage,
        ]);

        autoTable(doc, {
          startY: y,
          head: [["Candidate", "Headline", "Must-have coverage", "Stage"]],
          body: candidateRows,
          margin: { left: margin, right: margin },
          styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
          headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
        y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;

        // Mark each candidate as done in the progress UI, yielding between rows.
        for (const c of candidates) {
          patch(c.match_id, { state: "running" });
          await sleep(YIELD_MS);
          patch(c.match_id, { state: "done" });
        }

        // Requirement grid
        if (matrix.length > 0) {
          if (y > 240) {
            doc.addPage();
            y = 20;
          }
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text("Requirement grid", margin, y);
          y += 6;

          const requirementHead = ["Requirement", ...candidates.map((c) => c.candidate.display_name)];
          const requirementBody = matrix.map((row) => [
            `${row.label} (${row.importance === "must_have" ? "Must-have" : "Preferred"})`,
            ...row.cells.map((cell) => {
              const label =
                cell.status === "met"
                  ? "Met"
                  : cell.status === "partial"
                    ? "Partially met"
                    : cell.status === "contradicted"
                      ? "Contradicted"
                      : cell.status === "not_applicable"
                        ? "Not applicable"
                        : "Unknown";
              return cell.evidence ? `${label}: ${cell.evidence}` : label;
            }),
          ]);

          autoTable(doc, {
            startY: y,
            head: [requirementHead],
            body: requirementBody,
            margin: { left: margin, right: margin },
            styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
            headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            columnStyles: { 0: { cellWidth: 45 } },
          });
          y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
        }

        // Observations
        if (observations.length > 0) {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text("Observations", margin, y);
          y += 6;

          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          for (const observation of observations) {
            const lines = doc.splitTextToSize(`• ${observation}`, pageWidth - margin * 2);
            doc.text(lines, margin, y);
            y += lines.length * 4.5 + 2;
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
          }
        }

        // Interview focus
        const hasFocus = candidates.some((c) => c.interview_guide.length > 0);
        if (hasFocus) {
          if (y > 240) {
            doc.addPage();
            y = 20;
          }
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text("Suggested interview focus", margin, y);
          y += 6;

          for (const c of candidates) {
            if (c.interview_guide.length === 0) continue;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(c.candidate.display_name, margin, y);
            y += 5;
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            for (const q of c.interview_guide.slice(0, 3)) {
              const lines = doc.splitTextToSize(`• ${q.question}`, pageWidth - margin * 2);
              doc.text(lines, margin + 3, y);
              y += lines.length * 4.5 + 1;
              if (y > 270) {
                doc.addPage();
                y = 20;
              }
            }
            y += 3;
          }
        }

        // Footer note
        const footer = "This comparison is confidential and intended for the hiring team only.";
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(footer, margin, doc.internal.pageSize.getHeight() - 10);

        // Safe filename
        const safeRole = (positionTitle ?? "comparison")
          .normalize("NFKD")
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .toLowerCase();
        const filename = `${safeRole}-${new Date().toISOString().slice(0, 10)}.pdf`;

        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);

        setPhase("done");
        return { ok: true };
      } catch (e) {
        setPhase("error");
        const message = e instanceof Error ? e.message : "Could not build the PDF.";
        setFatal(message);
        return { ok: false, error: message };
      } finally {
        running.current = false;
      }
    },
    [patch],
  );

  const counts = {
    total: items.length,
    done: items.filter((i) => i.state === "done").length,
    failed: items.filter((i) => i.state === "error").length,
  };

  return {
    phase,
    items,
    counts,
    fatal,
    start,
    reset,
    busy: phase === "building",
  };
}
