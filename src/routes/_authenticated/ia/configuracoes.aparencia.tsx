import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { AparenciaCardapioTela } from "@/components/luxtia/AparenciaCardapio";

export const Route = createFileRoute("/_authenticated/ia/configuracoes/aparencia")({
  head: () => ({ meta: [{ title: "Aparência do cardápio | Luxtia" }] }),
  component: () => (
    <PaginaGateway titulo="Aparência do cardápio" papeis={["plataforma", "gestor"]} telaCheia>
      {(ctx) => <AparenciaCardapioTela key={ctx.empresa ?? "vinculada"} ctx={ctx} />}
    </PaginaGateway>
  ),
});
