/** IFOOD1-b1: lista e detalhe de pedidos do iFood (só acompanhamento). */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  atualizarPedidosIfood,
  lerPedidoIfood,
  listarPedidosIfood,
  listarLojasIfoodEmpresa,
} from "@/lib/gateway-ifood.functions";
import { reais } from "@/lib/gateway/pedidos";
import { temFinanceiroPedido } from "@/lib/ifood-financeiro";
import {
  INTERVALO_PEDIDOS_IFOOD_MS,
  TEXTO_ACOMPANHAMENTO_IFOOD,
  pedidoIfoodPendente,
  rotuloStatusIfood,
  type ListaPedidosIfood,
  type PedidoIfoodDetalhe,
  type PedidoIfoodLista,
} from "@/lib/ifood-pedidos";
import type { ListaLojasEmpresaIfood } from "@/lib/ifood-lojas";
import { dataHora, type ContextoGateway } from "./Gateway";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState } from "react";

const STATUS_FILTRO = [
  { id: "PLACED", rotulo: "Novo" },
  { id: "CONFIRMED", rotulo: "Confirmado" },
  { id: "READY_TO_PICKUP", rotulo: "Pronto" },
  { id: "DISPATCHED", rotulo: "Saiu para entrega" },
  { id: "CONCLUDED", rotulo: "Concluído" },
  { id: "CANCELLED", rotulo: "Cancelado" },
] as const;

function SeloTeste() {
  return (
    <span className="inline-flex rounded bg-gold-300/40 px-1.5 text-[11px] font-semibold text-gold-700">
      Teste
    </span>
  );
}

function SeloStatus({ status }: { status: string }) {
  const cancelado = status === "CANCELLED";
  return (
    <span
      className={`inline-flex rounded px-1.5 text-[11px] font-semibold ${
        cancelado ? "bg-destructive/10 text-destructive" : "bg-base-100 text-ink-700"
      }`}
    >
      {rotuloStatusIfood(status)}
    </span>
  );
}

