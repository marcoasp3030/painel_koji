/** 99FOOD1-b: lista e detalhe de pedidos da 99Food (confirmação no app da 99). */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  atualizarPedidosFood99,
  lerPedidoFood99,
  listarLojasFood99,
  listarPedidosFood99,
} from "@/lib/gateway-food99.functions";
import { reais } from "@/lib/gateway/pedidos";
import { empresaTemLojaFood99 } from "@/lib/food99";
import type { ListaLojasFood99 } from "@/lib/food99";
import {
  INTERVALO_PEDIDOS_FOOD99_MS,
  TEXTO_CONFIRMACAO_FOOD99,
  antesProximaPaginaFood99,
  pedidoFood99Pendente,
  rotuloEntregaFood99,
  rotuloPagamentoFood99,
  rotuloStatusFood99,
  type ListaPedidosFood99,
  type PedidoFood99Detalhe,
  type PedidoFood99Lista,
} from "@/lib/food99-pedidos";
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
  { id: "novo", rotulo: "Novo" },
  { id: "confirmado", rotulo: "Confirmado" },
  { id: "pronto", rotulo: "Pronto" },
  { id: "concluido", rotulo: "Concluído" },
  { id: "cancelado", rotulo: "Cancelado" },
] as const;

function SeloTeste() {
  return (
    <span className="inline-flex rounded bg-gold-300/40 px-1.5 text-[11px] font-semibold text-gold-700">
      Teste
    </span>
  );
}

function SeloStatus({ status }: { status: string }) {
  const cancelado = status === "cancelado";
  return (
    <span
      className={`inline-flex rounded px-1.5 text-[11px] font-semibold ${
        cancelado ? "bg-destructive/10 text-destructive" : "bg-base-100 text-ink-700"
      }`}
    >
      {rotuloStatusFood99(status)}
    </span>
  );
}

