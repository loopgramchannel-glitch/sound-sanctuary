import { createFileRoute, redirect } from "@tanstack/react-router";

// The "You" page was removed; old links go home.
export const Route = createFileRoute("/you")({
  beforeLoad: () => { throw redirect({ to: "/", replace: true }); },
});
