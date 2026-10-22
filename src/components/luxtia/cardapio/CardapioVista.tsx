import { ItemCat2, PrecoRapido } from "./ItemCat2";
import { horaReferencia, situacaoAgora, type ServicosCat2 } from "@/lib/gateway/cardapio-cat2";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Layers3,
  RefreshCw,
  Search,
  Store,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  precoTexto,
  problemaRascunho,
  rascunhoDe,
  type ItemCardapio,
  type RascunhoDisponibilidade,
} from "@/lib/gateway/cardapio";
import {
  agruparCardapio,
  aplicarLote,
  disponivelAgora,
  filtrarCardapio,
  resumoRascunho,
  temRestricao,
  type BuscaCardapio,
  type FiltroCardapio,
  type ResultadoLote,
  type SalvarItem,
} from "@/lib/gateway/cardapio-ux";
import { DisponibilidadeEditor } from "./DisponibilidadeEditor";

export type UnidadeCardapio = { codigo: string; nome: string; fuso?: string };
type Props = {
  itens: ItemCardapio[];
  unidades: UnidadeCardapio[];
  admin: boolean;
  filtros: BuscaCardapio;
  mudarFiltros: (f: BuscaCardapio) => void;
  salvar: SalvarItem;
  servicos: ServicosCat2;
  carregando?: boolean;
  erro?: string | undefined;
  atualizar: () => void;
  proteger?: ((v: boolean) => void) | undefined;
};
const CHIPS: { id: FiltroCardapio; nome: string }[] = [
  { id: "todos", nome: "Todos" },
  { id: "disponiveis", nome: "Disponíveis agora" },
  { id: "restricao", nome: "Com restrição" },
  { id: "sem_preco", nome: "Sem preço" },
  { id: "inativos", nome: "Inativos" },
];
const foco =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600";
export function CardapioVista({
  itens,
  unidades,
  admin,
  filtros,
  mudarFiltros,
  salvar,
  servicos,
  carregando = false,
  erro,
  atualizar,
  proteger,
}: Props) {
  const [selecionados, selecionar] = useState<Set<number>>(new Set());
  const [aberto, abrir] = useState<ItemCardapio | "lote" | "sempre" | null>(null);
  const origemFoco = useRef<HTMLElement | null>(null);
  const categoriaRefs = useRef(new Map<string, HTMLElement>());
  const [categoriaAtiva, setCategoriaAtiva] = useState("");
  const unidade = filtros.unidade || unidades[0]?.codigo || "";
  const todos = itens.filter((i) => i.unidade === unidade);
  const visiveis = filtrarCardapio(todos, { ...filtros, unidade });
  const grupos = agruparCardapio(visiveis, todos);
  const referencia = horaReferencia(todos.find((i) => i.data_referencia)?.data_referencia);
  const unidadeNome = unidades.find((u) => u.codigo === unidade)?.nome ?? unidade;
  const alvos = todos.filter((i) => selecionados.has(i.item_id));
  function mostrar(i: typeof aberto) {
    origemFoco.current = document.activeElement as HTMLElement;
    abrir(i);
  }
  function fechar() {
    abrir(null);
    requestAnimationFrame(() => origemFoco.current?.focus());
  }
  function filtrar(f: Partial<BuscaCardapio>) {
    selecionar(new Set());
    mudarFiltros({ ...filtros, unidade, ...f });
  }
  function marcar(ids: number[], marcado: boolean) {
    selecionar((anterior) => {
      const novo = new Set(anterior);
      for (const id of ids) {
        if (marcado) novo.add(id);
        else novo.delete(id);
      }
      return novo;
    });
  }
  const metricas = [
    { id: "todos", nome: "Total de itens", valor: todos.length, Icone: Layers3 },
    {
      id: "sem_preco",
      nome: "Sem preço",
      valor: todos.filter((i) => i.preco === null).length,
      Icone: CircleAlert,
    },
    {
      id: "restricao",
      nome: "Com restrição de horário/dia",
      valor: todos.filter(temRestricao).length,
      Icone: Clock3,
    },
    {
      id: "indisponiveis",
      nome: "Indisponíveis agora",
      valor: todos.filter((i) => disponivelAgora(i) === false).length,
      Icone: Store,
    },
  ] as const;
  return (
    <div className="mt-6 min-w-0 space-y-5 pb-28">
      <div
        className="flex gap-2 overflow-x-auto border-b border-base-200 pb-3"
        aria-label="Unidades"
      >
        {unidades.map((u) => {
          const lista = itens.filter((i) => i.unidade === u.codigo);
          return (
            <button
              key={u.codigo}
              aria-pressed={unidade === u.codigo}
              className={`flex min-h-14 shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${foco} ${unidade === u.codigo ? "border-purple-800 bg-purple-800 text-white shadow-sm" : "border-base-200 bg-card text-ink-700 hover:border-purple-300"}`}
              onClick={() => filtrar({ unidade: u.codigo })}
            >
              <Store className="size-4" />
              <span className="text-sm font-semibold">
                {u.nome}
                <span
                  className={`ml-2 rounded-md px-1.5 py-0.5 text-xs ${unidade === u.codigo ? "bg-white/15" : "bg-base-100"}`}
                >
                  {carregando ? "…" : lista.length}
                </span>
                {!carregando && !lista.some((i) => i.preco !== null) && (
                  <span
                    className={`mt-1 block text-xs font-normal ${unidade === u.codigo ? "text-white/85" : "text-amber-800"}`}
                  >
                    Sem cardápio
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {!carregando && !erro && todos.length > 0 && !todos.some((i) => i.preco !== null) && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Esta unidade ainda não tem itens com preço. Você pode consultar o catálogo e organizar a
          disponibilidade.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricas.map(({ id, nome, valor, Icone }) => (
          <button
            key={id}
            disabled={carregando || Boolean(erro)}
            aria-pressed={filtros.filtro === id}
            className={`rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-purple-300 ${foco} ${filtros.filtro === id ? "border-purple-400 ring-1 ring-purple-100" : "border-base-200"}`}
            onClick={() => filtrar({ filtro: id })}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink-500">{nome}</span>
              <Icone
                className={`size-4 shrink-0 ${id === "sem_preco" ? "text-amber-700" : "text-purple-500"}`}
              />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-purple-900">
              {carregando ? "—" : valor}
            </p>
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <label className="relative block">
          <Search className="absolute left-4 top-4 size-5 text-ink-500" />
          <span className="sr-only">Buscar em todas as categorias</span>
          <input
            type="search"
            maxLength={200}
            value={filtros.busca}
            onChange={(e) => filtrar({ busca: e.target.value })}
            placeholder="Buscar item, descrição ou categoria…"
            className={`h-14 w-full rounded-xl border border-base-200 bg-card pl-12 pr-4 text-base shadow-sm placeholder:text-ink-500 ${foco}`}
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtros rápidos">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              aria-pressed={filtros.filtro === c.id}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${foco} ${filtros.filtro === c.id ? "border-purple-200 bg-purple-100 text-purple-900" : "border-base-200 bg-card text-ink-700 hover:bg-base-50"}`}
              onClick={() => filtrar({ filtro: c.id })}
            >
              {c.nome}
            </button>
          ))}
        </div>
      </div>
      {referencia && !carregando && !erro && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
          <Clock3 className="size-4 shrink-0" />
          Situação de agora calculada pelo gateway em {referencia} (horário da unidade): dias,
          feriados da unidade, horários, preço e ativo.
          <button
            className={`inline-flex items-center gap-1 rounded font-medium text-purple-800 hover:underline ${foco}`}
            onClick={atualizar}
          >
            <RefreshCw className="size-3" />
            Atualizar
          </button>
        </p>
      )}
      {!admin && (
        <p className="text-sm text-ink-500">
          Modo de consulta · você pode ver os itens e suas regras de disponibilidade.
        </p>
      )}
      {erro ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p>{erro}</p>
          <Button variant="outline" className="mt-3" onClick={atualizar}>
            Tentar novamente
          </Button>
        </div>
      ) : carregando ? (
        <div aria-label="Carregando cardápio" className="space-y-3">
          {[1, 2, 3, 4].map((x) => (
            <Skeleton key={x} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="sticky top-0 z-20 min-w-0 bg-base-50 py-2 lg:top-6">
            <p className="mb-3 hidden text-[11px] font-semibold uppercase tracking-widest text-ink-500 lg:block">
              Categorias
            </p>
            <nav
              aria-label="Categorias do cardápio"
              className="flex gap-1 overflow-x-auto lg:flex-col"
            >
              {grupos.map((g) => (
                <button
                  key={g.nome}
                  className={`flex min-h-11 shrink-0 items-center justify-between gap-4 rounded-lg px-3 text-left text-sm ${foco} ${categoriaAtiva === g.nome ? "bg-purple-100 font-semibold text-purple-900" : "text-ink-700 hover:bg-base-100"}`}
                  onClick={() => {
                    setCategoriaAtiva(g.nome);
                    const el = categoriaRefs.current.get(g.nome);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    el?.focus({ preventScroll: true });
                  }}
                >
                  <span>{g.nome}</span>
                  <span className="text-xs tabular-nums text-ink-500">{g.itens.length}</span>
                </button>
              ))}
            </nav>
          </aside>
          <main className="min-w-0 space-y-6" aria-label="Itens do cardápio">
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>
                {visiveis.length} itens · {unidadeNome}
              </span>
              <span>
                {admin ? "Clique no item para gerenciar" : "Clique no item para consultar"}
              </span>
            </div>
            {!grupos.length && (
              <div className="rounded-xl border border-dashed border-base-200 bg-card px-6 py-14 text-center">
                <p className="font-display text-2xl text-purple-800">
                  {filtros.filtro === "sem_preco" && !filtros.busca
                    ? "Nenhum item sem preço 🎉"
                    : todos.length === 0
                      ? "Esta unidade ainda não tem itens com preço"
                      : "Nenhum item neste filtro"}
                </p>
                <p className="mt-2 text-sm text-ink-500">
                  {todos.length
                    ? "Experimente outra busca ou veja todos os itens."
                    : "Quando o catálogo for cadastrado, os itens aparecerão aqui."}
                </p>
                {todos.length > 0 && (
                  <Button
                    className="mt-5"
                    variant="outline"
                    onClick={() => filtrar({ busca: "", filtro: "todos" })}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            )}
            {grupos.map((g) => (
              <section
                key={g.nome}
                className="scroll-mt-20"
                tabIndex={-1}
                aria-label={g.nome}
                ref={(el) => {
                  if (el) categoriaRefs.current.set(g.nome, el);
                  else categoriaRefs.current.delete(g.nome);
                }}
              >
                <header className="sticky top-14 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-base-200 bg-base-50 py-3 lg:top-0">
                  <h2 className="font-display text-xl text-purple-900">
                    {g.nome}
                    <span className="ml-2 font-sans text-xs text-ink-500">{g.itens.length}</span>
                  </h2>
                  {admin && (
                    <label className="flex min-h-10 items-center gap-2 text-xs text-ink-500">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar todos de ${g.nome}`}
                        checked={g.itens.every((i) => selecionados.has(i.item_id))}
                        onChange={(e) =>
                          marcar(
                            g.itens.map((i) => i.item_id),
                            e.target.checked,
                          )
                        }
                        className="size-4 accent-purple-800"
                      />
                      Selecionar categoria
                    </label>
                  )}
                </header>
                <div className="mt-2 space-y-2 sm:space-y-0 sm:overflow-hidden sm:rounded-xl sm:border sm:border-base-200 sm:bg-card sm:divide-y sm:divide-base-200">
                  {g.itens.map((i) => (
                    <div
                      key={i.item_id}
                      className={`flex items-center rounded-xl border border-base-200 bg-card transition hover:bg-purple-50/40 sm:rounded-none sm:border-0 ${selecionados.has(i.item_id) ? "bg-purple-50" : ""}`}
                    >
                      {admin && (
                        <label className="flex min-h-16 w-11 shrink-0 items-center justify-center">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${i.nome}`}
                            checked={selecionados.has(i.item_id)}
                            onChange={(e) => marcar([i.item_id], e.target.checked)}
                            className="size-4 accent-purple-800"
                          />
                        </label>
                      )}
                      <button
                        className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-5 text-left ${admin ? "pl-0" : ""} ${foco}`}
                        onClick={() => mostrar(i)}
                        aria-label={`Abrir ${i.nome}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <h3 className="text-sm font-semibold text-ink-900">{i.nome}</h3>
                            {!admin && (
                              <span
                                className={`shrink-0 text-sm font-semibold tabular-nums ${i.preco === null ? "rounded bg-amber-50 px-2 py-1 text-amber-800" : "text-purple-900"}`}
                              >
                                {precoTexto(i.preco)}
                              </span>
                            )}
                          </div>
                          {i.descricao && (
                            <p className="mt-1 line-clamp-1 text-sm text-ink-500">{i.descricao}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                            {temRestricao(i) && (
                              <span className="rounded-md bg-purple-50 px-2 py-1 text-purple-800">
                                {i.disponibilidade?.resumo ||
                                  resumoRascunho(rascunhoDe(i.disponibilidade))}
                              </span>
                            )}
                            {disponivelAgora(i) === false && (
                              <span className="rounded-md bg-red-50 px-2 py-1 font-medium text-red-700">
                                {situacaoAgora(i)}
                              </span>
                            )}
                            {disponivelAgora(i) === true && temRestricao(i) && (
                              <span className="rounded-md bg-green-50 px-2 py-1 text-green-800">
                                {situacaoAgora(i)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-ink-300" />
                      </button>
                      {admin && <PrecoRapido item={i} servicos={servicos} />}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </main>
        </div>
      )}
      {admin && alvos.length > 0 && (
        <div
          className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-purple-900 p-4 text-white shadow-xl"
          role="region"
          aria-label="Ações em lote"
        >
          <span className="text-sm font-semibold">{alvos.length} itens selecionados</span>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-white text-purple-900 hover:bg-purple-100"
              onClick={() => mostrar("lote")}
            >
              Definir disponibilidade
            </Button>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => mostrar("sempre")}
            >
              Tornar sempre disponível
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Limpar seleção"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => selecionar(new Set())}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}
      {aberto && typeof aberto !== "string" && (
        <ItemCat2
          key={aberto.item_id}
          item={aberto}
          admin={admin}
          itens={todos}
          unidadeNome={unidadeNome}
          servicos={servicos}
          fechar={fechar}
          proteger={proteger}
        />
      )}
      {admin && typeof aberto === "string" && (
        <PainelLote
          key={aberto}
          alvos={alvos}
          sempre={aberto === "sempre"}
          unidadeNome={unidadeNome}
          itens={todos}
          salvar={salvar}
          fechar={fechar}
          concluido={() => selecionar(new Set())}
          proteger={proteger}
        />
      )}
    </div>
  );
}
/** Edição de disponibilidade em lote; o item único usa o painel ItemCat2. */
function PainelLote({
  alvos,
  sempre,
  unidadeNome,
  itens,
  salvar,
  fechar,
  concluido,
  proteger,
}: {
  alvos: ItemCardapio[];
  sempre: boolean;
  unidadeNome: string;
  itens: ItemCardapio[];
  salvar: SalvarItem;
  fechar: () => void;
  concluido: () => void;
  proteger: ((v: boolean) => void) | undefined;
}) {
  const [lote] = useState(alvos);
  const inicial = rascunhoDe(null);
  const [r, setR] = useState<RascunhoDisponibilidade>(inicial);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoLote[] | null>(null);
  const sujo = JSON.stringify(r) !== JSON.stringify(inicial);
  const problema = problemaRascunho(r);
  useEffect(() => {
    proteger?.(busy || (sujo && !resultados));
    return () => proteger?.(false);
  }, [busy, sujo, resultados, proteger]);
  const sair = () => {
    if (!busy && (!sujo || resultados || window.confirm("Descartar alterações não salvas?")))
      fechar();
  };
  useEffect(() => {
    if (!sujo && !busy) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const trocar = (e: Event) => {
      if (busy || !window.confirm("Descartar alterações não salvas?")) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("gestao:trocar", trocar);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("gestao:trocar", trocar);
    };
  }, [sujo, busy]);
  async function gravar() {
    if (busy || problema) return;
    setBusy(true);
    setErro(null);
    try {
      setResultados([]);
      const lista = await aplicarLote(lote, sempre ? rascunhoDe(null) : r, salvar, setResultados);
      const ok = lista.filter((x) => x.ok).length;
      toast[ok === lista.length ? "success" : "error"](
        `${ok} atualizados, ${lista.length - ok} falharam.`,
      );
      concluido();
    } catch {
      setErro("Não foi possível confirmar a gravação. Confira os itens antes de tentar novamente.");
      toast.error("Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  const total = lote.length;
  const terminados = resultados?.length ?? 0;
  return (
    <Sheet
      open
      onOpenChange={(v) => {
        if (!v) sair();
      }}
    >
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[540px]"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <header className="shrink-0 border-b border-base-200 px-6 pb-5 pt-7 pr-12">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-purple-600">
            Edição em lote
          </p>
          <SheetTitle className="font-display text-2xl text-purple-900">
            {sempre ? "Tornar sempre disponível" : "Definir disponibilidade"}
          </SheetTitle>
          <SheetDescription className="mt-2">
            {total} itens · {unidadeNome}
          </SheetDescription>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {resultados ? (
            <div className="space-y-4" aria-live="polite">
              <h3 className="font-semibold">
                {busy ? "Atualizando disponibilidade…" : "Resultado da atualização"}
              </h3>
              <div
                role="progressbar"
                aria-label="Progresso da atualização"
                aria-valuemin={0}
                aria-valuemax={Math.max(total, 1)}
                aria-valuenow={terminados}
                className="h-2 overflow-hidden rounded-full bg-purple-100"
              >
                <div
                  className="h-full rounded-full bg-purple-700 transition-all"
                  style={{ width: `${(terminados / Math.max(total, 1)) * 100}%` }}
                />
              </div>
              <p className="text-sm">
                {terminados} de {total} processados · {resultados.filter((x) => x.ok).length}{" "}
                atualizados · {resultados.filter((x) => !x.ok).length} falharam
              </p>
              {resultados.map((x) => (
                <div
                  key={x.item.item_id}
                  className={`rounded-lg border p-3 text-sm ${x.ok ? "border-base-200" : "border-red-200 bg-red-50"}`}
                >
                  <p className="flex items-center gap-2 font-medium">
                    {x.ok ? (
                      <Check className="size-4 text-green-700" />
                    ) : (
                      <CircleAlert className="size-4 text-red-700" />
                    )}
                    {x.item.nome}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {x.ok ? "Disponibilidade salva" : x.mensagem}
                  </p>
                </div>
              ))}
            </div>
          ) : sempre ? (
            <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
              <h3 className="font-semibold">Remover regras de dias e horários?</h3>
              <p className="mt-2 text-sm">
                Os {total} itens ficarão sem restrições de disponibilidade, inclusive em feriados.
                Isso não ativa itens inativos nem cadastra preços.
              </p>
              <p className="mt-3 text-xs text-ink-500">
                Será feita uma atualização por item; o resultado aparece aqui.
              </p>
            </div>
          ) : (
            <DisponibilidadeEditor r={r} mudar={setR} busy={busy} itens={itens} />
          )}
          {(erro || (sujo && problema)) && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {erro || problema}
            </p>
          )}
        </div>
        <footer className="shrink-0 border-t border-base-200 bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-500">
              {busy
                ? "Não feche até terminar"
                : resultados
                  ? "Atualização concluída"
                  : sujo
                    ? "Alterações não salvas"
                    : "Salve para aplicar"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={sair}>
                {resultados ? "Fechar" : "Cancelar"}
              </Button>
              {!resultados && (
                <Button disabled={busy || Boolean(problema)} onClick={() => void gravar()}>
                  {busy ? "Salvando…" : "Aplicar aos itens"}
                </Button>
              )}
            </div>
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
