import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useGestao } from "./gestao-base";
import type { ContextoGateway } from "./Gateway";
import { Cartao, EstadoVazio } from "./Superficie";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DIAS,
  NOMES_DIA,
  FUSO_PAINEL,
  dataRecebida,
  periodoNoFuso,
  type Alteracao,
  type PedidoGestao,
  type Unidade,
} from "@/lib/gateway/gestao";
import { useState } from "react";

const CAMPOS: Record<string, string> = {
  nome: "Nome",
  codigo: "Código",
  endereco: "Endereço",
  telefone: "Telefone",
  whatsapp_pedidos: "WhatsApp de pedidos",
  ativo: "Ativa",
  fuso: "Fuso",
  horarios: "Grade semanal",
  pausa_ate: "Pausa até",
  pausa_indefinida: "Pausa até reabrir",
  pausa_motivo: "Motivo da pausa",
  data: "Data",
  fechado: "Fechado o dia inteiro",
  faixas: "Horários",
  motivo: "Motivo",
};
function rotuloAcao(entidade: string, acao: string) {
  const mapa: Record<string, string> = {
    "unidade:criado": "Unidade criada",
    "unidade:alterado": "Dados alterados",
    "unidade:pausado": "Pedidos pausados",
    "unidade:reaberto": "Pedidos reabertos",
    "unidade:horarios": "Grade alterada",
    "excecao:criado": "Exceção criada",
    "excecao:alterado": "Exceção alterada",
    "excecao:removido": "Exceção removida",
  };
  return mapa[`${entidade}:${acao}`] ?? `${acao} · ${entidade}`;
}
function rotuloCampo(chave: string) {
  return CAMPOS[chave] ?? chave;
}
function idUnidade(a: Alteracao) {
  if (a.entidade === "unidade" && /^[A-Za-z0-9_-]{1,100}$/.test(a.entidade_id))
    return a.entidade_id;
  const m = /^([A-Za-z0-9_-]{1,100}):(\d{4}-\d{2}-\d{2})$/.exec(a.entidade_id);
  return a.entidade === "excecao" ? (m?.[1] ?? null) : null;
}
function textoValor(chave: string, v: unknown): string {
  if (v === undefined) return "Não existia";
  if (v === null) return "Não informado";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (chave === "faixas" && Array.isArray(v))
    return v.map((f) => (Array.isArray(f) ? `${f[0]}–${f[1]}` : String(f))).join(", ") || "Nenhum";
  if (chave === "horarios" && v && typeof v === "object" && !Array.isArray(v)) {
    const grade = v as Record<string, [string, string][] | undefined>;
    const linhas = DIAS.filter((d) => grade[d]?.length).map(
      (d) => `${NOMES_DIA[d]}: ${grade[d]!.map((f) => f.join("–")).join(", ")}`,
    );
    return linhas.length ? linhas.join("\n") : "Horário não informado";
  }
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}
function diaRegistro(v: string) {
  const m = /^(\d{2}\/\d{2}\/\d{4})/.exec(dataRecebida(v));
  return m?.[1] ?? "Data não informada";
}

