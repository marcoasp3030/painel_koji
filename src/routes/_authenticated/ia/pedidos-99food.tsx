import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { Food99Pedidos } from "@/components/luxtia/Food99Pedidos";

export const Route = createFileRoute("/_authenticated/ia/pedidos-99food")({
  head: () => ({ meta: [{ title: "Pedidos 99Food | Luxbrain" }] }),
  component: PaginaPedidosFood99,
});

function PaginaPedidosFood99() {
  return (
    <PaginaGateway
      titulo="Pedidos 99Food"
      descricao="Acompanhe os pedidos da 99Food. A confirmação é feita no app da 99Food."
      papeis={["plataforma", "gestor"]}
      telaCheia
    >
      {(ctx) => <Food99Pedidos key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  );
}
