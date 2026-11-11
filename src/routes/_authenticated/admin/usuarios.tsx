import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/luxtia/AppShell";
import { UsuariosPlataformaTela } from "@/components/luxtia/UsuariosPlataforma";
import { ADMIN_NAV } from "@/lib/nav";
import {
  criarUsuarioPlataforma,
  linkNovaSenhaPlataforma,
  listarUsuariosPlataforma,
  removerUsuarioPlataforma,
} from "@/lib/plataforma-usuarios.functions";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários da plataforma | Luxbrain" },
      {
        name: "description",
        content: "Crie e gerencie contas com perfil de Super Admin da plataforma Luxbrain.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const cache = useQueryClient();
  const listar = useServerFn(listarUsuariosPlataforma);
  const criar = useServerFn(criarUsuarioPlataforma);
  const remover = useServerFn(removerUsuarioPlataforma);
  const linkSenhaFn = useServerFn(linkNovaSenhaPlataforma);
  const [aviso, setAviso] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["usuarios-plataforma"],
    queryFn: () => listar(),
  });
  const invalida = () => cache.invalidateQueries({ queryKey: ["usuarios-plataforma"] });

  const mutCriar = useMutation({
    mutationFn: (d: { email: string; nome: string; senha: string }) => criar({ data: d }),
    onSuccess: (r) => {
      toast.success(r.criado ? "Super admin criado." : "Acesso de plataforma concedido.");
      void invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mutRemover = useMutation({
    mutationFn: (user_id: string) => remover({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Acesso de plataforma removido.");
      void invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mutLink = useMutation({
    mutationFn: (user_id: string) => linkSenhaFn({ data: { user_id } }),
    onSuccess: (r) => {
      setLink(r.link);
      setAviso(r.aviso);
      toast.success("Link de nova senha gerado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell nav={ADMIN_NAV} context="Super Admin" telaCheia>
      <h1 className="sr-only">Usuários da plataforma</h1>
      {q.isPending ? (
        <p className="p-4 text-sm text-ink-500">Carregando usuários…</p>
      ) : q.isError ? (
        <p role="alert" className="p-4 text-sm text-destructive">
          {q.error.message}
        </p>
      ) : (
        <UsuariosPlataformaTela
          usuarios={q.data.usuarios}
          ocupado={mutCriar.isPending || mutRemover.isPending || mutLink.isPending}
          aviso={aviso}
          linkSenha={link}
          onCriar={(d, pronto) => mutCriar.mutate(d, { onSuccess: pronto })}
          onRemover={(id, pronto) => mutRemover.mutate(id, { onSuccess: pronto })}
          onLinkSenha={(id) => mutLink.mutate(id)}
          onFecharLink={() => {
            setLink(null);
            setAviso(null);
          }}
        />
      )}
    </AppShell>
  );
}
