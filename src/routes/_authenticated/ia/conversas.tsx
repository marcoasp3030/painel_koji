import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { Conversas } from "@/components/luxtia/Conversas";
export const Route = createFileRoute("/_authenticated/ia/conversas")({
  head: () => ({ meta: [{ title: "Conversas | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Conversas"
      descricao="Acompanhe as mensagens e assuma o atendimento quando precisar."
      papeis={["plataforma", "admin", "membro"]}
    >
      {(ctx) => <Conversas key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  ),
});
