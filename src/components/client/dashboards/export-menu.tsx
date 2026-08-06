import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { exportDashboardRows } from "@/lib/dashboards.functions";
import { Button } from "@/components/ui/button";
import type { BlockId } from "@/lib/dashboards/blocks";

export function ExportMenu({ orgId, blocks, name }: { orgId: string; blocks: BlockId[]; name: string }) {
  const exportFn = useServerFn(exportDashboardRows);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const { rows } = await exportFn({ data: { orgId, blocks } });
      const csv = rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't build that export. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={download} disabled={busy}>
        <Download className="mr-1 h-3.5 w-3.5" /> CSV
      </Button>
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Download className="mr-1 h-3.5 w-3.5" /> PDF
      </Button>
    </div>
  );
}
