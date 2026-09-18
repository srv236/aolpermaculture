import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/introduction")({
  beforeLoad: () => {
    throw redirect({ to: "/about" });
  },
});
