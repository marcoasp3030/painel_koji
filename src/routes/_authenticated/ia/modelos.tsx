import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { ModelosAgente } from "@/components/luxtia/ModelosAgente";

export const Route = createFileRoute("/_authenticated/ia/modelos")({
  head: () => ({ meta: [{ title: "Modelos de agente | Luxtia" }] }),
  component: () => (
    <PaginaGateway titulo="Modelos de agente" papeis={["plataforma"]} semEmpresa telaCheia>
      {() => <ModelosAgente />}
    </PaginaGateway>
  ),
});
