import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { VisaoVendas } from "@/components/luxtia/VisaoVendas";

export const Route = createFileRoute("/_authenticated/ia/visao-vendas")({
  head: () => ({ meta: [{ title: "Visão de vendas | Luxbrain" }] }),
  component: PaginaVisaoVendas,
});

function PaginaVisaoVendas() {
  return (
    <PaginaGateway
      titulo="Visão de vendas"
      descricao="Faturamento, produtos, clientes e tempos da operação no período."
      papeis={["plataforma", "gestor"]}
      telaCheia
    >
      {(ctx) => <VisaoVendas key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  );
}
