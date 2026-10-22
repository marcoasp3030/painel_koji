import { useCallback, useEffect, useState } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { atendimento } from "@/lib/gateway-atendimento.functions";
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import { obterModulosEmpresa } from "@/lib/gateway-modulos.functions";
import {
  MOTIVO_AVISO,
  MOTIVO_BLOQUEIO,
  MOTIVO_CAMPO,
  SEM_EDICOES,
  campoSoLeitura,
  chaveCampo,
  contarEdicoes,
  corpoRascunho,
  gruposDoEsquema,
  porCampo,
  rotuloCaminho,
  rotuloCampo,
  rotuloGrupo,
  rotuloSegmento,
  situacaoCampo,
  textoValor,
  type CampoEsquema,
  type Edicoes,
  type ErroAtendimento,
  type Parte,
  type ResultadoAtendimento,
  type Trecho,
  type Visao,
} from "@/lib/gateway/atendimento";
import { CAMPOS_PEDIDOS, pedidosEmUso } from "@/lib/gateway/modulos";
import type { Json } from "@/lib/gateway/tipos";
import { dataHora, Etiqueta, type ContextoGateway } from "../Gateway";
import { Cartao } from "../Superficie";
import { CampoAtendimento } from "./CampoAtendimento";
import { HistoricoVersoes, TabelaAlteracoes } from "./HistoricoVersoes";
import { PreviaAtendimento } from "./PreviaAtendimento";

/** Erro estruturado de uma ação (campos, bloqueios, avisos, motivo do 409). */
export class ErroDaTela extends Error {
  constructor(readonly erro: ErroAtendimento) {
    super(erro.mensagem);
  }
}
export type Chamar = <T = Json>(entrada: { acao: string } & Record<string, unknown>) => Promise<T>;

const DESCARTAR = "Descartar as alterações não salvas?";

