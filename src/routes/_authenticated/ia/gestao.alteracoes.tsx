import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { HistoricoGestao } from "@/components/luxtia/HistoricoGestao";
export const Route = createFileRoute("/_authenticated/ia/gestao/alteracoes")({
  head: () => ({ meta: [{ title: "Histórico de gestão | Luxtia" }] }),
  component: () => (
    <PaginaGateway titulo="Histórico de gestão" papeis={["plataforma", "admin"]}>
      {(ctx) => <HistoricoGestao key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  ),
});
