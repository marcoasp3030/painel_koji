/** Layout das rotas /ia/documentos/lotes e /ia/documentos/lotes/$loteId. */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ia/documentos/lotes")({
  component: () => <Outlet />,
});
