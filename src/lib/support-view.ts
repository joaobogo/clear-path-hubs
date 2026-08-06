/**
 * Support-view context: exposed by the client layout when a platform staff
 * member is viewing another organization's dashboard via `?org=<uuid>`.
 *
 * Consumers read `readOnly` to disable client mutation controls, and `orgName`
 * to keep the customer name in view. The context is null when the current
 * user is the real client operating in their own workspace.
 */
import { createContext, useContext } from "react";

export type PermissionPreview = "client_admin" | "client_editor" | "client_viewer";

export interface SupportViewState {
  active: boolean;
  organizationId: string | null;
  organizationName: string | null;
  mode: "read_only" | "interactive";
  readOnly: boolean;
  permissionPreview: PermissionPreview;
  sessionId: string | null;
  /** Short human-quotable session reference written to the audit trail. */
  sessionRef: string | null;
  /** ISO timestamp when read-only access lapses, when known. */
  sessionExpiresAt: string | null;
}

const DEFAULT: SupportViewState = {
  active: false,
  organizationId: null,
  organizationName: null,
  mode: "read_only",
  readOnly: false,
  permissionPreview: "client_admin",
  sessionId: null,
  sessionRef: null,
  sessionExpiresAt: null,
};

export const SupportViewContext = createContext<SupportViewState>(DEFAULT);

export function useSupportView(): SupportViewState {
  return useContext(SupportViewContext);
}
