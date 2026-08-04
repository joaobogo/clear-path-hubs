import { MetricCard } from "@/components/intelligence/metric-card";
import { PreviewFrame } from "@/components/marketing/product-preview/preview-frame";
import { PREVIEW_METRICS } from "@/lib/previews/representative-fixtures";

/**
 * Hiring Intelligence preview — the real MetricCard component, rendered from
 * representative fixtures that deliberately include a partial-data state and a
 * "not enough data" state.
 */
export function IntelligencePreview({ className }: { className?: string }) {
  return (
    <PreviewFrame
      title="Hiring Intelligence"
      caption="Each metric answers one decision question — and says when it cannot"
      className={className}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PREVIEW_METRICS.map((metric) => (
          <MetricCard key={metric.key} metric={metric} representative />
        ))}
      </div>
    </PreviewFrame>
  );
}
