import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { Food99LojasEmpresa } from "@/components/luxtia/Food99LojasEmpresa";

export const Route = createFileRoute("/_authenticated/ia/configuracoes/99food")({
  head: () => ({ meta: [{ title: "99Food | Luxbrain" }] }),
  component: PaginaFood99Empresa,
});

function PaginaFood99Empresa() {
  return (
    <PaginaGateway
      titulo="99Food"
      descricao="Conecte cada unidade à 99Food, confira a autorização e desconecte quando precisar."
      papeis={["plataforma", "gestor"]}
      telaCheia
    >
      {(ctx) => <Food99LojasEmpresa key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  );
}
