import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FlaskConical, Search } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { atendimento } from "@/lib/gateway-atendimento.functions";
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import { listarCanais } from "@/lib/gateway-canais.functions";
import { obterModulosEmpresa } from "@/lib/gateway-modulos.functions";
import {
  AVISO_SO_WHATSAPP,
  CAMPOS_SEM_EFEITO,
  CAMPOS_SO_WHATSAPP,
  MOTIVO_AVISO,
  MOTIVO_BLOQUEIO,
  textoErroCampo,
  SEM_EDICOES,
  agenteTemWhatsapp,
  campoCasaBusca,
  campoSoLeitura,
  chaveCampo,
  contarEdicoes,
  corpoRascunho,
  diaMes,
  gruposDoEsquema,
  gruposDoPerfil,
  porCampo,
  rotuloCaminho,
  rotuloCampo,
  rotuloGrupo,
  rotuloSegmento,
  secaoDoCaminho,
  situacaoCampo,
  textoValor,
  type CampoEsquema,
  type Edicoes,
  type ErroAtendimento,
  type Parte,
  type Previa,
  type ResultadoAtendimento,
  type Trecho,
  type Visao,
} from "@/lib/gateway/atendimento";
import { CAMPOS_PEDIDOS, pedidosEmUso } from "@/lib/gateway/modulos";
import type { Json } from "@/lib/gateway/tipos";
import { dataHora, Etiqueta, type ContextoGateway } from "../Gateway";
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

const SO_WHATSAPP = new Set<string>(CAMPOS_SO_WHATSAPP);

