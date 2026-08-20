import { createFileRoute, redirect } from "@tanstack/react-router";

/** Approvals live on the Overview work queue now. Old links keep working. */
export const Route = createFileRoute("/_authenticated/admin/approvals")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", statusCode: 301 });
  },
});
