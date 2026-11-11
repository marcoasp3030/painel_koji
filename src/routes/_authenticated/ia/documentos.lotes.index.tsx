import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
import { AbasDocumentos } from "@/components/luxtia/documentos/AbasDocumentos";
import { DialogoNovoLote, LotesLista } from "@/components/luxtia/documentos/Lotes";
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import { capacidadeDocumentos } from "@/lib/gateway-simular.functions";
import { criarLote, listarLotes } from "@/lib/gateway-lotes.functions";

export const Route = createFileRoute("/_authenticated/ia/documentos/lotes/")({
  head: () => ({ meta: [{ title: "Lotes | Luxbrain" }] }),
  component: () => (
    <PaginaGateway
      titulo="Documentos"
      descricao="Envie várias notas de uma vez para um agente com a capacidade de documentos ligada."
      papeis={["plataforma", "gestor"]}
    >
      {(ctx) => <Tela key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

function Tela({ ctx }: { ctx: ContextoGateway }) {
  const navegar = useNavigate();
  const listar = useServerFn(listarLotes);
  const criar = useServerFn(criarLote);
  const listarAg = useServerFn(listarAgentes);
  const capDocs = useServerFn(capacidadeDocumentos);
  const cache = useQueryClient();
  const [novo, setNovo] = useState(false);

  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listarAg({ data: { empresa: ctx.empresa } }),
  });

  const comDocumentos = useQuery({
    queryKey: ["gateway", "agentes-documentos", ctx.empresa, agentes.data?.itens.map((a) => a.id)],
    enabled: Boolean(agentes.data?.itens.length),
    queryFn: async () => {
      const itens = agentes.data?.itens ?? [];
      const ok: { id: string; nome: string }[] = [];
      for (const a of itens) {
        const r = await capDocs({ data: { empresa: ctx.empresa, agente: a.id } });
        if (r.ativo) ok.push({ id: a.id, nome: a.nome });
      }
      return ok;
    },
  });

  const lista = useQuery({
    queryKey: ["lotes", ctx.empresa],
    queryFn: async () => {
      const r = await listar({ data: { empresa: ctx.empresa, acao: "listar" } });
      return r.itens;
    },
  });

  const nomesAgente = Object.fromEntries(
    (agentes.data?.itens ?? []).map((a) => [a.id, a.nome] as const),
  );

  const criarMut = useMutation({
    mutationFn: (dados: { agente_id: string; nome?: string }) =>
      criar({
        data: {
          empresa: ctx.empresa,
          acao: "criar",
          agente_id: dados.agente_id,
          ...(dados.nome ? { nome: dados.nome } : {}),
        },
      }),
    onSuccess: (lote) => {
      toast.success("Lote criado.");
      setNovo(false);
      void cache.invalidateQueries({ queryKey: ["lotes", ctx.empresa] });
      void navegar({
        to: "/ia/documentos/lotes/$loteId",
        params: { loteId: lote.lote_id },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AbasDocumentos ativa="lotes" />
      <LotesLista
        itens={lista.data ?? []}
        nomesAgente={nomesAgente}
        carregando={lista.isLoading}
        erro={lista.error instanceof Error ? lista.error.message : undefined}
        onNovo={() => setNovo(true)}
        onAbrir={(id) =>
          void navegar({ to: "/ia/documentos/lotes/$loteId", params: { loteId: id } })
        }
      />
      <DialogoNovoLote
        aberto={novo}
        onFechar={() => setNovo(false)}
        agentes={comDocumentos.data ?? []}
        carregandoAgentes={agentes.isLoading || comDocumentos.isLoading}
        salvando={criarMut.isPending}
        onCriar={(d) => criarMut.mutate(d)}
      />
    </>
  );
}
