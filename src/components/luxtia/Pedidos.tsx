import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Bike,
  Clock,
  LayoutGrid,
  List,
  MapPin,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { peloMenos } from "@/lib/acesso/papeis";
import { avisos } from "@/lib/gateway-avisos.functions";
import { pedidos } from "@/lib/gateway-pedidos.functions";
import {
  COLUNAS_PEDIDO,
  ORIGENS_PEDIDO,
  ROTULO_FILTRO_ORIGEM,
  ROTULO_STATUS,
  acoesPedido,
  nomeClientePedido,
  reais,
  textoPagamento,
  rotuloCanalPedido,
  rotuloOrigemPedido,
  tempoDesde,
  textoAviso,
  whatsappPedido,
  type ContagemPedidos,
  type OrigemPedido,
  type PedidoDetalhe,
  type PedidoLista,
  type StatusPedido,
} from "@/lib/gateway/pedidos";
import { FUSO_PAINEL, periodoNoFuso, type Unidade } from "@/lib/gateway/gestao";
import { dataHora, type ContextoGateway } from "./Gateway";
import { useGestao } from "./gestao-base";
import { textoCanal } from "@/lib/gateway/conversas";
import { IconeCanal, SeloOrigemNome } from "./Conversas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { definirSomPedido, somPedidoLigado } from "@/lib/pedidos-som";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Filtros = {
  status: StatusPedido[];
  /** Vazio = todas as origens; padrão da tela = só reais. */
  origem: OrigemPedido[];
  unidade: string;
  modalidade: "" | "delivery" | "retirada";
  desde: string;
  ate: string;
  busca: string;
};

const VAZIO: Filtros = {
  status: [],
  // Todas as origens. O padrão "só reais" escondia o quadro inteiro enquanto a
  // empresa está em piloto (nenhum pedido nasce como real) e os anteriores
  // ficaram marcados como teste.
  origem: [],
  unidade: "",
  modalidade: "",
  desde: "",
  ate: "",
  busca: "",
};

type IdColuna = (typeof COLUNAS_PEDIDO)[number]["id"];

/** Cor de cada status; só aparência, a regra continua no gateway. */
const TOM_STATUS: Record<StatusPedido, { ponto: string; selo: string }> = {
  aguardando_loja: { ponto: "bg-gold-500", selo: "bg-gold-300/30 text-gold-700" },
  confirmado: { ponto: "bg-purple-500", selo: "bg-purple-50 text-purple-700" },
  em_preparo: { ponto: "bg-purple-700", selo: "bg-purple-100 text-purple-800" },
  pronto_retirada: { ponto: "bg-success", selo: "bg-success-soft text-success" },
  saiu_entrega: { ponto: "bg-success", selo: "bg-success-soft text-success" },
  concluido: { ponto: "bg-ink-500", selo: "bg-base-100 text-ink-700" },
  recusado: { ponto: "bg-destructive", selo: "bg-destructive/10 text-destructive" },
  cancelado: { ponto: "bg-destructive", selo: "bg-destructive/10 text-destructive" },
};

const campo =
  "h-10 w-full rounded-lg border border-base-200 bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-purple-300";

