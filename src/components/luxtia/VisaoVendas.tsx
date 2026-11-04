/** PED-BI: Visão de vendas — faturamento, produtos, clientes, entrega e operação. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Minus,
  RefreshCw,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { lerIndicadoresPedidos } from "@/lib/gateway-pedidos-indicadores.functions";
import { FUSO_PAINEL, type Unidade } from "@/lib/gateway/gestao";
import { reais } from "@/lib/gateway/pedidos";
import {
  ATALHOS_PERIODO,
  DIAS_SEMANA,
  diaCivilNoFuso,
  deveMostrarAbaUnidades,
  erroPeriodo,
  matrizCalorHorarios,
  maximoCalor,
  minutosOuTraco,
  ordenarProdutos,
  periodoDoAtalho,
  rotuloDiaCurto,
  sentidoVariacao,
  telefoneParaBuscaConversa,
  temVendaNoPeriodo,
  textoVariacao,
  type AtalhoPeriodo,
  type IndicadoresPedidos,
  type ProdutoVendido,
} from "@/lib/pedidos-visao-vendas";
import { telefoneExibicao } from "@/lib/gateway/conversas";
import { useGestao } from "./gestao-base";
import type { ContextoGateway } from "./Gateway";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CORES_PIZZA = ["#5b21b6", "#a16207", "#15803d", "#b91c1c", "#0369a1", "#7c3aed", "#ca8a04"];

const cfgEvolucao = {
  faturamento: { label: "Faturamento", color: "#5b21b6" },
  pedidos: { label: "Pedidos", color: "#a16207" },
} satisfies ChartConfig;

function CartaoMetrica({
  rotulo,
  valor,
  variacao,
  detalhe,
}: {
  rotulo: string;
  valor: string | number;
  variacao: number | null | undefined;
  detalhe?: string;
}) {
  const sentido = sentidoVariacao(variacao);
  const texto = textoVariacao(variacao);
  const Icone = sentido === "alta" ? ArrowUpRight : sentido === "baixa" ? ArrowDownRight : Minus;
  const cor =
    sentido === "alta" ? "text-success" : sentido === "baixa" ? "text-destructive" : "text-ink-500";
  return (
    <div className="min-w-0 rounded-lg border border-base-200 bg-card px-3 py-2">
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-ink-500">
        {rotulo}
        {texto ? (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${cor}`}>
            <Icone className="size-3.5" aria-hidden />
            {texto}
          </span>
        ) : (
          <span className="sr-only">Sem comparação com o período anterior</span>
        )}
      </span>
      <span className="mt-0.5 block text-2xl font-semibold leading-tight tabular-nums text-ink-900">
        {valor}
      </span>
      <span className="block truncate text-xs text-ink-500" title={detalhe}>
        {detalhe ?? " "}
      </span>
    </div>
  );
}

function SeloCurva({ curva }: { curva: "A" | "B" | "C" }) {
  const tom =
    curva === "A"
      ? "bg-success-soft text-success"
      : curva === "B"
        ? "bg-gold-300/30 text-gold-700"
        : "bg-base-100 text-ink-700";
  return (
    <span className={`inline-flex rounded px-1.5 text-[11px] font-semibold ${tom}`} title={`Curva ${curva}`}>
      {curva}
    </span>
  );
}

function MapaCalor({ dados }: { dados: IndicadoresPedidos["horarios"] }) {
  const matriz = useMemo(() => matrizCalorHorarios(dados), [dados]);
  const max = maximoCalor(matriz);
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid min-w-full grid-cols-[2.5rem_repeat(24,minmax(0.7rem,1fr))] gap-0.5 text-[10px]">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-ink-500">
            {h}
          </span>
        ))}
        {DIAS_SEMANA.map((dia, d) => (
          <div key={dia} className="contents">
            <span className="pr-1 text-right font-medium text-ink-700">{dia}</span>
            {matriz[d]!.map((n, h) => {
              const intens = max > 0 ? n / max : 0;
              return (
                <span
                  key={h}
                  title={`${dia} ${h}h · ${n} pedido${n === 1 ? "" : "s"}`}
                  className="aspect-square rounded-sm border border-base-200"
                  style={{
                    backgroundColor:
                      n === 0 ? "transparent" : `rgba(91, 33, 182, ${0.12 + intens * 0.78})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      {max === 0 ? <p className="mt-2 text-xs text-ink-500">Sem pedidos no mapa de horário.</p> : null}
    </div>
  );
}

function Pizza({
  titulo,
  fatias,
}: {
  titulo: string;
  fatias: { chave: string; rotulo: string; valor: number }[];
}) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const cfg = Object.fromEntries(
    fatias.map((f, i) => [f.chave, { label: f.rotulo, color: CORES_PIZZA[i % CORES_PIZZA.length]! }]),
  ) satisfies ChartConfig;
  return (
    <section className="rounded-lg border border-base-200 bg-card p-3">
      <h3 className="mb-2 text-xs font-semibold text-ink-700">{titulo}</h3>
      {total === 0 ? (
        <p className="text-sm text-ink-500">Sem dados neste período.</p>
      ) : (
        <ChartContainer config={cfg} className="mx-auto aspect-square max-h-56 w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="rotulo" hideLabel />} />
            <Pie data={fatias} dataKey="valor" nameKey="rotulo" innerRadius={48} outerRadius={80}>
              {fatias.map((f, i) => (
                <Cell key={f.chave} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      )}
      <ul className="mt-2 space-y-1 text-xs text-ink-700">
        {fatias.map((f, i) => (
          <li key={f.chave} className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ background: CORES_PIZZA[i % CORES_PIZZA.length] }}
                aria-hidden
              />
              {f.rotulo}
            </span>
            <span className="tabular-nums text-ink-500">{f.valor}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TabelaClientes({
  titulo,
  itens,
  extra,
}: {
  titulo: string;
  itens: IndicadoresPedidos["clientes"]["por_valor"];
  extra?: (c: IndicadoresPedidos["clientes"]["por_valor"][number]) => string | null;
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold text-ink-700">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-ink-500">Ninguém nesta lista.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-200 bg-card">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-base-200 bg-base-50 text-xs text-ink-500">
              <tr>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Telefone</th>
                <th className="px-3 py-2 font-medium tabular-nums">Pedidos</th>
                <th className="px-3 py-2 font-medium tabular-nums">Faturamento</th>
                <th className="px-3 py-2 font-medium tabular-nums">Ticket</th>
                {extra ? <th className="px-3 py-2 font-medium">Extra</th> : null}
              </tr>
            </thead>
            <tbody>
              {itens.map((c, i) => {
                const busca = telefoneParaBuscaConversa(c.telefone);
                const fone = telefoneExibicao(c.telefone?.replace(/^\+/, "") ?? c.telefone) ?? c.telefone;
                return (
                  <tr key={`${c.telefone ?? c.nome ?? i}`} className="border-b border-base-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-ink-900">{c.nome?.trim() || "—"}</td>
                    <td className="px-3 py-2">
                      {busca ? (
                        <Link
                          to="/ia/conversas"
                          search={{ telefone: busca }}
                          className="text-purple-800 underline-offset-2 hover:underline"
                        >
                          {fone}
                        </Link>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{c.pedidos}</td>
                    <td className="px-3 py-2 tabular-nums">{reais(c.faturamento)}</td>
                    <td className="px-3 py-2 tabular-nums">{reais(c.ticket_medio)}</td>
                    {extra ? <td className="px-3 py-2 text-ink-500">{extra(c) ?? "—"}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AbaProdutos({ dados }: { dados: IndicadoresPedidos["produtos"] }) {
  const [ordem, setOrdem] = useState<"quantidade" | "faturamento">("faturamento");
  const itens = useMemo(() => ordenarProdutos(dados.itens, ordem), [dados.itens, ordem]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">Ordenar por</span>
        {(
          [
            ["faturamento", "Faturamento"],
            ["quantidade", "Quantidade"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            aria-pressed={ordem === id}
            onClick={() => setOrdem(id)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              ordem === id ? "bg-purple-800 text-white" : "bg-base-100 text-ink-700 hover:bg-base-200"
            }`}
          >
            {rotulo}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-500">
          Curva A {dados.curva.A} · B {dados.curva.B} · C {dados.curva.C}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-base-200 bg-card">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-base-200 bg-base-50 text-xs text-ink-500">
            <tr>
              <th className="px-3 py-2 font-medium">Produto</th>
              <th className="px-3 py-2 font-medium">Curva</th>
              <th className="px-3 py-2 font-medium tabular-nums">Qtd</th>
              <th className="px-3 py-2 font-medium tabular-nums">Fat.</th>
              <th className="px-3 py-2 font-medium tabular-nums">Part.</th>
              <th className="px-3 py-2 font-medium tabular-nums">Var.</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((p: ProdutoVendido) => (
              <tr key={`${p.item_id ?? p.codigo ?? p.nome}`} className="border-b border-base-100 last:border-0">
                <td className="px-3 py-2">
                  <span className="font-medium text-ink-900">{p.nome}</span>
                  {p.categoria ? (
                    <span className="mt-0.5 block text-xs text-ink-500">{p.categoria}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <SeloCurva curva={p.curva} />
                </td>
                <td className="px-3 py-2 tabular-nums">{p.quantidade}</td>
                <td className="px-3 py-2 tabular-nums">{reais(p.faturamento)}</td>
                <td className="px-3 py-2 tabular-nums text-ink-500">{p.participacao_pct}%</td>
                <td className="px-3 py-2 tabular-nums">
                  <span
                    className={
                      sentidoVariacao(p.variacao_quantidade) === "alta"
                        ? "text-success"
                        : sentidoVariacao(p.variacao_quantidade) === "baixa"
                          ? "text-destructive"
                          : "text-ink-500"
                    }
                  >
                    {textoVariacao(p.variacao_quantidade) ?? "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dados.categorias.length ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold text-ink-700">Categorias</h3>
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {dados.categorias.map((c) => (
              <li
                key={c.categoria}
                className="flex items-center justify-between gap-2 rounded-lg border border-base-200 bg-card px-3 py-2 text-sm"
              >
                <span className="truncate font-medium text-ink-900">{c.categoria}</span>
                <span className="shrink-0 tabular-nums text-ink-500">
                  {c.quantidade} · {reais(c.faturamento)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h3 className="mb-2 text-xs font-semibold text-ink-700">
          Sem venda no período
          {dados.sem_venda.total > dados.sem_venda.itens.length
            ? ` (${dados.sem_venda.itens.length} de ${dados.sem_venda.total})`
            : dados.sem_venda.total
              ? ` (${dados.sem_venda.total})`
              : ""}
        </h3>
        {dados.sem_venda.itens.length === 0 ? (
          <p className="text-sm text-ink-500">Todos os itens ativos venderam neste período.</p>
        ) : (
          <ul className="columns-1 gap-x-6 text-sm sm:columns-2 lg:columns-3">
            {dados.sem_venda.itens.map((i) => (
              <li key={i.item_id} className="mb-1 break-inside-avoid text-ink-700">
                {i.nome}
                {i.categoria ? <span className="text-ink-500"> · {i.categoria}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function VisaoVendas({ ctx }: { ctx: ContextoGateway }) {
  const g = useGestao(ctx);
  const hoje = diaCivilNoFuso();
  const padrao = periodoDoAtalho("30d", hoje)!;
  const [atalho, setAtalho] = useState<AtalhoPeriodo>("30d");
  const [de, setDe] = useState(padrao.de);
  const [ate, setAte] = useState(padrao.ate);
  const [unidade, setUnidade] = useState("");
  const [incluirTeste, setIncluirTeste] = useState(false);
  const erro = erroPeriodo(de, ate);
  const ler = useServerFn(lerIndicadoresPedidos);
  const unidades = useQuery({
    queryKey: ["gestao", ctx.empresa, "unidades"],
    queryFn: () => g.ler<{ itens: Unidade[] }>({ acao: "listar" }),
    staleTime: 60_000,
  });
  const q = useQuery({
    queryKey: ["pedidos", ctx.empresa ?? "vinculada", "indicadores", de, ate, unidade, incluirTeste],
    enabled: !erro,
    queryFn: () =>
      ler({
        data: {
          empresa: ctx.empresa,
          de,
          ate,
          incluir_teste_piloto: incluirTeste,
          ...(unidade ? { unidade } : {}),
        },
      }),
  });
  const d = q.data;

  function aplicarAtalho(id: AtalhoPeriodo) {
    setAtalho(id);
    const p = periodoDoAtalho(id, diaCivilNoFuso());
    if (p) {
      setDe(p.de);
      setAte(p.ate);
    }
  }

  const evolucao = useMemo(() => {
    if (!d) return [];
    return d.evolucao.map((e) => ({
      ...e,
      rotulo: rotuloDiaCurto(e.inicio, d.periodo.agrupar),
    }));
  }, [d]);

  const mostrarUnidades = d ? deveMostrarAbaUnidades(d.unidades) : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 bg-card px-3 py-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
          {ATALHOS_PERIODO.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={atalho === a.id}
              onClick={() => aplicarAtalho(a.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                atalho === a.id ? "bg-purple-800 text-white" : "text-ink-700 hover:bg-base-100"
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        {atalho === "livre" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="sr-only" htmlFor="vendas-de">
              De
            </label>
            <input
              id="vendas-de"
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="h-8 rounded-md border border-base-200 bg-card px-2 text-xs"
            />
            <span className="text-xs text-ink-500">até</span>
            <label className="sr-only" htmlFor="vendas-ate">
              Até
            </label>
            <input
              id="vendas-ate"
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="h-8 rounded-md border border-base-200 bg-card px-2 text-xs"
            />
          </div>
        ) : null}
        <label className="flex items-center gap-1.5 text-xs text-ink-700">
          <span className="sr-only">Unidade</span>
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            className="h-8 max-w-[12rem] rounded-md border border-base-200 bg-card px-2 text-xs"
          >
            <option value="">Todas as unidades</option>
            {(unidades.data?.itens ?? []).flatMap((u) =>
              u.codigo ? (
                <option key={u.id ?? u.codigo} value={u.codigo}>
                  {u.nome}
                </option>
              ) : (
                []
              ),
            )}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-ink-700">
          <input
            type="checkbox"
            checked={incluirTeste}
            onChange={(e) => setIncluirTeste(e.target.checked)}
            className="size-3.5 rounded border-base-200"
          />
          Incluir teste/piloto
        </label>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-500">
          <RefreshCw className={`size-3 ${q.isFetching ? "animate-spin" : ""}`} aria-hidden />
          {d ? `${d.periodo.de} → ${d.periodo.ate}` : FUSO_PAINEL}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-base-100 p-3">
        {erro ? (
          <p role="alert" className="rounded-lg border bg-card p-4 text-sm text-destructive">
            {erro}
          </p>
        ) : q.isError ? (
          <p role="alert" className="rounded-lg border bg-card p-4 text-sm text-destructive">
            {q.error instanceof Error ? q.error.message : "Não foi possível carregar os indicadores."}
          </p>
        ) : !d ? (
          <p className="text-sm text-ink-500">Carregando…</p>
        ) : !temVendaNoPeriodo(d.resumo) ? (
          <div className="mx-auto max-w-lg rounded-lg border border-base-200 bg-card p-6 text-center">
            <BarChart3 className="mx-auto size-8 text-ink-500" aria-hidden />
            <h2 className="mt-3 text-base font-semibold text-ink-900">Nenhuma venda neste período</h2>
            <p className="mt-2 text-sm text-ink-500">
              Por padrão só entram pedidos reais. Pedidos de teste e piloto ficam de fora da visão de
              vendas.
            </p>
            {!incluirTeste ? (
              <button
                type="button"
                onClick={() => setIncluirTeste(true)}
                className="mt-4 rounded-md bg-purple-800 px-3 py-2 text-sm font-medium text-white hover:bg-purple-900"
              >
                Incluir teste/piloto
              </button>
            ) : (
              <p className="mt-3 text-xs text-ink-500">
                Já incluindo teste e piloto — tente outro período ou outra unidade.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              <CartaoMetrica
                rotulo="Faturamento"
                valor={reais(d.resumo.faturamento)}
                variacao={d.variacao_pct.faturamento}
                detalhe={`Anterior ${reais(d.anterior.faturamento)}`}
              />
              <CartaoMetrica
                rotulo="Pedidos"
                valor={d.resumo.pedidos}
                variacao={d.variacao_pct.pedidos}
                detalhe={`${d.resumo.itens_vendidos} itens`}
              />
              <CartaoMetrica
                rotulo="Ticket médio"
                valor={reais(d.resumo.ticket_medio)}
                variacao={d.variacao_pct.ticket_medio}
              />
              <CartaoMetrica
                rotulo="Clientes novos"
                valor={d.resumo.clientes_novos}
                variacao={d.variacao_pct.clientes_novos}
                detalhe={`${d.resumo.clientes_recorrentes} recorrentes`}
              />
              <CartaoMetrica
                rotulo="% de perda"
                valor={d.resumo.perda_pct == null ? "—" : `${d.resumo.perda_pct}%`}
                variacao={null}
                detalhe="Recusados e cancelados"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-lg border border-base-200 bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold text-ink-700">Evolução</h3>
                <ChartContainer config={cfgEvolucao} className="aspect-[16/9] w-full">
                  <AreaChart data={evolucao} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis yAxisId="fat" hide />
                    <YAxis yAxisId="ped" orientation="right" hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      yAxisId="fat"
                      type="monotone"
                      dataKey="faturamento"
                      stroke="var(--color-faturamento)"
                      fill="var(--color-faturamento)"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Area
                      yAxisId="ped"
                      type="monotone"
                      dataKey="pedidos"
                      stroke="var(--color-pedidos)"
                      fill="var(--color-pedidos)"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </section>
              <section className="rounded-lg border border-base-200 bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold text-ink-700">Quando vende</h3>
                <MapaCalor dados={d.horarios} />
              </section>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Pizza
                titulo="Pagamentos"
                fatias={d.pagamentos.map((p) => ({
                  chave: p.forma,
                  rotulo: p.rotulo || p.forma,
                  valor: p.pedidos,
                }))}
              />
              <Pizza
                titulo="Delivery × retirada"
                fatias={[
                  {
                    chave: "delivery",
                    rotulo: "Delivery",
                    valor: d.resumo.modalidade.delivery.pedidos,
                  },
                  {
                    chave: "retirada",
                    rotulo: "Retirada",
                    valor: d.resumo.modalidade.retirada.pedidos,
                  },
                ]}
              />
            </div>

            <section className="rounded-lg border border-dashed border-base-200 bg-card/60 p-3">
              <h3 className="mb-2 text-xs font-semibold text-ink-700">Fora da venda</h3>
              <p className="mb-2 text-xs text-ink-500">
                Aguardando, recusado e cancelado não entram no faturamento.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    ["aguardando_loja", "Aguardando"],
                    ["recusado", "Recusado"],
                    ["cancelado", "Cancelado"],
                  ] as const
                ).map(([chave, rotulo]) => {
                  const bloco = d.resumo.fora_da_venda[chave] ?? { pedidos: 0, valor: 0 };
                  return (
                    <div key={chave} className="rounded-md border border-base-200 bg-card px-3 py-2">
                      <span className="text-xs text-ink-500">{rotulo}</span>
                      <span className="mt-0.5 block text-lg font-semibold tabular-nums text-ink-900">
                        {bloco.pedidos}
                      </span>
                      <span className="text-xs text-ink-500">{reais(bloco.valor)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <Tabs defaultValue="produtos" className="space-y-3">
              <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                {(
                  [
                    ["produtos", "Produtos"],
                    ["clientes", "Clientes"],
                    ["entrega", "Entrega"],
                    ["operacao", "Operação"],
                    ...(mostrarUnidades ? ([["unidades", "Unidades"]] as const) : []),
                  ] as const
                ).map(([id, rotulo]) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className="rounded-md border border-transparent data-[state=active]:border-base-200 data-[state=active]:bg-card"
                  >
                    {rotulo}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="produtos" className="mt-0">
                <AbaProdutos dados={d.produtos} />
              </TabsContent>

              <TabsContent value="clientes" className="mt-0 space-y-4">
                <TabelaClientes titulo="Por valor" itens={d.clientes.por_valor} />
                <TabelaClientes titulo="Por frequência" itens={d.clientes.por_frequencia} />
                <TabelaClientes
                  titulo={`Sumidos (${d.clientes.sumidos.dias} dias sem comprar · ${d.clientes.sumidos.total})`}
                  itens={d.clientes.sumidos.itens}
                  extra={(c) =>
                    typeof c.dias_sem_comprar === "number"
                      ? `${c.dias_sem_comprar} dias sem comprar`
                      : null
                  }
                />
              </TabsContent>

              <TabsContent value="entrega" className="mt-0">
                {d.bairros.length === 0 ? (
                  <p className="text-sm text-ink-500">Nenhum bairro com delivery neste período.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-base-200 bg-card">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="border-b border-base-200 bg-base-50 text-xs text-ink-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Bairro</th>
                          <th className="px-3 py-2 font-medium tabular-nums">Pedidos</th>
                          <th className="px-3 py-2 font-medium tabular-nums">Faturamento</th>
                          <th className="px-3 py-2 font-medium tabular-nums">Taxa média</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.bairros.map((b) => (
                          <tr key={b.bairro} className="border-b border-base-100 last:border-0">
                            <td className="px-3 py-2 font-medium">{b.bairro}</td>
                            <td className="px-3 py-2 tabular-nums">{b.pedidos}</td>
                            <td className="px-3 py-2 tabular-nums">{reais(b.faturamento)}</td>
                            <td className="px-3 py-2 tabular-nums">{reais(b.taxa_media)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="operacao" className="mt-0 space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["aceite", "Aceite"],
                      ["preparo", "Preparo"],
                      ["total", "Total"],
                    ] as const
                  ).map(([chave, rotulo]) => {
                    const t = d.operacao[chave];
                    return (
                      <div key={chave} className="rounded-lg border border-base-200 bg-card px-3 py-2">
                        <span className="text-xs font-medium text-ink-500">{rotulo}</span>
                        <p className="mt-1 text-sm text-ink-900">
                          Mediana <strong className="tabular-nums">{minutosOuTraco(t.mediana_min)}</strong>
                        </p>
                        <p className="text-xs text-ink-500">
                          90% dos pedidos · {minutosOuTraco(t.p90_min)} · {t.pedidos} medidos
                        </p>
                      </div>
                    );
                  })}
                </div>
                <section>
                  <h3 className="mb-2 text-xs font-semibold text-ink-700">Motivos de perda</h3>
                  {d.operacao.motivos_perda.length === 0 ? (
                    <p className="text-sm text-ink-500">Nenhum recusado ou cancelado no período.</p>
                  ) : (
                    <ul className="space-y-1">
                      {d.operacao.motivos_perda.map((m) => (
                        <li
                          key={`${m.status}-${m.motivo}`}
                          className="flex items-center justify-between gap-2 rounded-md border border-base-200 bg-card px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            <span className="text-ink-500">{m.status === "recusado" ? "Recusado" : "Cancelado"} · </span>
                            {m.motivo}
                          </span>
                          <span className="shrink-0 tabular-nums font-medium">{m.pedidos}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </TabsContent>

              {mostrarUnidades ? (
                <TabsContent value="unidades" className="mt-0">
                  <div className="overflow-x-auto rounded-lg border border-base-200 bg-card">
                    <table className="w-full min-w-[32rem] text-left text-sm">
                      <thead className="border-b border-base-200 bg-base-50 text-xs text-ink-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Unidade</th>
                          <th className="px-3 py-2 font-medium tabular-nums">Pedidos</th>
                          <th className="px-3 py-2 font-medium tabular-nums">Faturamento</th>
                          <th className="px-3 py-2 font-medium tabular-nums">Ticket</th>
                          <th className="px-3 py-2 font-medium tabular-nums">Recebidos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.unidades.map((u) => (
                          <tr key={u.unidade} className="border-b border-base-100 last:border-0">
                            <td className="px-3 py-2 font-medium">{u.nome}</td>
                            <td className="px-3 py-2 tabular-nums">{u.pedidos}</td>
                            <td className="px-3 py-2 tabular-nums">{reais(u.faturamento)}</td>
                            <td className="px-3 py-2 tabular-nums">{reais(u.ticket_medio)}</td>
                            <td className="px-3 py-2 tabular-nums">{u.recebidos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              ) : null}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
