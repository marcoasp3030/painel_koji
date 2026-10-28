import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { buscaCardapio } from "@/lib/gateway/cardapio-ux";
import { Cardapio } from "@/components/luxtia/Cardapio";

export const Route = createFileRoute("/_authenticated/ia/cardapio")({
  validateSearch: buscaCardapio,
  head: () => ({ meta: [{ title: "Cardápio | Luxtia" }] }),
  component: PaginaCardapio,
});

function PaginaCardapio() {
  return (
    <PaginaGateway
      titulo="Cardápio"
      descricao="Organize os itens e seus horários de disponibilidade, unidade por unidade."
      papeis={["plataforma", "gestor", "supervisor", "funcionario"]}
    >
      {(ctx) => <Cardapio key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  );
}
