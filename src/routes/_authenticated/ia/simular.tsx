import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
import { Simulador } from "@/components/luxtia/Simulador";

export const Route = createFileRoute("/_authenticated/ia/simular")({
  validateSearch: (s: Record<string, unknown>): { agente?: string } =>
    typeof s["agente"] === "string" ? { agente: s["agente"] } : {},
  head: () => ({ meta: [{ title: "Simular conversa | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Simular conversa"
      descricao="Envie mensagens como se fosse um cliente, por um canal API (para testes). Nada é enviado aos clientes."
      papeis={["plataforma", "admin"]}
    >
      {(ctx) => <SimularPagina key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

function SimularPagina({ ctx }: { ctx: ContextoGateway }) {
  const { agente } = Route.useSearch();
  return <Simulador ctx={ctx} agenteInicial={agente ?? null} />;
}
