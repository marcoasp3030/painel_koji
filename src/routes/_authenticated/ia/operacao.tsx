import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { Operacao } from "@/components/luxtia/Operacao";

export const Route = createFileRoute("/_authenticated/ia/operacao")({
  head: () => ({ meta: [{ title: "Operação | Luxtia" }] }),
  component: PaginaOperacao,
});

function PaginaOperacao() {
  return (
    <PaginaGateway
      titulo="Operação"
      descricao="Fila de agora, tempos de atendimento e volume por pessoa."
      papeis={["plataforma", "gestor", "supervisor"]}
      telaCheia
    >
      {(ctx) => <Operacao key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  );
}
