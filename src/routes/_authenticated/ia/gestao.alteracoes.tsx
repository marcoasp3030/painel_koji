import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { HistoricoGestao } from "@/components/luxtia/HistoricoGestao";

export const Route = createFileRoute("/_authenticated/ia/gestao/alteracoes")({
  validateSearch: (s: Record<string, unknown>): { unidade?: string } => ({
    ...(typeof s["unidade"] === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(s["unidade"])
      ? { unidade: s["unidade"] }
      : {}),
  }),
  head: () => ({ meta: [{ title: "Histórico de gestão | Luxtia" }] }),
  component: PaginaHistorico,
});

function PaginaHistorico() {
  const { unidade } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <PaginaGateway
      titulo="Histórico de gestão"
      descricao="Quem mudou unidades, horários e exceções. Escolha a unidade pelo nome."
      papeis={["plataforma", "gestor", "supervisor", "funcionario"]}
    >
      {(ctx) => (
        <HistoricoGestao
          key={ctx.empresa ?? "vinculada"}
          ctx={ctx}
          unidadeId={unidade ?? ""}
          aoEscolherUnidade={(id) =>
            navigate({
              search: id ? { unidade: id } : {},
              replace: true,
            })
          }
        />
      )}
    </PaginaGateway>
  );
}
