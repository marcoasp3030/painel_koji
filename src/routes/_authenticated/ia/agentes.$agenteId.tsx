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
import { peloMenos } from "@/lib/acesso/papeis";
import { Etiqueta, PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

type Situacao = "ativo" | "pausado" | "rascunho";

const EFEITO_SITUACAO: Record<Situacao, string> = {
  ativo: "O agente passa a responder às mensagens recebidas.",
  pausado: "O agente para de responder. As mensagens recebidas são ignoradas até reativar.",
  rascunho: "O agente para de responder. As mensagens recebidas são ignoradas.",
};

const CLASSE_ABA =
  "h-9 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-sm shadow-none data-[state=active]:border-purple-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none";
const CLASSE_CONTEUDO = "mt-0 min-h-0 flex-1 overflow-y-auto bg-base-50 p-3";

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
      papeis={["plataforma", "gestor", "supervisor"]}
      empresaFixa={empresa ?? null}
      telaCheia
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
  const [mudarPara, setMudarPara] = useState<Situacao | null>(null);

  const adminOuPlataforma = peloMenos(ctx.papel, "gestor");
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
    mutationFn: (status: Situacao) =>
      alterar({ data: { empresa: ctx.empresa, agente: agenteId, dados: { status } } }),
    onSuccess: async (a) => {
      toast.success(`Agente ${SITUACAO_AGENTE[a.status]?.rotulo.toLowerCase() ?? "atualizado"}.`);
      setMudarPara(null);
      await queryClient.invalidateQueries({ queryKey: chave });
      await queryClient.invalidateQueries({ queryKey: ["gateway", "agentes", ctx.empresa] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agente = detalhe.data;
  const voltar = (
    <Link
      to="/ia/agentes"
      aria-label="Voltar para agentes"
      className="rounded p-1 text-ink-500 hover:bg-purple-50 hover:text-purple-800"
    >
      <ArrowLeft className="size-4" aria-hidden />
    </Link>
  );

  if (detalhe.isLoading) return <p className="p-4 text-sm text-ink-500">Carregando…</p>;
  if (detalhe.error || !agente) {
    return (
      <div className="flex items-center gap-2 border-b border-base-200 bg-card px-3 py-2">
        {voltar}
        <p role="alert" className="text-sm text-destructive">
          {(detalhe.error as Error | null)?.message ?? "Não foi possível abrir o agente."}
        </p>
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
    if (a === "ativar") setMudarPara("ativo");
    else if (a === "criar_canal") {
      irPara("canais");
      setCriandoCanal(true);
    } else if (a === "ver_canais") irPara("canais");
    else irPara("conexao");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-base-200 px-3 py-1.5">
        {voltar}
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="truncate text-sm font-medium text-ink-900">{agente.nome}</h2>
          <p className="truncate text-xs text-ink-500">
            {nomeModelo ?? agente.modelo_id.replace(/_/g, " ")}
            {plataforma ? ` · Respostas: ${respostas} · Envio aos clientes: ${envio}` : ""}
          </p>
        </div>
        {ehAgenteDeTeste(agente.nome) ? (
          <Etiqueta tom="alerta">Teste: escondido da empresa</Etiqueta>
        ) : null}
        <Etiqueta tom={situacaoAtual?.tom ?? "neutro"}>
          {situacaoAtual?.rotulo ?? agente.status}
        </Etiqueta>
      </div>

      <Tabs
        value={aba}
        onValueChange={(v) => irPara(v as Aba)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="h-auto w-full shrink-0 justify-start overflow-x-auto rounded-none border-b border-base-200 bg-card p-0 px-2 [scrollbar-width:none]">
          <TabsTrigger className={CLASSE_ABA} value="visao">
            Visão geral
          </TabsTrigger>
          <TabsTrigger className={CLASSE_ABA} value="comportamento">
            Comportamento
          </TabsTrigger>
          {adminOuPlataforma ? (
            <TabsTrigger className={CLASSE_ABA} value="modulos">
              Módulos
            </TabsTrigger>
          ) : null}
          {plataforma ? (
            <TabsTrigger className={CLASSE_ABA} value="conexao">
              Conexão com IA
            </TabsTrigger>
          ) : null}
          <TabsTrigger className={CLASSE_ABA} value="canais">
            Canais
          </TabsTrigger>
          {plataforma ? (
            <TabsTrigger className={CLASSE_ABA} value="avancado">
              Avançado
            </TabsTrigger>
          ) : null}
        </TabsList>

        {plataforma ? (
          <TabsContent value="avancado" className={CLASSE_CONTEUDO}>
            <Capacidade empresa={ctx.empresa!} agente={agenteId} />
          </TabsContent>
        ) : null}
        <TabsContent value="visao" className={CLASSE_CONTEUDO}>
          <VisaoGeral
            ctx={ctx}
            agente={agente}
            itens={itens}
            salvando={situacao.isPending}
            onAcao={acao}
            onSituacao={setMudarPara}
          />
        </TabsContent>
        <TabsContent value="comportamento" className={CLASSE_CONTEUDO}>
          <Comportamento ctx={ctx} agente={agente} />
        </TabsContent>
        {adminOuPlataforma ? (
          <TabsContent value="modulos" className={CLASSE_CONTEUDO}>
            <ModulosDoAgente ctx={ctx} agenteId={agente.id} />
          </TabsContent>
        ) : null}
        {plataforma ? (
          <TabsContent value="conexao" className={CLASSE_CONTEUDO}>
            <ConexaoIA ctx={ctx} agente={agente} />
          </TabsContent>
        ) : null}
        <TabsContent value="canais" className={CLASSE_CONTEUDO}>
          <CanaisDoAgente
            ctx={ctx}
            agente={agente}
            canais={canais.data?.itens ?? []}
            criando={criandoCanal}
            onCriando={setCriandoCanal}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={mudarPara !== null}
        onOpenChange={(a) => !a && !situacao.isPending && setMudarPara(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mudar {agente.nome} para{" "}
              {mudarPara ? SITUACAO_AGENTE[mudarPara]?.rotulo.toLowerCase() : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mudarPara ? EFEITO_SITUACAO[mudarPara] : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={situacao.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (mudarPara) situacao.mutate(mudarPara);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
