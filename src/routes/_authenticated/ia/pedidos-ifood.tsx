import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { IfoodPedidos } from "@/components/luxtia/IfoodPedidos";

export const Route = createFileRoute("/_authenticated/ia/pedidos-ifood")({
  head: () => ({ meta: [{ title: "Pedidos iFood | Luxtia" }] }),
  component: PaginaPedidosIfood,
});

function PaginaPedidosIfood() {
  return (
    <PaginaGateway
      titulo="Pedidos iFood"
      descricao="Acompanhe os pedidos recebidos pelo iFood. Aceite e despacho ficam no sistema do iFood."
      papeis={["plataforma", "gestor"]}
      telaCheia
    >
      {(ctx) => <IfoodPedidos key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  );
}
