import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { peloMenos } from "@/lib/acesso/papeis";
import { PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
import { ChavesFormularioTela } from "@/components/luxtia/documentos/ChavesFormulario";
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import {
  criarChaveFormulario,
  listarChavesFormulario,
  revogarChaveFormulario,
} from "@/lib/gateway-documentos.functions";

export const Route = createFileRoute("/_authenticated/ia/chaves-formulario")({
  head: () => ({ meta: [{ title: "Chaves de formulário | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Chaves de formulário"
      descricao="Chaves para um site enviar documentos a um agente. O valor aparece uma única vez."
      papeis={["plataforma", "gestor"]}
    >
      {(ctx) => <Tela key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

function Tela({ ctx }: { ctx: ContextoGateway }) {
  const listar = useServerFn(listarChavesFormulario);
  const criarFn = useServerFn(criarChaveFormulario);
  const revogarFn = useServerFn(revogarChaveFormulario);
  const listarAg = useServerFn(listarAgentes);
  const cache = useQueryClient();
  const [chaveNova, setChaveNova] = useState<string | null>(null);
  const podeCriar = peloMenos(ctx.papel, "gestor");
  const lista = useQuery({
    queryKey: ["chaves-formulario", ctx.empresa],
    queryFn: () => listar({ data: { empresa: ctx.empresa, acao: "listar" } }),
  });
  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listarAg({ data: { empresa: ctx.empresa } }),
  });
  const recarregar = () =>
    cache.invalidateQueries({ queryKey: ["chaves-formulario", ctx.empresa] });
  const criar = useMutation({
    mutationFn: (dados: {
      nome: string;
      agente_id: string;
      limite_por_minuto: number;
      origens: string[];
    }) => criarFn({ data: { empresa: ctx.empresa, acao: "criar", ...dados } }),
    onSuccess: (r) => {
      setChaveNova(r.chave);
      toast.success("Chave criada. Copie agora.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revogar = useMutation({
    mutationFn: (id: string) => revogarFn({ data: { empresa: ctx.empresa, acao: "revogar", id } }),
    onSuccess: () => {
      toast.success("Chave revogada.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <ChavesFormularioTela
      itens={lista.data?.itens ?? []}
      agentes={agentes.data?.itens ?? []}
      podeCriar={podeCriar}
      carregando={lista.isLoading}
      erro={lista.error instanceof Error ? lista.error.message : undefined}
      salvando={criar.isPending || revogar.isPending}
      onCriar={(dados) => criar.mutate(dados)}
      onRevogar={(c) => revogar.mutate(c.id)}
      chaveNova={chaveNova}
      onFecharChave={() => setChaveNova(null)}
    />
  );
}