export function Pedidos({ ctx, abrir }: { ctx: ContextoGateway; abrir?: string | undefined }) {
  const g = useGestao(ctx);
  const [filtros, setFiltros] = useState<Filtros>(VAZIO);
  const [busca, setBusca] = useState("");
  const [visao, setVisao] = useState<"quadro" | "lista">("quadro");
  const [coluna, setColuna] = useState<IdColuna>("aguardando");
  const [verFiltros, setVerFiltros] = useState(false);
  // Atalho vindo da conversa (?pedido=…): abre o detalhe direto.
  const [numero, setNumero] = useState<string | null>(abrir ?? null);
  const [agora, setAgora] = useState(Date.now());
  const [usuario, setUsuario] = useState("local");
  const [som, setSom] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => ({ ...f, busca })), 350);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id ?? "local";
      setUsuario(id);
      setSom(somPedidoLigado(id));
    });
  }, []);
  const fuso = useQuery({
    queryKey: ["gestao", ctx.empresa, "fuso"],
    queryFn: () =>
      g.ler<{ timezone: string; origem: "empresa" | "padrao" }>({ acao: "fuso_empresa" }),
    staleTime: 60_000,
  });
  const unidades = useQuery({
    queryKey: ["gestao", ctx.empresa, "unidades"],
    queryFn: () => g.ler<{ itens: Unidade[] }>({ acao: "listar" }),
    staleTime: 20_000,
  });
  const zona = fuso.data?.timezone ?? FUSO_PAINEL;
  let periodo: { desde?: string; ate?: string; erro?: string } = {};
  if (filtros.desde && filtros.ate && filtros.desde > filtros.ate)
    periodo = { erro: "A data inicial precisa ser anterior ou igual à final." };
  else {
    try {
      periodo = periodoNoFuso(filtros.desde || undefined, filtros.ate || undefined, zona);
    } catch (e) {
      periodo = { erro: e instanceof Error ? e.message : "Confira o período." };
    }
  }
  const consulta = {
    ...(filtros.origem.length ? { origem: filtros.origem } : {}),
    ...(filtros.unidade ? { unidade: filtros.unidade } : {}),
    ...(filtros.modalidade ? { modalidade: filtros.modalidade } : {}),
    ...(periodo.desde ? { desde: periodo.desde } : {}),
    ...(periodo.ate ? { ate: periodo.ate } : {}),
    ...(filtros.busca.trim().length >= 2 ? { busca: filtros.busca.trim() } : {}),
  };
  const pausa = Boolean(periodo.erro) || !fuso.isFetched;
  const origemPadrao = filtros.origem.length === 0;
  const ativos =
    (origemPadrao ? 0 : 1) +
    (filtros.unidade ? 1 : 0) +
    (filtros.modalidade ? 1 : 0) +
    (filtros.desde || filtros.ate ? 1 : 0) +
    (visao === "lista" ? filtros.status.length : 0);
  const nomeUnidade = unidades.data?.itens.find((u) => u.codigo === filtros.unidade)?.nome;

  return (
    <div className="mt-4 space-y-3">
      <Indicadores
        ctx={ctx}
        onEscolher={(id) => {
          setVisao("quadro");
          setColuna(id);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500"
            aria-hidden
          />
          <Input
            value={busca}
            maxLength={100}
            aria-label="Buscar pedido"
            placeholder="Buscar por número, nome ou telefone"
            className="h-10 rounded-lg pl-9"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div
          role="group"
          aria-label="Modo de exibição"
          className="flex h-10 rounded-lg border border-base-200 bg-card p-0.5"
        >
          {(
            [
              ["quadro", "Quadro", LayoutGrid],
              ["lista", "Lista", List],
            ] as const
          ).map(([id, rotulo, Icone]) => (
            <button
              key={id}
              type="button"
              aria-pressed={visao === id}
              onClick={() => setVisao(id)}
              className={`flex items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
                visao === id ? "bg-purple-800 text-white" : "text-ink-700 hover:bg-base-100"
              }`}
            >
              <Icone className="size-4" aria-hidden />
              <span className="hidden sm:inline">{rotulo}</span>
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          className="h-10 gap-1.5 rounded-lg"
          aria-expanded={verFiltros}
          onClick={() => setVerFiltros((v) => !v)}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          <span className="hidden sm:inline">Filtros</span>
          {ativos > 0 ? (
            <span className="rounded-full bg-purple-800 px-1.5 text-[11px] font-semibold text-white">
              {ativos}
            </span>
          ) : null}
        </Button>
        <Button
          variant="outline"
          className="h-10 rounded-lg px-3"
          aria-pressed={som}
          title={som ? "Som de pedido novo ligado" : "Som de pedido novo desligado"}
          onClick={() => {
            setSom(!som);
            definirSomPedido(usuario, !som);
            toast.message(som ? "Som de pedido novo desligado." : "Som de pedido novo ligado.");
          }}
        >
          {som ? (
            <Bell className="size-4 text-purple-800" aria-hidden />
          ) : (
            <BellOff className="size-4 text-ink-500" aria-hidden />
          )}
          <span className="sr-only">Som de pedido novo</span>
        </Button>
      </div>

      {verFiltros ? (
        <div className="rounded-xl border border-base-200 bg-card p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs font-medium text-ink-500">
              Unidade
              <select
                className={campo}
                value={filtros.unidade}
                onChange={(e) => setFiltros({ ...filtros, unidade: e.target.value })}
              >
                <option value="">Todas as unidades</option>
                {unidades.data?.itens.flatMap((u) =>
                  u.codigo ? (
                    <option key={u.id} value={u.codigo}>
                      {u.nome}
                    </option>
                  ) : (
                    []
                  ),
                )}
              </select>
            </label>
            <fieldset className="space-y-1 text-xs font-medium text-ink-500 sm:col-span-2">
              <legend>Origem</legend>
              <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Origem">
                <button
                  type="button"
                  aria-pressed={filtros.origem.length === 0}
                  onClick={() => setFiltros({ ...filtros, origem: [] })}
                  className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                    filtros.origem.length === 0
                      ? "border-purple-800 bg-purple-800 text-white"
                      : "border-base-200 text-ink-700 hover:bg-base-100"
                  }`}
                >
                  Todas
                </button>
                {ORIGENS_PEDIDO.map((o) => {
                  const marcado = filtros.origem.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() =>
                        setFiltros({
                          ...filtros,
                          origem: marcado
                            ? filtros.origem.filter((x) => x !== o)
                            : [...filtros.origem, o],
                        })
                      }
                      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                        marcado
                          ? "border-purple-800 bg-purple-800 text-white"
                          : "border-base-200 text-ink-700 hover:bg-base-100"
                      }`}
                    >
                      {ROTULO_FILTRO_ORIGEM[o]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="space-y-1 text-xs font-medium text-ink-500">
              Entrega ou retirada
              <select
                className={campo}
                value={filtros.modalidade}
                onChange={(e) =>
                  setFiltros({ ...filtros, modalidade: e.target.value as Filtros["modalidade"] })
                }
              >
                <option value="">Entrega e retirada</option>
                <option value="delivery">Entrega</option>
                <option value="retirada">Retirada</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-ink-500">
              De
              <input
                type="date"
                className={campo}
                value={filtros.desde}
                onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-ink-500">
              Até
              <input
                type="date"
                className={campo}
                value={filtros.ate}
                onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })}
              />
            </label>
          </div>
          {visao === "lista" ? (
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Status">
              {(Object.keys(ROTULO_STATUS) as StatusPedido[]).map((s) => {
                const marcado = filtros.status.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() =>
                      setFiltros({
                        ...filtros,
                        status: marcado
                          ? filtros.status.filter((x) => x !== s)
                          : [...filtros.status, s],
                      })
                    }
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                      marcado
                        ? "border-purple-800 bg-purple-800 text-white"
                        : "border-base-200 text-ink-700 hover:bg-base-100"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${TOM_STATUS[s].ponto}`} />
                    {ROTULO_STATUS[s]}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
            <span>
              {fuso.data?.origem === "empresa"
                ? `Datas no fuso da empresa (${zona}); o dia final entra.`
                : "Fuso da empresa indisponível; as datas usam Brasília e o dia final entra."}
            </span>
            {ativos > 0 ? (
              <button
                type="button"
                className="font-medium text-purple-800 hover:underline"
                onClick={() => setFiltros({ ...VAZIO, busca: filtros.busca })}
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
        </div>
      ) : ativos > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {!origemPadrao ? (
            <Ficha onTirar={() => setFiltros({ ...filtros, origem: [] })}>
              {filtros.origem.length === 0
                ? "Todas as origens"
                : filtros.origem.map((o) => ROTULO_FILTRO_ORIGEM[o]).join(", ")}
            </Ficha>
          ) : null}
          {filtros.unidade ? (
            <Ficha onTirar={() => setFiltros({ ...filtros, unidade: "" })}>
              {nomeUnidade ?? filtros.unidade}
            </Ficha>
          ) : null}
          {filtros.modalidade ? (
            <Ficha onTirar={() => setFiltros({ ...filtros, modalidade: "" })}>
              {filtros.modalidade === "delivery" ? "Entrega" : "Retirada"}
            </Ficha>
          ) : null}
          {filtros.desde || filtros.ate ? (
            <Ficha onTirar={() => setFiltros({ ...filtros, desde: "", ate: "" })}>
              {filtros.desde || "…"} a {filtros.ate || "…"}
            </Ficha>
          ) : null}
          {visao === "lista"
            ? filtros.status.map((s) => (
                <Ficha
                  key={s}
                  onTirar={() =>
                    setFiltros({ ...filtros, status: filtros.status.filter((x) => x !== s) })
                  }
                >
                  {ROTULO_STATUS[s]}
                </Ficha>
              ))
            : null}
        </div>
      ) : null}

      {periodo.erro ? (
        <p role="alert" className="text-sm text-destructive">
          {periodo.erro}
        </p>
      ) : null}

      {visao === "quadro" ? (
        <>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
            {COLUNAS_PEDIDO.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={coluna === c.id}
                onClick={() => setColuna(c.id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium ${
                  coluna === c.id
                    ? "border-purple-800 bg-purple-800 text-white"
                    : "border-base-200 bg-card text-ink-700"
                }`}
              >
                <span className={`size-2 rounded-full ${TOM_STATUS[c.status[0]].ponto}`} />
                {c.rotulo}
              </button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            {COLUNAS_PEDIDO.map((c) => (
              <div key={c.id} className={coluna === c.id ? "block" : "hidden lg:block"}>
                <Coluna
                  ctx={ctx}
                  titulo={c.rotulo}
                  status={[...c.status]}
                  consulta={consulta}
                  agora={agora}
                  pausa={pausa}
                  onAbrir={setNumero}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <Lista
          ctx={ctx}
          status={filtros.status}
          consulta={consulta}
          agora={agora}
          pausa={pausa}
          onAbrir={setNumero}
        />
      )}
      <Detalhe ctx={ctx} numero={numero} fechar={() => setNumero(null)} />
    </div>
  );
}

function Ficha({ children, onTirar }: { children: React.ReactNode; onTirar: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-purple-50 pl-3 pr-1 text-xs font-medium text-purple-800">
      {children}
      <button
        type="button"
        onClick={onTirar}
        className="rounded-full p-1 hover:bg-purple-100"
        aria-label="Tirar filtro"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

function Indicadores({
  ctx,
  onEscolher,
}: {
  ctx: ContextoGateway;
  onEscolher: (id: IdColuna) => void;
}) {
  const fn = useServerFn(pedidos);
  const q = useQuery({
    queryKey: ["pedidos", ctx.empresa ?? "vinculada", "contagem"],
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const r = await fn({ data: { acao: "contagem", empresa: ctx.empresa } });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return r.dados as ContagemPedidos;
    },
  });
  if (q.isLoading)
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  if (!q.data) return null;
  const a = q.data.em_andamento ?? {};
  const novos = q.data.aguardando_loja.total;
  const itens: { id: IdColuna; rotulo: string; valor: number; detalhe?: string }[] = [
    {
      id: "aguardando",
      rotulo: "Aguardando loja",
      valor: novos,
      ...(novos > 0 && q.data.aguardando_loja.mais_antigo_em
        ? { detalhe: `mais antigo ${tempoDesde(q.data.aguardando_loja.mais_antigo_em)}` }
        : {}),
    },
    { id: "confirmado", rotulo: "Confirmados", valor: a["confirmado"] ?? 0 },
    { id: "preparo", rotulo: "Em preparo", valor: a["em_preparo"] ?? 0 },
    {
      id: "saida",
      rotulo: "Prontos / saíram",
      valor: (a["pronto_retirada"] ?? 0) + (a["saiu_entrega"] ?? 0),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {itens.map((i) => {
        const destaque = i.id === "aguardando" && i.valor > 0;
        return (
          <button
            key={i.id}
            type="button"
            onClick={() => onEscolher(i.id)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              destaque
                ? "border-gold-500 bg-gold-300/20 hover:bg-gold-300/30"
                : "border-base-200 bg-card hover:bg-base-100"
            }`}
          >
            <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-500">
              {i.rotulo}
            </span>
            <span className="flex items-baseline gap-2">
              <span
                className={`font-display text-2xl leading-tight ${destaque ? "text-gold-700" : "text-purple-800"}`}
              >
                {i.valor}
              </span>
              {i.detalhe ? (
                <span className="truncate text-xs text-gold-700">{i.detalhe}</span>
              ) : null}
            </span>
          </button>
        );
      })}
      <div
        className={`col-span-2 rounded-xl border px-3 py-2.5 sm:col-span-1 ${
          q.data.avisos_com_falha > 0
            ? "border-destructive/30 bg-destructive/5"
            : "border-base-200 bg-card"
        }`}
      >
        <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-500">
          Avisos com falha
        </span>
        <span
          className={`flex items-center gap-1.5 font-display text-2xl leading-tight ${
            q.data.avisos_com_falha > 0 ? "text-destructive" : "text-purple-800"
          }`}
        >
          {q.data.avisos_com_falha > 0 ? <AlertTriangle className="size-4" aria-hidden /> : null}
          {q.data.avisos_com_falha}
        </span>
      </div>
    </div>
  );
}

function usePagina(
  ctx: ContextoGateway,
  status: StatusPedido[],
  consulta: {
    origem?: OrigemPedido[];
    unidade?: string;
    modalidade?: "delivery" | "retirada";
    desde?: string;
    ate?: string;
    busca?: string;
  },
  pausa: boolean,
  limite: number,
) {
  const fn = useServerFn(pedidos);
  return useInfiniteQuery({
    queryKey: ["pedidos", ctx.empresa ?? "vinculada", "lista", status, consulta, limite],
    enabled: !pausa,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const r = await fn({
        data: {
          acao: "listar",
          empresa: ctx.empresa,
          ...(status.length ? { status } : {}),
          ...consulta,
          cursor: pageParam,
          limite,
        },
      });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return r.dados as { itens: PedidoLista[]; proximo_cursor: number | null };
    },
    getNextPageParam: (p) => p.proximo_cursor,
  });
}

type PropsLista = {
  ctx: ContextoGateway;
  status: StatusPedido[];
  consulta: Parameters<typeof usePagina>[2];
  agora: number;
  pausa: boolean;
  onAbrir: (numero: string) => void;
};

function Coluna({ titulo, ...p }: PropsLista & { titulo: string }) {
  const q = usePagina(p.ctx, p.status, p.consulta, p.pausa, 20);
  const itens = q.data?.pages.flatMap((pg) => pg.itens) ?? [];
  const primeiro = p.status[0] ?? "concluido";
  return (
    <section className="flex flex-col rounded-xl bg-base-100/70 p-2 lg:max-h-[calc(100vh-15rem)]">
      <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
        <span className={`size-2 rounded-full ${TOM_STATUS[primeiro].ponto}`} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-700">{titulo}</h2>
        {q.isSuccess ? (
          <span className="rounded-full bg-card px-2 text-xs font-semibold text-ink-700">
            {itens.length}
            {q.hasNextPage ? "+" : ""}
          </span>
        ) : null}
      </header>
      <div className="space-y-2 overflow-y-auto pr-0.5 lg:min-h-24">
        {q.isLoading || q.isPending ? (
          <>
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </>
        ) : null}
        {q.isError ? (
          <p role="alert" className="px-1.5 text-xs text-destructive">
            {q.error.message}
          </p>
        ) : null}
        {q.isSuccess && itens.length === 0 ? (
          <p className="rounded-lg border border-dashed border-base-200 px-3 py-6 text-center text-xs text-ink-500">
            Nenhum pedido
          </p>
        ) : null}
        {itens.map((pedido) => (
          <CartaoPedido
            key={pedido.id}
            pedido={pedido}
            agora={p.agora}
            onAbrir={() => p.onAbrir(pedido.numero)}
          />
        ))}
        {q.hasNextPage ? (
          <Button
            className="min-h-10 w-full"
            variant="ghost"
            disabled={q.isFetchingNextPage}
            onClick={() => void q.fetchNextPage()}
          >
            {q.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function Lista(p: PropsLista) {
  const q = usePagina(p.ctx, p.status, p.consulta, p.pausa, 50);
  const itens = q.data?.pages.flatMap((pg) => pg.itens) ?? [];
  return (
    <div className="overflow-hidden rounded-xl border border-base-200 bg-card">
      <div className="hidden grid-cols-[90px_minmax(0,1.4fr)_minmax(0,1fr)_120px_minmax(0,9rem)_110px_90px] gap-3 border-b border-base-200 bg-base-100/60 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-500 md:grid">
        <span>Pedido</span>
        <span>Cliente</span>
        <span>Unidade</span>
        <span>Status</span>
        <span>Pagamento</span>
        <span className="text-right">Total</span>
        <span className="text-right">Entrou</span>
      </div>
      {q.isLoading || q.isPending ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : null}
      {q.isError ? (
        <p role="alert" className="p-4 text-sm text-destructive">
          {q.error.message}
        </p>
      ) : null}
      {q.isSuccess && itens.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-500">
          Nenhum pedido com esses filtros.
        </p>
      ) : null}
      <ul className="divide-y divide-base-200">
        {itens.map((pedido) => (
          <li key={pedido.id}>
            <LinhaPedido pedido={pedido} agora={p.agora} onAbrir={() => p.onAbrir(pedido.numero)} />
          </li>
        ))}
      </ul>
      {q.hasNextPage ? (
        <div className="border-t border-base-200 p-2">
          <Button
            className="min-h-10 w-full"
            variant="ghost"
            disabled={q.isFetchingNextPage}
            onClick={() => void q.fetchNextPage()}
          >
            {q.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SeloStatus({ status }: { status: StatusPedido }) {
  const tom = TOM_STATUS[status] ?? TOM_STATUS.concluido;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tom.selo}`}
    >
      <span className={`size-1.5 rounded-full ${tom.ponto}`} />
      {ROTULO_STATUS[status] ?? status}
    </span>
  );
}

function IconeModalidade({ modalidade }: { modalidade: PedidoLista["modalidade"] }) {
  if (modalidade === "delivery") return <Bike className="size-3.5" aria-label="Entrega" />;
  if (modalidade === "retirada") return <Store className="size-3.5" aria-label="Retirada" />;
  return null;
}

/** Etiqueta discreta de origem/canal do pedido (Piloto, Teste, API…). */
function EtiquetaOrigemCanal({ origem, canal }: { origem?: string | null; canal?: string | null }) {
  const o = rotuloOrigemPedido(origem);
  const c = rotuloCanalPedido(canal);
  // Real + WhatsApp é o caso comum: não polui a lista.
  const partes: string[] = [];
  if (o && origem !== "real") partes.push(o);
  if (c && canal !== "whatsapp") partes.push(c);
  if (partes.length === 0) return null;
  return (
    <span
      className="inline-flex items-center rounded border border-base-200 bg-base-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500"
      title={[o, c].filter(Boolean).join(" · ")}
    >
      {partes.join(" · ")}
    </span>
  );
}

/** Indicador compacto do aviso ao cliente: enviado, falhou ou desligado. */
function MarcaAviso({ status }: { status: string | null | undefined }) {
  const texto = textoAviso(status);
  if (!texto) return null;
  const cor =
    status === "falhou"
      ? "text-destructive"
      : status === "enviado" || status === "simulado"
        ? "text-success"
        : "text-ink-500";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${cor}`} title={texto}>
      <MessageCircle className="size-3" aria-hidden />
      {texto.replace(/^Aviso /, "")}
    </span>
  );
}

function CartaoPedido({
  pedido,
  agora,
  onAbrir,
}: {
  pedido: PedidoLista;
  agora: number;
  onAbrir: () => void;
}) {
  const cliente = nomeClientePedido(pedido.cliente);
  const novo = pedido.status === "aguardando_loja";
  const minutos = (agora - Date.parse(pedido.criado_em)) / 60000;
  const atrasado = novo && minutos >= 15;
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`group block w-full rounded-lg border bg-card p-3 text-left shadow-[0_1px_2px_rgba(26,21,32,0.05)] transition hover:-translate-y-px hover:border-purple-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 ${
        novo ? "border-l-4 border-base-200 border-l-gold-500" : "border-base-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="font-semibold text-purple-800">#{pedido.numero}</span>
          <EtiquetaOrigemCanal origem={pedido.origem ?? null} canal={pedido.canal ?? null} />
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${
            atrasado ? "text-destructive" : "text-ink-500"
          }`}
        >
          <Clock className="size-3" aria-hidden />
          {tempoDesde(pedido.criado_em, agora).replace(/^há /, "")}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-ink-700">
        {pedido.cliente?.canal ? (
          <span className="shrink-0 text-ink-500">
            <IconeCanal tipo={pedido.cliente.canal.tipo || pedido.cliente.canal.icone} />
          </span>
        ) : null}
        <span className="truncate">{cliente.nome}</span>
      </p>
      {cliente.temNome && cliente.fone ? (
        <p className="truncate text-xs text-ink-500">{cliente.fone}</p>
      ) : null}
      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-ink-500">
        <IconeModalidade modalidade={pedido.modalidade} />
        <span className="truncate">
          {pedido.unidade_nome || pedido.unidade || "Unidade não informada"}
          {pedido.horario ? ` · ${pedido.horario}` : ""}
        </span>
      </p>
      <p className="mt-1 truncate text-xs text-ink-700">{textoPagamento(pedido.pagamento)}</p>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-base-200 pt-2">
        <span className="text-xs text-ink-500">
          {pedido.numero_itens} {pedido.numero_itens === 1 ? "item" : "itens"}
        </span>
        <MarcaAviso status={pedido.aviso?.status} />
        <span className="text-sm font-semibold text-ink-700">{reais(pedido.total)}</span>
      </div>
    </button>
  );
}

function LinhaPedido({
  pedido,
  agora,
  onAbrir,
}: {
  pedido: PedidoLista;
  agora: number;
  onAbrir: () => void;
}) {
  const cliente = nomeClientePedido(pedido.cliente);
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left text-sm transition-colors hover:bg-purple-50/60 focus-visible:bg-purple-50 focus-visible:outline-none md:grid-cols-[90px_minmax(0,1.4fr)_minmax(0,1fr)_120px_minmax(0,9rem)_110px_90px]"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-purple-800">
        #{pedido.numero}
        <EtiquetaOrigemCanal origem={pedido.origem ?? null} canal={pedido.canal ?? null} />
      </span>
      <span className="text-right font-semibold md:order-last md:hidden">
        {reais(pedido.total)}
      </span>
      <span className="col-span-2 flex min-w-0 items-center gap-1.5 md:col-span-1">
        {pedido.cliente?.canal ? (
          <span className="shrink-0 text-ink-500">
            <IconeCanal tipo={pedido.cliente.canal.tipo || pedido.cliente.canal.icone} />
          </span>
        ) : null}
        <span className="truncate">
          {cliente.nome}
          {cliente.temNome && cliente.fone ? (
            <span className="text-ink-500"> · {cliente.fone}</span>
          ) : null}
        </span>
      </span>
      <span className="col-span-2 flex min-w-0 items-center gap-1.5 text-ink-500 md:col-span-1">
        <IconeModalidade modalidade={pedido.modalidade} />
        <span className="truncate">{pedido.unidade_nome || pedido.unidade || "—"}</span>
      </span>
      <span className="flex items-center gap-2">
        <SeloStatus status={pedido.status} />
      </span>
      <span className="col-span-2 truncate text-xs text-ink-700 md:col-span-1 md:text-sm">
        {textoPagamento(pedido.pagamento)}
      </span>
      <span className="hidden text-right font-semibold md:block">{reais(pedido.total)}</span>
      <span className="text-right text-xs text-ink-500">
        {tempoDesde(pedido.criado_em, agora).replace(/^há /, "")}
      </span>
    </button>
  );
}

function Detalhe({
  ctx,
  numero,
  fechar,
}: {
  ctx: ContextoGateway;
  numero: string | null;
  fechar: () => void;
}) {
  const fn = useServerFn(pedidos);
  const cache = useQueryClient();
  const [acao, setAcao] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [previsao, setPrevisao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    setAcao(null);
    setMotivo("");
    setPrevisao("");
    setErro(null);
  }, [numero]);
  const q = useQuery({
    queryKey: ["pedidos", ctx.empresa ?? "vinculada", "detalhe", numero],
    enabled: Boolean(numero),
    queryFn: async () => {
      const r = await fn({ data: { acao: "detalhe", empresa: ctx.empresa, numero: numero ?? "" } });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return r.dados as PedidoDetalhe;
    },
  });
  const reenviarFn = useServerFn(avisos);
  async function reenviar(status: string, incerto: boolean) {
    if (
      !numero ||
      ocupado ||
      !window.confirm(
        incerto
          ? "O cliente pode já ter recebido este aviso. Reenviar mesmo assim?"
          : "Reenviar este aviso ao cliente?",
      )
    )
      return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await reenviarFn({
        data: {
          acao: "reenviar",
          empresa: ctx.empresa,
          numero,
          status,
          ...(incerto ? { mesmo_incerto: true } : {}),
        },
      });
      if (!r.ok) setErro(r.erro.mensagem);
      else toast.success("Aviso colocado na fila de envio.");
      await cache.invalidateQueries({ queryKey: ["pedidos", ctx.empresa ?? "vinculada"] });
    } catch {
      setErro("Não foi possível confirmar o reenvio. Atualize o pedido antes de tentar novamente.");
    } finally {
      setOcupado(false);
    }
  }
  const pedido = q.data;
  const botoes = acoesPedido(pedido?.proximos_status ?? []).filter(
    (b) => b.status !== "cancelado" || peloMenos(ctx.papel, "supervisor"),
  );
  const principais = botoes.filter((b) => b.status !== "cancelado" && b.status !== "recusado");
  const negativas = botoes.filter((b) => b.status === "cancelado" || b.status === "recusado");
  const escolhida = botoes.find((b) => b.status === acao);
  async function enviar(status: string) {
    const botao = botoes.find((b) => b.status === status);
    if (!botao || !numero) return;
    const textoPrevisao = previsao.trim();
    const minutos = textoPrevisao ? Number(textoPrevisao) : undefined;
    if (minutos !== undefined && (!Number.isInteger(minutos) || minutos < 1 || minutos > 600)) {
      setErro("A previsão é um número de minutos, de 1 a 600.");
      return;
    }
    if (botao.motivo === "obrigatorio" && motivo.trim().length < 3) {
      setErro("O cancelamento precisa de um motivo com pelo menos 3 caracteres.");
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      const r = await fn({
        data: {
          acao: "status",
          empresa: ctx.empresa,
          numero,
          status,
          ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
          ...(botao.previsao && minutos !== undefined ? { previsao_min: minutos } : {}),
        },
      });
      if (!r.ok) {
        setErro(r.erro.mensagem);
        if (r.erro.mensagem === "Este pedido já foi atualizado") {
          toast.message("Este pedido já foi atualizado");
          await q.refetch();
          await cache.invalidateQueries({ queryKey: ["pedidos", ctx.empresa ?? "vinculada"] });
          setAcao(null);
        }
        return;
      }
      toast.success(`Pedido #${numero}: ${botao.rotulo.toLowerCase()}.`);
      setAcao(null);
      setMotivo("");
      setPrevisao("");
      await cache.invalidateQueries({ queryKey: ["pedidos", ctx.empresa ?? "vinculada"] });
    } finally {
      setOcupado(false);
    }
  }
  const fone = whatsappPedido(pedido?.cliente?.telefone);
  const cliente = pedido ? nomeClientePedido(pedido.cliente) : null;
  const horario = pedido?.entrega?.horario || pedido?.horario;
  const endereco = pedido?.entrega?.endereco || pedido?.endereco;
  const observacao = pedido?.entrega?.observacao || pedido?.observacao;
  return (
    <Sheet open={Boolean(numero)} onOpenChange={(a) => !a && !ocupado && fechar()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="space-y-1 border-b border-base-200 px-5 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <SheetTitle className="font-display text-2xl text-purple-800">
              Pedido #{numero}
            </SheetTitle>
            {pedido ? <SeloStatus status={pedido.status} /> : null}
            {pedido ? (
              <EtiquetaOrigemCanal origem={pedido.origem ?? null} canal={pedido.canal ?? null} />
            ) : null}
          </div>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
            {pedido ? (
              <>
                <span>{pedido.unidade_nome || "Unidade não informada"}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <IconeModalidade modalidade={pedido.modalidade} />
                  {pedido.modalidade === "delivery" ? "Entrega" : "Retirada"}
                </span>
                {rotuloCanalPedido(pedido.canal) ? (
                  <>
                    <span>·</span>
                    <span>{rotuloCanalPedido(pedido.canal)}</span>
                  </>
                ) : null}
                <span>·</span>
                <span>entrou {tempoDesde(pedido.criado_em)}</span>
                {pedido.previsao_min ? (
                  <>
                    <span>·</span>
                    <span>previsão {pedido.previsao_min} min</span>
                  </>
                ) : null}
              </>
            ) : (
              "Carregando…"
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {q.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ) : null}
          {q.isError ? (
            <p role="alert" className="text-destructive">
              {q.error.message}
            </p>
          ) : null}
          {pedido ? (
            <>
              <section className="flex items-start justify-between gap-3 rounded-lg bg-base-100/70 p-3">
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 font-semibold text-ink-700">
                    <span className="truncate">{cliente?.nome}</span>
                    <SeloOrigemNome origem={cliente?.origem} />
                  </p>
                  {cliente?.temNome && fone ? <p className="text-ink-500">{fone}</p> : null}
                  {pedido.cliente?.canal ? (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-500">
                      <IconeCanal tipo={pedido.cliente.canal.tipo || pedido.cliente.canal.icone} />
                      {textoCanal(pedido.cliente.canal.tipo, pedido.cliente.canal.nome)}
                    </p>
                  ) : null}
                </div>
                {pedido.conversation_id ? (
                  <Button asChild variant="outline" size="sm" className="min-h-9 shrink-0">
                    <Link
                      to="/ia/conversas"
                      search={{
                        conversa: pedido.conversation_id,
                        ...(cliente?.temNome ? { nome: cliente.nome } : {}),
                        ...(pedido.cliente?.telefone && peloMenos(ctx.papel, "supervisor")
                          ? { telefone: pedido.cliente.telefone }
                          : {}),
                        ...(pedido.cliente?.canal?.tipo
                          ? { canal: pedido.cliente.canal.tipo }
                          : {}),
                      }}
                    >
                      <MessageCircle className="size-4" aria-hidden />
                      Conversa
                    </Link>
                  </Button>
                ) : null}
              </section>

              {endereco || horario || observacao ? (
                <section className="space-y-1">
                  {endereco ? (
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
                      {endereco}
                    </p>
                  ) : null}
                  {horario ? (
                    <p className="flex items-center gap-2">
                      <Clock className="size-4 shrink-0 text-ink-500" aria-hidden />
                      {horario}
                    </p>
                  ) : null}
                  {observacao ? (
                    <p className="rounded-md bg-gold-300/20 px-2 py-1 text-gold-700">
                      {observacao}
                    </p>
                  ) : null}
                </section>
              ) : null}

              <section className="rounded-lg bg-base-100/70 p-3">
                <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                  Pagamento
                </h3>
                <p className="font-medium text-ink-700">{textoPagamento(pedido.pagamento)}</p>
              </section>

              <section>
                <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                  Itens
                </h3>
                <ul className="divide-y divide-base-200 rounded-lg border border-base-200">
                  {(pedido.itens ?? []).map((item, i) => (
                    <li key={`${item.codigo}-${i}`} className="flex gap-3 px-3 py-2">
                      <span className="w-7 shrink-0 font-semibold text-purple-800">
                        {item.quantidade}×
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{item.nome}</span>
                        {item.observacao ? (
                          <span className="block text-xs text-ink-500">{item.observacao}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-ink-700">{reais(item.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-2 space-y-0.5 px-1 text-ink-500">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd>{reais(pedido.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Taxa de entrega</dt>
                    <dd>{reais(pedido.taxa_entrega)}</dd>
                  </div>
                  <div className="flex justify-between text-base font-semibold text-ink-700">
                    <dt>Total</dt>
                    <dd>{reais(pedido.total)}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                  Linha do tempo
                </h3>
                <ol className="relative space-y-3 border-l border-base-200 pl-4">
                  {(pedido.linha_do_tempo ?? []).map((ev, i) => {
                    const st = ev.para as StatusPedido;
                    return (
                      <li key={`${ev.em}-${i}`} className="relative">
                        <span
                          className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-card ${
                            TOM_STATUS[st]?.ponto ?? "bg-ink-500"
                          }`}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-x-2">
                          <span className="font-medium text-ink-700">
                            {ROTULO_STATUS[st] ?? ev.para}
                          </span>
                          <span className="text-xs text-ink-500">{dataHora(ev.em)}</span>
                        </div>
                        <p className="text-xs text-ink-500">
                          {ev.por || "Autor não informado"}
                          {ev.previsao_min ? ` · previsão ${ev.previsao_min} min` : ""}
                        </p>
                        {ev.motivo ? (
                          <p className="text-xs italic text-ink-700">“{ev.motivo}”</p>
                        ) : null}
                        <MarcaAviso status={ev.aviso?.status} />
                        {ev.aviso?.status === "falhou" && ev.aviso.pode_reenviar ? (
                          <Button
                            className="ml-2 min-h-11"
                            variant="outline"
                            size="sm"
                            disabled={ocupado}
                            onClick={() => void reenviar(ev.para, ev.aviso?.incerto === true)}
                          >
                            Reenviar aviso
                          </Button>
                        ) : null}
                        {ev.aviso?.erro ? (
                          <span className="ml-1 text-[11px] text-destructive">
                            ({ev.aviso.erro})
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </section>
            </>
          ) : null}
        </div>

        {pedido ? (
          <footer className="space-y-2 border-t border-base-200 bg-card px-5 py-3">
            {escolhida && (escolhida.motivo || escolhida.previsao) ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviar(escolhida.status);
                }}
              >
                {escolhida.previsao ? (
                  <label className="block text-xs font-medium text-ink-500">
                    Previsão em minutos (opcional)
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {[20, 30, 45, 60].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPrevisao(String(m))}
                          className={`h-9 rounded-md border px-3 text-sm ${
                            previsao === String(m)
                              ? "border-purple-800 bg-purple-800 text-white"
                              : "border-base-200 text-ink-700 hover:bg-base-100"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                      <Input
                        inputMode="numeric"
                        value={previsao}
                        placeholder="Outro"
                        className="h-9 w-24"
                        onChange={(e) => setPrevisao(e.target.value)}
                      />
                    </div>
                  </label>
                ) : null}
                {escolhida.motivo ? (
                  <label className="block text-xs font-medium text-ink-500">
                    Motivo{escolhida.motivo === "obrigatorio" ? " (obrigatório)" : " (opcional)"}
                    <Textarea
                      autoFocus
                      rows={2}
                      value={motivo}
                      maxLength={300}
                      className="mt-1"
                      onChange={(e) => setMotivo(e.target.value)}
                    />
                  </label>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    disabled={ocupado}
                    onClick={() => {
                      setAcao(null);
                      setErro(null);
                    }}
                  >
                    Voltar
                  </Button>
                  <Button
                    className="min-h-11 flex-1"
                    variant={escolhida.motivo === "obrigatorio" ? "destructive" : "default"}
                    disabled={ocupado}
                  >
                    {ocupado ? "Enviando…" : `Confirmar: ${escolhida.rotulo.toLowerCase()}`}
                  </Button>
                </div>
              </form>
            ) : botoes.length ? (
              <div className="flex flex-wrap gap-2">
                {principais.map((b, i) => (
                  <Button
                    key={b.status}
                    className="min-h-11 flex-1"
                    variant={i === 0 ? "default" : "outline"}
                    disabled={ocupado}
                    onClick={() => {
                      setAcao(b.status);
                      setErro(null);
                      if (!b.motivo && !b.previsao) void enviar(b.status);
                    }}
                  >
                    {b.rotulo}
                  </Button>
                ))}
                {negativas.map((b) => (
                  <Button
                    key={b.status}
                    className="min-h-11 text-destructive hover:text-destructive"
                    variant="ghost"
                    disabled={ocupado}
                    onClick={() => {
                      setAcao(b.status);
                      setErro(null);
                    }}
                  >
                    {b.rotulo}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-ink-500">
                Pedido encerrado, sem próximos passos.
              </p>
            )}
            {erro ? (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            ) : null}
          </footer>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
