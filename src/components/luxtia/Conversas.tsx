import { peloMenos, telefoneParaPapel } from "@/lib/acesso/papeis";
import { gerirAtendimentos } from "@/lib/gateway-enc1.functions";
import {
  cancelarFollowUps,
  listarFollowUps,
  reativarOptOut,
} from "@/lib/gateway-followup.functions";
import { AtendimentosConversa } from "./AtendimentosConversa";
import { BlocoFollowUp, SeloOptOut } from "./FollowUpConversa";
import { BotaoRespostas, useMenuRespostas } from "./RespostasRapidas";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { dataHora, type ContextoGateway } from "./Gateway";
import { Iniciais } from "./Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import { listarCanais } from "@/lib/gateway-canais.functions";
import { historicoConversa } from "@/lib/gateway-simular.functions";
import {
  acompanharConversas,
  apagarNota,
  atenderConversa,
  atribuirConversa,
  criarNota,
  editarNomeContato,
  listarConversas,
  listarEquipeConversas,
  listarNotas,
  obterCursorEventos,
} from "@/lib/gateway-conversas.functions";
import {
  canalDaConversa,
  desdeDoCursor,
  esperaCurta,
  estadoConversa,
  juntarMensagens,
  LIMITE_NOTA,
  linhaDoTempo,
  nomeContato,
  nomeSemCadastro,
  ordenarConversas,
  proximaDaFila,
  resumoUltima,
  rotuloPessoa,
  ROTULO_ESTADO,
  seloOrigemNome,
  temNovidade,
  textoCanal,
  telefoneVisivel,
  urgenciaEspera,
  validarNomeCadastro,
  vizinhaNaLista,
  MOTIVO_NOME,
  type Conversa,
  type EstadoConversa,
  type Leitura,
  type OrigemNome,
  type PessoaEquipe,
  type UrgenciaEspera,
  MOTIVO_ATENDENTE,
  seloEspera,
} from "@/lib/gateway/conversas";
import { ROTULO_ATENDIMENTO } from "@/lib/gateway/enc1";
import { primeiroNome, variaveisPendentes } from "@/lib/gateway/respostas-rapidas";
import { ROTULO_STATUS, type StatusPedido } from "@/lib/gateway/pedidos";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock,
  Lock,
  PanelRight,
  Pencil,
  Search,
  Send,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import type { CanalGateway } from "@/lib/gateway/tipos";
import { ORIGEM_MENSAGEM } from "@/lib/gateway/vocabulario";

const TOM_ESTADO: Record<EstadoConversa, string> = {
  aguardando_atendente: "bg-gold-300/35 text-gold-700",
  atendente: "bg-purple-100 text-purple-800",
  bot: "bg-success-soft text-success",
  encerrada: "bg-base-100 text-ink-500",
};

/** A espera muda de cor conforme envelhece. */
const TOM_URGENCIA: Record<UrgenciaEspera, string> = {
  normal: "bg-gold-300/25 text-gold-700",
  atencao: "bg-gold-500/35 text-gold-700",
  critica: "bg-destructive/10 text-destructive",
};
const BARRA_URGENCIA: Record<UrgenciaEspera, string> = {
  normal: "shadow-[inset_3px_0_0_0_var(--gold-300)]",
  atencao: "shadow-[inset_3px_0_0_0_var(--gold-500)]",
  critica: "shadow-[inset_3px_0_0_0_var(--destructive)]",
};

const ABAS: { valor: "" | "minhas" | EstadoConversa; rotulo: string; ajuda: string }[] = [
  { valor: "", rotulo: "Todas", ajuda: "Quem aguarda atendente aparece no topo" },
  { valor: "minhas", rotulo: "Minhas", ajuda: "Conversas com você agora" },
  {
    valor: "aguardando_atendente",
    rotulo: "Fila",
    ajuda: "Fila de espera: a mais antiga primeiro",
  },
  { valor: "atendente", rotulo: "Atendente", ajuda: "Conversas com uma pessoa da equipe" },
  { valor: "bot", rotulo: "Bot", ajuda: "Conversas com o agente" },
  { valor: "encerrada", rotulo: "Encerradas", ajuda: "Conversas encerradas" },
];

const PAUSAS = [
  { minutos: 15, rotulo: "15 min" },
  { minutos: 30, rotulo: "30 min" },
  { minutos: 60, rotulo: "1 h" },
  { minutos: 120, rotulo: "2 h" },
  { minutos: 240, rotulo: "4 h" },
  { minutos: 480, rotulo: "8 h" },
  { minutos: 1440, rotulo: "24 h" },
];

/** O painel de detalhes fica fixo a partir de 1280 px; abaixo disso abre sob demanda. */
const CONSULTA_TELA_LARGA = "(min-width: 1280px)";
function assinarTelaLarga(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_TELA_LARGA);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}
function useTelaLarga() {
  return useSyncExternalStore(
    assinarTelaLarga,
    () => window.matchMedia(CONSULTA_TELA_LARGA).matches,
    () => false,
  );
}

