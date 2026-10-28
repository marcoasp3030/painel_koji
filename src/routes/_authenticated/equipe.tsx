import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
import { UsuariosTela } from "@/components/luxtia/Usuarios";
import {
  alterarUsuario,
  convidarUsuario,
  listarUsuarios,
  reenviarConvite,
  revogarConvite,
} from "@/lib/usuarios.functions";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Usuários | Luxtia" },
      { name: "description", content: "Convide pessoas e defina papel e unidades." },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <PaginaGateway
      titulo="Usuários"
      semCabecalho
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
  const alterar = useServerFn(alterarUsuario);
  const reenviar = useServerFn(reenviarConvite);
  const revogar = useServerFn(revogarConvite);
  const [aviso, setAviso] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["usuarios", ctx.empresa],
    queryFn: () => listar({ data: { empresa: ctx.empresa } }),
  });
  const invalida = () => cache.invalidateQueries({ queryKey: ["usuarios", ctx.empresa] });
  const criar = useMutation({
    mutationFn: (d: { email: string; nome: string; papel: "gestor" | "supervisor" | "funcionario"; unidades: string[] }) =>
      convidar({ data: { ...d, empresa: ctx.empresa } }),
    onSuccess: (r) => {
      setLink(r.link);
      setAviso(r.link ? null : r.aviso);
      toast.success(r.link ? "Link gerado." : r.aviso ? "Acesso gravado." : "Convite enviado.");
      void invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mudar = useMutation({
    mutationFn: (d: { id: string; papel?: "gestor" | "supervisor" | "funcionario"; unidades?: string[]; ativo?: boolean }) =>
      alterar({ data: { ...d, empresa: ctx.empresa } }),
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
  if (q.isPending) return <p className="text-sm text-ink-500">Carregando usuários…</p>;
  if (q.isError) return <p role="alert">{q.error.message}</p>;
  return (
    <UsuariosTela
      empresa={q.data.empresa}
      concediveis={q.data.concediveis}
      unidades={q.data.unidades}
      usuarios={q.data.usuarios}
      ocupado={criar.isPending || mudar.isPending || deNovo.isPending || revogarUm.isPending}
      aviso={aviso}
      linkConvite={link}
      convitePorEmail={q.data.convitePorEmail}
      onConvidar={(d) => criar.mutate(d)}
      onAlterar={(d) => mudar.mutate(d)}
      onReenviar={(id) => deNovo.mutate(id)}
      onRevogar={(id) => revogarUm.mutate(id)}
    />
  );
}
