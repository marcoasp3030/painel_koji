import { Capacidade } from "@/components/luxtia/Capacidade";
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CanaisDoAgente } from "@/components/luxtia/agente/CanaisDoAgente";
import { Comportamento } from "@/components/luxtia/agente/Comportamento";
import { ConexaoIA } from "@/components/luxtia/agente/ConexaoIA";
import { ModulosDoAgente } from "@/components/luxtia/agente/ModulosDoAgente";
import { VisaoGeral } from "@/components/luxtia/agente/VisaoGeral";
import { Etiqueta, PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
import { CabecalhoPagina, Cartao, EstadoVazio } from "@/components/luxtia/Superficie";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  alterarAgente,
  listarModelos,
  obterAgente,
  obterCircuito,
} from "@/lib/gateway-agentes.functions";
import { listarCanais } from "@/lib/gateway-canais.functions";
import { ehAgenteDeTeste } from "@/lib/gateway/ocultos";
import { prontidao, type AcaoProntidao } from "@/lib/gateway/prontidao";
import { ENVIO, RESPOSTAS, SITUACAO_AGENTE } from "@/lib/gateway/vocabulario";

const ABAS = ["visao", "comportamento", "modulos", "conexao", "canais", "avancado"] as const;
type Aba = (typeof ABAS)[number];

