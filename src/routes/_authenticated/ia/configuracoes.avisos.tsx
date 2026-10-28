import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { AvisosPedido } from "@/components/luxtia/AvisosPedido";
export const Route = createFileRoute("/_authenticated/ia/configuracoes/avisos")({
  head: () => ({ meta: [{ title: "Avisos de pedido | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      sobretitulo="Configurações"
      titulo="Avisos de pedido"
      descricao="Configurações da empresa"
      papeis={["plataforma", "gestor", "supervisor"]}
    >
      {(ctx) => <AvisosPedido key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  ),
});
