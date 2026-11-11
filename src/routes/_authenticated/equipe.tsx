import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
import { UsuariosTela } from "@/components/luxtia/Usuarios";
import { peloMenos } from "@/lib/acesso/papeis";
import { gerarLinkRedefinicao } from "@/lib/entrada.functions";
import {
  alterarUsuario,
  convidarUsuario,
  criarUsuarioComSenha,
  definirSenhaUsuario,
  listarUsuarios,
  reenviarConvite,
  revogarConvite,
} from "@/lib/usuarios.functions";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Usuários da empresa | Luxbrain" },
      {
        name: "description",
        content: "Crie e gerencie pessoas da empresa: papel, unidades, senha e ativação.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <PaginaGateway
      titulo="Usuários da empresa"
      telaCheia
      papeis={["plataforma", "gestor", "supervisor"]}
    >
      {(ctx) => <Equipe ctx={ctx} />}
    </PaginaGateway>
  );
}

function Equipe({ ctx }: { ctx: ContextoGateway }) {
  const cache = useQueryClient();
  const listar = useServerFn(listarUsuarios);
  const convidar = useServerFn(convidarUsuario);
  const criarSenha = useServerFn(criarUsuarioComSenha);
  const definirSenha = useServerFn(definirSenhaUsuario);
  const alterar = useServerFn(alterarUsuario);
  const reenviar = useServerFn(reenviarConvite);
  const revogar = useServerFn(revogarConvite);
  const redefinir = useServerFn(gerarLinkRedefinicao);
  const [aviso, setAviso] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["usuarios", ctx.empresa],
    queryFn: () => listar({ data: { empresa: ctx.empresa } }),
  });
  const invalida = () => cache.invalidateQueries({ queryKey: ["usuarios", ctx.empresa] });
  const podeSenha = peloMenos(q.data?.papel, "gestor");

  const criar = useMutation({
    mutationFn: (d: {
      email: string;
      nome: string;
      papel: "gestor" | "supervisor" | "funcionario";
      unidades: string[];
    }) => convidar({ data: { ...d, empresa: ctx.empresa } }),
    onSuccess: (r) => {
      setLink(r.link);
      setAviso(r.link ? null : r.aviso);
      toast.success(r.link ? "Link gerado." : r.aviso ? "Acesso gravado." : "Convite enviado.");
      void invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const criarComSenha = useMutation({
    mutationFn: (d: {
      email: string;
      nome: string;
      papel: "gestor" | "supervisor" | "funcionario";
      unidades: string[];
      senha: string;
    }) => criarSenha({ data: { ...d, empresa: ctx.empresa } }),
    onSuccess: () => {
      toast.success("Usuário criado com senha.");
      void invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mudar = useMutation({
    mutationFn: (d: {
      id: string;
      papel?: "gestor" | "supervisor" | "funcionario";
      unidades?: string[];
      ativo?: boolean;
    }) => alterar({ data: { ...d, empresa: ctx.empresa } }),
    onSuccess: () => {
      toast.success("Acesso atualizado.");
      void invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deNovo = useMutation({
    mutationFn: (id: string) => reenviar({ data: { id, empresa: ctx.empresa } }),
    onSuccess: (r) => {
      setLink(r.link);
      if (!r.ok) setAviso(r.aviso);
      else if (r.link) {
        setAviso(null);
        toast.success("Link gerado.");
      } else toast.success("Convite reenviado.");
      void invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revogarUm = useMutation({
    mutationFn: (id: string) => revogar({ data: { id, empresa: ctx.empresa } }),
    onSuccess: () => {
      setLink(null);
      toast.success("Convite revogado.");
      void invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const novaSenha = useMutation({
    mutationFn: (userId: string) => redefinir({ data: { user_id: userId, empresa: ctx.empresa } }),
    onSuccess: (r) => {
      setLink(r.link);
      setAviso(r.aviso);
      toast.success("Link de nova senha gerado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const senhaDireta = useMutation({
    mutationFn: (d: { id: string; senha: string }) =>
      definirSenha({ data: { ...d, empresa: ctx.empresa } }),
    onSuccess: () => {
      toast.success("Senha atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) return <p className="p-4 text-sm text-ink-500">Carregando usuários…</p>;
  if (q.isError)
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {q.error.message}
      </p>
    );
  return (
    <UsuariosTela
      concediveis={q.data.concediveis}
      podeRedefinirSenha={podeSenha}
      podeDefinirSenha={podeSenha}
      unidades={q.data.unidades}
      usuarios={q.data.usuarios}
      ocupado={
        criar.isPending ||
        criarComSenha.isPending ||
        mudar.isPending ||
        deNovo.isPending ||
        revogarUm.isPending ||
        novaSenha.isPending ||
        senhaDireta.isPending
      }
      aviso={aviso}
      linkConvite={link}
      convitePorEmail={q.data.convitePorEmail}
      onConvidar={(d, pronto) => criar.mutate(d, { onSuccess: pronto })}
      onCriarComSenha={(d, pronto) => criarComSenha.mutate(d, { onSuccess: pronto })}
      onAlterar={(d, pronto) => mudar.mutate(d, { onSuccess: pronto })}
      onReenviar={(id) => deNovo.mutate(id)}
      onRevogar={(id) => revogarUm.mutate(id)}
      onRedefinirSenha={(userId) => novaSenha.mutate(userId)}
      onDefinirSenha={(d, pronto) => senhaDireta.mutate(d, { onSuccess: pronto })}
      onFecharLink={() => {
        setLink(null);
        setAviso(null);
      }}
    />
  );
}
