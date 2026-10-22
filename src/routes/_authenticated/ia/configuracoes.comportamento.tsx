import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { ComportamentoAgente } from "@/components/luxtia/comportamento/ComportamentoAgente";

export const Route = createFileRoute("/_authenticated/ia/configuracoes/comportamento")({
  head: () => ({ meta: [{ title: "Comportamento do agente | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      sobretitulo="Configurações"
      titulo="Comportamento do agente"
      descricao="Jeito de falar, regras da casa e comportamentos do atendimento. Edite em rascunho e publique quando estiver pronto."
      papeis={["plataforma", "admin", "membro"]}
    >
      {(ctx) => <ComportamentoAgente key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  ),
});