export const Route = createFileRoute("/_authenticated/ia/agentes/$agenteId")({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba; empresa?: string } => ({
    ...(ABAS.includes(s["aba"] as Aba) ? { aba: s["aba"] as Aba } : {}),
    ...(typeof s["empresa"] === "string" ? { empresa: s["empresa"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Agente | Luxtia" }] }),
  component: PaginaAgente,
});

function PaginaAgente() {
  const { agenteId } = Route.useParams();
  const { empresa } = Route.useSearch();
  return (
    <PaginaGateway
      titulo="Agente"
      papeis={["plataforma", "admin", "membro"]}
      empresaFixa={empresa ?? null}
      semCabecalho
    >
      {(ctx) => <Agente key={`${ctx.empresa}:${agenteId}`} ctx={ctx} agenteId={agenteId} />}
    </PaginaGateway>
  );
}

function Agente({ ctx, agenteId }: { ctx: ContextoGateway; agenteId: string }) {
  const navigate = useNavigate({ from: Route.fullPath });
  const { aba: abaPedida } = Route.useSearch();
  const queryClient = useQueryClient();
  const obter = useServerFn(obterAgente);
  const circuitoFn = useServerFn(obterCircuito);
  const listarCn = useServerFn(listarCanais);
  const modelosFn = useServerFn(listarModelos);
  const alterar = useServerFn(alterarAgente);
  const plataforma = ctx.papel === "plataforma";
  const [criandoCanal, setCriandoCanal] = useState(false);

  const adminOuPlataforma = ctx.papel === "admin" || plataforma;
  const aba: Aba =
    (abaPedida === "conexao" || abaPedida === "avancado") && !plataforma
      ? "visao"
      : (abaPedida ?? "visao");
  const irPara = (nova: Aba) =>
    navigate({
      search: (s: { aba?: Aba; empresa?: string }) => ({ ...s, aba: nova }),
      replace: true,
    });

  const chave = ["gateway", "agente", ctx.empresa, agenteId];
  const detalhe = useQuery({
    queryKey: chave,
    queryFn: () => obter({ data: { empresa: ctx.empresa, agente: agenteId } }),
  });
  const circuito = useQuery({
    queryKey: ["gateway", "circuito", ctx.empresa, agenteId],
    queryFn: () => circuitoFn({ data: { empresa: ctx.empresa, agente: agenteId } }),
  });
  const canais = useQuery({
    queryKey: ["gateway", "canais", ctx.empresa],
    queryFn: () => listarCn({ data: { empresa: ctx.empresa } }),
  });
  const modelos = useQuery({
    queryKey: ["gateway", "modelos", ctx.empresa],
    queryFn: () => modelosFn({ data: { empresa: ctx.empresa } }),
    enabled: plataforma,
  });

  const situacao = useMutation({
    mutationFn: (status: "ativo" | "pausado" | "rascunho") =>
      alterar({ data: { empresa: ctx.empresa, agente: agenteId, dados: { status } } }),
    onSuccess: async (a) => {
      toast.success(`Agente ${SITUACAO_AGENTE[a.status]?.rotulo.toLowerCase() ?? "atualizado"}.`);
      await queryClient.invalidateQueries({ queryKey: chave });
      await queryClient.invalidateQueries({ queryKey: ["gateway", "agentes", ctx.empresa] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agente = detalhe.data;
  const voltar = (
    <Link
      to="/ia/agentes"
      className="inline-flex items-center gap-1 text-sm text-purple-700 underline-offset-2 hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden /> Agentes
    </Link>
  );

  if (detalhe.isLoading) return <p className="mt-8 text-ink-500">Carregando…</p>;
  if (detalhe.error || !agente) {
    return (
      <div className="mt-2 space-y-4">
        {voltar}
        <Cartao>
          <EstadoVazio
            titulo="Não foi possível abrir o agente"
            texto={(detalhe.error as Error | null)?.message ?? "Tente de novo."}
          />
        </Cartao>
      </div>
    );
  }

  const nomeModelo = modelos.data?.find((m) => m.id === agente.modelo_id)?.nome ?? null;
  const itens = prontidao(agente, canais.data?.itens ?? [], circuito.data ?? null, nomeModelo);
  const efetiva = agente.configuracao_efetiva ?? {};
  const respostas = RESPOSTAS[String(efetiva["agente_mode"] ?? agente.agente_mode ?? "mock")];
  const envio = ENVIO[String(efetiva["send_mode"] ?? agente.send_mode ?? "dry")];
  const situacaoAtual = SITUACAO_AGENTE[agente.status];

  function acao(a: AcaoProntidao) {
    if (a === "ativar") situacao.mutate("ativo");
    else if (a === "criar_canal") {
      irPara("canais");
      setCriandoCanal(true);
    } else if (a === "ver_canais") irPara("canais");
    else irPara("conexao");
  }

  return (
    <div className="space-y-6">
      {voltar}
      <CabecalhoPagina
        sobretitulo="Agente"
        titulo={agente.nome}
        descricao={`Modelo: ${nomeModelo ?? agente.modelo_id.replace(/_/g, " ")} · Respostas: ${respostas} · Envio aos clientes: ${envio}`}
      />
      <div className="flex flex-wrap gap-1.5">
        <Etiqueta tom={situacaoAtual?.tom ?? "neutro"}>
          {situacaoAtual?.rotulo ?? agente.status}
        </Etiqueta>
        {ehAgenteDeTeste(agente.nome) ? (
          <Etiqueta tom="alerta">Teste: escondido da empresa</Etiqueta>
        ) : null}
      </div>

      <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)}>
        <TabsList className="h-auto flex-wrap justify-start bg-base-200/60">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="comportamento">Comportamento</TabsTrigger>
          {adminOuPlataforma ? <TabsTrigger value="modulos">Módulos</TabsTrigger> : null}
          {plataforma ? <TabsTrigger value="conexao">Conexão com IA</TabsTrigger> : null}
          <TabsTrigger value="canais">Canais</TabsTrigger>
          {plataforma ? <TabsTrigger value="avancado">Avançado</TabsTrigger> : null}
        </TabsList>

        {plataforma ? (
          <TabsContent value="avancado" className="mt-6">
            <Capacidade empresa={ctx.empresa!} agente={agenteId} />
          </TabsContent>
        ) : null}
        <TabsContent value="visao" className="mt-6">
          <VisaoGeral
            ctx={ctx}
            agente={agente}
            itens={itens}
            salvando={situacao.isPending}
            onAcao={acao}
            onSituacao={(s) => situacao.mutate(s)}
          />
        </TabsContent>
        <TabsContent value="comportamento" className="mt-6">
          <Comportamento ctx={ctx} agente={agente} />
        </TabsContent>
        {adminOuPlataforma ? (
          <TabsContent value="modulos" className="mt-6">
            <ModulosDoAgente ctx={ctx} agenteId={agente.id} />
          </TabsContent>
        ) : null}
        {plataforma ? (
          <TabsContent value="conexao" className="mt-6">
            <ConexaoIA ctx={ctx} agente={agente} />
          </TabsContent>
        ) : null}
        <TabsContent value="canais" className="mt-6">
          <CanaisDoAgente
            ctx={ctx}
            agente={agente}
            canais={canais.data?.itens ?? []}
            criando={criandoCanal}
            onCriando={setCriandoCanal}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
