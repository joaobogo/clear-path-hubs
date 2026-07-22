import { type ReactElement, cloneElement, isValidElement } from "react";
import { useSupportView } from "@/lib/support-view";

/**
 * Wrap a client mutation control. In support-view read-only mode the child is
 * rendered with `disabled` and a tooltip so admins never accidentally trigger
 * a client-side action.
 *
 * Usage:
 *   <ActionGuard>
 *     <Button onClick={...}>Shortlist</Button>
 *   </ActionGuard>
 */
export function ActionGuard({
  children,
  reason = "Disabled while viewing as an administrator.",
}: {
  children: ReactElement;
  reason?: string;
}) {
  const support = useSupportView();
  if (!support.readOnly || !isValidElement(children)) return children;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = children.props ?? {};
  return cloneElement(children, {
    ...props,
    disabled: true,
    onClick: undefined,
    onSubmit: undefined,
    title: reason,
    "aria-disabled": true,
    "data-support-guarded": "true",
  });
}
