import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { dataHora, Etiqueta, type ContextoGateway } from "./Gateway";
import { Cartao } from "./Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import { listarCanais } from "@/lib/gateway-canais.functions";
import { historicoConversa } from "@/lib/gateway-simular.functions";
import {
  acompanharConversas,
  atenderConversa,
  listarConversas,
  obterCursorEventos,
} from "@/lib/gateway-conversas.functions";
import {
  desdeDoCursor,
  estadoConversa,
  juntarMensagens,
  nomeContato,
  ordenarConversas,
  ROTULO_ESTADO,
  temNovidade,
  textoCanal,
  telefoneVisivel,
  type Conversa,
  type Leitura,
  MOTIVO_ATENDENTE,
  seloEspera,
} from "@/lib/gateway/conversas";
import type { CanalGateway } from "@/lib/gateway/tipos";
import { ORIGEM_MENSAGEM } from "@/lib/gateway/vocabulario";

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
  const [status, setStatus] = useState<"" | "ativa" | "pausada">(""),
    [busca, setBusca] = useState(""),
    [desde, setDesde] = useState("");
  const [soAguardando, setSoAguardando] = useState(false);
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
    queryKey: ["conversas", ctx.empresa, agente, canal, status, filtroBusca, desde, soAguardando],
    enabled: cursorInicial.isSuccess && !soAguardando,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      buscar({
        data: {
          empresa: ctx.empresa,
          cursor: pageParam,
          aguardando: false,
          ...(agente ? { agente } : {}),
          ...(canal ? { canal } : {}),
          ...(status ? { status } : {}),
          ...(filtroBusca ? { busca: filtroBusca } : {}),
          ...(desde ? { desde: new Date(desde).toISOString() } : {}),
        },
      }),
    getNextPageParam: (p) => p.proximo_cursor ?? undefined,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const espera = useQuery({
    queryKey: ["conversas", ctx.empresa, "aguardando", agente, canal, status, filtroBusca, desde],
    enabled: cursorInicial.isSuccess,
    queryFn: () =>
      buscar({
        data: {
          empresa: ctx.empresa,
          aguardando: true,
          ...(agente ? { agente } : {}),
          ...(canal ? { canal } : {}),
          ...(status ? { status } : {}),
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
  const itens = ordenarConversas([
    ...new Map(
      [
        ...(!soAguardando ? (lista.data?.pages.flatMap((p) => p.itens) ?? []) : []),
        ...(espera.data?.itens ?? []),
      ].map((c) => [c.conversation_id, c]),
    ).values(),
  ]);
  const atual =
    itens.find((c) => c.conversation_id === selecionada?.conversation_id) ?? selecionada;
  return (
    <div className="mt-6 space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={soAguardando}
          onChange={(e) => setSoAguardando(e.target.checked)}
        />
        Só aguardando atendente
      </label>
      {avisoEspera ? (
        <div role="status" className="rounded-lg bg-gold-300/20 p-3 text-sm">
          Há novas conversas aguardando atendente.{" "}
          <button className="ml-2 underline" onClick={() => setAvisoEspera(false)}>
            Dispensar aviso
          </button>
        </div>
      ) : null}
      {espera.isError ? (
        <p role="alert">Não foi possível carregar a fila de atendimento. {espera.error.message}</p>
      ) : null}
      <Cartao className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          Buscar contato
          <Input
            value={busca}
            maxLength={200}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou telefone"
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
          Atendimento
          <select
            className="mt-1 w-full rounded-md border bg-card p-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="">Todos</option>
            <option value="ativa">Bot sem pausa</option>
            <option value="pausada">Bot pausado</option>
          </select>
        </label>
        <label className="text-sm">
          Atualizadas desde
          <Input type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
      </Cartao>
      <p className="text-xs text-ink-500">
        O filtro de atendimento usa a pausa do bot. Encerrada e aguardando aparecem no estado de
        cada conversa.
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
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        <Cartao className="overflow-hidden">
          {itens.some((c) => c.aguardando_atendente_desde) ? (
            <p className="border-b bg-gold-300/20 p-3 font-medium">Aguardando atendente</p>
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
          <div className="max-h-[65vh] overflow-y-auto">
            {itens.map((c) => (
              <button
                key={c.conversation_id}
                className={`block w-full border-b p-4 text-left hover:bg-purple-50 ${atual?.conversation_id === c.conversation_id ? "bg-purple-50" : ""}`}
                onClick={() => setSelecionada(c)}
              >
                <div className="flex items-center gap-2">
                  <strong className="min-w-0 truncate">{nomeContato(c)}</strong>
                  {leitura && temNovidade(c, leitura) ? (
                    <span
                      className="size-2 shrink-0 rounded-full bg-purple-700"
                      title="Novas mensagens"
                      aria-label="Novas mensagens"
                    />
                  ) : null}
                </div>
                <p className="mt-1">
                  <MarcaCanal
                    conversa={c}
                    canal={c.canal_id ? porCanal.get(c.canal_id) : undefined}
                  />
                </p>
                <p className="mt-1 truncate text-sm text-ink-500">
                  {c.ultima_mensagem ?? "Sem mensagem de texto"}
                </p>
                <p className="mt-2 text-xs text-ink-500">
                  {dataHora(c.ultima_em)} · {ROTULO_ESTADO[estadoConversa(c, agora)]}
                </p>
                {estadoConversa(c, agora) === "aguardando_atendente" &&
                c.aguardando_atendente_desde ? (
                  <div className="mt-2 space-y-1">
                    <Etiqueta tom="alerta">
                      {seloEspera(c.aguardando_atendente_desde, agora)}
                    </Etiqueta>
                    <p className="text-xs text-gold-700">
                      {c.aguardando_motivo ? MOTIVO_ATENDENTE[c.aguardando_motivo] : ""}
                    </p>
                  </div>
                ) : null}
              </button>
            ))}
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
        {atual ? (
          <Atendimento
            key={atual.conversation_id}
            ctx={ctx}
            conversa={atual}
            canal={atual.canal_id ? porCanal.get(atual.canal_id) : undefined}
            agora={agora}
            marcar={marcar}
          />
        ) : (
          <Cartao className="p-12 text-center text-ink-500">
            Escolha uma conversa para ler o histórico e atender.
          </Cartao>
        )}
      </div>
    </div>
  );
}

function MarcaCanal({ conversa, canal }: { conversa: Conversa; canal: CanalGateway | undefined }) {
  const tipo = canal?.tipo ?? conversa.canal;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-ink-500">
      <IconeCanal tipo={tipo} />
      <span className="truncate">{textoCanal(tipo, canal?.nome)}</span>
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
}: {
  ctx: ContextoGateway;
  conversa: Conversa;
  canal: CanalGateway | undefined;
  agora: number;
  marcar: (c: Conversa) => void;
}) {
  const buscar = useServerFn(historicoConversa),
    atender = useServerFn(atenderConversa),
    cache = useQueryClient();
  const [texto, setTexto] = useState(""),
    [minutos, setMinutos] = useState(60);
  const mensagens = useInfiniteQuery({
    queryKey: ["conversa-mensagens", ctx.empresa, conversa.conversation_id],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) =>
      buscar({
        data: {
          empresa: ctx.empresa,
          conversa: conversa.conversation_id,
          antes: pageParam,
          limite: 100,
        },
      }),
    getNextPageParam: (p) => (p.tem_mais ? p.itens[0]?.id : undefined),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });
  const itens = juntarMensagens(...(mensagens.data?.pages.map((p) => p.itens) ?? []));
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
  const titulo = nomeContato(conversa);
  const fone = telefoneVisivel(conversa);
  const estado = estadoConversa(conversa, agora);
  return (
    <Cartao className="flex min-w-0 flex-col">
      <div className="space-y-3 border-b p-4">
        <h2 className="font-display text-xl">{titulo}</h2>
        {fone && fone !== titulo ? <p className="text-sm text-ink-500">{fone}</p> : null}
        <MarcaCanal conversa={conversa} canal={canal} />
        <p className="text-sm text-ink-500">
          {ROTULO_ESTADO[estado]}
          {estado === "atendente" && conversa.bot_pausado_ate
            ? ` · até ${dataHora(conversa.bot_pausado_ate)}`
            : ""}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            Pausa em minutos
            <Input
              type="number"
              className="w-24"
              min={1}
              max={1440}
              value={minutos}
              onChange={(e) => setMinutos(Number(e.target.value))}
            />
          </label>
          <Button
            variant="outline"
            disabled={acao.isPending || minutos < 1 || minutos > 1440 || !Number.isInteger(minutos)}
            onClick={() => acao.mutate("assumir")}
          >
            Assumir atendimento
          </Button>
          <Button
            variant="outline"
            disabled={acao.isPending || conversa.status !== "pausada"}
            onClick={() => acao.mutate("devolver")}
          >
            Devolver ao agente
          </Button>
        </div>
      </div>
      <div className="h-[50vh] space-y-3 overflow-y-auto p-4" aria-label="Histórico da conversa">
        {mensagens.hasNextPage ? (
          <Button
            variant="ghost"
            className="w-full"
            disabled={mensagens.isFetchingNextPage}
            onClick={() => void mensagens.fetchNextPage()}
          >
            Carregar mensagens anteriores
          </Button>
        ) : null}
        {mensagens.isError ? (
          <p role="alert" className="text-destructive">
            {mensagens.error.message}
          </p>
        ) : null}
        {mensagens.isLoading ? <p>Carregando histórico…</p> : null}
        {itens.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.direcao === "saida" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 ${m.origem === "humano" ? "bg-gold-300/20" : m.direcao === "saida" ? "bg-purple-50" : "bg-base-100"}`}
            >
              <p className="whitespace-pre-wrap break-words text-sm">
                {m.conteudo ?? "Mensagem sem texto"}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {ORIGEM_MENSAGEM[m.origem] ?? m.origem} · {dataHora(m.enviada_em)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <form
        className="space-y-2 border-t p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (texto.trim() && !acao.isPending) acao.mutate("mensagens");
        }}
      >
        <label className="text-sm" htmlFor="atendimento-texto">
          Sua mensagem ao contato
        </label>
        <Textarea
          id="atendimento-texto"
          value={texto}
          maxLength={20000}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva como atendente…"
        />
        <p className="text-xs text-ink-500">
          Enviar uma mensagem pausa o agente automaticamente. Em envio de teste, ela fica somente no
          histórico.
        </p>
        <Button type="submit" disabled={acao.isPending || !texto.trim()}>
          Enviar como atendente
        </Button>
      </form>
    </Cartao>
  );
}
