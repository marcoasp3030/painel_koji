import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { GestaoUnidades } from "@/components/luxtia/GestaoUnidades";
import type { SecaoUnidade } from "@/lib/gateway/gestao";

const SECOES = ["agenda", "horarios", "excecoes", "pagamentos"] as const;

export const Route = createFileRoute("/_authenticated/ia/unidades")({
  validateSearch: (s: Record<string, unknown>): { unidade?: string; secao?: SecaoUnidade } => ({
    ...(typeof s["unidade"] === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(s["unidade"])
      ? { unidade: s["unidade"] }
      : {}),
    ...(SECOES.includes(s["secao"] as SecaoUnidade) ? { secao: s["secao"] as SecaoUnidade } : {}),
  }),
  head: () => ({ meta: [{ title: "Unidades e horários | Luxtia" }] }),
  component: PaginaUnidades,
});

function PaginaUnidades() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <PaginaGateway
      titulo="Unidades e horários"
      descricao="Abra a agenda, os horários ou as exceções direto em cada unidade. A situação vem do gateway."
      papeis={["plataforma", "gestor", "supervisor"]}
    >
      {(ctx) => (
        <GestaoUnidades
          key={ctx.empresa ?? "vinculada"}
          ctx={ctx}
          unidadeId={busca.unidade ?? null}
          secao={busca.secao ?? "agenda"}
          aoNavegar={(destino) =>
            navigate({
              search: {
                ...(destino.unidade ? { unidade: destino.unidade } : {}),
                ...(destino.unidade && destino.secao && destino.secao !== "agenda"
                  ? { secao: destino.secao }
                  : {}),
              },
              replace: true,
            })
          }
        />
      )}
    </PaginaGateway>
  );
}
