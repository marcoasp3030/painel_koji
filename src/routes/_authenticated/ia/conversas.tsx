import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { Conversas } from "@/components/luxtia/Conversas";

export const Route = createFileRoute("/_authenticated/ia/conversas")({
  validateSearch: (s: Record<string, unknown>) => ({
    ...(typeof s["conversa"] === "string" &&
    s["conversa"].length >= 3 &&
    s["conversa"].length <= 300
      ? { conversa: s["conversa"] }
      : {}),
    ...(typeof s["nome"] === "string" && s["nome"].length <= 200 ? { nome: s["nome"] } : {}),
    ...(typeof s["telefone"] === "string" && s["telefone"].length <= 40
      ? { telefone: s["telefone"] }
      : {}),
    ...(typeof s["canal"] === "string" && s["canal"].length <= 40 ? { canal: s["canal"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Conversas | Luxtia" }] }),
  component: PaginaConversas,
});

function PaginaConversas() {
  const busca = Route.useSearch();
  return (
    <PaginaGateway
      titulo="Conversas"
      descricao="Acompanhe as mensagens e assuma o atendimento quando precisar."
      papeis={["plataforma", "gestor", "supervisor", "funcionario"]}
    >
      {(ctx) => (
        <Conversas
          key={ctx.empresa ?? "vinculada"}
          ctx={ctx}
          abertura={
            busca.conversa
              ? {
                  conversa: busca.conversa,
                  ...(busca.nome ? { nome: busca.nome } : {}),
                  ...(busca.telefone ? { telefone: busca.telefone } : {}),
                  ...(busca.canal ? { canal: busca.canal } : {}),
                }
              : null
          }
        />
      )}
    </PaginaGateway>
  );
}
