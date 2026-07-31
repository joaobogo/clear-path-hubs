import { Rows3, Rows4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Density } from "@/lib/use-density";

/**
 * Compact fits more roles on screen. Tap targets stay full size — only spacing
 * and type scale change.
 */
export function DensityToggle({
  density,
  onChange,
}: {
  density: Density;
  onChange: (d: Density) => void;
}) {
  const compact = density === "compact";
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 gap-1.5"
      aria-pressed={compact}
      onClick={() => onChange(compact ? "comfortable" : "compact")}
      title={compact ? "Switch to comfortable spacing" : "Fit more roles on screen"}
    >
      {compact ? <Rows3 className="h-3.5 w-3.5" /> : <Rows4 className="h-3.5 w-3.5" />}
      {compact ? "Comfortable" : "Compact"}
    </Button>
  );
}
