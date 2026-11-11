import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { IfoodLojasPlataforma } from "@/components/luxtia/IfoodLojasPlataforma";

export const Route = createFileRoute("/_authenticated/ia/ifood")({
  head: () => ({ meta: [{ title: "iFood | Luxbrain" }] }),
  component: PaginaIfoodPlataforma,
});

function PaginaIfoodPlataforma() {
  return (
    <PaginaGateway
      titulo="iFood"
      descricao="Lojas que autorizaram o aplicativo e a ligação com cada empresa."
      papeis={["plataforma"]}
      semEmpresa
      telaCheia
    >
      {() => <IfoodLojasPlataforma />}
    </PaginaGateway>
  );
}