export function HistoricoGestao({
  ctx,
  unidadeId,
  aoEscolherUnidade,
}: {
  ctx: ContextoGateway;
  unidadeId: string;
  aoEscolherUnidade: (id: string) => void;
}) {
  const g = useGestao(ctx);
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [entidade, setEntidade] = useState("");
  const [alvo, setAlvo] = useState("");
  const unidades = useQuery({
    queryKey: ["gestao", ctx.empresa, "unidades"],
    queryFn: () => g.ler<{ itens: Unidade[] }>({ acao: "listar" }),
  });
  const fusoEmpresa = useQuery({
    queryKey: ["gestao", ctx.empresa, "fuso"],
    queryFn: () =>
      g.ler<{ timezone: string; origem: "empresa" | "padrao" }>({ acao: "fuso_empresa" }),
    staleTime: 60_000,
  });
  const zona = fusoEmpresa.data?.timezone ?? FUSO_PAINEL;
  const origemFuso = fusoEmpresa.data?.origem ?? "padrao";
  let periodo: { valor: { desde?: string; ate?: string }; erro?: string };
  if (desde && ate && desde > ate)
    periodo = { valor: {}, erro: "A data inicial precisa ser anterior ou igual à final." };
  else {
    try {
      periodo = { valor: periodoNoFuso(desde || undefined, ate || undefined, zona) };
    } catch (e) {
      periodo = { valor: {}, erro: e instanceof Error ? e.message : "Confira o período." };
    }
  }
  const especifico = Boolean(entidade || alvo);
  const nomes = new Map((unidades.data?.itens ?? []).map((u) => [u.id, u.nome]));
  const nomeEscolhida = unidadeId ? (nomes.get(unidadeId) ?? unidadeId) : "";
  const q = useInfiniteQuery({
    queryKey: ["gestao", ctx.empresa, "historico", unidadeId, entidade, alvo, desde, ate, zona],
    enabled: (fusoEmpresa.isSuccess || fusoEmpresa.isError) && !periodo.erro,
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      g.ler<{ itens: Alteracao[]; proximo_cursor: number | null }>({
        acao: "historico",
        ...(especifico
          ? {
              ...(entidade ? { entidade } : {}),
              ...(alvo ? { entidade_id: alvo } : {}),
            }
          : unidadeId
            ? { unidade_id: unidadeId }
            : {}),
        ...periodo.valor,
        ...(pageParam ? { cursor: pageParam } : {}),
      } as PedidoGestao),
    getNextPageParam: (ultima) => ultima.proximo_cursor ?? undefined,
  });
  const itens = q.data?.pages.flatMap((p) => p.itens) ?? [];
  const grupos: { dia: string; itens: Alteracao[] }[] = [];
  for (const item of itens) {
    const dia = diaRegistro(item.criado_em);
    const atual = grupos.at(-1);
    if (atual?.dia === dia) atual.itens.push(item);
    else grupos.push({ dia, itens: [item] });
  }
  const recorte = especifico
    ? alvo
      ? `Identificador exato ${alvo}. As outras alterações da unidade não entram.`
      : entidade === "excecao"
        ? "Somente exceções, de qualquer unidade."
        : "Somente alterações de unidade, sem as exceções."
    : unidadeId
      ? `${nomeEscolhida}: a unidade e todas as exceções dela.`
      : "Todas as alterações da empresa.";
  return (
    <div className="mt-6 space-y-4">
      <Cartao className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">
          Unidade
          <select
            className="mt-1 block min-h-11 w-full rounded-md border bg-card px-3"
            value={especifico ? "" : unidadeId}
            onChange={(e) => {
              setEntidade("");
              setAlvo("");
              aoEscolherUnidade(e.target.value);
            }}
          >
            <option value="">Todas</option>
            {unidadeId && !nomes.has(unidadeId) ? (
              <option value={unidadeId}>{unidadeId}</option>
            ) : null}
            {unidades.data?.itens.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Desde
          <Input
            className="mt-1 min-h-11"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Até
          <Input
            className="mt-1 min-h-11"
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
          />
        </label>
        <div className="flex items-end">
          <Button
            className="min-h-11"
            variant="outline"
            onClick={() => {
              setDesde("");
              setAte("");
              setEntidade("");
              setAlvo("");
              aoEscolherUnidade("");
            }}
          >
            Limpar
          </Button>
        </div>
      </Cartao>
      <p className="text-sm text-ink-500">
        {recorte}{" "}
        {origemFuso === "empresa"
          ? `Período no fuso da empresa (${zona}).`
          : "Fuso da empresa indisponível; o período usa Brasília."}{" "}
        O dia final entra na consulta. O horário de cada linha continua o que o gateway enviou.
      </p>
      <details className="rounded-xl border border-base-200 bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Buscar por identificador exato
        </summary>
        <p className="mt-2 text-sm text-ink-500">
          Serve para uma unidade ou uma exceção específica (ID ou ID:AAAA-MM-DD). Não combina com o
          filtro de unidade acima.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-sm">
            Tipo
            <select
              className="mt-1 block min-h-11 rounded-md border bg-card px-3"
              value={entidade}
              onChange={(e) => {
                setEntidade(e.target.value);
                if (e.target.value) aoEscolherUnidade("");
              }}
            >
              <option value="">Qualquer</option>
              <option value="unidade">Unidade</option>
              <option value="excecao">Exceção</option>
            </select>
          </label>
          <label className="min-w-64 flex-1 text-sm">
            Identificador
            <Input
              className="mt-1 min-h-11"
              value={alvo}
              placeholder="ID da unidade ou ID:AAAA-MM-DD"
              onChange={(e) => {
                setAlvo(e.target.value);
                if (e.target.value) aoEscolherUnidade("");
              }}
            />
          </label>
        </div>
      </details>
      {periodo.erro ? <p role="alert">{periodo.erro}</p> : null}
      {q.isPending && !periodo.erro ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : null}
      {q.error ? (
        <p role="alert">
          {q.error.message}{" "}
          <Button variant="outline" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        </p>
      ) : null}
      {q.data && itens.length === 0 ? (
        <Cartao>
          <EstadoVazio
            titulo="Nenhuma alteração neste recorte"
            texto="Troque a unidade ou amplie o período. Uma alteração sem efeito não gera linha."
          />
        </Cartao>
      ) : null}
      {grupos.map((grupo) => (
        <section key={grupo.dia} className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
            {grupo.dia}
          </h2>
          {grupo.itens.map((a) => {
            const campos = [
              ...new Set([...Object.keys(a.antes ?? {}), ...Object.keys(a.depois ?? {})]),
            ];
            const unidade = idUnidade(a);
            const nome = unidade ? (nomes.get(unidade) ?? unidade) : a.entidade_id;
            return (
              <Cartao key={a.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{rotuloAcao(a.entidade, a.acao)}</p>
                    <p className="text-sm text-ink-500">
                      {nome} · {dataRecebida(a.criado_em)} · {a.actor}
                    </p>
                  </div>
                  {unidade && (
                    <Link
                      to="/ia/unidades"
                      search={{
                        unidade,
                        ...(a.entidade === "excecao" ? { secao: "excecoes" as const } : {}),
                      }}
                      className="text-sm font-medium text-purple-800 underline-offset-4 hover:underline"
                    >
                      Abrir unidade
                    </Link>
                  )}
                </div>
                <p className="text-sm">
                  {campos.length
                    ? campos.map(rotuloCampo).join(" · ")
                    : "Sem campos detalhados nesta linha."}
                </p>
                {campos.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">
                      Ver antes e depois
                    </summary>
                    <div className="mt-3 space-y-3">
                      {campos.map((k) => (
                        <div key={k} className="rounded-lg border border-base-200 p-3">
                          <strong>{rotuloCampo(k)}</strong>
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-ink-500">Antes</p>
                              <pre className="whitespace-pre-wrap break-words text-sm">
                                {textoValor(k, a.antes?.[k])}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-ink-500">Depois</p>
                              <pre className="whitespace-pre-wrap break-words text-sm">
                                {textoValor(k, a.depois?.[k])}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </Cartao>
            );
          })}
        </section>
      ))}
      {q.hasNextPage && (
        <Button
          className="min-h-11"
          variant="outline"
          disabled={q.isFetchingNextPage}
          onClick={() => q.fetchNextPage()}
        >
          {q.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
        </Button>
      )}
    </div>
  );
}
