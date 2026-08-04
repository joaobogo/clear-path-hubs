import { EvidenceGraph } from "@/components/evidence/evidence-graph";
import { PreviewFrame } from "@/components/marketing/product-preview/preview-frame";
import { PREVIEW_EVIDENCE_CHAIN, PREVIEW_ROLE } from "@/lib/previews/representative-fixtures";

/**
 * Evidence graph preview — the real product component in its compact variant,
 * driven by the shared representative chain.
 */
export function EvidencePreview({
  idPrefix = "evidence-preview",
  className,
}: {
  idPrefix?: string;
  className?: string;
}) {
  return (
    <PreviewFrame
      title={`Evidence graph · ${PREVIEW_ROLE.title}`}
      caption="Requirement → quote → score. Unquoted requirements are never counted as met."
      className={className}
    >
      <EvidenceGraph
        nodes={PREVIEW_EVIDENCE_CHAIN.nodes}
        meta={PREVIEW_EVIDENCE_CHAIN.meta}
        variant="compact"
        representative
        idPrefix={idPrefix}
        title="Evidence graph"
      />
    </PreviewFrame>
  );
}
