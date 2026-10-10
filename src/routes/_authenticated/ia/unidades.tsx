import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { GestaoUnidades } from "@/components/luxtia/GestaoUnidades";
export const Route = createFileRoute("/_authenticated/ia/unidades")({
  head: () => ({ meta: [{ title: "Unidades e horários | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Unidades e horários"
      descricao="Situação, pausa de pedidos e horários da empresa."
      papeis={["plataforma", "admin", "membro"]}
    >
      {(ctx) => <GestaoUnidades key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  ),
});
