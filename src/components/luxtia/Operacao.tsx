/** Painel da operação: o que pede ação agora, os tempos do período e o volume por atendente. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Clock, RefreshCw } from "lucide-react";
import { listarConversas, listarEquipeConversas } from "@/lib/gateway-conversas.functions";
import { lerOperacao } from "@/lib/gateway-operacao.functions";
import { pedidos } from "@/lib/gateway-pedidos.functions";
import {
  duracaoCurta,
  esperaCurta,
  MOTIVO_ATENDENTE,
  nomeContato,
  rotuloPessoa,
  urgenciaEspera,
  type UrgenciaEspera,
} from "@/lib/gateway/conversas";
import { tempoDesde, type ContagemPedidos } from "@/lib/gateway/pedidos";
import type { ContextoGateway } from "./Gateway";

const PERIODOS = [
  { dias: 1, rotulo: "24 h" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
] as const;

const TOM_ESPERA: Record<UrgenciaEspera, string> = {
  normal: "bg-gold-300/25 text-gold-700",
  atencao: "bg-gold-500/35 text-gold-700",
  critica: "bg-destructive/10 text-destructive",
};

function Indicador({
  rotulo,
  valor,
  detalhe,
  para,
  alerta = false,
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string | undefined;
  para?: "/ia/conversas" | "/ia/pedidos";
  alerta?: boolean;
}) {
  const corpo = (
    <>
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-ink-500">
        {rotulo}
        {para ? <ArrowRight className="size-3.5 shrink-0" aria-hidden /> : null}
      </span>
      <span
        className={`mt-0.5 block text-2xl font-semibold leading-tight tabular-nums ${alerta ? "text-gold-700" : "text-ink-900"}`}
      >
        {valor}
      </span>
      <span className="block truncate text-xs text-ink-500" title={detalhe}>
        {detalhe ?? " "}
      </span>
    </>
  );
  const classe = `block min-w-0 rounded-lg border bg-card px-3 py-2 ${alerta ? "border-gold-500" : "border-base-200"}`;
  return para ? (
    <Link to={para} className={`${classe} transition-colors hover:bg-purple-50`}>
      {corpo}
    </Link>
  ) : (
    <div className={classe}>{corpo}</div>
  );
}

export function Operacao({ ctx }: { ctx: ContextoGateway }) {
  const [dias, setDias] = useState<1 | 7 | 30>(7);
  const ler = useServerFn(lerOperacao);
  const lerEquipe = useServerFn(listarEquipeConversas);
  const lerFila = useServerFn(listarConversas);
  const lerPedidos = useServerFn(pedidos);
  const dados = useQuery({
    queryKey: ["operacao", ctx.empresa, dias],
    queryFn: () => ler({ data: { empresa: ctx.empresa, dias } }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const equipe = useQuery({
    queryKey: ["conversas-equipe", ctx.empresa],
    queryFn: () => lerEquipe({ data: { empresa: ctx.empresa } }),
    staleTime: 5 * 60_000,
  });
  const fila = useQuery({
    queryKey: ["operacao", ctx.empresa, "fila"],
    queryFn: () => lerFila({ data: { empresa: ctx.empresa, aguardando: true } }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  // Empresa sem o módulo de pedidos: o indicador só não aparece.
  const contagem = useQuery({
    queryKey: ["pedidos", ctx.empresa ?? "vinculada", "contagem"],
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: false,
    queryFn: async () => {
      const r = await lerPedidos({ data: { acao: "contagem", empresa: ctx.empresa } });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return r.dados as ContagemPedidos;
    },
  });
  const d = dados.data;
  const maiorVolume = Math.max(1, ...(d?.por_atendente.map((p) => p.mensagens) ?? []));
  const emFila = fila.data?.itens ?? [];
  const pedidosEsperando = contagem.data?.aguardando_loja;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 bg-card px-3 py-2">
        <div
          className="flex h-8 rounded-lg border border-base-200 bg-base-50 p-0.5"
          role="group"
          aria-label="Período"
        >
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              type="button"
              aria-pressed={dias === p.dias}
              onClick={() => setDias(p.dias)}
              className={`rounded-md px-2.5 text-xs font-medium transition-colors ${
                dias === p.dias ? "bg-purple-800 text-white" : "text-ink-700 hover:bg-base-100"
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-500">
          <RefreshCw className={`size-3 ${dados.isFetching ? "animate-spin" : ""}`} aria-hidden />
          Atualiza sozinho
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-base-100 p-3">
        {dados.isError ? (
          <p role="alert" className="rounded-lg border bg-card p-4 text-sm text-destructive">
            {dados.error.message}
          </p>
        ) : !d ? (
          <p className="text-sm text-ink-500">Carregando…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              <Indicador
                rotulo="Na fila agora"
                valor={d.agora.fila}
                detalhe={
                  d.agora.mais_antiga
                    ? `Mais antiga há ${esperaCurta(d.agora.mais_antiga)}`
                    : "Ninguém aguardando"
                }
                para="/ia/conversas"
                alerta={d.agora.fila > 0}
              />
              <Indicador
                rotulo="Com atendente"
                valor={d.agora.com_atendente}
                detalhe="Conversas com responsável"
              />
              {pedidosEsperando ? (
                <Indicador
                  rotulo="Pedidos aguardando"
                  valor={pedidosEsperando.total}
                  detalhe={
                    pedidosEsperando.mais_antigo_em
                      ? `Mais antigo ${tempoDesde(pedidosEsperando.mais_antigo_em)}`
                      : "Nenhum aguardando a loja"
                  }
                  para="/ia/pedidos"
                  alerta={pedidosEsperando.total > 0}
                />
              ) : null}
              <Indicador
                rotulo="Espera na fila"
                valor={duracaoCurta(d.periodo.espera_p50_s)}
                detalhe={
                  d.periodo.esperas
                    ? `Mediana · 95% até ${duracaoCurta(d.periodo.espera_p95_s)}`
                    : "Sem esperas no período"
                }
              />
              <Indicador
                rotulo="Tempo de resposta"
                valor={duracaoCurta(d.periodo.resposta_p50_s)}
                detalhe={
                  d.periodo.resposta_p95_s === null
                    ? "Sem respostas no período"
                    : `Mediana · 95% até ${duracaoCurta(d.periodo.resposta_p95_s)}`
                }
              />
            </div>
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <section
                aria-label="Por atendente"
                className="min-w-0 overflow-x-auto rounded-lg border border-base-200 bg-card"
              >
                <table className="w-full min-w-[34rem] text-sm">
                  <caption className="px-3 py-2 text-left text-sm font-semibold text-ink-900">
                    Por atendente
                  </caption>
                  <thead>
                    <tr className="border-y border-base-200 bg-base-50 text-left text-xs text-ink-500">
                      <th className="px-3 py-1.5 font-medium">Atendente</th>
                      <th className="px-3 py-1.5 text-right font-medium">Abertas</th>
                      <th className="w-40 px-3 py-1.5 font-medium">Mensagens</th>
                      <th className="px-3 py-1.5 text-right font-medium">Conversas</th>
                      <th className="px-3 py-1.5 text-right font-medium">Tirou da fila</th>
                      <th className="px-3 py-1.5 text-right font-medium">Resposta</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {d.por_atendente.length ? (
                      d.por_atendente.map((p) => (
                        <tr key={p.atendente} className="border-b border-base-200/70 last:border-0">
                          <td
                            className="max-w-48 truncate px-3 py-1.5 text-ink-900"
                            title={p.atendente}
                          >
                            {rotuloPessoa(p.atendente, equipe.data?.itens)}
                          </td>
                          <td className="px-3 py-1.5 text-right">{p.abertas_agora}</td>
                          <td className="px-3 py-1.5" title={`${p.mensagens} mensagens no período`}>
                            <span className="flex items-center gap-2">
                              <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-base-100">
                                <span
                                  className="block h-full rounded-full bg-purple-700"
                                  style={{ width: `${(p.mensagens / maiorVolume) * 100}%` }}
                                />
                              </span>
                              <span className="w-8 shrink-0 text-right">{p.mensagens}</span>
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right">{p.conversas}</td>
                          <td className="px-3 py-1.5 text-right">{p.esperas_assumidas}</td>
                          <td className="px-3 py-1.5 text-right">
                            {duracaoCurta(p.resposta_p50_s)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                          Nenhum atendimento humano no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
              <section
                aria-label="Fila agora"
                className="min-w-0 overflow-hidden rounded-lg border border-base-200 bg-card"
              >
                <h2 className="flex items-center justify-between border-b border-base-200 px-3 py-2 font-sans text-sm font-semibold text-ink-900">
                  Fila agora
                  <span className="text-xs font-normal tabular-nums text-ink-500">
                    {emFila.length}
                  </span>
                </h2>
                {fila.isError ? (
                  <p role="alert" className="px-3 py-3 text-sm text-destructive">
                    {fila.error.message}
                  </p>
                ) : emFila.length ? (
                  <ul className="max-h-80 divide-y divide-base-200/70 overflow-y-auto">
                    {emFila.slice(0, 20).map((c) => {
                      const desde = c.aguardando_atendente_desde;
                      return (
                        <li key={c.conversation_id}>
                          <Link
                            to="/ia/conversas"
                            search={{ conversa: c.conversation_id }}
                            className="flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-purple-50"
                            title="Abrir a conversa"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-ink-900">
                                {nomeContato(c)}
                              </span>
                              {c.aguardando_motivo ? (
                                <span className="block truncate text-xs text-ink-500">
                                  {MOTIVO_ATENDENTE[c.aguardando_motivo]}
                                </span>
                              ) : null}
                            </span>
                            {desde ? (
                              <span
                                className={`inline-flex shrink-0 items-center gap-1 rounded px-1 text-[11px] font-semibold tabular-nums ${TOM_ESPERA[urgenciaEspera(desde)]}`}
                              >
                                <Clock className="size-3" aria-hidden />
                                {esperaCurta(desde)}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-ink-500">Ninguém aguardando.</p>
                )}
              </section>
            </div>
            <p className="text-xs text-ink-500">
              Os tempos são medidos a partir da ativação deste painel. Resposta vai da fala do
              cliente até a mensagem da pessoa logo depois.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