export function ComportamentoAgente({ ctx }: { ctx: ContextoGateway }) {
  const fn = useServerFn(atendimento),
    buscarAgentes = useServerFn(listarAgentes),
    buscarCanais = useServerFn(listarCanais),
    buscarModulos = useServerFn(obterModulosEmpresa),
    cache = useQueryClient();
  const [agente, setAgente] = useState("");
  const [secao, setSecao] = useState("");
  const [busca, setBusca] = useState("");
  const [focar, setFocar] = useState<string | null>(null);
  const [edicoes, setEdicoes] = useState<Edicoes>(SEM_EDICOES);
  const [problema, setProblema] = useState<ErroAtendimento | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const [verDif, setVerDif] = useState(false);
  const sujo = contarEdicoes(edicoes) > 0;
  const chave = ["atendimento", ctx.empresa ?? "vinculada", agente || "empresa"];
  const modulos = useQuery({
    queryKey: ["gateway", "modulos", ctx.empresa],
    queryFn: () => buscarModulos({ data: { empresa: ctx.empresa } }),
    staleTime: 30_000,
  });

  useBlocker({
    shouldBlockFn: () => sujo && !window.confirm(DESCARTAR),
    enableBeforeUnload: () => sujo,
  });
  useEffect(() => {
    if (!sujo) return;
    const sair = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", sair);
    return () => window.removeEventListener("beforeunload", sair);
  }, [sujo]);

  // O campo só existe depois que a seção dele abre: leva até ele nesse momento.
  useEffect(() => {
    if (!focar) return;
    document.getElementById(focar)?.scrollIntoView({ block: "center" });
    document.getElementById(`${focar}-entrada`)?.focus();
    setFocar(null);
  }, [focar]);

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
  const canais = useQuery({
    queryKey: ["gateway", "canais", ctx.empresa],
    queryFn: () => buscarCanais({ data: { empresa: ctx.empresa } }),
    enabled: Boolean(agente),
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

  function abrir(id: string) {
    setBusca("");
    setSecao(id);
  }

  if (q.isPending)
    return (
      <p role="status" className="p-4 text-sm text-ink-500">
        Carregando o comportamento do agente…
      </p>
    );
  if (q.isError || !v)
    return (
      <div role="alert" className="space-y-2 p-4">
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
  const semWhatsapp =
    Boolean(agente) && canais.isSuccess && !agenteTemWhatsapp(canais.data?.itens ?? [], agente);

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
          {...(semWhatsapp && SO_WHATSAPP.has(campo) ? { restricao: AVISO_SO_WHATSAPP } : {})}
        />
      );
    });

  const ocultar = new Set<string>(CAMPOS_SEM_EFEITO);
  if (!pedidosEmUso(modulos.data)) for (const campo of CAMPOS_PEDIDOS) ocultar.add(campo);
  const gruposComp = gruposDoEsquema(v.esquema, "comportamentos", ocultar);
  const operacao = gruposComp.flatMap((g) => g.campos).filter(([, d]) => campoSoLeitura(d));
  const editaveis = gruposComp
    .map((g) => ({ ...g, campos: g.campos.filter(([, d]) => !campoSoLeitura(d)) }))
    .filter((g) => g.campos.length);

  const secoesPerfil: Secao[] = gruposDoPerfil(v.esquema).map((g) => ({
    ...g,
    parte: "perfil",
  }));
  const secoesComp: Secao[] = editaveis.map((g) => ({ ...g, parte: "comportamentos" }));
  const secoes = [...secoesPerfil, ...secoesComp];
  const verOperacao = ctx.papel === "plataforma" && operacao.length > 0;
  const validas = [
    ...secoes.map((x) => x.grupo),
    ...(verOperacao ? ["operacao"] : []),
    ...(v.pode_editar ? ["publicar"] : []),
    "previa",
    "historico",
  ];
  const ativa = validas.includes(secao) ? secao : validas[0]!;
  const atual = secoes.find((x) => x.grupo === ativa);
  const procurando = busca.trim().length > 0;
  const achados = procurando
    ? secoes
        .map((x) => ({ ...x, campos: x.campos.filter(([c]) => campoCasaBusca(c, busca)) }))
        .filter((x) => x.campos.length)
    : [];
  const naoSalvas = contarEdicoes(edicoes);
  const mudancas = r?.alteracoes.length ?? 0;

  function irParaCampo(caminho: string) {
    abrir(secaoDoCaminho(v!.esquema, caminho));
    setFocar(`campo-${chaveCampo(caminho).replace(".", "-")}`);
  }
  const sinalDe = (x: Secao): Sinal => {
    const chaves = x.campos.map(([c]) => [c, `${x.parte}.${c}`] as const);
    if (chaves.some(([, k]) => erros.has(k) || bloqueios.has(k))) return "erro";
    const estados = chaves.map(([c]) => situacaoCampo(v, x.parte, c, edicoes));
    if (estados.some((e) => e.editado)) return "nao_salvo";
    return estados.some((e) => e.noRascunho) ? "rascunho" : null;
  };
  const personalizadosDe = (x: Secao) =>
    x.campos.filter(([c]) => situacaoCampo(v, x.parte, c, edicoes).personalizado).length;
  const itemSecao = (x: Secao) => (
    <ItemSecao
      key={x.grupo}
      rotulo={rotuloGrupo(x.grupo)}
      ativo={!procurando && ativa === x.grupo}
      sinal={sinalDe(x)}
      contagem={personalizadosDe(x)}
      abrir={() => abrir(x.grupo)}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      {/* Uma barra só: escopo, situação e ações do rascunho. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-base-200 px-3 py-1.5">
        <div className="flex min-w-0 flex-1 basis-72 items-center gap-3">
          <select
            aria-label="Escopo"
            className="h-8 min-w-0 max-w-56 flex-1 rounded-md sm:flex-none border bg-card px-2 text-sm font-medium"
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
          <p
            className="hidden min-w-0 truncate text-xs text-ink-500 xl:block"
            title={`${rotuloSegmento(v.segmento)} · perfil ${v.perfil_versao}`}
          >
            Em uso:{" "}
            <span className="font-medium text-ink-700">
              {v.versao_publicada
                ? `v${v.versao_publicada} · ${dataHora(v.publicado_em)} · ${v.publicado_por}`
                : "padrões (nada publicado)"}
            </span>
          </p>
          <p
            role="status"
            className={`shrink-0 whitespace-nowrap text-xs ${naoSalvas ? "font-medium text-purple-700" : mudancas ? "font-medium text-gold-700" : "text-ink-500"}`}
            title={
              r
                ? `Rascunho de ${r.atualizado_por}, desde ${diaMes(r.atualizado_em)}, baseado na v${r.baseado_em}`
                : undefined
            }
          >
            {naoSalvas
              ? `${naoSalvas} ${naoSalvas === 1 ? "alteração não salva" : "alterações não salvas"}`
              : mudancas
                ? `${mudancas} ${mudancas === 1 ? "mudança no rascunho" : "mudanças no rascunho"}`
                : r
                  ? "Rascunho igual ao que está em uso"
                  : "Sem rascunho"}
          </p>
          {mudancas ? (
            <Button
              type="button"
              size="sm"
              variant="link"
              className="h-7 shrink-0 px-0 text-xs"
              onClick={() => setVerDif(true)}
            >
              Ver diferenças
            </Button>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!v.pode_editar ? <Etiqueta>Somente leitura</Etiqueta> : null}
          {v.pode_editar && sujo ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={ocupado}
              onClick={() => setEdicoes(SEM_EDICOES)}
            >
              Desfazer
            </Button>
          ) : null}
          {v.pode_editar && r ? (
            <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setDescartar(true)}>
              Descartar
            </Button>
          ) : null}
          {v.pode_editar ? (
            <Button
              variant="outline"
              size="sm"
              disabled={ocupado || !sujo}
              onClick={() => void salvar()}
            >
              {ocupado ? "Salvando…" : "Salvar rascunho"}
            </Button>
          ) : null}
          {v.pode_editar && ativa !== "publicar" ? (
            <Button size="sm" disabled={ocupado || sujo || !r} onClick={() => abrir("publicar")}>
              Revisar e publicar
            </Button>
          ) : null}
        </div>
      </div>

      {v.escopo === "agente" ? (
        <p className="shrink-0 border-b border-base-200 bg-purple-50/60 px-3 py-1 text-xs text-ink-700">
          Em {nomeAgente ?? agente} vale só o que for diferente da empresa; o resto vem da empresa e
          do segmento.
        </p>
      ) : null}

      {r?.desatualizado ? (
        <div
          role="status"
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gold-500/40 bg-gold-300/20 px-3 py-1.5 text-sm text-gold-700"
        >
          <p className="min-w-0 flex-1">
            Este rascunho foi feito sobre a v{r.baseado_em}, mas a v{v.versao_publicada} já foi
            publicada. Confira o histórico e atualize a base do rascunho para poder publicar.
          </p>
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
          className="max-h-32 shrink-0 overflow-y-auto border-b border-destructive/40 bg-destructive/5 px-3 py-1.5 text-sm"
        >
          <p className="font-medium text-destructive">{problema.mensagem}</p>
          <ul className="mt-0.5 text-ink-700">
            {problema.campos.map((c) => (
              <li key={c.campo + c.motivo}>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => irParaCampo(c.campo)}
                >
                  {rotuloCaminho(c.campo)}
                </button>
                : {textoErroCampo(c)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex shrink-0 flex-col border-base-200 max-lg:border-b lg:w-60 lg:border-r">
          <div className="relative p-2">
            <Search
              className="absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-ink-500"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Procurar campo"
              placeholder="Procurar campo"
              className="h-8 pl-7 text-sm"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setBusca("");
              }}
            />
          </div>
          <nav
            aria-label="Seções"
            className="flex min-h-0 flex-1 overflow-x-auto max-lg:[scrollbar-width:none] lg:flex-col lg:overflow-y-auto lg:pb-2"
          >
            <TituloRail>Personalidade</TituloRail>
            {secoesPerfil.map(itemSecao)}
            <TituloRail>Comportamentos</TituloRail>
            {secoesComp.map(itemSecao)}
            {verOperacao ? (
              <ItemSecao
                rotulo={rotuloGrupo("operacao")}
                ativo={!procurando && ativa === "operacao"}
                abrir={() => abrir("operacao")}
              />
            ) : null}
            <TituloRail>Versões</TituloRail>
            {v.pode_editar ? (
              <ItemSecao
                rotulo="Publicar"
                ativo={!procurando && ativa === "publicar"}
                contagem={mudancas}
                abrir={() => abrir("publicar")}
              />
            ) : null}
            <ItemSecao
              rotulo="Prévia"
              ativo={!procurando && ativa === "previa"}
              abrir={() => abrir("previa")}
            />
            <ItemSecao
              rotulo="Histórico"
              ativo={!procurando && ativa === "historico"}
              abrir={() => abrir("historico")}
            />
          </nav>
          {v.pode_editar ? (
            <div className="hidden border-t border-base-200 p-2 lg:block">
              <TestarNoSimular agente={agente} agentes={listaAgentes} />
            </div>
          ) : null}
        </aside>

        {/* A chave recomeça a rolagem a cada seção. */}
        <div key={procurando ? "busca" : ativa} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {procurando ? (
            achados.length ? (
              achados.map((x) => (
                <section key={x.grupo} aria-label={rotuloGrupo(x.grupo)}>
                  <TituloSecao>{rotuloGrupo(x.grupo)}</TituloSecao>
                  {renderCampos(x.parte, x.campos)}
                </section>
              ))
            ) : (
              <p className="p-4 text-sm text-ink-500">Nenhum campo com “{busca.trim()}”.</p>
            )
          ) : atual ? (
            <section aria-label={rotuloGrupo(atual.grupo)}>
              <TituloSecao>
                {rotuloGrupo(atual.grupo)}
                {atual.campos.every(([, d]) => d.disponivel === false) ? (
                  <span className="ml-2 rounded-full bg-base-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                    em breve
                  </span>
                ) : null}
              </TituloSecao>
              {renderCampos(atual.parte, atual.campos)}
            </section>
          ) : ativa === "operacao" ? (
            <section aria-label={rotuloGrupo("operacao")}>
              <TituloSecao>{rotuloGrupo("operacao")}</TituloSecao>
              <p className="px-4 pt-2 text-xs text-ink-500">
                Só leitura. Ficam fora do rascunho e das versões; a plataforma altera com efeito
                imediato, nas telas do agente.
              </p>
              <dl className="grid gap-x-4 gap-y-1 p-4 text-sm sm:grid-cols-[minmax(0,260px)_1fr]">
                {operacao.map(([campo]) => (
                  <div key={campo} className="contents">
                    <dt className="text-ink-500">{rotuloCampo(campo)}</dt>
                    <dd className="text-ink-700">{textoValor(v.efetivo.comportamentos[campo])}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : ativa === "publicar" ? (
            <Publicar
              visao={v}
              sujo={sujo}
              ocupado={ocupado}
              escrever={escrever}
              irParaCampo={irParaCampo}
            />
          ) : ativa === "previa" ? (
            <PreviaAtendimento
              chave={chave}
              chamar={chamar}
              visao={v}
              acoes={
                v.pode_editar ? (
                  <div className="ml-auto lg:hidden">
                    <TestarNoSimular agente={agente} agentes={listaAgentes} />
                  </div>
                ) : null
              }
            />
          ) : (
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
          )}
        </div>
      </div>

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

      <Dialog open={verDif} onOpenChange={setVerDif}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Diferenças não publicadas</DialogTitle>
            <DialogDescription>
              O que está no rascunho ainda não vale. Abaixo, o que o agente recebe hoje.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-ink-700">O que muda ao publicar</h3>
              <TabelaAlteracoes alteracoes={r?.alteracoes ?? []} />
            </div>
            <PreviaPublicada chave={chave} chamar={chamar} aberto={verDif} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Secao = { grupo: string; parte: Parte; campos: [string, CampoEsquema][] };
type Sinal = "erro" | "nao_salvo" | "rascunho" | null;

const SINAL: Record<Exclude<Sinal, null>, { cor: string; texto: string }> = {
  erro: { cor: "bg-destructive", texto: "tem erro" },
  nao_salvo: { cor: "bg-purple-700", texto: "tem alteração não salva" },
  rascunho: { cor: "bg-gold-500", texto: "tem mudança no rascunho" },
};

function TituloRail({ children }: { children: string }) {
  return (
    <p className="hidden px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-ink-500 lg:block">
      {children}
    </p>
  );
}

function TituloSecao({ children }: { children: ReactNode }) {
  return (
    <h2 className="sticky top-0 z-10 border-b border-base-200 bg-card/95 px-4 py-1.5 text-sm font-medium text-ink-900 backdrop-blur">
      {children}
    </h2>
  );
}

function ItemSecao({
  rotulo,
  ativo,
  sinal = null,
  contagem = 0,
  abrir,
}: {
  rotulo: string;
  ativo: boolean;
  sinal?: Sinal;
  contagem?: number;
  abrir: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={ativo ? "true" : undefined}
      onClick={abrir}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500 ${
        ativo
          ? "bg-purple-100/60 font-medium text-ink-900 lg:shadow-[inset_3px_0_0_0_var(--purple-700)] max-lg:shadow-[inset_0_-2px_0_0_var(--purple-700)]"
          : "text-ink-700 hover:bg-purple-50/60"
      }`}
    >
      <span className="min-w-0 truncate lg:flex-1">{rotulo}</span>
      {sinal ? (
        <span className={`size-2 shrink-0 rounded-full ${SINAL[sinal].cor}`}>
          <span className="sr-only">{SINAL[sinal].texto}</span>
        </span>
      ) : null}
      {contagem ? <span className="text-xs tabular-nums text-ink-500">{contagem}</span> : null}
    </button>
  );
}

/** Prévia publicada: o bloco que o agente recebe hoje, pela rota que o gateway já tem. */
function PreviaPublicada({
  chave,
  chamar,
  aberto,
}: {
  chave: unknown[];
  chamar: Chamar;
  aberto: boolean;
}) {
  const q = useQuery({
    queryKey: [...chave, "previa", "publicado", "faixa"],
    enabled: aberto,
    queryFn: () => chamar<Previa>({ acao: "previa", fonte: "publicado" }),
  });
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-ink-700">O que o agente recebe hoje</h3>
      {q.isPending ? <p role="status">Consultando a versão em uso…</p> : null}
      {q.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {q.error.message}
        </p>
      ) : null}
      {q.data ? (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,200px)_1fr]">
          {Object.entries(q.data.perfil_atendimento).map(([campo, valor]) => (
            <div key={campo} className="contents">
              <dt className="text-ink-500">{rotuloCampo(campo)}</dt>
              <dd className="whitespace-pre-wrap break-words text-ink-700">{textoValor(valor)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="text-xs text-ink-500">
        É o <code>perfil_atendimento</code> da versão publicada. Os comportamentos técnicos entram
        na publicação e não vão neste bloco.
      </p>
    </div>
  );
}

/** Aba Publicar: o que muda, verificações, nota e confirmação de trechos duvidosos. */
function Publicar({
  visao,
  sujo,
  ocupado,
  escrever,
  irParaCampo,
}: {
  visao: Visao;
  sujo: boolean;
  ocupado: boolean;
  escrever: (
    entrada: { acao: string } & Record<string, unknown>,
    sucesso: string,
  ) => Promise<{ ok: true; visao: Visao } | { ok: false; erro: ErroAtendimento }>;
  irParaCampo: (caminho: string) => void;
}) {
  const [nota, setNota] = useState("");
  const [confirmar, setConfirmar] = useState<Trecho[] | null>(null);
  const [revisei, setRevisei] = useState(false);
  const r = visao.rascunho;
  if (!r)
    return (
      <p className="p-4 text-sm text-ink-500">
        Sem rascunho. Altere campos em Personalidade ou Comportamentos e salve o rascunho para
        publicar.
      </p>
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
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 space-y-2" aria-label="O que muda">
        <h2 className="text-sm font-medium text-ink-900">O que muda</h2>
        <TabelaAlteracoes alteracoes={r.alteracoes} />
      </section>
      <div className="min-w-0 space-y-3 lg:sticky lg:top-0 lg:self-start">
        {bloqueado ? (
          <div className="space-y-1 rounded-md bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">
              Não dá para publicar: há texto bloqueado.
            </p>
            {r.bloqueios.map((b, i) => (
              <p key={i}>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => irParaCampo(b.campo)}
                >
                  {rotuloCaminho(b.campo)}
                </button>{" "}
                — {MOTIVO_BLOQUEIO[b.motivo] ?? b.motivo}: “{b.trecho}”
              </p>
            ))}
            <p className="text-xs text-ink-500">Corrija o trecho, salve o rascunho e volte aqui.</p>
          </div>
        ) : null}
        {r.avisos.length ? (
          <div className="space-y-1 rounded-md bg-gold-300/20 p-3 text-sm">
            <p className="font-medium text-gold-700">
              Trechos para conferir (publicar pede confirmação)
            </p>
            {r.avisos.map((a, i) => (
              <p key={i}>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => irParaCampo(a.campo)}
                >
                  {rotuloCaminho(a.campo)}
                </button>{" "}
                — {MOTIVO_AVISO[a.motivo] ?? a.motivo}: “{a.trecho}”
              </p>
            ))}
          </div>
        ) : null}
        <label className="block text-sm font-medium text-ink-700">
          Nota da versão (opcional)
          <Input
            className="mt-1 font-normal"
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
          className="w-full"
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
      </div>

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
    <div className="flex flex-wrap items-center gap-1.5">
      {!agente && agentes.length > 1 ? (
        <select
          className="h-8 w-full rounded-md border bg-card px-2 text-sm"
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