function LinhaPedido({
  p,
  onAbrir,
}: {
  p: PedidoIfoodLista;
  onAbrir: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(p.order_id)}
      className="flex w-full flex-col gap-1 border-b border-base-200 px-3 py-2.5 text-left hover:bg-base-100 sm:flex-row sm:items-center sm:gap-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold tabular-nums text-ink-900">
            {p.numero ? `#${p.numero}` : p.order_id.slice(0, 8)}
          </span>
          <SeloStatus status={p.status} />
          {p.teste ? <SeloTeste /> : null}
          {pedidoIfoodPendente(p) ? (
            <span className="text-[11px] font-medium text-ink-500">Detalhe pendente</span>
          ) : null}
        </div>
        <p className="truncate text-sm text-ink-700">
          {p.cliente_nome || "Cliente"}
          {p.bairro ? ` · ${p.bairro}` : ""}
          {p.tipo ? ` · ${p.tipo}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-baseline gap-3 text-sm">
        <span className="text-xs text-ink-500">{dataHora(p.criado_em)}</span>
        <span className="font-semibold tabular-nums text-ink-900">
          {p.total == null ? "—" : reais(p.total)}
        </span>
        <span className="text-xs text-ink-500">{p.numero_itens} it.</span>
      </div>
    </button>
  );
}

function PainelDetalhe({
  empresa,
  orderId,
  onFechar,
  onAtualizado,
}: {
  empresa: string | undefined;
  orderId: string | null;
  onFechar: () => void;
  onAtualizado: () => void;
}) {
  const ler = useServerFn(lerPedidoIfood);
  const atualizar = useServerFn(atualizarPedidosIfood);
  const q = useQuery({
    queryKey: ["ifood", empresa ?? "vinculada", "pedido", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const r = await ler({ data: { empresa, order_id: orderId! } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as PedidoIfoodDetalhe;
    },
  });
  const mut = useMutation({
    mutationFn: async () => {
      const r = await atualizar({ data: { empresa } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r;
    },
    onSuccess: (r) => {
      toast.success(
        r && "detalhados" in r
          ? `Atualizados: ${r.detalhados}. Ainda pendentes: ${r.pendentes}.`
          : "Atualização concluída.",
      );
      void q.refetch();
      onAtualizado();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const d = q.data;

  return (
    <Sheet open={!!orderId} onOpenChange={(a) => !a && onFechar()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {d?.numero ? `Pedido #${d.numero}` : orderId ? `Pedido ${orderId.slice(0, 8)}` : "Pedido"}
          </SheetTitle>
          <SheetDescription>{TEXTO_ACOMPANHAMENTO_IFOOD}</SheetDescription>
        </SheetHeader>

        {q.isError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {q.error.message}
          </p>
        ) : q.isLoading || !d ? (
          <p className="mt-4 text-sm text-ink-500">Carregando…</p>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <SeloStatus status={d.status} />
              {d.teste ? <SeloTeste /> : null}
              <span className="text-xs text-ink-500">{dataHora(d.criado_em)}</span>
            </div>

            {pedidoIfoodPendente(d) ? (
              <div className="rounded-md border border-dashed border-base-200 bg-base-100 px-3 py-2">
                <p className="text-sm font-medium text-ink-900">Detalhe pendente</p>
                <p className="mt-1 text-xs text-ink-500">
                  O iFood ainda não devolveu os itens deste pedido. Tente atualizar.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  disabled={mut.isPending}
                  onClick={() => mut.mutate()}
                >
                  <RefreshCw className={`size-3.5 ${mut.isPending ? "animate-spin" : ""}`} aria-hidden />
                  Atualizar
                </Button>
              </div>
            ) : null}

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-ink-500">Cliente</dt>
              <dd className="text-ink-900">{d.cliente_nome || "—"}</dd>
              <dt className="text-ink-500">Bairro</dt>
              <dd className="text-ink-900">{d.bairro || "—"}</dd>
              <dt className="text-ink-500">Tipo</dt>
              <dd className="text-ink-900">{d.tipo || "—"}</dd>
              <dt className="text-ink-500">Canal</dt>
              <dd className="text-ink-900">{d.canal_venda || "—"}</dd>
              <dt className="text-ink-500">Loja</dt>
              <dd className="truncate text-ink-900" title={d.loja}>
                {d.loja}
              </dd>
            </dl>

            {d.itens?.length ? (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-ink-700">Itens</h3>
                <ul className="divide-y divide-base-200 rounded-md border border-base-200">
                  {d.itens.map((it, i) => (
                    <li key={`${it.nome}-${i}`} className="px-2.5 py-2">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-ink-900">
                          {it.quantidade ?? "?"}× {it.nome || "Item"}
                        </span>
                        <span className="tabular-nums text-ink-700">
                          {it.total == null ? "—" : reais(it.total)}
                        </span>
                      </div>
                      {it.opcoes?.length ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-ink-500">
                          {it.opcoes.map((o, j) => (
                            <li key={j}>
                              {o.quantidade ? `${o.quantidade}× ` : ""}
                              {o.nome || "Opção"}
                              {o.preco != null ? ` (${reais(o.preco)})` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-ink-500">Subtotal</dt>
              <dd className="tabular-nums text-ink-900">
                {d.subtotal == null ? "—" : reais(d.subtotal)}
              </dd>
              <dt className="text-ink-500">Taxa de entrega</dt>
              <dd className="tabular-nums text-ink-900">
                {d.taxa_entrega == null ? "—" : reais(d.taxa_entrega)}
              </dd>
              <dt className="text-ink-500">Descontos</dt>
              <dd className="tabular-nums text-ink-900">
                {d.descontos == null ? "—" : reais(d.descontos)}
              </dd>
              <dt className="text-ink-500">Taxas adicionais</dt>
              <dd className="tabular-nums text-ink-900">
                {d.taxas_adicionais == null ? "—" : reais(d.taxas_adicionais)}
              </dd>
              <dt className="text-ink-700 font-semibold">Total</dt>
              <dd className="font-semibold tabular-nums text-ink-900">
                {d.total == null ? "—" : reais(d.total)}
              </dd>
            </dl>

            {d.pagamentos?.length ? (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-ink-700">Pagamentos</h3>
                <ul className="space-y-1 text-xs">
                  {d.pagamentos.map((pg, i) => (
                    <li key={i} className="flex justify-between gap-2 rounded border border-base-200 px-2 py-1.5">
                      <span>
                        {[pg.forma, pg.tipo, pg.bandeira].filter(Boolean).join(" · ") || "Pagamento"}
                      </span>
                      <span className="tabular-nums">
                        {pg.valor == null ? "—" : reais(pg.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {temFinanceiroPedido(d.financeiro) ? (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-ink-700">Financeiro do pedido</h3>
                <ul className="divide-y divide-base-200 rounded-md border border-base-200 text-xs">
                  {d.financeiro.map((f, i) => (
                    <li key={`${f.nome}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 px-2.5 py-2">
                      <span className="min-w-0">
                        <span className="font-medium text-ink-900">{f.nome}</span>
                        {f.descricao ? (
                          <span className="mt-0.5 block text-ink-500">{f.descricao}</span>
                        ) : null}
                        {f.taxa_pct != null ? (
                          <span className="mt-0.5 block text-ink-500">Taxa {f.taxa_pct}%</span>
                        ) : null}
                        {f.pagamento_previsto ? (
                          <span className="mt-0.5 block text-ink-500">
                            Previsto: {f.pagamento_previsto}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular-nums font-medium text-ink-900">{reais(f.valor)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {d.eventos?.length ? (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-ink-700">Linha do tempo</h3>
                <ol className="space-y-1.5 border-l border-base-200 pl-3">
                  {d.eventos.map((ev, i) => (
                    <li key={`${ev.codigo}-${i}`} className="text-xs">
                      <span className="font-medium text-ink-900">{rotuloStatusIfood(ev.codigo)}</span>
                      <span className="ml-2 text-ink-500">
                        {dataHora(ev.criado_em ?? ev.recebido_em)}
                      </span>
                      <span className="ml-1 text-ink-500">({ev.codigo})</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function IfoodPedidos({ ctx }: { ctx: ContextoGateway }) {
  const cache = useQueryClient();
  const listar = useServerFn(listarPedidosIfood);
  const atualizar = useServerFn(atualizarPedidosIfood);
  const listarLojas = useServerFn(listarLojasIfoodEmpresa);
  const [status, setStatus] = useState<string[]>([]);
  const [loja, setLoja] = useState("");
  const [teste, setTeste] = useState<"todos" | "sim" | "nao">("todos");
  const [aberto, setAberto] = useState<string | null>(null);

  const lojas = useQuery({
    queryKey: ["ifood", ctx.empresa ?? "vinculada", "lojas"],
    queryFn: async () => {
      const r = await listarLojas({ data: { empresa: ctx.empresa } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as ListaLojasEmpresaIfood;
    },
    staleTime: 60_000,
  });

  const q = useInfiniteQuery({
    queryKey: [
      "ifood",
      ctx.empresa ?? "vinculada",
      "pedidos",
      status.join(","),
      loja,
      teste,
    ],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const r = await listar({
        data: {
          empresa: ctx.empresa,
          ...(status.length ? { status } : {}),
          ...(loja ? { loja } : {}),
          ...(teste === "sim" ? { teste: true } : teste === "nao" ? { teste: false } : {}),
          limite: 40,
          ...(pageParam ? { antes: pageParam } : {}),
        },
      });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as ListaPedidosIfood;
    },
    getNextPageParam: (ultima) => ultima.proximo_antes ?? undefined,
    refetchInterval: INTERVALO_PEDIDOS_IFOOD_MS,
    refetchIntervalInBackground: false,
  });

  const mutAtualizar = useMutation({
    mutationFn: async () => {
      const r = await atualizar({ data: { empresa: ctx.empresa } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r;
    },
    onSuccess: (r) => {
      toast.success(
        r && "detalhados" in r
          ? `Atualizados: ${r.detalhados}. Ainda pendentes: ${r.pendentes}.`
          : "Atualização concluída.",
      );
      void cache.invalidateQueries({
        queryKey: ["ifood", ctx.empresa ?? "vinculada", "pedidos"],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = q.data?.pages.flatMap((p) => p.itens) ?? [];
  const temPendente = itens.some(pedidoIfoodPendente);

  function toggleStatus(id: string) {
    setStatus((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-base-200 bg-card px-3 py-2">
        <p className="text-sm text-ink-500">{TEXTO_ACOMPANHAMENTO_IFOOD}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTRO.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={status.includes(s.id)}
              onClick={() => toggleStatus(s.id)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                status.includes(s.id) ? "bg-purple-800 text-white" : "text-ink-700 hover:bg-base-100"
              }`}
            >
              {s.rotulo}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1 text-xs text-ink-700">
            <span className="sr-only">Loja</span>
            <select
              value={loja}
              onChange={(e) => setLoja(e.target.value)}
              className="h-7 max-w-[10rem] rounded-md border border-base-200 bg-card px-1.5 text-xs"
            >
              <option value="">Todas as lojas</option>
              {(lojas.data?.itens ?? []).map((l) => (
                <option key={l.merchant_id} value={l.merchant_id}>
                  {l.nome || l.merchant_id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-ink-700">
            <span className="sr-only">Teste</span>
            <select
              value={teste}
              onChange={(e) => setTeste(e.target.value as typeof teste)}
              className="h-7 rounded-md border border-base-200 bg-card px-1.5 text-xs"
            >
              <option value="todos">Todos</option>
              <option value="nao">Só reais</option>
              <option value="sim">Só teste</option>
            </select>
          </label>
          <span className="ml-auto flex items-center gap-1.5">
            {temPendente ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mutAtualizar.isPending}
                onClick={() => mutAtualizar.mutate()}
              >
                <RefreshCw
                  className={`size-3.5 ${mutAtualizar.isPending ? "animate-spin" : ""}`}
                  aria-hidden
                />
                Atualizar pendentes
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={q.isFetching}
              onClick={() => void q.refetch()}
            >
              <RefreshCw className={`size-3.5 ${q.isFetching ? "animate-spin" : ""}`} aria-hidden />
              Atualizar
            </Button>
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-base-100">
        {q.isError ? (
          <p role="alert" className="m-3 rounded-lg border bg-card p-4 text-sm text-destructive">
            {q.error.message}
          </p>
        ) : q.isLoading ? (
          <p className="p-3 text-sm text-ink-500">Carregando…</p>
        ) : itens.length === 0 ? (
          <div className="mx-auto max-w-lg p-6 text-center">
            <h2 className="text-base font-semibold text-ink-900">Nenhum pedido do iFood</h2>
            <p className="mt-2 text-sm text-ink-500">
              Quando a loja receber pedidos no iFood, eles aparecem aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="border-y border-base-200 bg-card">
            {itens.map((p) => (
              <LinhaPedido key={p.order_id} p={p} onAbrir={setAberto} />
            ))}
          </div>
        )}
        {q.hasNextPage ? (
          <div className="p-3 text-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
            </Button>
          </div>
        ) : null}
      </div>

      <PainelDetalhe
        empresa={ctx.empresa}
        orderId={aberto}
        onFechar={() => setAberto(null)}
        onAtualizado={() =>
          void cache.invalidateQueries({
            queryKey: ["ifood", ctx.empresa ?? "vinculada", "pedidos"],
          })
        }
      />
    </div>
  );
}
