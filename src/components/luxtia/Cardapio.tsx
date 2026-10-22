import type { ServicosCat2 } from "@/lib/gateway/cardapio-cat2";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useBlocker, useNavigate, useSearch } from "@tanstack/react-router";
import { cardapio } from "@/lib/gateway-cardapio.functions";
import type { ItemCardapio, PedidoCardapio } from "@/lib/gateway/cardapio";
import { gerirCat3 } from "@/lib/gateway-cat3.functions";
import type { ExecutarCat3 } from "@/lib/gateway/cat3";
import type { Unidade } from "@/lib/gateway/gestao";
import type { ContextoGateway } from "./Gateway";
import { useGestao } from "./gestao-base";
import { CardapioCat3 } from "./cardapio/CardapioCat3";

export function Cardapio({ ctx }: { ctx: ContextoGateway }) {
  const fn = useServerFn(cardapio);
  const cat3 = useServerFn(gerirCat3);
  const executar = useMemo<ExecutarCat3>(
    () => (data) => cat3({ data: { ...data, empresa: ctx.empresa } }),
    [cat3, ctx.empresa],
  );
  const [protegido, proteger] = useState(false);
  useBlocker({
    shouldBlockFn: () =>
      protegido &&
      !window.confirm("Há uma edição em andamento. Sair e descartar alterações não salvas?"),
  });
  const g = useGestao(ctx);
  const cache = useQueryClient();
  const filtros = useSearch({ from: "/_authenticated/ia/cardapio" });
  const navigate = useNavigate({ from: "/ia/cardapio" });
  const unidades = useQuery({
    queryKey: ["gestao", ctx.empresa, "unidades"],
    queryFn: () => g.ler<{ itens: Unidade[] }>({ acao: "listar" }),
  });
  const q = useQuery({
    queryKey: ["cardapio", ctx.empresa, "panorama", filtros.filtro === "arquivados"],
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const r = await fn({
        data: {
          acao: "panorama",
          com_esgotados: true,
          empresa: ctx.empresa,
          arquivados: filtros.filtro === "arquivados",
        },
      });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return r.dados as unknown as { itens: ItemCardapio[] };
    },
  });
  const servicos = useMemo<ServicosCat2>(() => {
    const trocar = (novo: ItemCardapio) =>
      cache.setQueryData<{ itens: ItemCardapio[] }>(
        ["cardapio", ctx.empresa, "panorama", filtros.filtro === "arquivados"],
        (atual) =>
          atual && {
            itens: atual.itens.map((i) =>
              i.item_id === novo.item_id
                ? {
                    ...novo,
                    ...(i.esgotado_agora !== undefined ? { esgotado_agora: i.esgotado_agora } : {}),
                  }
                : i,
            ),
          },
      );
    const ler = async <T,>(data: PedidoCardapio): Promise<T> => {
      const res = await fn({ data: { ...data, empresa: ctx.empresa } });
      if (!res.ok) throw new Error(res.erro.mensagem);
      return res.dados as unknown as T;
    };
    return {
      obter: (id) => ler({ acao: "obter", item_id: id }),
      categorias: (unidade, arquivadas) =>
        ler({ acao: "categorias", unidade, ...(arquivadas ? { arquivadas: true } : {}) }),
      previa: (unidade, disponibilidade) =>
        ler({ acao: "previa", unidade, disponibilidade: disponibilidade ?? null }),
      historico: (id, cursor) => ler({ acao: "historico", item_id: id, cursor }),
      atualizarLocal: trocar,
      editar: async (item, campos) => {
        const res = await fn({
          data: {
            acao: "editar",
            empresa: ctx.empresa,
            item_id: item.item_id,
            atualizado_em: item.atualizado_em ?? "",
            campos,
          },
        });
        if (!res.ok)
          return {
            ok: false,
            mensagem: res.erro.mensagem,
            campo: res.erro.campo,
            atual: res.atual,
          };
        const novo = res.dados as unknown as ItemCardapio;
        trocar(novo);
        return { ok: true, item: novo };
      },
    };
  }, [fn, ctx.empresa, cache, filtros.filtro]);
  const lista = (unidades.data?.itens ?? [])
    .map((u) => ({ codigo: u.codigo!, nome: u.nome, fuso: u.fuso_efetivo }))
    .filter((u) => u.codigo);
  return (
    <CardapioCat3
      itens={q.data?.itens ?? []}
      unidades={lista}
      filtros={filtros}
      mudarFiltros={(f) => void navigate({ search: f, replace: true })}
      admin={ctx.papel !== "membro"}
      executar={executar}
      servicos={servicos}
      proteger={proteger}
      carregando={q.isPending || unidades.isPending}
      erro={q.error?.message || unidades.error?.message}
      atualizar={() => {
        void q.refetch();
        void unidades.refetch();
      }}
    />
  );
}
