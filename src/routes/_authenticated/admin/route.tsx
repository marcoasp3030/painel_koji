import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMe } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const me = await getMe();
    if (!me?.isSuperAdmin) throw redirect({ to: "/painel" });
  },
  component: () => <Outlet />,
});
