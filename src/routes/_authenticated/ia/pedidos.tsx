import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { Pedidos } from "@/components/luxtia/Pedidos";

export const Route = createFileRoute("/_authenticated/ia/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Pedidos"
      descricao="Acompanhe os pedidos da empresa e avance só o próximo passo que a loja pode dar."
      papeis={["plataforma", "admin", "membro"]}
    >
      {(ctx) => <Pedidos key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  ),
});