/** Atalhos de uma tecla não valem com a pessoa digitando. */
function digitando(alvo: EventTarget | null) {
  return Boolean(
    (alvo as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable='true']"),
  );
}

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
  const [minhas, setMinhas] = useState(false);
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
    enabled: peloMenos(ctx.papel, "supervisor"),
    queryFn: () => buscarAgentes({ data: { empresa: ctx.empresa } }),
  });
  const canais = useQuery({
    queryKey: ["gateway", "canais", ctx.empresa],
    enabled: peloMenos(ctx.papel, "gestor"),
    queryFn: () => buscarCanais({ data: { empresa: ctx.empresa } }),
  });
  const lista = useInfiniteQuery({
    queryKey: ["conversas", ctx.empresa, agente, canal, estado, minhas, ordem, filtroBusca, desde],
    enabled: cursorInicial.isSuccess && !soAguardando,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      buscar({
        data: {
          empresa: ctx.empresa,
          cursor: pageParam,
          aguardando: false,
          ordem,
          ...(minhas ? { minhas: true } : {}),
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
    // Roda em todas as abas: a contagem e "Abrir próxima" dependem dela. Com outro estado
    // escolhido, a fila só não entra na lista.
    enabled: cursorInicial.isSuccess,
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
  // Contagem da aba Minhas, em qualquer aba. Mantém o último valor enquanto atualiza.
  const comigo = useQuery({
    queryKey: ["conversas", ctx.empresa, "minhas-contagem"],
    enabled: cursorInicial.isSuccess,
    queryFn: () =>
      buscar({
        data: { empresa: ctx.empresa, aguardando: false, minhas: true, ordem: "recentes" },
      }),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const buscarEquipe = useServerFn(listarEquipeConversas);
  const equipeQuery = useQuery({
    queryKey: ["conversas-equipe", ctx.empresa],
    queryFn: () => buscarEquipe({ data: { empresa: ctx.empresa } }),
    staleTime: 5 * 60_000,
  });
  const equipe = equipeQuery.data?.itens;
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
          ...((!estado && !minhas) || soAguardando ? (espera.data?.itens ?? []) : []),
        ].map((c) => [c.conversation_id, c]),
      ).values(),
    ],
    { porRecencia: ordem === "recentes" },
  );
  // A conversa aberta tem leitura própria: pode sair da aba (assumida, transferida) e seguir aberta.
  const abertaId = selecionada?.conversation_id;
  const aberta = useQuery({
    queryKey: ["conversas", ctx.empresa, "aberta", abertaId],
    enabled: cursorInicial.isSuccess && Boolean(abertaId),
    queryFn: () =>
      buscar({
        data: {
          empresa: ctx.empresa,
          aguardando: false,
          ...(abertaId ? { conversa: abertaId } : {}),
        },
      }),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const atual =
    aberta.data?.itens.find((c) => c.conversation_id === abertaId) ??
    itens.find((c) => c.conversation_id === abertaId) ??
    selecionada;
  const atualId = atual?.conversation_id ?? null;
  // A fila vem completa do servidor, então vale em qualquer aba.
  const filaEspera = espera.data?.itens ?? [];
  const proxima = proximaDaFila(filaEspera, atualId);
  const maisAntiga = filaEspera[0]?.aguardando_atendente_desde;
  const filtrosAtivos =
    Number(Boolean(agente)) +
    Number(Boolean(canal)) +
    Number(Boolean(desde)) +
    Number(ordem !== "recentes");

  const painelLista = useRef<HTMLDivElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const fimLista = useRef<HTMLDivElement>(null);
  const rascunhos = useRef(new Map<string, string>());
  const abrir = useCallback((c: Conversa) => setSelecionada(c), []);

  // Os atalhos leem a lista de agora sem refazer o ouvinte a cada atualização.
  const navegacao = useRef({ itens, atualId, proxima });
  navegacao.current = { itens, atualId, proxima };
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const { itens, atualId, proxima } = navegacao.current;
      if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        const vizinha = vizinhaNaLista(itens, atualId, e.key === "ArrowDown" ? 1 : -1);
        e.preventDefault();
        if (vizinha) setSelecionada(vizinha);
        return;
      }
      const alvo = e.target as HTMLElement | null;
      if (e.key === "Escape" && alvo?.id === "atendimento-texto") {
        alvo.blur();
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey || digitando(alvo)) return;
      if (e.key === "/") {
        e.preventDefault();
        campoBusca.current?.focus();
      } else if (e.key === "n" || e.key === "N") {
        if (proxima) setSelecionada(proxima);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        document.getElementById("atendimento-texto")?.focus();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  useEffect(() => {
    if (!atualId) return;
    painelLista.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [atualId]);

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = lista;
  useEffect(() => {
    const fim = fimLista.current;
    if (!fim || soAguardando || !hasNextPage || isFetchingNextPage) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) void fetchNextPage();
      },
      { root: painelLista.current, rootMargin: "240px" },
    );
    observador.observe(fim);
    return () => observador.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, soAguardando]);

  return (
    <div className="grid min-h-0 flex-1 bg-card lg:grid-cols-[22rem_minmax(0,1fr)]">
      <section
        aria-label="Fila de conversas"
        className={`flex min-h-0 min-w-0 flex-col border-base-200 lg:border-r ${atual ? "max-lg:hidden" : ""}`}
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pb-1.5 pt-2.5">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-500"
              aria-hidden
            />
            <Input
              ref={campoBusca}
              value={busca}
              maxLength={200}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome ou telefone"
              aria-label="Buscar contato"
              title="Procura no nome de cadastro, no nome informado, no do perfil e no telefone"
              className="h-8 bg-base-50 pl-8 text-sm"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 px-2.5">
                <SlidersHorizontal className="size-3.5" aria-hidden />
                Filtros
                {filtrosAtivos ? (
                  <span className="rounded-full bg-purple-700 px-1.5 text-[10px] tabular-nums text-base-50">
                    {filtrosAtivos}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3 p-3">
              <label className="block text-xs text-ink-500">
                Agente
                <select
                  className="mt-1 h-8 w-full rounded-md border bg-card px-2 text-sm text-ink-900"
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
              <label className="block text-xs text-ink-500">
                Canal
                <select
                  className="mt-1 h-8 w-full rounded-md border bg-card px-2 text-sm text-ink-900"
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
              <label className="block text-xs text-ink-500">
                Ordenar
                <select
                  className="mt-1 h-8 w-full rounded-md border bg-card px-2 text-sm text-ink-900 disabled:opacity-60"
                  value={ordem}
                  disabled={soAguardando}
                  onChange={(e) => setOrdem(e.target.value as typeof ordem)}
                >
                  <option value="recentes">Atividade mais recente</option>
                  <option value="id">Ordem de cadastro</option>
                </select>
              </label>
              <label className="block text-xs text-ink-500">
                Atualizadas desde
                <Input
                  type="datetime-local"
                  className="mt-1 h-8 text-sm text-ink-900"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </label>
              {filtrosAtivos ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full"
                  onClick={() => {
                    setAgente("");
                    setCanal("");
                    setDesde("");
                    setOrdem("recentes");
                  }}
                >
                  Limpar filtros
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>
        </div>
        <div
          role="tablist"
          aria-label="Estado da conversa"
          className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-base-200 px-2 [scrollbar-width:none]"
        >
          {ABAS.map((aba) => {
            const ativa = aba.valor === "minhas" ? minhas : !minhas && estado === aba.valor;
            const emEspera = aba.valor === "aguardando_atendente" ? filaEspera.length : 0;
            const comigoTotal = aba.valor === "minhas" ? (comigo.data?.itens.length ?? 0) : 0;
            return (
              <button
                key={aba.valor}
                type="button"
                role="tab"
                aria-selected={ativa}
                title={aba.ajuda}
                className={`flex shrink-0 items-center gap-1 border-b-2 px-1 pb-1.5 pt-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  ativa
                    ? "border-purple-700 font-semibold text-purple-800"
                    : "border-transparent text-ink-500 hover:text-ink-900"
                }`}
                onClick={() => {
                  setMinhas(aba.valor === "minhas");
                  setEstado(aba.valor === "minhas" ? "" : aba.valor);
                }}
              >
                {aba.rotulo}
                {comigoTotal ? (
                  <span className="rounded-full bg-purple-700 px-1.5 text-[10px] font-semibold tabular-nums text-base-50">
                    {comigo.data?.proximo_cursor ? `${comigoTotal}+` : comigoTotal}
                  </span>
                ) : null}
                {emEspera ? (
                  <span className="rounded-full bg-gold-500 px-1.5 text-[10px] font-semibold tabular-nums text-purple-900">
                    {emEspera}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {proxima && maisAntiga ? (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gold-300/50 bg-gold-300/15 py-1 pl-3 pr-1.5">
            <p className="min-w-0 truncate text-xs text-gold-700">
              Mais antiga há <strong>{esperaCurta(maisAntiga, agora)}</strong>
            </p>
            <Button
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs"
              title="Abre a conversa que aguarda há mais tempo (atalho N)"
              onClick={() => abrir(proxima)}
            >
              Abrir próxima
              <ArrowRight className="size-3" aria-hidden />
            </Button>
          </div>
        ) : null}
        {avisoEspera ? (
          <div
            role="status"
            className="flex shrink-0 items-center justify-between gap-2 border-b border-gold-300/50 bg-gold-300/25 px-3 py-1 text-xs text-gold-700"
          >
            <span className="min-w-0 truncate">Novas conversas na fila</span>
            <span className="flex shrink-0 gap-2">
              <button
                className="font-medium underline"
                onClick={() => {
                  setMinhas(false);
                  setEstado("aguardando_atendente");
                  setAvisoEspera(false);
                }}
              >
                Ver a fila
              </button>
              <button className="underline" onClick={() => setAvisoEspera(false)}>
                Dispensar aviso
              </button>
            </span>
          </div>
        ) : null}
        {espera.isError ? (
          <p role="alert" className="shrink-0 border-b px-3 py-1.5 text-xs text-destructive">
            Não foi possível carregar a fila de atendimento. {espera.error.message}
          </p>
        ) : null}
        {cursorInicial.isError ? (
          <p role="alert" className="shrink-0 border-b px-3 py-1.5 text-xs text-destructive">
            Não foi possível acompanhar as novidades.{" "}
            <button className="underline" onClick={() => void cursorInicial.refetch()}>
              Tentar novamente
            </button>
          </p>
        ) : acompanhamento.isError ? (
          <p role="alert" className="shrink-0 border-b px-3 py-1.5 text-xs text-destructive">
            Não foi possível acompanhar as novidades. A lista continua sendo atualizada.{" "}
            <button className="underline" onClick={() => void acompanhamento.refetch()}>
              Tentar novamente
            </button>
          </p>
        ) : null}
        {lista.isError ? (
          <p role="alert" className="shrink-0 border-b px-3 py-1.5 text-xs text-destructive">
            {lista.error.message}{" "}
            <button className="underline" onClick={() => void lista.refetch()}>
              Tentar novamente
            </button>
          </p>
        ) : null}
        <div ref={painelLista} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!cursorInicial.isSuccess || lista.isLoading ? (
            cursorInicial.isError ? null : (
              <p className="p-4 text-sm text-ink-500">Carregando conversas…</p>
            )
          ) : !itens.length ? (
            <p className="p-4 text-sm text-ink-500">Nenhuma conversa com os filtros escolhidos.</p>
          ) : null}
          {itens.map((c) => (
            <LinhaConversa
              key={c.conversation_id}
              conversa={c}
              canal={c.canal_id ? porCanal.get(c.canal_id) : undefined}
              escolhida={atualId === c.conversation_id}
              novidade={Boolean(leitura && temNovidade(c, leitura))}
              agora={agora}
              abrir={abrir}
              responsavel={
                c.atribuida_minha
                  ? "Você"
                  : c.atribuida_a
                    ? rotuloPessoa(c.atribuida_a, equipe)
                    : null
              }
            />
          ))}
          {!soAguardando && lista.hasNextPage ? (
            <div ref={fimLista}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={lista.isFetchingNextPage}
                onClick={() => void lista.fetchNextPage()}
              >
                {lista.isFetchingNextPage ? "Carregando…" : "Carregar mais conversas"}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="hidden shrink-0 items-center justify-between gap-2 whitespace-nowrap border-t border-base-200 bg-base-50 px-3 py-1 text-[10px] text-ink-500 lg:flex">
          <span className="tabular-nums" title="Conversas carregadas">
            {itens.length}
            {lista.hasNextPage && !soAguardando ? "+" : ""}
          </span>
          <span className="flex gap-2" aria-label="Atalhos de teclado">
            <span>
              <Tecla>/</Tecla> buscar
            </span>
            <span>
              <Tecla>Alt ↑↓</Tecla> trocar
            </span>
            <span>
              <Tecla>N</Tecla> próxima
            </span>
            <span>
              <Tecla>R</Tecla> responder
            </span>
          </span>
        </div>
      </section>
      <div className={`min-h-0 min-w-0 ${atual ? "flex" : "hidden lg:flex"}`}>
        {atual ? (
          <Atendimento
            key={atual.conversation_id}
            ctx={ctx}
            conversa={atual}
            canal={atual.canal_id ? porCanal.get(atual.canal_id) : undefined}
            agora={agora}
            marcar={marcar}
            voltar={() => setSelecionada(null)}
            rascunhos={rascunhos.current}
            equipe={equipe ?? []}
          />
        ) : (
          <div className="flex min-h-0 w-full flex-col items-center justify-center bg-base-100 px-8 text-center">
            <p className="font-display text-xl text-purple-800">Nenhuma conversa aberta</p>
            <p className="mt-1 max-w-sm text-sm text-ink-500">
              Escolha um contato na lista
              {proxima ? " ou aperte N para abrir quem aguarda há mais tempo" : ""}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-base-200 bg-card px-1 font-sans text-[10px] text-ink-700">
      {children}
    </kbd>
  );
}

/** A linha da fila: duas alturas de texto. O restante fica no título e no painel de detalhes. */
const LinhaConversa = memo(function LinhaConversa({
  conversa: c,
  canal,
  escolhida,
  novidade,
  agora,
  abrir,
  responsavel,
}: {
  conversa: Conversa;
  canal: CanalGateway | undefined;
  escolhida: boolean;
  novidade: boolean;
  agora: number;
  abrir: (c: Conversa) => void;
  /** "Você", o nome curto de quem está com a conversa, ou nulo. */
  responsavel: string | null;
}) {
  const estado = estadoConversa(c, agora);
  const nome = nomeContato(c);
  const quando = c.ultima?.em ?? c.ultima_em;
  const desde = estado === "aguardando_atendente" ? c.aguardando_atendente_desde : null;
  const urgencia = desde ? urgenciaEspera(desde, agora) : null;
  const info = canalDaConversa(c, canal);
  const unidade = c.unidade_preferida_nome || c.unidade_preferida;
  const motivo = c.aguardando_motivo ? MOTIVO_ATENDENTE[c.aguardando_motivo] : null;
  const detalhe = [
    nome,
    desde ? seloEspera(desde, agora) : ROTULO_ESTADO[estado],
    responsavel ? `Com ${responsavel === "Você" ? "você" : responsavel}` : null,
    motivo,
    textoCanal(info.tipo, info.nome),
    info.teste ? "teste" : null,
    unidade,
    c.atendimento
      ? `Atendimento #${c.atendimento.numero} · ${ROTULO_ATENDIMENTO[c.atendimento.estado]}`
      : null,
    c.pedido_aberto ? `Pedido #${c.pedido_aberto.numero}` : null,
    c.follow_up?.estado === "agendado" ? "Follow-up agendado" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      aria-current={escolhida ? "true" : undefined}
      title={detalhe}
      className={`flex w-full items-center gap-2.5 border-b border-base-200/70 px-3 py-2 text-left transition-colors [contain-intrinsic-size:auto_3.5rem] [content-visibility:auto] hover:bg-purple-50/80 focus-visible:bg-purple-50 focus-visible:outline-none ${
        escolhida ? "bg-purple-100/60" : ""
      } ${urgencia ? BARRA_URGENCIA[urgencia] : escolhida ? "shadow-[inset_3px_0_0_0_var(--purple-700)]" : ""} ${
        estado === "encerrada" ? "opacity-70" : ""
      }`}
      onClick={() => abrir(c)}
    >
      <span className="relative shrink-0">
        <Iniciais nome={nome} className="size-8" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5 text-ink-500 [&>svg]:size-3">
          <IconeCanal tipo={info.tipo} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <strong
            className={`min-w-0 flex-1 truncate text-sm leading-5 ${novidade ? "font-semibold text-ink-900" : "font-medium text-ink-700"}`}
          >
            {nome}
          </strong>
          {desde && urgencia ? (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded px-1 text-[11px] font-semibold tabular-nums ${TOM_URGENCIA[urgencia]}`}
            >
              <Clock className="size-3" aria-hidden />
              {esperaCurta(desde, agora)}
            </span>
          ) : (
            <time
              className={`shrink-0 text-[11px] tabular-nums ${novidade ? "font-semibold text-purple-800" : "text-ink-500"}`}
              dateTime={quando ?? undefined}
            >
              {tempoCurto(quando, agora)}
            </time>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <UltimaMensagemResumo conversa={c} />
          {c.pedido_aberto ? (
            <ShoppingBag className="size-3.5 shrink-0 text-purple-700" aria-label="Pedido aberto" />
          ) : null}
          {c.follow_up?.estado === "agendado" ? (
            <CalendarClock
              className="size-3.5 shrink-0 text-purple-700"
              aria-label="Follow-up agendado"
            />
          ) : null}
          {responsavel ? (
            <span
              className={`inline-flex max-w-24 shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                responsavel === "Você"
                  ? "bg-purple-700 text-base-50"
                  : "bg-purple-100 text-purple-800"
              }`}
            >
              <UserRoundCheck className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{responsavel}</span>
            </span>
          ) : estado === "atendente" || estado === "encerrada" ? (
            <SeloEstado estado={estado} />
          ) : null}
          {novidade ? (
            <span
              className="size-2 shrink-0 rounded-full bg-purple-700"
              title="Novas mensagens"
              aria-label="Novas mensagens"
            />
          ) : null}
        </span>
      </span>
    </button>
  );
});

function MarcaCanal({ conversa, canal }: { conversa: Conversa; canal: CanalGateway | undefined }) {
  const info = canalDaConversa(conversa, canal);
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 text-xs text-ink-500">
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
    <span className="block min-w-0 flex-1 truncate text-xs leading-4 text-ink-500">
      {u.autor ? <span className="font-medium text-ink-700">{u.autor}: </span> : null}
      {u.tipo ? <span className="italic">[{u.tipo}] </span> : null}
      {u.texto ?? (u.tipo ? "" : "Sem mensagem de texto")}
    </span>
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
  rascunhos,
  equipe,
}: {
  ctx: ContextoGateway;
  conversa: Conversa;
  canal: CanalGateway | undefined;
  agora: number;
  marcar: (c: Conversa) => void;
  voltar: () => void;
  /** O texto em digitação de cada conversa sobrevive à troca entre elas. */
  rascunhos: Map<string, string>;
  equipe: PessoaEquipe[];
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
  const [texto, setTexto] = useState(() => rascunhos.get(conversa.conversation_id) ?? ""),
    [minutos, setMinutos] = useState(60);
  const conversaId = conversa.conversation_id;
  const escrever = useCallback(
    (valor: string) => {
      setTexto(valor);
      if (valor) rascunhos.set(conversaId, valor);
      else rascunhos.delete(conversaId);
    },
    [rascunhos, conversaId],
  );
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
  const buscarNotas = useServerFn(listarNotas),
    gravarNota = useServerFn(criarNota),
    removerNota = useServerFn(apagarNota);
  const notas = useQuery({
    queryKey: ["conversa-notas", ctx.empresa, conversa.conversation_id, atendimentoId],
    queryFn: () =>
      buscarNotas({
        data: {
          empresa: ctx.empresa,
          conversa: conversa.conversation_id,
          ...(atendimentoId ? { atendimento: atendimentoId } : {}),
        },
      }),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const linha = linhaDoTempo(itens, notas.data?.itens ?? [], {
    temMais: mensagens.hasNextPage,
  });
  const ultimaNota = notas.data?.itens.at(-1)?.id ?? 0;
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
    ultimaNota,
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
  const deOutraPessoa = Boolean(conversa.atribuida_a) && !conversa.atribuida_minha;
  const responsavel = conversa.atribuida_a ? rotuloPessoa(conversa.atribuida_a, equipe) : null;
  const [modo, setModo] = useState<"mensagem" | "nota">("mensagem");
  const chaveNota = `nota:${conversaId}`;
  const [textoNota, setTextoNota] = useState(() => rascunhos.get(chaveNota) ?? "");
  const escreverNota = useCallback(
    (valor: string) => {
      setTextoNota(valor);
      if (valor) rascunhos.set(chaveNota, valor);
      else rascunhos.delete(chaveNota);
    },
    [rascunhos, chaveNota],
  );
  const salvarNota = useMutation({
    mutationFn: () =>
      gravarNota({ data: { empresa: ctx.empresa, conversa: conversaId, texto: textoNota } }),
    onSuccess: () => {
      escreverNota("");
      coladoNoFim.current = true;
      document.getElementById("atendimento-texto")?.focus();
      void notas.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
    retry: false,
  });
  const excluirNota = useMutation({
    mutationFn: (nota: number) =>
      removerNota({ data: { empresa: ctx.empresa, conversa: conversaId, nota } }),
    onSuccess: () => void notas.refetch(),
    onError: (e: Error) => toast.error(e.message),
    retry: false,
  });
  const atribuir = useServerFn(atribuirConversa);
  const transferir = useMutation({
    mutationFn: (para: string) =>
      atribuir({ data: { empresa: ctx.empresa, conversa: conversaId, para } }),
    onSuccess: (_, para) => {
      toast.success(`Conversa transferida para ${rotuloPessoa(para, equipe)}.`);
      void cache.invalidateQueries({ queryKey: ["conversas", ctx.empresa] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void cache.invalidateQueries({ queryKey: ["conversas", ctx.empresa] });
    },
    retry: false,
  });
  // Depois de a tela atualizar: o campo pode estar desabilitado até o modo mudar.
  const focarAoTrocar = useRef(false);
  useEffect(() => {
    if (!focarAoTrocar.current) return;
    focarAoTrocar.current = false;
    document.getElementById("atendimento-texto")?.focus();
  }, [modo]);
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key !== "i" && e.key !== "I") return;
      if (e.altKey || e.ctrlKey || e.metaKey || digitando(e.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      focarAoTrocar.current = true;
      setModo("nota");
      document.getElementById("atendimento-texto")?.focus();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  const acao = useMutation({
    mutationFn: (acao: "assumir" | "devolver" | "mensagens") =>
      atender({
        data: {
          empresa: ctx.empresa,
          conversa: conversa.conversation_id,
          acao,
          minutos,
          ...(acao === "mensagens" ? { texto } : {}),
          ...(acao === "assumir" && deOutraPessoa ? { transferir: true } : {}),
        },
      }),
    onSuccess: (r, acao) => {
      if (acao === "mensagens") {
        escrever("");
        document.getElementById("atendimento-texto")?.focus();
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
  const telaLarga = useTelaLarga();
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const unidade = conversa.unidade_preferida_nome || conversa.unidade_preferida;
  const campoTexto = useRef<HTMLTextAreaElement>(null);
  const respostas = useMenuRespostas({
    ctx,
    texto: modo === "mensagem" ? texto : "",
    escrever,
    campo: campoTexto,
    dados: { nome: primeiroNome(conversa), unidade: unidade ?? null },
  });
  const pendentes = modo === "mensagem" ? variaveisPendentes(texto) : [];
  const podeEnviar =
    Boolean(texto.trim()) && !pendentes.length && !acao.isPending && !deOutraPessoa;
  const podeNota = Boolean(textoNota.trim()) && !salvarNota.isPending;
  const emNota = modo === "nota";
  const encerrada = estado === "encerrada";
  // ESPEC_USUARIOS1: funcionário vê e assume; transferir fica a partir de supervisor.
  const podeTransferir = !encerrada && peloMenos(ctx.papel, "supervisor");
  const bloqueadaParaMim = deOutraPessoa && !podeTransferir;
  const colegas = equipe.filter(
    (p) => p.email.toLowerCase() !== conversa.atribuida_a?.toLowerCase(),
  );
  let diaAnterior = "";
  const detalhes = (
    <>
      <section aria-label="Contato" className="space-y-2 border-b border-base-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-500">
            Contato
          </h3>
          {podeEditarNome && !editando ? (
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-7 px-2 text-xs text-ink-500"
              onClick={() => setEditando(true)}
            >
              <Pencil className="size-3" aria-hidden />
              Editar nome
            </Button>
          ) : null}
        </div>
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink-900">
          <span className="min-w-0 truncate">{titulo}</span>
          <SeloOrigemNome origem={conversa.nome_origem} />
        </p>
        {editando && conversa.contato_id ? (
          <EditarNome
            ctx={ctx}
            conversa={conversa}
            contato={conversa.contato_id}
            fechar={() => setEditando(false)}
          />
        ) : null}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-xs">
          {fone && fone !== titulo ? (
            <>
              <dt className="text-ink-500">Telefone</dt>
              <dd className="truncate text-ink-900">{fone}</dd>
            </>
          ) : null}
          <dt className="text-ink-500">Canal</dt>
          <dd className="min-w-0">
            <MarcaCanal conversa={conversa} canal={canal} />
          </dd>
          {unidade ? (
            <>
              <dt className="text-ink-500">Unidade</dt>
              <dd className="truncate text-ink-900">{unidade}</dd>
            </>
          ) : null}
        </dl>
        {conversa.contato_id ? (
          <SeloOptOut
            optOut={followUps.data?.opt_out}
            podeReativar={peloMenos(ctx.papel, "gestor")}
            onReativar={(motivo) => reativar.mutate(motivo)}
          />
        ) : null}
      </section>
      {conversa.pedido_aberto ? (
        <section aria-label="Pedido aberto" className="border-b border-base-200 px-4 py-3">
          <Link
            to="/ia/pedidos"
            search={{ pedido: conversa.pedido_aberto.numero }}
            className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
            title="Abrir o pedido"
          >
            <SeloPedidoAberto pedido={conversa.pedido_aberto} />
          </Link>
        </section>
      ) : null}
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
      <BlocoFollowUp
        itens={followUps.data?.itens ?? []}
        carregando={followUps.isLoading}
        indisponivel={followUps.data?.indisponivel === true}
        erro={followUps.error instanceof Error ? followUps.error.message : undefined}
        podeCancelar={peloMenos(ctx.papel, "supervisor")}
        cancelando={cancelarFollow.isPending}
        onCancelar={() => cancelarFollow.mutate()}
      />
    </>
  );
  return (
    <>
      <section
        aria-label={`Conversa com ${titulo}`}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-base-200 bg-card px-3 py-2">
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-ml-1 size-8 shrink-0 lg:hidden"
              aria-label="Voltar para a lista"
              onClick={voltar}
            >
              <ArrowLeft aria-hidden />
            </Button>
            <Iniciais nome={titulo} className="size-8" />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="min-w-0 truncate font-sans text-sm font-semibold leading-5 text-ink-900">
                  {titulo}
                </h2>
                <SeloEstado estado={estado} />
              </div>
              <p className="flex min-w-0 items-center gap-x-1.5 truncate text-xs leading-4 text-ink-500">
                {fone && fone !== titulo ? <span className="truncate">{fone}</span> : null}
                {unidade ? <span className="truncate">· {unidade}</span> : null}
                {estado === "atendente" && conversa.bot_pausado_ate ? (
                  <span className="truncate">· até {dataHora(conversa.bot_pausado_ate)}</span>
                ) : null}
                {conversa.atribuida_minha ? (
                  <span className="shrink-0 font-medium text-purple-800">· Com você</span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center">
              <select
                aria-label="Tempo de pausa do agente ao assumir"
                title="Por quanto tempo o agente fica pausado"
                className="h-8 rounded-l-md border border-r-0 border-input bg-card px-1.5 text-xs text-ink-700"
                value={minutos}
                onChange={(e) => setMinutos(Number(e.target.value))}
              >
                {PAUSAS.map((p) => (
                  <option key={p.minutos} value={p.minutos}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
              <Button
                variant={estado === "aguardando_atendente" || deOutraPessoa ? "default" : "outline"}
                size="sm"
                className="h-8 rounded-l-none px-2.5"
                disabled={acao.isPending || bloqueadaParaMim}
                title={
                  bloqueadaParaMim
                    ? `Conversa com ${responsavel}. Peça a um supervisor para transferir.`
                    : deOutraPessoa
                      ? `Tira a conversa de ${responsavel} e passa para você`
                      : undefined
                }
                onClick={() => acao.mutate("assumir")}
              >
                {bloqueadaParaMim
                  ? "Assumir"
                  : deOutraPessoa
                    ? "Transferir para mim"
                    : conversa.atribuida_minha
                      ? "Estender"
                      : "Assumir"}
              </Button>
            </div>
            {peloMenos(ctx.papel, "supervisor") && conversa.status === "pausada" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5"
                disabled={acao.isPending}
                onClick={() => acao.mutate("devolver")}
              >
                Devolver ao agente
              </Button>
            ) : null}
            {podeTransferir ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-2.5">
                    Transferir
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-1">
                  <p className="px-2 py-1.5 text-xs font-medium text-ink-500">Passar para</p>
                  {colegas.length ? (
                    <ul className="max-h-60 overflow-y-auto">
                      {colegas.map((p) => (
                        <li key={p.email}>
                          <button
                            type="button"
                            className="w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-purple-50 disabled:opacity-60"
                            disabled={transferir.isPending}
                            onClick={() => transferir.mutate(p.email)}
                          >
                            {p.nome?.trim() || p.email}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-2 pb-2 text-xs text-ink-500">
                      Nenhuma outra pessoa cadastrada nesta empresa.
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            ) : null}
            {!telaLarga ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Abrir detalhes do contato"
                title="Contato, pedido, atendimento e follow-up"
                onClick={() => setDetalhesAbertos(true)}
              >
                <PanelRight aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
        {estado === "aguardando_atendente" && conversa.aguardando_atendente_desde ? (
          <p
            className={`shrink-0 truncate px-3 py-1 text-xs font-medium ${TOM_URGENCIA[urgenciaEspera(conversa.aguardando_atendente_desde, agora)]}`}
          >
            {seloEspera(conversa.aguardando_atendente_desde, agora)}
            {conversa.aguardando_motivo ? ` · ${MOTIVO_ATENDENTE[conversa.aguardando_motivo]}` : ""}
          </p>
        ) : null}
        {deOutraPessoa ? (
          <p className="flex shrink-0 items-center gap-1.5 bg-purple-100/70 px-3 py-1 text-xs font-medium text-purple-800">
            <UserRoundCheck className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              Com {responsavel}
              {conversa.atribuida_em ? ` desde ${horaDaMensagem(conversa.atribuida_em)}` : ""}.
              {bloqueadaParaMim
                ? " Deixe uma nota ou peça a um supervisor para transferir."
                : " Você pode deixar uma nota interna."}
            </span>
          </p>
        ) : null}
        <div className="relative min-h-0 flex-1 bg-base-100">
          <div
            ref={painel}
            onScroll={medirRolagem}
            className="absolute inset-0 space-y-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4"
            aria-label="Histórico da conversa"
          >
            {mensagens.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full bg-card text-xs"
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
              <div className="space-y-2" aria-hidden>
                <div className="h-10 w-2/3 animate-pulse rounded-xl bg-card" />
                <div className="ml-auto h-10 w-1/2 animate-pulse rounded-xl bg-purple-100" />
                <div className="h-14 w-3/5 animate-pulse rounded-xl bg-card" />
              </div>
            ) : null}
            {!mensagens.isLoading && !mensagens.isError && linha.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-500">
                Nenhuma mensagem neste recorte.
              </p>
            ) : null}
            {linha.map((item, indice) => {
              const dia = diaDaMensagem(item.em);
              const mostraDia = Boolean(dia) && dia !== diaAnterior;
              diaAnterior = dia;
              const separador = mostraDia ? (
                <div className="sticky top-0 z-[1] mb-1 flex justify-center">
                  <span className="rounded-full border border-base-200 bg-card/95 px-2 py-px text-[10px] font-medium text-ink-500">
                    {dia}
                  </span>
                </div>
              ) : null;
              if (item.tipo === "nota") {
                const n = item.nota;
                return (
                  <div key={`nota-${n.id}`} className="pb-1">
                    {separador}
                    <article
                      aria-label="Nota interna"
                      className="group mx-auto max-w-[38rem] rounded-lg border border-dashed border-gold-500/60 bg-gold-300/20 px-2.5 py-1.5"
                    >
                      <p className="flex items-center gap-1.5 text-[10px] font-medium text-gold-700">
                        <Lock className="size-3 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">
                          Nota interna · {n.minha ? "você" : rotuloPessoa(n.autor, equipe)} ·{" "}
                          {horaDaMensagem(n.criado_em)}
                        </span>
                        {n.apagavel ? (
                          <button
                            type="button"
                            className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                            aria-label="Apagar nota interna"
                            disabled={excluirNota.isPending}
                            onClick={() => {
                              if (window.confirm("Apagar esta nota interna?"))
                                excluirNota.mutate(n.id);
                            }}
                          >
                            <Trash2 className="size-3" aria-hidden />
                          </button>
                        ) : null}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-snug text-ink-900">
                        {n.texto}
                      </p>
                    </article>
                  </div>
                );
              }
              const m = item.mensagem;
              const saida = m.direcao === "saida";
              const humano = m.origem === "humano";
              const seguinte = linha[indice + 1];
              const proxima = seguinte?.tipo === "mensagem" ? seguinte.mensagem : null;
              const fechaGrupo =
                !proxima ||
                proxima.direcao !== m.direcao ||
                proxima.origem !== m.origem ||
                diaDaMensagem(proxima.enviada_em) !== dia;
              return (
                <div key={m.id} className={fechaGrupo ? "pb-1" : ""}>
                  {separador}
                  <div className={`flex ${saida ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[min(85%,38rem)] px-2.5 py-1.5 ${
                        humano
                          ? "rounded-xl rounded-br-sm bg-gold-300/35 text-ink-900"
                          : saida
                            ? "rounded-xl rounded-br-sm bg-purple-700 text-base-50"
                            : "rounded-xl rounded-bl-sm border border-base-200 bg-card text-ink-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-snug">
                        {m.conteudo ?? "Mensagem sem texto"}
                      </p>
                      {fechaGrupo ? (
                        <p
                          className={`mt-0.5 text-right text-[10px] leading-3 ${saida && !humano ? "text-purple-200" : "text-ink-500"}`}
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
              className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-base-200 bg-card px-3 py-1 text-xs font-medium text-purple-800 shadow-[0_8px_20px_rgba(46,35,64,0.12)]"
              onClick={() => irParaRecentes(true)}
            >
              <ArrowDown className="size-3.5" aria-hidden />
              Mensagens recentes
            </button>
          ) : null}
        </div>
        <form
          className="relative shrink-0 border-t border-base-200 bg-card px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (emNota) {
              if (podeNota) salvarNota.mutate();
              return;
            }
            if (podeEnviar) {
              coladoNoFim.current = true;
              acao.mutate("mensagens");
            }
          }}
        >
          <div role="tablist" aria-label="Tipo de texto" className="mb-1 flex gap-1">
            {(
              [
                ["mensagem", "Responder"],
                ["nota", "Nota interna"],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={modo === valor}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
                  modo === valor
                    ? valor === "nota"
                      ? "bg-gold-300/40 font-semibold text-gold-700"
                      : "bg-purple-100 font-semibold text-purple-800"
                    : "text-ink-500 hover:text-ink-900"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  focarAoTrocar.current = true;
                  setModo(valor);
                  document.getElementById("atendimento-texto")?.focus();
                }}
              >
                {valor === "nota" ? <Lock className="size-3" aria-hidden /> : null}
                {rotulo}
              </button>
            ))}
          </div>
          {!emNota && atendimentoId && atendimentoId !== conversa.atendimento?.id && (
            <p className="mb-1.5 text-xs text-amber-800">
              Você está consultando um atendimento anterior. Uma nova mensagem será enviada no
              atendimento atual.
            </p>
          )}
          {emNota ? null : respostas.menu}
          {pendentes.length ? (
            <p role="status" className="mb-1.5 text-xs text-amber-800">
              Complete {pendentes.join(" e ")} antes de enviar.
            </p>
          ) : null}
          <div className="flex items-end gap-1.5">
            {emNota ? null : <BotaoRespostas onClick={respostas.abrirPeloBotao} />}
            <Textarea
              id="atendimento-texto"
              ref={campoTexto}
              {...(emNota ? {} : respostas.camposDoTexto)}
              value={emNota ? textoNota : texto}
              maxLength={emNota ? LIMITE_NOTA : 20000}
              rows={1}
              disabled={!emNota && deOutraPessoa}
              className={`max-h-32 min-h-9 resize-none rounded-xl py-2 [field-sizing:content] ${
                emNota ? "border-gold-500/60 bg-gold-300/15" : "bg-base-50"
              }`}
              onChange={(e) => (emNota ? escreverNota : escrever)(e.target.value)}
              onKeyDown={(e) => {
                if (!emNota && respostas.teclado(e)) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={
                emNota
                  ? "Só a equipe vê. O cliente e o agente não recebem."
                  : deOutraPessoa
                    ? `Conversa com ${responsavel}.`
                    : "Mensagem, ou / para respostas rápidas…"
              }
              aria-label={emNota ? "Nota interna para a equipe" : "Sua mensagem ao contato"}
            />
            {emNota ? (
              <Button
                type="submit"
                variant="outline"
                className="h-9 shrink-0 rounded-full border-gold-500/60 px-3"
                disabled={!podeNota}
              >
                <Lock aria-hidden />
                {salvarNota.isPending ? "Salvando…" : "Salvar nota"}
              </Button>
            ) : (
              <Button
                type="submit"
                className="h-9 shrink-0 rounded-full px-3"
                disabled={!podeEnviar}
              >
                <Send aria-hidden />
                {acao.isPending ? "Enviando…" : "Enviar"}
              </Button>
            )}
          </div>
          <p className="mt-1 truncate text-[10px] text-ink-500">
            {emNota
              ? "Enter salva · Shift+Enter quebra a linha · Não pausa o agente"
              : "Enter envia · Shift+Enter quebra a linha · / respostas rápidas · I nota interna · Enviar pausa o agente"}
          </p>
        </form>
        {respostas.dialogo}
      </section>
      {telaLarga ? (
        <aside
          aria-label="Detalhes da conversa"
          className="w-72 shrink-0 overflow-y-auto overscroll-contain border-l border-base-200 bg-card"
        >
          {detalhes}
        </aside>
      ) : (
        <Sheet open={detalhesAbertos} onOpenChange={setDetalhesAbertos}>
          <SheetContent side="right" className="w-[22rem] max-w-[100vw] overflow-y-auto p-0">
            <SheetHeader className="border-b border-base-200 px-4 py-3 text-left">
              <SheetTitle className="text-sm">Detalhes da conversa</SheetTitle>
              <SheetDescription className="sr-only">
                Contato, pedido aberto, atendimento e follow-up.
              </SheetDescription>
            </SheetHeader>
            {detalhes}
          </SheetContent>
        </Sheet>
      )}
    </>
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
