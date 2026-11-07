/** IFOOD1-b2: financeiro do iFood — resumo, a receber, repasses e coleta. */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  atualizarFinanceiroIfood,
  lerFinanceiroIfood,
  listarLojasIfoodEmpresa,
} from "@/lib/gateway-ifood.functions";
import { reais } from "@/lib/gateway/pedidos";
import {
  CARTOES_RESUMO,
  algumaColetando,
  mensagemErroColeta,
  rotuloStatusRepasse,
  rotuloTipoRepasse,
  type FinanceiroIfood,
} from "@/lib/ifood-financeiro";
import type { ListaLojasEmpresaIfood } from "@/lib/ifood-lojas";
import { diaCivilNoFuso, periodoDoAtalho, type AtalhoPeriodo } from "@/lib/pedidos-visao-vendas";
import { dataHora, type ContextoGateway } from "./Gateway";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const cfgDia = {
  creditos: { label: "Créditos", color: "#15803d" },
  debitos: { label: "Débitos", color: "#b91c1c" },
  repasse: { label: "Repasse", color: "#5b21b6" },
} satisfies ChartConfig;

const cfgForma = {
  valor: { label: "Valor", color: "#0369a1" },
} satisfies ChartConfig;

const ATALHOS: { id: AtalhoPeriodo; rotulo: string }[] = [
  { id: "7d", rotulo: "7 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "livre", rotulo: "Datas livres" },
];

function Cartao({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-base-200 bg-card px-3 py-2">
      <span className="text-xs font-medium text-ink-500">{rotulo}</span>
      <span className="mt-0.5 block text-2xl font-semibold leading-tight tabular-nums text-ink-900">
        {valor}
      </span>
      {detalhe ? <span className="block text-xs text-ink-500">{detalhe}</span> : null}
    </div>
  );
}

export function IfoodFinanceiro({ ctx }: { ctx: ContextoGateway }) {
  const cache = useQueryClient();
  const hoje = diaCivilNoFuso();
  const padrao = periodoDoAtalho("30d", hoje)!;
  const [atalho, setAtalho] = useState<AtalhoPeriodo>("30d");
  const [de, setDe] = useState(padrao.de);
  const [ate, setAte] = useState(padrao.ate);
  const [loja, setLoja] = useState("");
  const ler = useServerFn(lerFinanceiroIfood);
  const atualizar = useServerFn(atualizarFinanceiroIfood);
  const listarLojas = useServerFn(listarLojasIfoodEmpresa);

  const lojas = useQuery({
    queryKey: ["ifood", ctx.empresa ?? "vinculada", "lojas"],
    queryFn: async () => {
      const r = await listarLojas({ data: { empresa: ctx.empresa } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as ListaLojasEmpresaIfood;
    },
    staleTime: 60_000,
  });

  const q = useQuery({
    queryKey: ["ifood", ctx.empresa ?? "vinculada", "financeiro", de, ate, loja],
    queryFn: async () => {
      const r = await ler({
        data: {
          empresa: ctx.empresa,
          de,
          ate,
          ...(loja ? { loja } : {}),
        },
      });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as FinanceiroIfood;
    },
  });

  const coletando = q.data ? algumaColetando(q.data.coletas) : false;

  // Coleta automática ao abrir: a resposta vem com o que já há; recarrega em alguns segundos.
  useEffect(() => {
    if (!coletando && q.data && q.data.resumo.eventos === 0 && q.data.coletas.length > 0) {
      const t = window.setTimeout(() => void q.refetch(), 4000);
      return () => window.clearTimeout(t);
    }
    if (coletando) {
      const t = window.setTimeout(() => void q.refetch(), 5000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [coletando, q.data?.resumo.eventos, q.data?.coletas.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const mut = useMutation({
    mutationFn: async () => {
      const r = await atualizar({ data: { empresa: ctx.empresa } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r;
    },
    onSuccess: (r) => {
      toast.success(
        r && "coletando" in r && r.coletando
          ? "Coleta iniciada. Atualize em alguns segundos."
          : "Nenhuma loja para coletar.",
      );
      window.setTimeout(() => {
        void cache.invalidateQueries({
          queryKey: ["ifood", ctx.empresa ?? "vinculada", "financeiro"],
        });
      }, 3000);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function aplicarAtalho(id: AtalhoPeriodo) {
    setAtalho(id);
    const p = periodoDoAtalho(id, diaCivilNoFuso());
    if (p) {
      setDe(p.de);
      setAte(p.ate);
    }
  }

  const d = q.data;
  const porDia = useMemo(
    () =>
      (d?.por_dia ?? []).map((x) => ({
        ...x,
        // Débitos já vêm negativos; no gráfico usamos o valor absoluto da barra de débito.
        debitosAbs: Math.abs(x.debitos),
        rotulo: x.data.slice(5),
      })),
    [d],
  );
  const porForma = useMemo(
    () =>
      (d?.por_forma ?? []).map((x) => ({
        ...x,
        rotulo: x.bandeira ? `${x.forma} ${x.bandeira}` : x.forma,
      })),
    [d],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 bg-card px-3 py-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
          {ATALHOS.map((a) => (
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
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="h-8 rounded-md border border-base-200 bg-card px-2 text-xs"
              aria-label="De"
            />
            <span className="text-xs text-ink-500">até</span>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="h-8 rounded-md border border-base-200 bg-card px-2 text-xs"
              aria-label="Até"
            />
          </div>
        ) : null}
        <label className="flex items-center gap-1.5 text-xs text-ink-700">
          <span className="sr-only">Loja</span>
          <select
            value={loja}
            onChange={(e) => setLoja(e.target.value)}
            className="h-8 max-w-[12rem] rounded-md border border-base-200 bg-card px-2 text-xs"
          >
            <option value="">Todas as lojas</option>
            {(lojas.data?.itens ?? []).map((l) => (
              <option key={l.merchant_id} value={l.merchant_id}>
                {l.nome || l.merchant_id}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-500">
          <RefreshCw className={`size-3 ${q.isFetching || coletando ? "animate-spin" : ""}`} aria-hidden />
          {coletando ? "Coletando…" : d ? `${d.periodo.de} → ${d.periodo.ate}` : "—"}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-base-100 p-3">
        {q.isError ? (
          <p role="alert" className="rounded-lg border bg-card p-4 text-sm text-destructive">
            {q.error.message}
          </p>
        ) : !d ? (
          <p className="text-sm text-ink-500">Carregando…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {CARTOES_RESUMO.map((c) => (
                <Cartao
                  key={c.chave}
                  rotulo={c.rotulo}
                  valor={reais(d.resumo[c.chave])}
                  detalhe={
                    c.chave === "creditos"
                      ? `${d.resumo.pedidos} pedidos · ${d.resumo.eventos} eventos`
                      : undefined
                  }
                />
              ))}
            </div>

            <section className="rounded-lg border border-base-200 bg-card p-3">
              <h3 className="mb-1 text-xs font-semibold text-ink-700">A receber</h3>
              <p className="mb-2 text-2xl font-semibold tabular-nums text-ink-900">
                {reais(d.a_receber.total)}
              </p>
              {d.a_receber.por_data.length === 0 ? (
                <p className="text-xs text-ink-500">Nenhuma data prevista a partir de hoje.</p>
              ) : (
                <ul className="divide-y divide-base-200 text-sm">
                  {d.a_receber.por_data.map((x) => (
                    <li key={x.data} className="flex justify-between gap-2 py-1.5">
                      <span className="text-ink-700">{x.data}</span>
                      <span className="tabular-nums font-medium text-ink-900">{reais(x.valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-base-200 bg-card p-3">
              <h3 className="mb-2 text-xs font-semibold text-ink-700">Repasses</h3>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Cartao rotulo="Pago" valor={reais(d.repasses.pago)} />
                <Cartao rotulo="Pendente" valor={reais(d.repasses.pendente)} />
                <Cartao rotulo="Retido em recebíveis" valor={reais(d.repasses.retido_recebiveis)} />
                <Cartao rotulo="Boletos" valor={reais(d.repasses.boletos)} />
              </div>
              {d.repasses.renegociado ? (
                <p className="mb-2 text-xs text-ink-500">
                  Renegociado: {reais(d.repasses.renegociado)}
                </p>
              ) : null}
              {d.repasses.itens.length === 0 ? (
                <p className="text-xs text-ink-500">Nenhum título no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-xs">
                    <thead className="text-ink-500">
                      <tr className="border-b border-base-200">
                        <th className="py-1.5 pr-2 font-medium">Tipo</th>
                        <th className="py-1.5 pr-2 font-medium">Valor</th>
                        <th className="py-1.5 pr-2 font-medium">Status</th>
                        <th className="py-1.5 pr-2 font-medium">Pagamento</th>
                        <th className="py-1.5 font-medium">Período</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.repasses.itens.map((t) => (
                        <tr key={t.titulo} className="border-b border-base-100">
                          <td className="py-1.5 pr-2 text-ink-900">{rotuloTipoRepasse(t.tipo)}</td>
                          <td className="py-1.5 pr-2 tabular-nums">{reais(t.valor)}</td>
                          <td className="py-1.5 pr-2">{rotuloStatusRepasse(t.status)}</td>
                          <td className="py-1.5 pr-2 tabular-nums">{t.pagamento_em || "—"}</td>
                          <td className="py-1.5 tabular-nums text-ink-500">
                            {t.periodo_inicio && t.periodo_fim
                              ? `${t.periodo_inicio} → ${t.periodo_fim}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-lg border border-base-200 bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold text-ink-700">Por dia</h3>
                {porDia.length === 0 ? (
                  <p className="text-xs text-ink-500">Sem eventos no período.</p>
                ) : (
                  <ChartContainer config={cfgDia} className="aspect-[16/9] w-full">
                    <AreaChart data={porDia} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={20} />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="creditos"
                        stroke="var(--color-creditos)"
                        fill="var(--color-creditos)"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="debitosAbs"
                        name="debitos"
                        stroke="var(--color-debitos)"
                        fill="var(--color-debitos)"
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="repasse"
                        stroke="var(--color-repasse)"
                        fill="var(--color-repasse)"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </section>
              <section className="rounded-lg border border-base-200 bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold text-ink-700">Por forma de pagamento</h3>
                {porForma.length === 0 ? (
                  <p className="text-xs text-ink-500">Sem créditos no período.</p>
                ) : (
                  <ChartContainer config={cfgForma} className="aspect-[16/9] w-full">
                    <BarChart data={porForma} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="rotulo" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="valor" fill="var(--color-valor)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                )}
              </section>
            </div>

            <section className="rounded-lg border border-base-200 bg-card p-3">
              <h3 className="mb-2 text-xs font-semibold text-ink-700">Por tipo de evento</h3>
              {d.por_tipo.length === 0 ? (
                <p className="text-xs text-ink-500">Sem eventos no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-left text-xs">
                    <thead className="text-ink-500">
                      <tr className="border-b border-base-200">
                        <th className="py-1.5 pr-2 font-medium">Nome</th>
                        <th className="py-1.5 pr-2 font-medium">Descrição</th>
                        <th className="py-1.5 pr-2 font-medium">Eventos</th>
                        <th className="py-1.5 font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.por_tipo.map((t, i) => (
                        <tr key={`${t.nome}-${i}`} className="border-b border-base-100">
                          <td className="py-1.5 pr-2 font-medium text-ink-900">{t.nome}</td>
                          <td className="py-1.5 pr-2 text-ink-500">{t.descricao || "—"}</td>
                          <td className="py-1.5 pr-2 tabular-nums">{t.eventos}</td>
                          <td className="py-1.5 tabular-nums">{reais(t.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <footer className="rounded-lg border border-dashed border-base-200 bg-card/60 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-ink-700">Coleta</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mut.isPending || coletando}
                  onClick={() => mut.mutate()}
                >
                  <RefreshCw
                    className={`size-3.5 ${mut.isPending || coletando ? "animate-spin" : ""}`}
                    aria-hidden
                  />
                  Atualizar
                </Button>
              </div>
              {d.coletas.length === 0 ? (
                <p className="text-xs text-ink-500">Nenhuma loja do iFood ligada a esta empresa.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {d.coletas.map((c) => {
                    const erroMsg = mensagemErroColeta(c.erro);
                    return (
                      <li
                        key={c.loja}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-base-200 bg-card px-2.5 py-2"
                      >
                        <span className="font-medium text-ink-900">{c.nome || c.loja}</span>
                        <span className="text-ink-500">
                          {c.coletando
                            ? "Coletando…"
                            : c.sucesso_em
                              ? `Último sucesso: ${dataHora(c.sucesso_em)}`
                              : "Ainda sem coleta"}
                        </span>
                        {erroMsg ? (
                          <span role="alert" className="w-full text-destructive">
                            {erroMsg}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
