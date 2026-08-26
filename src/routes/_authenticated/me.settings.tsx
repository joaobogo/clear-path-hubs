import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/me/settings")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/me/privacy", search: search as { focus?: string } });
  },
  validateSearch: (search: Record<string, unknown>) =>
    ({
      ...(typeof search.focus === "string" ? { focus: search.focus } : {}),
    }) as { focus?: string },
});
