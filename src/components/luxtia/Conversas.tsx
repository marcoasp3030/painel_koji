import { peloMenos, telefoneParaPapel } from "@/lib/acesso/papeis";
import { gerirAtendimentos } from "@/lib/gateway-enc1.functions";
import {
  cancelarFollowUps,
  listarFollowUps,
  reativarOptOut,
} from "@/lib/gateway-followup.functions";
import { AtendimentosConversa, ResumoAtendimento } from "./AtendimentosConversa";
import { BlocoFollowUp, SeloOptOut } from "./FollowUpConversa";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { dataHora, Etiqueta, type ContextoGateway } from "./Gateway";
import { Cartao, Iniciais } from "./Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import { listarCanais } from "@/lib/gateway-canais.functions";
import { historicoConversa } from "@/lib/gateway-simular.functions";
import {
  acompanharConversas,
  atenderConversa,
  editarNomeContato,
  listarConversas,
  obterCursorEventos,
} from "@/lib/gateway-conversas.functions";
import {
  canalDaConversa,
  desdeDoCursor,
  ESTADOS_CONVERSA,
  estadoConversa,
  juntarMensagens,
  nomeContato,
  nomeSemCadastro,
  ordenarConversas,
  resumoUltima,
  ROTULO_ESTADO,
  seloOrigemNome,
  temNovidade,
  textoCanal,
  telefoneVisivel,
  validarNomeCadastro,
  MOTIVO_NOME,
  type Conversa,
  type EstadoConversa,
  type Leitura,
  type OrigemNome,
  MOTIVO_ATENDENTE,
  seloEspera,
} from "@/lib/gateway/conversas";
import { ROTULO_STATUS, type StatusPedido } from "@/lib/gateway/pedidos";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, Pencil, Send, ShoppingBag } from "lucide-react";
import type { CanalGateway } from "@/lib/gateway/tipos";
import { ORIGEM_MENSAGEM } from "@/lib/gateway/vocabulario";

const TOM_ESTADO: Record<EstadoConversa, string> = {
  aguardando_atendente: "bg-gold-300/35 text-gold-700",
  atendente: "bg-purple-100 text-purple-800",
  bot: "bg-success-soft text-success",
  encerrada: "bg-base-100 text-ink-500",
};

/** Horário curto da lista, no fuso de Brasília. */
function tempoCurto(iso: string | null | undefined, agora: number) {
  if (!iso) return "";
  const instante = Date.parse(iso);
  if (Number.isNaN(instante)) return "";
  const minutos = Math.max(0, Math.round((agora - instante) / 60000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas} h`;
  return new Date(instante).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

function diaDaMensagem(iso: string | null) {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function horaDaMensagem(iso: string | null) {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SeloEstado({ estado }: { estado: EstadoConversa }) {
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TOM_ESTADO[estado]}`}
    >
      {ROTULO_ESTADO[estado]}
    </span>
  );
}

function esbocoConversa(abertura: {
  conversa: string;
  nome?: string;
  telefone?: string;
  canal?: string;
}): Conversa {
  return {
    conversation_id: abertura.conversa,
    agente_id: "",
    canal: abertura.canal ?? "",
    nome: abertura.nome ?? null,
    telefone: abertura.telefone ?? null,
    status: "ativa",
    bot_pausado_ate: null,
    ultima_mensagem: null,
    ultima_em: null,
    aguardando_atendente_desde: null,
    aguardando_motivo: null,
  };
}

