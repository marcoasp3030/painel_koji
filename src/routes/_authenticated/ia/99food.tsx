import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { Food99Credenciais } from "@/components/luxtia/Food99Credenciais";

export const Route = createFileRoute("/_authenticated/ia/99food")({
  head: () => ({ meta: [{ title: "99Food | Luxbrain" }] }),
  component: PaginaFood99,
});

function PaginaFood99() {
  return (
    <PaginaGateway
      titulo="99Food"
      descricao="Credenciais do aplicativo 99Food e o Callback Address para colar no portal."
      papeis={["plataforma"]}
      semEmpresa
    >
      {() => <Food99Credenciais />}
    </PaginaGateway>
  );
}
