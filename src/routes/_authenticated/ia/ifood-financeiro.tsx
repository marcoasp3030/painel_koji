import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { IfoodFinanceiro } from "@/components/luxtia/IfoodFinanceiro";

export const Route = createFileRoute("/_authenticated/ia/ifood-financeiro")({
  head: () => ({ meta: [{ title: "Financeiro iFood | Luxtia" }] }),
  component: PaginaFinanceiroIfood,
});

function PaginaFinanceiroIfood() {
  return (
    <PaginaGateway
      titulo="Financeiro iFood"
      descricao="Vendas, comissões, repasses e o que ainda vai receber pelo iFood."
      papeis={["plataforma", "gestor"]}
      telaCheia
    >
      {(ctx) => <IfoodFinanceiro key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  );
}
