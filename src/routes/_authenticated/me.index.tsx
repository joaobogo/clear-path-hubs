import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/me/")({
 beforeLoad: () => {
 throw redirect({ to: "/me/applications" });
 },
});