export function ComportamentoAgente({ ctx }: { ctx: ContextoGateway }) {
  const fn = useServerFn(atendimento),
    buscarAgentes = useServerFn(listarAgentes),
    buscarModulos = useServerFn(obterModulosEmpresa),
    cache = useQueryClient();
  const [agente, setAgente] = useState("");
  const [aba, setAba] = useState("personalidade");
  const [edicoes, setEdicoes] = useState<Edicoes>(SEM_EDICOES);
  const [problema, setProblema] = useState<ErroAtendimento | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const sujo = contarEdicoes(edicoes) > 0;
  const chave = ["atendimento", ctx.empresa ?? "vinculada", agente || "empresa"];
  const modulos = useQuery({
    queryKey: ["gateway", "modulos", ctx.empresa],
    queryFn: () => buscarModulos({ data: { empresa: ctx.empresa } }),
    staleTime: 30_000,
  });

  useBlocker({ shouldBlockFn: () => sujo && !window.confirm(DESCARTAR) });
  useEffect(() => {
    if (!sujo) return;
    const sair = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", sair);
    return () => window.removeEventListener("beforeunload", sair);
  }, [sujo]);

  const chamar: Chamar = useCallback(
    async <T,>(entrada: { acao: string } & Record<string, unknown>) => {
      const r = (await fn({
        data: { ...entrada, empresa: ctx.empresa, ...(agente ? { agente } : {}) },
      })) as ResultadoAtendimento<T>;
      if (!r.ok) throw new ErroDaTela(r.erro);
      return r.dados;
    },
    [fn, ctx.empresa, agente],
  ) as Chamar;

  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => buscarAgentes({ data: { empresa: ctx.empresa } }),
  });
  const q = useQuery({
    queryKey: chave,
    refetchOnWindowFocus: !sujo,
    refetchOnReconnect: !sujo,
    queryFn: () => chamar<Visao>({ acao: "ler" }),
  });
  const v = q.data;

  /** Ação que devolve a visão inteira (rascunho, descartar, publicar, restaurar). */
  async function escrever(entrada: { acao: string } & Record<string, unknown>, sucesso: string) {
    setOcupado(true);
    try {
      const nova = await chamar<Visao>(entrada);
      cache.setQueryData(chave, nova);
      void cache.invalidateQueries({ queryKey: [...chave, "versoes"] });
      setProblema(null);
      toast.success(sucesso);
      return { ok: true as const, visao: nova };
    } catch (e) {
      if (!(e instanceof ErroDaTela)) throw e;
      const erro = e.erro;
      if (["sem_rascunho", "sem_alteracoes", "versao_desatualizada"].includes(erro.motivo ?? ""))
        void q.refetch();
      if (erro.motivo !== "confirmacao_necessaria") {
        setProblema(erro.campos || erro.bloqueios ? erro : null);
        toast.error(erro.mensagem);
      }
      return { ok: false as const, erro };
    } finally {
      setOcupado(false);
    }
  }

  async function salvar() {
    if (!v) return;
    const r = await escrever(
      { acao: "salvar", ...corpoRascunho(v, edicoes) },
      "Rascunho salvo. Nada mudou em produção.",
    );
    if (r.ok) setEdicoes(SEM_EDICOES);
  }
  async function voltarAoPadrao(parte: Parte, campo: string) {
    if (!v) return;
    const restante = { ...edicoes, [parte]: { ...edicoes[parte] } };
    delete restante[parte][campo];
    setEdicoes(restante);
    if (!situacaoCampo(v, parte, campo, SEM_EDICOES).personalizado) return;
    await escrever(
      {
        acao: "salvar",
        baseado_em: v.rascunho?.baseado_em ?? v.versao_publicada,
        [parte]: { [campo]: null },
      },
      `${rotuloCampo(campo)}: volta ao padrão quando o rascunho for publicado.`,
    );
  }
  function trocarEscopo(novo: string) {
    if (novo === agente) return;
    if (sujo && !window.confirm(DESCARTAR)) return;
    setEdicoes(SEM_EDICOES);
    setProblema(null);
    setAgente(novo);
  }

  if (q.isPending) return <p role="status">Carregando o comportamento do agente…</p>;
  if (q.isError || !v)
    return (
      <div role="alert" className="space-y-2">
        <p className="text-destructive">{q.error?.message}</p>
        <Button variant="outline" onClick={() => void q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );

  const r = v.rascunho;
  const erros = porCampo(problema?.campos);
  const bloqueios = porCampo(problema?.bloqueios ?? r?.bloqueios);
  const avisos = porCampo(r?.avisos);
  const listaAgentes = agentes.data?.itens ?? [];
  const nomeAgente = listaAgentes.find((a) => a.id === agente)?.nome;

  const renderCampos = (parte: Parte, campos: [string, CampoEsquema][]) =>
    campos.map(([campo, def]) => {
      const k = `${parte}.${campo}`;
      return (
        <CampoAtendimento
          key={k}
          parte={parte}
          campo={campo}
          def={def}
          situacao={situacaoCampo(v, parte, campo, edicoes)}
          podeEditar={v.pode_editar}
          escopo={v.escopo}
          erros={erros.get(k) ?? []}
          bloqueios={(bloqueios.get(k) ?? []) as Trecho[]}
          avisos={(avisos.get(k) ?? []) as Trecho[]}
          mudar={(valor) => setEdicoes((e) => ({ ...e, [parte]: { ...e[parte], [campo]: valor } }))}
          voltarAoPadrao={() => void voltarAoPadrao(parte, campo)}
        />
      );
    });

  const ocultarPedidos = pedidosEmUso(modulos.data) ? undefined : CAMPOS_PEDIDOS;
  const gruposComp = gruposDoEsquema(v.esquema, "comportamentos", ocultarPedidos);
  const operacao = gruposComp.flatMap((g) => g.campos).filter(([, d]) => campoSoLeitura(d));
  const editaveis = gruposComp
    .map((g) => ({ ...g, campos: g.campos.filter(([, d]) => !campoSoLeitura(d)) }))
    .filter((g) => g.campos.length);

  return (
    <div className="mt-6 space-y-4 pb-24">
      {/* Cabeçalho: escopo, segmento, versão e rascunho */}
      <Cartao className="flex flex-wrap items-end gap-x-6 gap-y-3 p-4">
        <label className="text-sm">
          Escopo
          <select
            className="mt-1 block min-w-60 rounded-md border bg-card p-2"
            value={agente}
            onChange={(e) => trocarEscopo(e.target.value)}
          >
            <option value="">Empresa (todos os agentes)</option>
            {listaAgentes.map((a) => (
              <option key={a.id} value={a.id}>
                Agente: {a.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <p className="text-xs text-ink-500">Segmento</p>
          <p className="font-medium text-ink-700">{rotuloSegmento(v.segmento)}</p>
        </div>
        <div className="text-sm">
          <p className="text-xs text-ink-500">Em uso</p>
          <p className="font-medium text-ink-700">
            {v.versao_publicada
              ? `v${v.versao_publicada} · ${dataHora(v.publicado_em)} · ${v.publicado_por}`
              : "Padrões (nada publicado)"}{" "}
            <code className="text-xs text-ink-500">{v.perfil_versao}</code>
          </p>
        </div>
        <div className="text-sm">
          <p className="text-xs text-ink-500">Rascunho</p>
          <p className="font-medium text-ink-700">
            {r
              ? `De ${r.atualizado_por}, ${dataHora(r.atualizado_em)}, baseado na v${r.baseado_em}`
              : "Sem rascunho"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!v.pode_editar ? <Etiqueta>Somente leitura</Etiqueta> : null}
          {v.pode_editar ? <TestarNoSimular agente={agente} agentes={listaAgentes} /> : null}
        </div>
        {v.escopo === "agente" ? (
          <p className="w-full text-xs text-ink-500">
            Neste agente ({nomeAgente ?? agente}) vale só o que for diferente da empresa; o resto
            vem da empresa e do segmento.
          </p>
        ) : null}
      </Cartao>

      {r?.desatualizado ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg bg-gold-300/20 p-3 text-sm text-gold-700"
        >
          Este rascunho foi feito sobre a v{r.baseado_em}, mas a v{v.versao_publicada} já foi
          publicada. Confira o histórico e atualize a base do rascunho para poder publicar.
          {v.pode_editar ? (
            <Button
              size="sm"
              variant="outline"
              disabled={ocupado || sujo}
              onClick={() =>
                void escrever(
                  { acao: "salvar", baseado_em: v.versao_publicada },
                  `Rascunho atualizado para a v${v.versao_publicada}.`,
                )
              }
            >
              Atualizar para a v{v.versao_publicada}
            </Button>
          ) : null}
        </div>
      ) : null}

      {problema?.campos?.length ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-medium text-destructive">{problema.mensagem}</p>
          <ul className="mt-1 list-inside list-disc text-ink-700">
            {problema.campos.map((c) => (
              <li key={c.campo + c.motivo}>
                <a
                  className="underline"
                  href={`#campo-${chaveCampo(c.campo).replace(".", "-")}`}
                  onClick={() =>
                    setAba(c.campo.startsWith("perfil") ? "personalidade" : "comportamentos")
                  }
                >
                  {rotuloCaminho(c.campo)}
                </a>
                : {MOTIVO_CAMPO[c.motivo] ?? c.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="personalidade">Personalidade</TabsTrigger>
          <TabsTrigger value="comportamentos">Comportamentos</TabsTrigger>
          {v.pode_editar ? (
            <TabsTrigger value="publicar">
              Publicar{r?.alteracoes.length ? ` (${r.alteracoes.length})` : ""}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="previa">Prévia</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="personalidade" className="space-y-3">
          {gruposDoEsquema(v.esquema, "perfil").map((g) => (
            <Cartao key={g.grupo} className="grid gap-3 p-4 lg:grid-cols-2">
              {renderCampos("perfil", g.campos)}
            </Cartao>
          ))}
        </TabsContent>

        <TabsContent value="comportamentos" className="space-y-3">
          {editaveis.map((g) => (
            <Cartao key={g.grupo} className="space-y-3 p-4">
              <h3 className="font-medium text-ink-700">
                {rotuloGrupo(g.grupo)}
                {g.campos.every(([, d]) => d.disponivel === false) ? (
                  <span className="ml-2 rounded-full bg-base-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                    em breve
                  </span>
                ) : null}
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {renderCampos("comportamentos", g.campos)}
              </div>
            </Cartao>
          ))}
          {operacao.length ? (
            <Cartao className="space-y-2 p-4">
              <h3 className="font-medium text-ink-700">{rotuloGrupo("operacao")}</h3>
              <p className="text-xs text-ink-500">
                Só leitura. Ficam fora do rascunho e das versões; a plataforma altera com efeito
                imediato, nas telas do agente.
              </p>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,260px)_1fr]">
                {operacao.map(([campo]) => (
                  <div key={campo} className="contents">
                    <dt className="text-ink-500">{rotuloCampo(campo)}</dt>
                    <dd className="text-ink-700">{textoValor(v.efetivo.comportamentos[campo])}</dd>
                  </div>
                ))}
              </dl>
            </Cartao>
          ) : null}
        </TabsContent>

        {v.pode_editar ? (
          <TabsContent value="publicar">
            <Publicar visao={v} sujo={sujo} ocupado={ocupado} escrever={escrever} />
          </TabsContent>
        ) : null}

        <TabsContent value="previa">
          <PreviaAtendimento chave={chave} chamar={chamar} visao={v} />
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoVersoes
            chave={chave}
            chamar={chamar}
            visao={v}
            restaurar={async (versao, nota) =>
              (
                await escrever(
                  { acao: "restaurar", versao, ...(nota.trim() ? { nota: nota.trim() } : {}) },
                  `Restaurada como v${v.versao_publicada + 1}. Vale em até 30 segundos.`,
                )
              ).ok
            }
          />
        </TabsContent>
      </Tabs>

      {/* Barra do rascunho: só para quem edita */}
      {v.pode_editar && (aba === "personalidade" || aba === "comportamentos") ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-base-200 bg-card/95 px-4 py-3 shadow-[0_-2px_8px_rgba(26,21,32,0.06)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <span className="text-sm text-ink-700">
              {sujo
                ? `${contarEdicoes(edicoes)} alteração(ões) não salva(s)`
                : r
                  ? `Rascunho salvo · ${r.alteracoes.length} mudança(s) para publicar`
                  : "Sem alterações"}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              {sujo ? (
                <Button variant="ghost" disabled={ocupado} onClick={() => setEdicoes(SEM_EDICOES)}>
                  Desfazer
                </Button>
              ) : null}
              {r ? (
                <Button variant="ghost" disabled={ocupado} onClick={() => setDescartar(true)}>
                  Descartar rascunho
                </Button>
              ) : null}
              <Button variant="outline" disabled={ocupado || !sujo} onClick={() => void salvar()}>
                {ocupado ? "Salvando…" : "Salvar rascunho"}
              </Button>
              <Button disabled={ocupado || sujo || !r} onClick={() => setAba("publicar")}>
                Revisar e publicar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={descartar} onOpenChange={(a) => !ocupado && setDescartar(a)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar o rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              Apaga o rascunho deste escopo. O que está publicado continua valendo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={ocupado}
              onClick={async (e) => {
                e.preventDefault();
                const res = await escrever({ acao: "descartar" }, "Rascunho descartado.");
                if (res.ok) {
                  setEdicoes(SEM_EDICOES);
                  setDescartar(false);
                }
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Aba Publicar: o que muda, verificações, nota e confirmação de trechos duvidosos. */
function Publicar({
  visao,
  sujo,
  ocupado,
  escrever,
}: {
  visao: Visao;
  sujo: boolean;
  ocupado: boolean;
  escrever: (
    entrada: { acao: string } & Record<string, unknown>,
    sucesso: string,
  ) => Promise<{ ok: true; visao: Visao } | { ok: false; erro: ErroAtendimento }>;
}) {
  const [nota, setNota] = useState("");
  const [confirmar, setConfirmar] = useState<Trecho[] | null>(null);
  const [revisei, setRevisei] = useState(false);
  const r = visao.rascunho;
  if (!r)
    return (
      <Cartao className="p-6 text-sm text-ink-500">
        Sem rascunho. Altere campos em Personalidade ou Comportamentos e salve o rascunho para
        publicar.
      </Cartao>
    );
  const bloqueado = r.bloqueios.length > 0;
  async function publicar(confirmarAvisos: boolean) {
    const res = await escrever(
      {
        acao: "publicar",
        baseado_em: r!.baseado_em,
        ...(nota.trim() ? { nota: nota.trim() } : {}),
        confirmar_avisos: confirmarAvisos,
      },
      `Publicado como v${visao.versao_publicada + 1}. Vale para o agente em até 30 segundos.`,
    );
    if (res.ok) {
      setNota("");
      setConfirmar(null);
      setRevisei(false);
    } else if (res.erro.motivo === "confirmacao_necessaria") {
      setRevisei(false);
      setConfirmar(res.erro.avisos ?? []);
    } else setConfirmar(null);
  }
  return (
    <div className="space-y-3">
      <Cartao className="space-y-2 p-4">
        <h3 className="font-medium text-ink-700">O que muda</h3>
        <TabelaAlteracoes alteracoes={r.alteracoes} />
      </Cartao>
      {bloqueado ? (
        <Cartao className="space-y-1 border-destructive/40 p-4 text-sm">
          <p className="font-medium text-destructive">Não dá para publicar: há texto bloqueado.</p>
          {r.bloqueios.map((b, i) => (
            <p key={i}>
              {rotuloCaminho(b.campo)} — {MOTIVO_BLOQUEIO[b.motivo] ?? b.motivo}: “{b.trecho}”
            </p>
          ))}
          <p className="text-xs text-ink-500">Corrija o trecho, salve o rascunho e volte aqui.</p>
        </Cartao>
      ) : null}
      {r.avisos.length ? (
        <Cartao className="space-y-1 p-4 text-sm">
          <p className="font-medium text-gold-700">
            Trechos para conferir (publicar pede confirmação)
          </p>
          {r.avisos.map((a, i) => (
            <p key={i}>
              {rotuloCaminho(a.campo)} — {MOTIVO_AVISO[a.motivo] ?? a.motivo}: “{a.trecho}”
            </p>
          ))}
        </Cartao>
      ) : null}
      <Cartao className="space-y-3 p-4">
        <label className="block text-sm">
          Nota da versão (opcional)
          <Input
            value={nota}
            maxLength={300}
            placeholder="ex.: tom mais informal"
            onChange={(e) => setNota(e.target.value)}
          />
        </label>
        {sujo ? (
          <p className="text-xs text-gold-700">
            Há alterações não salvas. Salve o rascunho antes de publicar.
          </p>
        ) : null}
        {r.desatualizado ? (
          <p className="text-xs text-gold-700">
            Atualize a base do rascunho (aviso no topo) antes de publicar.
          </p>
        ) : null}
        <Button
          disabled={ocupado || sujo || bloqueado || r.desatualizado || !r.alteracoes.length}
          onClick={() => void publicar(false)}
        >
          {ocupado ? "Publicando…" : `Publicar como v${visao.versao_publicada + 1}`}
        </Button>
        {!r.alteracoes.length ? (
          <p className="text-xs text-ink-500">O rascunho é igual ao que está em vigor.</p>
        ) : null}
        <p className="text-xs text-ink-500">
          O Simular testa a versão publicada (não o rascunho) e só funciona com envio de teste. Para
          testar uma mudança: publique, teste no Simular e, se não gostar, restaure a versão
          anterior no Histórico.
        </p>
      </Cartao>

      <AlertDialog
        open={confirmar !== null}
        onOpenChange={(a) => !a && !ocupado && setConfirmar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirme os trechos antes de publicar</AlertDialogTitle>
            <AlertDialogDescription>
              O gateway encontrou trechos que podem ser lidos como instrução ao sistema ou como dado
              sensível. Confira se é isso mesmo que a casa quer dizer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-60 space-y-1.5 overflow-y-auto text-sm">
            {(confirmar ?? []).map((a, i) => (
              <li key={i} className="rounded-md bg-gold-300/20 p-2">
                <span className="font-medium">{rotuloCaminho(a.campo)}</span> —{" "}
                {MOTIVO_AVISO[a.motivo] ?? a.motivo}: “{a.trecho}”
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={revisei}
              onChange={(e) => setRevisei(e.target.checked)}
            />
            Revisei e quero publicar assim
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Voltar e editar</AlertDialogCancel>
            <AlertDialogAction
              disabled={ocupado || !revisei}
              onClick={(e) => {
                e.preventDefault();
                void publicar(true);
              }}
            >
              Publicar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Abre o Simular com o agente; na empresa, pergunta qual agente. O Simular usa o publicado. */
function TestarNoSimular({
  agente,
  agentes,
}: {
  agente: string;
  agentes: { id: string; nome: string }[];
}) {
  const [escolhido, setEscolhido] = useState(agente || agentes[0]?.id || "");
  const alvo = agente || escolhido;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!agente && agentes.length > 1 ? (
        <select
          className="h-9 rounded-md border bg-card px-2 text-sm"
          aria-label="Agente para testar"
          value={escolhido}
          onChange={(e) => setEscolhido(e.target.value)}
        >
          {agentes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      ) : null}
      <Button asChild variant="outline" size="sm" disabled={!alvo}>
        <Link
          to="/ia/simular"
          search={alvo ? { agente: alvo } : {}}
          target="_blank"
          title="O Simular usa a versão publicada e só funciona com envio de teste"
        >
          <FlaskConical className="size-4" aria-hidden />
          Testar no Simular
        </Link>
      </Button>
    </div>
  );
}
