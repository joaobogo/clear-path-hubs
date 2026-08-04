import { RoleLifecycleTimeline } from "@/components/client/role-lifecycle-timeline";
import { PreviewFrame } from "@/components/marketing/product-preview/preview-frame";
import { PREVIEW_LIFECYCLE } from "@/lib/previews/representative-fixtures";

/**
 * Role lifecycle preview — the real workspace timeline component, driven by a
 * representative lifecycle with completed, active, waiting and not-started
 * stages so the states are honest rather than uniformly green.
 */
export function LifecyclePreview({ className }: { className?: string }) {
  return (
    <PreviewFrame
      title={`Role lifecycle · ${PREVIEW_LIFECYCLE.title}`}
      caption={PREVIEW_LIFECYCLE.caption}
      className={className}
    >
      <RoleLifecycleTimeline lifecycle={PREVIEW_LIFECYCLE} />
    </PreviewFrame>
  );
}
