import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/approvals")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin",
      search: { scope: "all" },
      hash: "queue-approvals",
    });
  },
});
