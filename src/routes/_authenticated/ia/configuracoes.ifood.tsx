import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { IfoodLojasEmpresa } from "@/components/luxtia/IfoodLojasEmpresa";

export const Route = createFileRoute("/_authenticated/ia/configuracoes/ifood")({
  head: () => ({ meta: [{ title: "iFood | Luxtia" }] }),
  component: PaginaIfoodEmpresa,
});

function PaginaIfoodEmpresa() {
  return (
    <PaginaGateway
      titulo="iFood"
      descricao="Lojas do iFood ligadas à empresa e situação da conexão."
      papeis={["plataforma", "gestor"]}
      telaCheia
    >
      {(ctx) => <IfoodLojasEmpresa key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  );
}
