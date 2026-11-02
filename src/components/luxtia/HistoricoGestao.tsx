import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useGestao } from "./gestao-base";
import type { ContextoGateway } from "./Gateway";
import { EstadoVazio } from "./Superficie";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DIAS,
  NOMES_DIA,
  FUSO_PAINEL,
  dataRecebida,
  momentoNoFuso,
  periodoNoFuso,
  rotuloDia,
  type Alteracao,
  type PedidoGestao,
  type Unidade,
} from "@/lib/gateway/gestao";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";

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
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const fimLista = useRef<HTMLDivElement>(null);
  function alternar(id: number) {
    setAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  const unidades = useQuery({
    queryKey: ["gestao", ctx.empresa, "unidades"],
    queryFn: () => g.ler<{ itens: Unidade[] }>({ acao: "listar" }),
  });
  const fusoEmpresa = useQuery({
    queryKey: ["gestao", ctx.empresa, "fuso"],
    queryFn: () =>
      g.ler<{ timezone: string; origem: "empresa" | "padrao" }>({ acao: "fuso_empresa" }),
    staleTime: 60_000,
    // Quem não lê o fuso cai no de Brasília na hora, sem esperar repetições.
    retry: false,
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
  const momento = (v: string) => momentoNoFuso(v, zona);
  const grupos: { dia: string; itens: Alteracao[] }[] = [];
  for (const item of itens) {
    const dia = momento(item.criado_em)?.dia ?? diaRegistro(item.criado_em);
    const atual = grupos.at(-1);
    if (atual?.dia === dia) atual.itens.push(item);
    else grupos.push({ dia, itens: [item] });
  }
  const recorte = especifico
    ? alvo
      ? `Identificador exato ${alvo}.`
      : entidade === "excecao"
        ? "Somente exceções, de qualquer unidade."
        : "Somente alterações de unidade, sem as exceções."
    : unidadeId
      ? `${nomeEscolhida}: a unidade e todas as exceções dela.`
      : "Todas as alterações da empresa.";
  const filtrando = Boolean(desde || ate || entidade || alvo || unidadeId);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = q;
  useEffect(() => {
    const fim = fimLista.current;
    if (!fim || !hasNextPage || isFetchingNextPage) return;
    const observador = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void fetchNextPage();
      },
      { root: fim.parentElement, rootMargin: "200px" },
    );
    observador.observe(fim);
    return () => observador.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 bg-card px-3 py-2">
        <select
          aria-label="Unidade"
          className="h-8 max-w-52 rounded-md border bg-base-50 px-2 text-sm"
          value={especifico ? "" : unidadeId}
          onChange={(e) => {
            setEntidade("");
            setAlvo("");
            aoEscolherUnidade(e.target.value);
          }}
        >
          <option value="">Todas as unidades</option>
          {unidadeId && !nomes.has(unidadeId) ? (
            <option value={unidadeId}>{unidadeId}</option>
          ) : null}
          {unidades.data?.itens.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          De
          <Input
            className="h-8 w-36 bg-base-50 text-sm"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          Até
          <Input
            className="h-8 w-36 bg-base-50 text-sm"
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
          />
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5">
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Identificador
              {especifico ? (
                <span className="rounded-full bg-purple-800 px-1.5 text-[10px] font-semibold text-white">
                  1
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-2 p-3">
            <p className="text-xs text-ink-500">
              Para uma unidade ou exceção específica (ID ou ID:AAAA-MM-DD). Não combina com o filtro
              de unidade.
            </p>
            <label className="block text-xs font-medium text-ink-500">
              Tipo
              <select
                className="mt-1 block h-8 w-full rounded-md border bg-card px-2 text-sm text-ink-900"
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
            <label className="block text-xs font-medium text-ink-500">
              Identificador
              <Input
                className="mt-1 h-8 text-sm"
                value={alvo}
                placeholder="ID da unidade ou ID:AAAA-MM-DD"
                onChange={(e) => {
                  setAlvo(e.target.value);
                  if (e.target.value) aoEscolherUnidade("");
                }}
              />
            </label>
          </PopoverContent>
        </Popover>
        {filtrando ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
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
        ) : null}
        <p className="ml-auto min-w-0 truncate text-xs text-ink-500" title={`Fuso ${zona}`}>
          {recorte} {origemFuso === "empresa" ? `Horários em ${zona}.` : "Horários de Brasília."}
        </p>
      </div>
      {periodo.erro ? (
        <p role="alert" className="shrink-0 px-3 py-1.5 text-sm text-destructive">
          {periodo.erro}
        </p>
      ) : null}
      {q.error ? (
        <p role="alert" className="shrink-0 px-3 py-1.5 text-sm text-destructive">
          {q.error.message}{" "}
          <button type="button" className="underline" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card">
        {q.isPending && !periodo.erro ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : null}
        {q.data && itens.length === 0 ? (
          <div className="flex h-full items-center justify-center bg-base-100 p-6">
            <EstadoVazio
              titulo="Nenhuma alteração neste recorte"
              texto="Troque a unidade ou amplie o período. Uma alteração sem efeito não gera linha."
            />
          </div>
        ) : null}
        {grupos.map((grupo) => (
          <section key={grupo.dia} aria-label={grupo.dia}>
            <h2 className="sticky top-0 z-10 flex h-7 items-center gap-2 border-b border-base-200 bg-base-50 px-3 font-sans text-xs font-semibold text-ink-900">
              {rotuloDia(grupo.dia, zona)}
              <span className="font-normal tabular-nums text-ink-500">{grupo.itens.length}</span>
            </h2>
            {grupo.itens.map((a) => {
              const campos = [
                ...new Set([...Object.keys(a.antes ?? {}), ...Object.keys(a.depois ?? {})]),
              ];
              const unidade = idUnidade(a);
              const nome = unidade ? (nomes.get(unidade) ?? unidade) : a.entidade_id;
              const aberto = abertos.has(a.id);
              return (
                <article key={a.id} className="border-b border-base-200/70">
                  <div className="flex items-center gap-2 pr-3 transition-colors hover:bg-purple-50/50">
                    <button
                      type="button"
                      aria-expanded={campos.length ? aberto : undefined}
                      disabled={!campos.length}
                      title={`${dataRecebida(a.criado_em)} · ${a.actor}`}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-default"
                      onClick={() => alternar(a.id)}
                    >
                      <ChevronRight
                        className={`size-3.5 shrink-0 text-ink-400 transition-transform ${aberto ? "rotate-90" : ""} ${campos.length ? "" : "invisible"}`}
                        aria-hidden
                      />
                      <time className="w-11 shrink-0 text-xs tabular-nums text-ink-500">
                        {momento(a.criado_em)?.hora ?? "—"}
                      </time>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                          <strong className="text-sm font-medium text-ink-900">
                            {rotuloAcao(a.entidade, a.acao)}
                          </strong>
                          <span className="truncate text-sm text-ink-700">{nome}</span>
                        </span>
                        <span className="block truncate text-xs leading-4 text-ink-500">
                          {a.actor}
                          {campos.length ? ` · ${campos.map(rotuloCampo).join(", ")}` : ""}
                        </span>
                      </span>
                    </button>
                    {unidade && (
                      <Link
                        to="/ia/unidades"
                        search={{
                          unidade,
                          ...(a.entidade === "excecao" ? { secao: "excecoes" as const } : {}),
                        }}
                        className="shrink-0 text-xs font-medium text-purple-800 underline-offset-4 hover:underline"
                      >
                        Abrir unidade
                      </Link>
                    )}
                  </div>
                  {aberto ? (
                    <div className="overflow-x-auto bg-base-50 px-3 py-2 sm:pl-[5.25rem]">
                      <table className="w-full min-w-[28rem] text-xs">
                        <thead>
                          <tr className="text-left text-ink-500">
                            <th className="w-40 pb-1 pr-3 font-medium">Campo</th>
                            <th className="pb-1 pr-3 font-medium">Antes</th>
                            <th className="pb-1 font-medium">Depois</th>
                          </tr>
                        </thead>
                        <tbody className="align-top">
                          {campos.map((k) => (
                            <tr key={k} className="border-t border-base-200">
                              <td className="py-1 pr-3 font-medium text-ink-900">
                                {rotuloCampo(k)}
                              </td>
                              <td className="py-1 pr-3">
                                <pre className="whitespace-pre-wrap break-words font-sans text-ink-500">
                                  {textoValor(k, a.antes?.[k])}
                                </pre>
                              </td>
                              <td className="py-1">
                                <pre className="whitespace-pre-wrap break-words font-sans text-ink-900">
                                  {textoValor(k, a.depois?.[k])}
                                </pre>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        ))}
        {q.hasNextPage ? (
          <div ref={fimLista} className="p-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
