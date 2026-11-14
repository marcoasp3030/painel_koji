import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { MetaCredenciais } from "@/components/luxtia/MetaCredenciais";

export const Route = createFileRoute("/_authenticated/ia/meta")({
  head: () => ({ meta: [{ title: "WhatsApp oficial (Meta) | Luxbrain" }] }),
  component: PaginaMeta,
});

function PaginaMeta() {
  return (
    <PaginaGateway
      titulo="WhatsApp oficial (Meta)"
      descricao="Credenciais do aplicativo da Meta e o endereço do webhook para colar no portal."
      papeis={["plataforma"]}
      semEmpresa
    >
      {() => <MetaCredenciais />}
    </PaginaGateway>
  );
}