function LinhaPedido({
  p,
  onAbrir,
}: {
  p: PedidoFood99Lista;
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
            {p.numero ? `#${p.numero}` : `…${p.order_id.slice(-8)}`}
          </span>
          <SeloStatus status={p.status} />
          {p.teste ? <SeloTeste /> : null}
          {pedidoFood99Pendente(p) ? (
            <span className="text-[11px] font-medium text-ink-500">Detalhe pendente</span>
          ) : null}
        </div>
        <p className="truncate text-sm text-ink-700">
          {p.unidade || "Unidade"}
          {p.tipo_entrega ? ` · ${rotuloEntregaFood99(p.tipo_entrega)}` : ""}
          {p.pagamento ? ` · ${rotuloPagamentoFood99(p.pagamento)}` : ""}
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
  const ler = useServerFn(lerPedidoFood99);
  const atualizar = useServerFn(atualizarPedidosFood99);
  const q = useQuery({
    queryKey: ["99food", empresa ?? "vinculada", "pedido", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const r = await ler({ data: { empresa, order_id: orderId! } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as PedidoFood99Detalhe;
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
        r && "atualizados" in r
          ? `Atualizados: ${r.atualizados}.`
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
            {d?.numero
              ? `Pedido #${d.numero}`
              : orderId
                ? `Pedido …${orderId.slice(-8)}`
                : "Pedido"}
          </SheetTitle>
          <SheetDescription>{TEXTO_CONFIRMACAO_FOOD99}</SheetDescription>
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

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mut.isPending}
                onClick={() => mut.mutate()}
              >
                <RefreshCw
                  className={`size-3.5 ${mut.isPending ? "animate-spin" : ""}`}
                  aria-hidden
                />
                Atualizar
              </Button>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-ink-500">Nº do dia</dt>
              <dd className="text-ink-900">{d.numero || "—"}</dd>
              <dt className="text-ink-500">Unidade</dt>
              <dd className="text-ink-900">{d.unidade || "—"}</dd>
              <dt className="text-ink-500">Entrega</dt>
              <dd className="text-ink-900">{rotuloEntregaFood99(d.tipo_entrega)}</dd>
              <dt className="text-ink-500">Pagamento</dt>
              <dd className="text-ink-900">{rotuloPagamentoFood99(d.pagamento)}</dd>
              <dt className="text-ink-500">Pedido (id)</dt>
              <dd className="break-all font-mono text-[11px] text-ink-900">{d.order_id}</dd>
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
                            <li key={j}>{o}</li>
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
              <dt className="text-ink-500">Entrega</dt>
              <dd className="tabular-nums text-ink-900">
                {d.taxa_entrega == null ? "—" : reais(d.taxa_entrega)}
              </dd>
              <dt className="text-ink-500">Descontos</dt>
              <dd className="tabular-nums text-ink-900">
                {d.descontos == null ? "—" : reais(d.descontos)}
              </dd>
              <dt className="text-ink-700 font-semibold">Total</dt>
              <dd className="font-semibold tabular-nums text-ink-900">
                {d.total == null ? "—" : reais(d.total)}
              </dd>
              <dt className="text-ink-500">Total pago</dt>
              <dd className="tabular-nums text-ink-900">
                {d.total_pago == null ? "—" : reais(d.total_pago)}
              </dd>
            </dl>

            {d.eventos?.length ? (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-ink-700">Linha do tempo</h3>
                <ol className="space-y-1.5 border-l border-base-200 pl-3">
                  {d.eventos.map((ev, i) => (
                    <li key={`${ev.tipo}-${i}`} className="text-xs">
                      <span className="font-medium text-ink-900">{ev.tipo}</span>
                      <span className="ml-2 text-ink-500">{dataHora(ev.recebido_em)}</span>
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

export function Food99Pedidos({ ctx }: { ctx: ContextoGateway }) {
  const cache = useQueryClient();
  const listar = useServerFn(listarPedidosFood99);
  const atualizar = useServerFn(atualizarPedidosFood99);
  const listarLojas = useServerFn(listarLojasFood99);
  const [status, setStatus] = useState<string>("");
  const [unidade, setUnidade] = useState("");
  const [teste, setTeste] = useState<"todos" | "sim" | "nao">("todos");
  const [aberto, setAberto] = useState<string | null>(null);

  const lojas = useQuery({
    queryKey: ["99food", ctx.empresa ?? "vinculada", "lojas"],
    queryFn: async () => {
      const r = await listarLojas({ data: { empresa: ctx.empresa } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as ListaLojasFood99;
    },
    staleTime: 60_000,
  });

  const temLoja = empresaTemLojaFood99(lojas.data?.itens);

  const q = useInfiniteQuery({
    queryKey: [
      "99food",
      ctx.empresa ?? "vinculada",
      "pedidos",
      status,
      unidade,
      teste,
    ],
    enabled: temLoja,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const r = await listar({
        data: {
          empresa: ctx.empresa,
          ...(status ? { status } : {}),
          ...(unidade ? { unidade } : {}),
          ...(teste === "sim" ? { teste: true } : teste === "nao" ? { teste: false } : {}),
          limite: 40,
          ...(pageParam ? { antes: pageParam } : {}),
        },
      });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as ListaPedidosFood99;
    },
    getNextPageParam: (ultima) => antesProximaPaginaFood99(ultima),
    refetchInterval: INTERVALO_PEDIDOS_FOOD99_MS,
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
        r && "atualizados" in r
          ? `Atualizados: ${r.atualizados}.`
          : "Atualização concluída.",
      );
      void cache.invalidateQueries({
        queryKey: ["99food", ctx.empresa ?? "vinculada", "pedidos"],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = q.data?.pages.flatMap((p) => p.itens) ?? [];

  if (lojas.isLoading) {
    return <p className="p-3 text-sm text-ink-500">Carregando…</p>;
  }

  if (!temLoja) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h2 className="text-base font-semibold text-ink-900">Nenhuma loja da 99Food</h2>
        <p className="mt-2 text-sm text-ink-500">
          Conecte uma unidade em Loja → 99Food para receber pedidos e aparecer na Visão de vendas.
        </p>
        <Button asChild type="button" size="sm" className="mt-4">
          <Link to="/ia/configuracoes/99food">Abrir 99Food</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-base-200 bg-card px-3 py-2">
        <p className="rounded-md border border-gold-300/50 bg-gold-300/15 px-2.5 py-1.5 text-sm text-ink-800">
          {TEXTO_CONFIRMACAO_FOOD99}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTRO.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={status === s.id}
              onClick={() => setStatus((atual) => (atual === s.id ? "" : s.id))}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                status === s.id ? "bg-purple-800 text-white" : "text-ink-700 hover:bg-base-100"
              }`}
            >
              {s.rotulo}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1 text-xs text-ink-700">
            <span className="sr-only">Unidade</span>
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="h-7 max-w-[10rem] rounded-md border border-base-200 bg-card px-1.5 text-xs"
            >
              <option value="">Todas as unidades</option>
              {(lojas.data?.itens ?? []).map((l) => (
                <option key={l.id} value={l.unidade}>
                  {l.nome || l.unidade}
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
            <h2 className="text-base font-semibold text-ink-900">Nenhum pedido da 99Food</h2>
            <p className="mt-2 text-sm text-ink-500">
              Quando a loja receber pedidos na 99Food, eles aparecem aqui automaticamente.
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
            queryKey: ["99food", ctx.empresa ?? "vinculada", "pedidos"],
          })
        }
      />
    </div>
  );
}
