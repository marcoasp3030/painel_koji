import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Luxtia · Redirecionando para o seu painel" },
      { name: "description", content: "Encaminhando o acesso para o painel correto da Luxtia." },
      { property: "og:title", content: "Luxtia · Painel" },
      { property: "og:description", content: "Encaminhando o acesso para o painel correto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const navigate = useNavigate();
  const fetchMe = useServerFn(getMe);
  const { data, isError } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  useEffect(() => {
    if (!data) return;
    if (data.isSuperAdmin) navigate({ to: "/admin", replace: true });
    else if (data.tenant) navigate({ to: "/equipe", replace: true });
  }, [data, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-50 px-6 text-center">
      {isError ? (
        <p className="text-ink-500">Não foi possível carregar o seu acesso. Entre novamente.</p>
      ) : data && data.isSuperAdmin ? (
        <p className="text-ink-500">Abrindo o painel da plataforma…</p>
      ) : data && !data.tenant ? (
        <p className="text-ink-500">
          Seu acesso ainda não está vinculado a nenhum cliente. Fale com a administração.
        </p>
      ) : (
        <p className="text-ink-500">Carregando seu painel…</p>
      )}
    </div>
  );
}