export function Conversas({
  ctx,
  abertura,
}: {
  ctx: ContextoGateway;
  abertura?: {
    conversa: string;
    nome?: string;
    telefone?: string;
    canal?: string;
  } | null;
}) {
  const buscar = useServerFn(listarConversas),
    eventos = useServerFn(acompanharConversas),
    cursorEventos = useServerFn(obterCursorEventos);
  const buscarAgentes = useServerFn(listarAgentes),
    buscarCanais = useServerFn(listarCanais);
  const cache = useQueryClient();
  const [agente, setAgente] = useState(""),
    [canal, setCanal] = useState("");
  const [estado, setEstado] = useState<"" | EstadoConversa>(""),
    [ordem, setOrdem] = useState<"recentes" | "id">("recentes"),
    [busca, setBusca] = useState(""),
    [desde, setDesde] = useState("");
  // A fila de espera tem leitura própria (todas as páginas, ordenada pela idade da espera).
  const soAguardando = estado === "aguardando_atendente";
  const [avisoEspera, setAvisoEspera] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const [filtroBusca, setFiltroBusca] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFiltroBusca(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);
  const [selecionada, setSelecionada] = useState<Conversa | null>(
    abertura?.conversa ? esbocoConversa(abertura) : null,
  );
  const conversaVinda = abertura?.conversa;
  const nomeVindo = abertura?.nome;
  const telefoneVindo = abertura?.telefone;
  const canalVindo = abertura?.canal;
  useEffect(() => {
    if (!conversaVinda) return;
    setSelecionada((atual) =>
      atual?.conversation_id === conversaVinda
        ? atual
        : esbocoConversa({
            conversa: conversaVinda,
            ...(nomeVindo ? { nome: nomeVindo } : {}),
            ...(telefoneVindo ? { telefone: telefoneVindo } : {}),
            ...(canalVindo ? { canal: canalVindo } : {}),
          }),
    );
  }, [conversaVinda, nomeVindo, telefoneVindo, canalVindo]);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const chave = useRef<string | null>(null),
    cursor = useRef(0),
    inicializado = useRef(false);
  const montar = useRef(new Date().toISOString());
  const cursorInicial = useQuery({
    queryKey: ["conversas-cursor", ctx.empresa],
    queryFn: () => cursorEventos({ data: { empresa: ctx.empresa } }),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => buscarAgentes({ data: { empresa: ctx.empresa } }),
  });
  const canais = useQuery({
    queryKey: ["gateway", "canais", ctx.empresa],
    queryFn: () => buscarCanais({ data: { empresa: ctx.empresa } }),
  });
  const lista = useInfiniteQuery({
    queryKey: ["conversas", ctx.empresa, agente, canal, estado, ordem, filtroBusca, desde],
    enabled: cursorInicial.isSuccess && !soAguardando,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      buscar({
        data: {
          empresa: ctx.empresa,
          cursor: pageParam,
          aguardando: false,
          ordem,
          ...(agente ? { agente } : {}),
          ...(canal ? { canal } : {}),
          ...(estado ? { estado: [estado] } : {}),
          ...(filtroBusca ? { busca: filtroBusca } : {}),
          ...(desde ? { desde: new Date(desde).toISOString() } : {}),
        },
      }),
    getNextPageParam: (p) => p.proximo_cursor ?? undefined,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const espera = useQuery({
    queryKey: ["conversas", ctx.empresa, "aguardando", agente, canal, filtroBusca, desde],
    // Com outro estado escolhido, a fila não entra na lista.
    enabled: cursorInicial.isSuccess && (!estado || soAguardando),
    queryFn: () =>
      buscar({
        data: {
          empresa: ctx.empresa,
          aguardando: true,
          ...(agente ? { agente } : {}),
          ...(canal ? { canal } : {}),
          ...(filtroBusca ? { busca: filtroBusca } : {}),
          ...(desde ? { desde: new Date(desde).toISOString() } : {}),
        },
      }),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const acompanhamento = useQuery({
    queryKey: ["conversas-eventos", ctx.empresa],
    enabled: cursorInicial.isSuccess,
    queryFn: async () => {
      const desde = inicializado.current
        ? cursor.current
        : desdeDoCursor(cursorInicial.data!.ultimo_id);
      const r = await eventos({ data: { empresa: ctx.empresa, desde } });
      const mudou = r.cursor !== desde;
      if (r.novosAguardando > 0) setAvisoEspera(true);
      cursor.current = r.cursor;
      if (!inicializado.current) {
        inicializado.current = true;
        const chaveLocal = cursorInicial.data!.chaveLocal;
        chave.current = chaveLocal;
        let l: Leitura = { inicio: montar.current, vistas: {} };
        try {
          const salva = JSON.parse(localStorage.getItem(chaveLocal) ?? "null");
          if (
            salva &&
            typeof salva.inicio === "string" &&
            Number.isFinite(Date.parse(salva.inicio)) &&
            salva.vistas &&
            typeof salva.vistas === "object"
          ) {
            l = {
              inicio: salva.inicio,
              vistas: Object.fromEntries(
                Object.entries(salva.vistas).filter(
                  ([, v]) => typeof v === "string" && Number.isFinite(Date.parse(v)),
                ),
              ) as Record<string, string>,
            };
          }
          localStorage.setItem(chaveLocal, JSON.stringify(l));
        } catch {
          /* Mantém o marcador em memória se o armazenamento estiver indisponível. */
        }
        setLeitura(l);
      }
      if (mudou) {
        void cache.invalidateQueries({ queryKey: ["conversas", ctx.empresa] });
        void cache.invalidateQueries({ queryKey: ["conversa-mensagens", ctx.empresa] });
      }
      return r;
    },
    refetchInterval: 2500,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const marcar = useCallback((c: Conversa) => {
    setLeitura((atual) => {
      if (!atual || !c.ultima_em || atual.vistas[c.conversation_id] === c.ultima_em) return atual;
      const proxima = {
        ...atual,
        vistas: { ...atual.vistas, [c.conversation_id]: c.ultima_em ?? new Date().toISOString() },
      };
      try {
        if (chave.current) localStorage.setItem(chave.current, JSON.stringify(proxima));
      } catch {
        /* Só memória. */
      }
      return proxima;
    });
  }, []);
  const porCanal = new Map((canais.data?.itens ?? []).map((c) => [c.id, c]));
  const itens = ordenarConversas(
    [
      ...new Map(
        [
          ...(!soAguardando ? (lista.data?.pages.flatMap((p) => p.itens) ?? []) : []),
          ...(!estado || soAguardando ? (espera.data?.itens ?? []) : []),
        ].map((c) => [c.conversation_id, c]),
      ).values(),
    ],
    { porRecencia: ordem === "recentes" },
  );
  const atual =
    itens.find((c) => c.conversation_id === selecionada?.conversation_id) ?? selecionada;
  return (
    <div className="mt-4 flex h-[calc(100dvh-16rem)] min-h-[36rem] flex-col gap-3">
      {avisoEspera ? (
        <div role="status" className="rounded-lg bg-gold-300/20 p-3 text-sm">
          Há novas conversas aguardando atendente.{" "}
          <button
            className="ml-2 underline"
            onClick={() => {
              setEstado("aguardando_atendente");
              setAvisoEspera(false);
            }}
          >
            Ver a fila
          </button>
          <button className="ml-3 underline" onClick={() => setAvisoEspera(false)}>
            Dispensar aviso
          </button>
        </div>
      ) : null}
      {espera.isError ? (
        <p role="alert">Não foi possível carregar a fila de atendimento. {espera.error.message}</p>
      ) : null}
      <Cartao className="grid shrink-0 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-sm">
          Buscar contato
          <Input
            value={busca}
            maxLength={200}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, apelido ou telefone"
            title="Procura no nome de cadastro, no nome informado, no do perfil e no telefone"
          />
        </label>
        <label className="text-sm">
          Agente
          <select
            className="mt-1 w-full rounded-md border bg-card p-2"
            value={agente}
            onChange={(e) => {
              setAgente(e.target.value);
              setCanal("");
            }}
          >
            <option value="">Todos</option>
            {agentes.data?.itens.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Canal
          <select
            className="mt-1 w-full rounded-md border bg-card p-2"
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
          >
            <option value="">Todos</option>
            {canais.data?.itens
              .filter((c) => !agente || c.agente_id === agente)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm">
          Estado
          <select
            className="mt-1 w-full rounded-md border bg-card p-2"
            value={estado}
            onChange={(e) => setEstado(e.target.value as typeof estado)}
          >
            <option value="">Todos</option>
            {ESTADOS_CONVERSA.map((e) => (
              <option key={e} value={e}>
                {ROTULO_ESTADO[e]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Ordenar
          <select
            className="mt-1 w-full rounded-md border bg-card p-2"
            value={ordem}
            disabled={soAguardando}
            onChange={(e) => setOrdem(e.target.value as typeof ordem)}
          >
            <option value="recentes">Atividade mais recente</option>
            <option value="id">Ordem de cadastro</option>
          </select>
        </label>
        <label className="text-sm">
          Atualizadas desde
          <Input type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
      </Cartao>
      <p className="shrink-0 text-xs text-ink-500">
        {soAguardando
          ? "Fila de espera: a mais antiga primeiro."
          : "Quem aguarda atendente aparece no topo. Encerradas só aparecem no filtro “Encerrada” ou em “Todos”."}
      </p>
      {cursorInicial.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível acompanhar as novidades.{" "}
          <button className="underline" onClick={() => void cursorInicial.refetch()}>
            Tentar novamente
          </button>
        </p>
      ) : acompanhamento.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível acompanhar as novidades. A lista continua sendo atualizada.{" "}
          <button className="underline" onClick={() => void acompanhamento.refetch()}>
            Tentar novamente
          </button>
        </p>
      ) : !leitura ? (
        <p className="text-sm text-ink-500">Preparando o acompanhamento das novidades…</p>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(17.5rem,22.5rem)_minmax(0,1fr)]">
        <Cartao
          className={`flex h-full min-h-0 flex-col overflow-hidden ${atual ? "max-lg:hidden" : ""}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5">
            <p className="text-sm font-medium text-ink-900">
              {soAguardando ? "Fila de espera" : "Conversas"}
            </p>
            <p className="text-xs tabular-nums text-ink-500">{itens.length}</p>
          </div>
          {itens.some((c) => c.aguardando_atendente_desde) ? (
            <p className="shrink-0 border-b bg-gold-300/20 px-4 py-2 text-xs font-medium text-gold-700">
              Há contatos aguardando atendente
            </p>
          ) : null}
          {lista.isError ? (
            <p role="alert" className="p-4 text-destructive">
              {lista.error.message}{" "}
              <button className="underline" onClick={() => void lista.refetch()}>
                Tentar novamente
              </button>
            </p>
          ) : null}
          {!cursorInicial.isSuccess || lista.isLoading ? (
            cursorInicial.isError ? null : (
              <p className="p-6">Carregando conversas…</p>
            )
          ) : !itens.length ? (
            <p className="p-6 text-ink-500">
              Nenhuma conversa nesta página com os filtros escolhidos.
            </p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {itens.map((c) => {
              const escolhida = atual?.conversation_id === c.conversation_id;
              const estadoItem = estadoConversa(c, agora);
              const novidade = Boolean(leitura && temNovidade(c, leitura));
              const nome = nomeContato(c);
              const quando = c.ultima?.em ?? c.ultima_em;
              return (
                <button
                  key={c.conversation_id}
                  type="button"
                  aria-current={escolhida ? "true" : undefined}
                  className={`flex w-full gap-3 border-b border-base-200 px-3 py-3 text-left transition-colors hover:bg-purple-50/80 ${
                    escolhida
                      ? "bg-purple-50 shadow-[inset_3px_0_0_0_var(--purple-700)]"
                      : estadoItem === "aguardando_atendente"
                        ? "bg-gold-300/10"
                        : ""
                  }`}
                  onClick={() => setSelecionada(c)}
                >
                  <Iniciais nome={nome} />
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <strong
                        className={`min-w-0 flex-1 truncate text-sm ${novidade ? "text-ink-900" : "font-medium text-ink-700"}`}
                      >
                        {nome}
                      </strong>
                      <time
                        className="shrink-0 text-[11px] tabular-nums text-ink-500"
                        dateTime={quando ?? undefined}
                      >
                        {tempoCurto(quando, agora)}
                      </time>
                      {novidade ? (
                        <span
                          className="size-2 shrink-0 rounded-full bg-purple-700"
                          title="Novas mensagens"
                          aria-label="Novas mensagens"
                        />
                      ) : null}
                    </span>
                    <UltimaMensagemResumo conversa={c} />
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <SeloEstado estado={estadoItem} />
                      {c.follow_up?.estado === "agendado" ? (
                        <Etiqueta tom="roxo">Follow-up</Etiqueta>
                      ) : null}
                      <SeloOrigemNome origem={c.nome_origem} />
                    </span>
                    <span className="mt-1 block truncate">
                      <MarcaCanal
                        conversa={c}
                        canal={c.canal_id ? porCanal.get(c.canal_id) : undefined}
                      />
                      {c.unidade_preferida_nome || c.unidade_preferida
                        ? ` · ${c.unidade_preferida_nome || c.unidade_preferida}`
                        : ""}
                    </span>
                    <ResumoAtendimento atendimento={c.atendimento} compacto />
                    {c.pedido_aberto ? (
                      <span className="mt-1.5 block">
                        <SeloPedidoAberto pedido={c.pedido_aberto} />
                      </span>
                    ) : null}
                    {estadoItem === "aguardando_atendente" && c.aguardando_atendente_desde ? (
                      <span className="mt-1.5 block space-y-1">
                        <Etiqueta tom="alerta">
                          {seloEspera(c.aguardando_atendente_desde, agora)}
                        </Etiqueta>
                        {c.aguardando_motivo ? (
                          <span className="block text-xs text-gold-700">
                            {MOTIVO_ATENDENTE[c.aguardando_motivo]}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          {!soAguardando && lista.hasNextPage ? (
            <Button
              variant="ghost"
              className="w-full"
              disabled={lista.isFetchingNextPage}
              onClick={() => void lista.fetchNextPage()}
            >
              Carregar mais conversas
            </Button>
          ) : null}
        </Cartao>
        <div className={`h-full min-h-0 min-w-0 ${atual ? "flex" : "hidden lg:flex"}`}>
          {atual ? (
            <Atendimento
              key={atual.conversation_id}
              ctx={ctx}
              conversa={atual}
              canal={atual.canal_id ? porCanal.get(atual.canal_id) : undefined}
              agora={agora}
              marcar={marcar}
              voltar={() => setSelecionada(null)}
            />
          ) : (
            <Cartao className="flex h-full min-h-0 w-full flex-col items-center justify-center px-8 text-center">
              <p className="font-display text-2xl text-purple-800">Nenhuma conversa aberta</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
                Escolha um contato na lista. As mensagens mais recentes aparecem assim que a
                conversa abre.
              </p>
            </Cartao>
          )}
        </div>
      </div>
    </div>
  );
}

function MarcaCanal({ conversa, canal }: { conversa: Conversa; canal: CanalGateway | undefined }) {
  const info = canalDaConversa(conversa, canal);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-ink-500">
      <IconeCanal tipo={info.tipo} />
      <span className="truncate">{textoCanal(info.tipo, info.nome)}</span>
      {info.teste ? (
        <span
          className="shrink-0 rounded border border-dashed border-ink-300 px-1 text-[10px] font-medium uppercase tracking-wide text-ink-500"
          title="Empresa de teste ou conversa criada no Simular"
        >
          teste
        </span>
      ) : null}
    </span>
  );
}
/** Selo discreto da origem do nome (cadastro, informado, perfil, telefone). */
export function SeloOrigemNome({ origem }: { origem: OrigemNome | null | undefined }) {
  const selo = seloOrigemNome(origem);
  if (!selo) return null;
  return (
    <span
      className="shrink-0 rounded bg-base-100 px-1 text-[10px] font-normal text-ink-500"
      title={selo.ajuda}
    >
      {selo.rotulo}
    </span>
  );
}
function UltimaMensagemResumo({ conversa }: { conversa: Conversa }) {
  const u = resumoUltima(conversa);
  return (
    <p className="mt-1 truncate text-sm text-ink-500">
      {u.autor ? <span className="font-medium text-ink-700">{u.autor}: </span> : null}
      {u.tipo ? <span className="italic">[{u.tipo}] </span> : null}
      {u.texto ?? (u.tipo ? "" : "Sem mensagem de texto")}
    </p>
  );
}
function SeloPedidoAberto({ pedido }: { pedido: { numero: string; status: string } }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800">
      <ShoppingBag className="size-3" aria-hidden />
      Pedido #{pedido.numero} · {ROTULO_STATUS[pedido.status as StatusPedido] ?? pedido.status}
    </span>
  );
}
export function IconeCanal({ tipo }: { tipo: string }) {
  const comum = { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": true as const };
  if (tipo === "uazapi" || tipo === "meta")
    return (
      <svg {...comum}>
        <path
          fill="currentColor"
          d="M8 1.5a6.5 6.5 0 0 0-5.6 9.8L1.5 14.5l3.3-.8A6.5 6.5 0 1 0 8 1.5Zm3.2 8.3c-.1.4-.7.7-1 .8-.3 0-.6.1-2-.5-1.7-.7-2.8-2.4-2.9-2.5-.1-.1-.7-.9-.7-1.7s.4-1.2.6-1.4.4-.3.5-.3h.4c.1 0 .3 0 .4.3.1.4.5 1.3.5 1.4.1.1 0 .3 0 .4-.1.2-.2.3-.3.4l-.2.2c-.1.1-.2.2-.1.4.1.2.5.9 1.2 1.4.8.6 1.4.8 1.6.9.2.1.3.1.4-.1l.3-.4c.1-.2.3-.1.4-.1.2 0 1.1.5 1.3.6.2.1.3.1.4.2.1.2 0 .6-.1 1Z"
        />
      </svg>
    );
  if (tipo === "email")
    return (
      <svg {...comum}>
        <path
          fill="currentColor"
          d="M2 3.5h12v9H2v-9Zm1.2 1 4.8 3.2L12.8 4.5H3.2Zm9.6 7.5V6.2L8 9.6 3.2 6.2v4.8h9.6Z"
        />
      </svg>
    );
  if (tipo === "site")
    return (
      <svg {...comum}>
        <path
          fill="currentColor"
          d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM2.7 8h2.1a10 10 0 0 0 1.4 4.3A5.3 5.3 0 0 1 2.7 8Zm2.1 0h6.4a8.6 8.6 0 0 1-1.5 4.2 8.6 8.6 0 0 1-3.4 0A8.6 8.6 0 0 1 4.8 8Zm7.1 0h2.1a5.3 5.3 0 0 1-3.5 4.3A10 10 0 0 0 11.9 8ZM13.3 6.8h-2.1A10 10 0 0 0 9.8 2.5 5.3 5.3 0 0 1 13.3 6.8ZM8 2.6c.7.8 1.3 2.3 1.5 4.2H6.5C6.7 4.9 7.3 3.4 8 2.6ZM6.2 2.5A10 10 0 0 0 4.8 6.8H2.7A5.3 5.3 0 0 1 6.2 2.5Z"
        />
      </svg>
    );
  if (tipo === "api")
    return (
      <svg {...comum}>
        <path
          fill="currentColor"
          d="M6.2 3.2 2.4 8l3.8 4.8-1.1.9L1 8l4.1-5.7 1.1.9Zm3.6 0 1.1-.9L15 8l-4.1 5.7-1.1-.9L12.6 8 9.8 3.2Z"
        />
      </svg>
    );
  return (
    <svg {...comum}>
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function Atendimento({
  ctx,
  conversa,
  canal,
  agora,
  marcar,
  voltar,
}: {
  ctx: ContextoGateway;
  conversa: Conversa;
  canal: CanalGateway | undefined;
  agora: number;
  marcar: (c: Conversa) => void;
  voltar: () => void;
}) {
  const enc = useServerFn(gerirAtendimentos);
  const listarFollow = useServerFn(listarFollowUps);
  const cancelarFollowFn = useServerFn(cancelarFollowUps);
  const reativarFn = useServerFn(reativarOptOut);
  const [atendimentoId, setAtendimentoId] = useState("");
  const lerAtendimentos = useCallback(
    (cursor?: number) =>
      enc({
        data: { empresa: ctx.empresa, conversa: conversa.conversation_id, acao: "listar", cursor },
      }),
    [enc, ctx.empresa, conversa.conversation_id],
  );
  const agirAtendimento = useCallback(
    (acao: "encerrar" | "reabrir") =>
      enc({ data: { empresa: ctx.empresa, conversa: conversa.conversation_id, acao } }),
    [enc, ctx.empresa, conversa.conversation_id],
  );
  const buscar = useServerFn(historicoConversa),
    atender = useServerFn(atenderConversa),
    cache = useQueryClient();
  const [texto, setTexto] = useState(""),
    [minutos, setMinutos] = useState(60);
  const mensagens = useInfiniteQuery({
    queryKey: ["conversa-mensagens", ctx.empresa, conversa.conversation_id, atendimentoId],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) =>
      buscar({
        data: {
          empresa: ctx.empresa,
          conversa: conversa.conversation_id,
          ...(atendimentoId ? { atendimento: atendimentoId } : {}),
          antes: pageParam,
          limite: 100,
        },
      }),
    getNextPageParam: (p) => (p.tem_mais ? p.itens[0]?.id : undefined),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });
  const itens = juntarMensagens(...(mensagens.data?.pages.map((p) => p.itens) ?? []));
  const painel = useRef<HTMLDivElement>(null);
  const coladoNoFim = useRef(true);
  const preservarRolagem = useRef(false);
  const alturaAntes = useRef(0);
  const [longeDoFim, setLongeDoFim] = useState(false);
  const ultimaId = itens.at(-1)?.id ?? 0;
  const primeiraId = itens[0]?.id ?? 0;
  const medirRolagem = useCallback(() => {
    const el = painel.current;
    if (!el) return;
    const distancia = el.scrollHeight - el.scrollTop - el.clientHeight;
    const noFim = distancia < 80;
    coladoNoFim.current = noFim;
    setLongeDoFim(!noFim && el.scrollHeight > el.clientHeight + 80);
  }, []);
  const irParaRecentes = useCallback((suave: boolean) => {
    const el = painel.current;
    if (!el) return;
    coladoNoFim.current = true;
    setLongeDoFim(false);
    el.scrollTo({ top: el.scrollHeight, behavior: suave ? "smooth" : "auto" });
  }, []);
  // Abre já nas mensagens recentes. Se a pessoa subiu para ler o passado, a rolagem fica onde está.
  useLayoutEffect(() => {
    const el = painel.current;
    if (!el || !mensagens.isSuccess) return;
    if (preservarRolagem.current) {
      const ganho = el.scrollHeight - alturaAntes.current;
      if (ganho > 0) el.scrollTop += ganho;
      preservarRolagem.current = false;
      medirRolagem();
      return;
    }
    if (coladoNoFim.current) {
      el.scrollTop = el.scrollHeight;
      setLongeDoFim(false);
    }
  }, [
    itens.length,
    ultimaId,
    primeiraId,
    mensagens.isSuccess,
    mensagens.dataUpdatedAt,
    medirRolagem,
  ]);
  const ultimaLida = itens.at(-1)?.enviada_em;
  useEffect(() => {
    if (
      mensagens.isSuccess &&
      !document.hidden &&
      ultimaLida &&
      Date.parse(ultimaLida) >= Date.parse(conversa.ultima_em ?? "")
    )
      marcar(conversa);
  }, [mensagens.dataUpdatedAt, mensagens.isSuccess, conversa, marcar, ultimaLida]);
  const acao = useMutation({
    mutationFn: (acao: "assumir" | "devolver" | "mensagens") =>
      atender({
        data: {
          empresa: ctx.empresa,
          conversa: conversa.conversation_id,
          acao,
          minutos,
          ...(acao === "mensagens" ? { texto } : {}),
        },
      }),
    onSuccess: (r, acao) => {
      if (acao === "mensagens") {
        setTexto("");
        toast.success(
          r.send_mode === "dry"
            ? "Mensagem registrada em teste. Nada enviado ao cliente."
            : "Mensagem enviada.",
        );
      }
      void cache.invalidateQueries({ queryKey: ["conversas", ctx.empresa] });
      void mensagens.refetch();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void cache.invalidateQueries({ queryKey: ["conversas", ctx.empresa] });
    },
    retry: false,
  });
  const followUps = useQuery({
    queryKey: ["follow-ups", ctx.empresa, conversa.conversation_id],
    queryFn: () =>
      listarFollow({
        data: { empresa: ctx.empresa, acao: "listar", conversa: conversa.conversation_id },
      }),
  });
  const reativar = useMutation({
    mutationFn: (motivo: string) =>
      reativarFn({
        data: { empresa: ctx.empresa, acao: "reativar", contato: conversa.contato_id, motivo },
      }),
    onSuccess: () => {
      toast.success("Follow-up reativado para este contato.");
      void cache.invalidateQueries({
        queryKey: ["follow-ups", ctx.empresa, conversa.conversation_id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelarFollow = useMutation({
    mutationFn: () =>
      cancelarFollowFn({
        data: { empresa: ctx.empresa, acao: "cancelar", conversa: conversa.conversation_id },
      }),
    onSuccess: (r) => {
      toast.success(r.cancelados ? "Follow-up cancelado." : "Não havia follow-up agendado.");
      void cache.invalidateQueries({
        queryKey: ["follow-ups", ctx.empresa, conversa.conversation_id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const titulo = nomeContato(conversa);
  const fone = telefoneParaPapel(ctx.papel, telefoneVisivel(conversa));
  const estado = estadoConversa(conversa, agora);
  const [editando, setEditando] = useState(false);
  const podeEditarNome = Boolean(conversa.contato_id) && conversa.nome_origem !== "anonimizado";
  let diaAnterior = "";
  return (
    <Cartao className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b bg-card px-4 py-3">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 lg:hidden"
            aria-label="Voltar para a lista"
            onClick={voltar}
          >
            <ArrowLeft aria-hidden />
          </Button>
          <Iniciais nome={titulo} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 truncate font-display text-xl leading-tight">{titulo}</h2>
              <SeloEstado estado={estado} />
              <SeloOrigemNome origem={conversa.nome_origem} />
              {conversa.contato_id ? (
                <SeloOptOut
                  optOut={followUps.data?.opt_out}
                  podeReativar={peloMenos(ctx.papel, "gestor")}
                  onReativar={(motivo) => reativar.mutate(motivo)}
                />
              ) : null}
              {podeEditarNome && !editando ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-ink-500"
                  onClick={() => setEditando(true)}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Editar nome
                </Button>
              ) : null}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
              {fone && fone !== titulo ? <span>{fone}</span> : null}
              <MarcaCanal conversa={conversa} canal={canal} />
              {estado === "atendente" && conversa.bot_pausado_ate ? (
                <span>até {dataHora(conversa.bot_pausado_ate)}</span>
              ) : null}
              {conversa.unidade_preferida_nome || conversa.unidade_preferida ? (
                <span>
                  Unidade: {conversa.unidade_preferida_nome || conversa.unidade_preferida}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        {editando && conversa.contato_id ? (
          <EditarNome
            ctx={ctx}
            conversa={conversa}
            contato={conversa.contato_id}
            fechar={() => setEditando(false)}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {conversa.pedido_aberto ? (
            <Link
              to="/ia/pedidos"
              search={{ pedido: conversa.pedido_aberto.numero }}
              className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              title="Abrir o pedido"
            >
              <SeloPedidoAberto pedido={conversa.pedido_aberto} />
            </Link>
          ) : null}
          <label className="text-xs text-ink-500">
            Pausa em minutos
            <Input
              type="number"
              className="mt-1 w-24"
              min={1}
              max={1440}
              value={minutos}
              onChange={(e) => setMinutos(Number(e.target.value))}
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={acao.isPending || minutos < 1 || minutos > 1440 || !Number.isInteger(minutos)}
            onClick={() => acao.mutate("assumir")}
          >
            Assumir atendimento
          </Button>
          {peloMenos(ctx.papel, "supervisor") ? (
            <Button
              variant="outline"
              size="sm"
              disabled={acao.isPending || conversa.status !== "pausada"}
              onClick={() => acao.mutate("devolver")}
            >
              Devolver ao agente
            </Button>
          ) : null}
        </div>
      </div>
      <details className="shrink-0 border-b bg-base-50/80">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-ink-900">
          Atendimento e follow-up
        </summary>
        <div className="max-h-64 overflow-y-auto">
          <BlocoFollowUp
            itens={followUps.data?.itens ?? []}
            carregando={followUps.isLoading}
            indisponivel={followUps.data?.indisponivel === true}
            erro={followUps.error instanceof Error ? followUps.error.message : undefined}
            podeCancelar={peloMenos(ctx.papel, "supervisor")}
            cancelando={cancelarFollow.isPending}
            onCancelar={() => cancelarFollow.mutate()}
          />
          <AtendimentosConversa
            atual={conversa.atendimento}
            selecionado={atendimentoId}
            selecionar={setAtendimentoId}
            ler={lerAtendimentos}
            agir={agirAtendimento}
            podeEncerrar={peloMenos(ctx.papel, "supervisor")}
            mudou={() => {
              void cache.invalidateQueries({ queryKey: ["conversas", ctx.empresa] });
              void mensagens.refetch();
            }}
          />
        </div>
      </details>
      <div className="relative min-h-0 flex-1 bg-[radial-gradient(circle_at_top,_rgba(165,148,189,0.16),_transparent_42%),linear-gradient(180deg,#faf9f7,#f4f2ee)]">
        <div
          ref={painel}
          onScroll={medirRolagem}
          className="absolute inset-0 space-y-2 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
          aria-label="Histórico da conversa"
        >
          {mensagens.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full bg-card"
                disabled={mensagens.isFetchingNextPage}
                onClick={() => {
                  const el = painel.current;
                  if (el) alturaAntes.current = el.scrollHeight;
                  preservarRolagem.current = true;
                  void mensagens.fetchNextPage();
                }}
              >
                {mensagens.isFetchingNextPage ? "Carregando…" : "Mensagens anteriores"}
              </Button>
            </div>
          ) : null}
          {mensagens.isError ? (
            <p role="alert" className="text-center text-sm text-destructive">
              {mensagens.error.message}
            </p>
          ) : null}
          {mensagens.isLoading ? (
            <div className="space-y-3" aria-hidden>
              <div className="h-14 w-2/3 animate-pulse rounded-2xl bg-card" />
              <div className="ml-auto h-14 w-1/2 animate-pulse rounded-2xl bg-purple-100" />
              <div className="h-20 w-3/5 animate-pulse rounded-2xl bg-card" />
            </div>
          ) : null}
          {!mensagens.isLoading && !mensagens.isError && itens.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-500">
              Nenhuma mensagem neste recorte.
            </p>
          ) : null}
          {itens.map((m, indice) => {
            const dia = diaDaMensagem(m.enviada_em);
            const mostraDia = Boolean(dia) && dia !== diaAnterior;
            diaAnterior = dia;
            const saida = m.direcao === "saida";
            const humano = m.origem === "humano";
            const proxima = itens[indice + 1];
            const fechaGrupo =
              !proxima ||
              proxima.direcao !== m.direcao ||
              proxima.origem !== m.origem ||
              diaDaMensagem(proxima.enviada_em) !== dia;
            return (
              <div key={m.id} className={fechaGrupo ? "pb-1" : ""}>
                {mostraDia ? (
                  <div className="sticky top-0 z-[1] mb-2 flex justify-center">
                    <span className="rounded-full border border-base-200 bg-card/95 px-2.5 py-0.5 text-[11px] font-medium text-ink-500 shadow-sm">
                      {dia}
                    </span>
                  </div>
                ) : null}
                <div className={`flex ${saida ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[min(85%,32rem)] px-3.5 py-2 shadow-[0_1px_2px_rgba(26,21,32,0.06)] ${
                      humano
                        ? "rounded-2xl rounded-br-md bg-gold-300/35 text-ink-900"
                        : saida
                          ? "rounded-2xl rounded-br-md bg-purple-700 text-base-50"
                          : "rounded-2xl rounded-bl-md border border-base-200 bg-card text-ink-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {m.conteudo ?? "Mensagem sem texto"}
                    </p>
                    {fechaGrupo ? (
                      <p
                        className={`mt-1 text-[10px] ${saida && !humano ? "text-purple-200" : "text-ink-500"}`}
                      >
                        {ORIGEM_MENSAGEM[m.origem] ?? m.origem} · {horaDaMensagem(m.enviada_em)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {longeDoFim ? (
          <button
            type="button"
            className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-base-200 bg-card px-3 py-1.5 text-xs font-medium text-purple-800 shadow-[0_8px_20px_rgba(46,35,64,0.12)]"
            onClick={() => irParaRecentes(true)}
          >
            <ArrowDown className="size-3.5" aria-hidden />
            Mensagens recentes
          </button>
        ) : null}
      </div>
      <form
        className="shrink-0 border-t bg-card px-3 py-3 sm:px-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (texto.trim() && !acao.isPending) {
            coladoNoFim.current = true;
            acao.mutate("mensagens");
          }
        }}
      >
        {atendimentoId && atendimentoId !== conversa.atendimento?.id && (
          <p className="mb-2 text-sm text-amber-800">
            Você está consultando um atendimento anterior. Uma nova mensagem será enviada no
            atendimento atual.
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            id="atendimento-texto"
            value={texto}
            maxLength={20000}
            rows={2}
            className="max-h-32 min-h-11 resize-none rounded-2xl bg-base-50"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Escreva a mensagem para o contato…"
            aria-label="Sua mensagem ao contato"
          />
          <Button
            type="submit"
            className="h-11 shrink-0 rounded-full px-4"
            disabled={acao.isPending || !texto.trim()}
          >
            <Send aria-hidden />
            {acao.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-500">
          Enter envia. Shift+Enter quebra a linha. Enviar pausa o agente. Em teste, a mensagem fica
          só no histórico.
        </p>
      </form>
    </Cartao>
  );
}
/** Nome de cadastro do contato. Qualquer papel; o gateway registra quem alterou. */
function EditarNome({
  ctx,
  conversa,
  contato,
  fechar,
}: {
  ctx: ContextoGateway;
  conversa: Conversa;
  contato: string;
  fechar: () => void;
}) {
  const editar = useServerFn(editarNomeContato),
    cache = useQueryClient();
  const [nome, setNome] = useState(conversa.nomes?.cadastro ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useMutation({
    mutationFn: (valor: string | null) =>
      editar({
        data: { empresa: ctx.empresa, conversa: conversa.conversation_id, contato, nome: valor },
      }),
    onSuccess: (r) => {
      toast.success(
        r.nomes.cadastro
          ? "Nome atualizado."
          : `Nome de cadastro removido. Vale: ${r.nome_exibicao}.`,
      );
      void cache.invalidateQueries({ queryKey: ["conversas", ctx.empresa] });
      void cache.invalidateQueries({ queryKey: ["pedidos", ctx.empresa ?? "vinculada"] });
      fechar();
    },
    onError: (e: Error) => setErro(e.message),
    retry: false,
  });
  const proximo = nomeSemCadastro(conversa);
  return (
    <form
      className="space-y-2 rounded-lg border border-base-200 bg-base-100/60 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const v = validarNomeCadastro(nome);
        if (!v.ok) return setErro(MOTIVO_NOME[v.motivo] ?? "Nome inválido.");
        setErro(null);
        salvar.mutate(v.nome);
      }}
    >
      <label className="block text-sm" htmlFor="contato-nome">
        Nome de cadastro
      </label>
      <Input
        id="contato-nome"
        value={nome}
        maxLength={60}
        autoFocus
        aria-invalid={Boolean(erro)}
        aria-describedby="contato-nome-ajuda"
        onChange={(e) => {
          setNome(e.target.value);
          setErro(null);
        }}
        placeholder={proximo}
      />
      <p id="contato-nome-ajuda" className="text-xs text-ink-500">
        Vale acima do nome informado e do perfil, aqui e nos pedidos. Deixe vazio para remover;
        volta a valer “{proximo}”.
      </p>
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={salvar.isPending}
          onClick={fechar}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
