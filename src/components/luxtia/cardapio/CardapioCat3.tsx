import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { precoTexto, type ItemCardapio } from "@/lib/gateway/cardapio";
import { situacaoAgora, horaReferencia, type ServicosCat2 } from "@/lib/gateway/cardapio-cat2";
import {
  filtrarCardapio,
  type BuscaCardapio,
  type FiltroCardapio,
} from "@/lib/gateway/cardapio-ux";
import {
  moverNaOrdem,
  ordenarItens,
  type CategoriaCat3,
  type ExecutarCat3,
  type LinhaResultado,
  type PedidoCat3,
} from "@/lib/gateway/cat3";
import { ItemCat2, PrecoRapido } from "./ItemCat2";
import { ItemCat3 } from "./ItemCat3";
import { LoteCat3, ResultadoCat3, SugestoesCat3 } from "./OperacoesCat3";

type Unidade = { codigo: string; nome: string; fuso?: string };

const FILTROS_RAPIDOS: { id: FiltroCardapio; nome: string }[] = [
  { id: "todos", nome: "Todos" },
  { id: "disponiveis", nome: "Disponíveis" },
  { id: "indisponiveis", nome: "Indisponíveis" },
  { id: "esgotados", nome: "Esgotados" },
  { id: "sem_preco", nome: "Sem preço" },
];

const FILTROS_MAIS: { id: FiltroCardapio; nome: string }[] = [
  { id: "restricao", nome: "Com restrição" },
  { id: "inativos", nome: "Inativos" },
  { id: "arquivados", nome: "Arquivados" },
];

function seloStatus(i: ItemCardapio) {
  if (i.arquivado) return { texto: "Arquivado", classe: "bg-base-200 text-ink-600" };
  if (!i.ativo) return { texto: "Inativo", classe: "bg-base-200 text-ink-600" };
  if (i.esgotado_agora ?? i.indisponivel_motivo === "esgotado")
    return { texto: "Esgotado", classe: "bg-amber-100 text-amber-900" };
  if (i.preco === null) return { texto: "Sem preço", classe: "bg-orange-100 text-orange-900" };
  if (i.disponivel_agora === true)
    return { texto: "Disponível", classe: "bg-emerald-100 text-emerald-900" };
  if (i.disponivel_agora === false)
    return {
      texto: situacaoAgora(i).replace(/^Agora:\s*/i, ""),
      classe: "bg-amber-100 text-amber-900",
    };
  return { texto: "Sem informação", classe: "bg-base-100 text-ink-500" };
}

function textoEsgotado(i: ItemCardapio, unidades: Unidade[]) {
  if (!(i.esgotado_agora ?? i.indisponivel_motivo === "esgotado")) return null;
  if (!i.esgotado_ate) return "até reposição";
  const fuso = unidades.find((u) => u.codigo === i.unidade)?.fuso;
  if (fuso)
    return `até ${new Date(i.esgotado_ate).toLocaleString("pt-BR", {
      timeZone: fuso,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  return `até ${horaReferencia(i.esgotado_ate)}`;
}

export function CardapioCat3({
  itens,
  unidades,
  admin,
  grade = false,
  servicos,
  executar,
  filtros,
  mudarFiltros,
  carregando,
  erro,
  atualizar,
  proteger,
}: {
  itens: ItemCardapio[];
  unidades: Unidade[];
  admin: boolean;
  /** Supervisor edita disponibilidade e horários, sem preço nem exclusão. */
  grade?: boolean;
  servicos: ServicosCat2;
  executar: ExecutarCat3;
  filtros: BuscaCardapio;
  mudarFiltros: (f: BuscaCardapio) => void;
  carregando: boolean;
  erro?: string | undefined;
  atualizar: () => void;
  proteger: (v: boolean) => void;
}) {
  const unidade = filtros.unidade || unidades[0]?.codigo || "";
  const [categorias, setCategorias] = useState<CategoriaCat3[]>([]),
    [categoriaErro, setCategoriaErro] = useState(""),
    [revisao, setRevisao] = useState(0),
    [categoriasBusy, setCategoriasBusy] = useState(true);
  const [aba, setAba] = useState("itens"),
    [editar, setEditar] = useState<ItemCardapio | null | undefined>(undefined),
    [selecionados, setSelecionados] = useState<number[]>([]),
    [lote, setLote] = useState(false),
    [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{
      acao: "criar_categoria" | "renomear" | "arquivar_categoria" | "copiar" | "mover";
      id?: number;
      nome?: string;
    } | null>(null),
    [nome, setNome] = useState(""),
    [destino, setDestino] = useState(""),
    [modo, setModo] = useState("arquivar"),
    [erroModal, setErroModal] = useState(""),
    [resultados, setResultados] = useState<LinhaResultado[]>([]);
  const [drag, setDrag] = useState<{
    tipo: "categoria" | "item";
    id: number;
    categoria?: number;
  } | null>(null);
  const [verFiltros, setVerFiltros] = useState(false);
  const [fechadas, setFechadas] = useState<Set<number>>(new Set());
  const [categoriaAtiva, setCategoriaAtiva] = useState<number | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const reler = () => {
    atualizar();
    setRevisao((x) => x + 1);
  };

  useEffect(() => {
    if (!unidade) return;
    let vivo = true;
    setCategoriasBusy(true);
    setCategoriaErro("");
    Promise.all([
      servicos.categorias(unidade),
      ...(filtros.filtro === "arquivados" ? [servicos.categorias(unidade, true)] : []),
    ])
      .then((rs) => {
        const porId = new Map<number, CategoriaCat3>();
        for (const pagina of rs)
          for (const c of pagina.categorias as CategoriaCat3[]) porId.set(c.id, c);
        if (vivo) {
          setCategorias([...porId.values()]);
          setCategoriasBusy(false);
        }
      })
      .catch(() => {
        if (vivo) {
          setCategoriaErro("Não foi possível carregar as categorias.");
          setCategoriasBusy(false);
        }
      });
    return () => {
      vivo = false;
    };
  }, [unidade, servicos, revisao, filtros.filtro]);

  useEffect(() => {
    setSelecionados([]);
    setEditar(undefined);
    setModal(null);
    setResultados([]);
    setFechadas(new Set());
    setCategoriaAtiva(null);
  }, [unidade, filtros.filtro]);

  const daUnidade = itens.filter((i) => i.unidade === unidade);
  const filtrados = filtrarCardapio(itens, { ...filtros, unidade }).filter(
    (i) =>
      (!filtros.categoria || String(i.categoria_id) === filtros.categoria) &&
      (!filtros.prato || String(i.prato?.id) === filtros.prato),
  );

  const resumo = [
    { nome: "Itens", valor: daUnidade.length, filtro: "todos" as const },
    {
      nome: "Sem preço",
      valor: daUnidade.filter((i) => i.preco === null).length,
      filtro: "sem_preco" as const,
    },
    {
      nome: "Esgotados",
      valor: daUnidade.filter((i) => i.esgotado_agora ?? i.indisponivel_motivo === "esgotado")
        .length,
      filtro: "esgotados" as const,
    },
    {
      nome: "Indisponíveis",
      valor: daUnidade.filter((i) => i.disponivel_agora === false).length,
      filtro: "indisponiveis" as const,
    },
  ];

  const filtrosAtivos =
    (filtros.filtro !== "todos" ? 1 : 0) +
    (filtros.categoria ? 1 : 0) +
    (filtros.prato ? 1 : 0) +
    (filtros.busca.trim() ? 1 : 0);

  const pratos = useMemo(
    () => [
      ...new Map(daUnidade.filter((i) => i.prato).map((i) => [i.prato!.id, i.prato!])).values(),
    ],
    [daUnidade],
  );

  const categoriasVisiveis = categorias.filter(
    (c) => !filtros.categoria || String(c.id) === filtros.categoria,
  );

  useEffect(() => {
    if (carregando || categoriasBusy || !listaRef.current) return;
    const root = listaRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const visivel = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visivel) return;
        const id = Number((visivel.target as HTMLElement).dataset["categoriaId"]);
        if (Number.isFinite(id)) setCategoriaAtiva(id);
      },
      { root: null, rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    );
    for (const el of root.querySelectorAll<HTMLElement>("[data-categoria-id]")) obs.observe(el);
    return () => obs.disconnect();
  }, [carregando, categoriasBusy, categoriasVisiveis, filtrados.length, unidade]);

  async function agir(p: PedidoCat3) {
    setBusy(true);
    try {
      const r = await executar(p);
      if (!r.ok) {
        toast.error(r.erro.mensagem);
        return false;
      }
      const rs = (r.dados as { resultados?: LinhaResultado[] })?.resultados;
      if (rs) setResultados(rs);
      toast.success("Operação concluída.");
      reler();
      return true;
    } catch {
      toast.error("Resultado não confirmado. Atualize antes de repetir.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function ativo(i: ItemCardapio) {
    setBusy(true);
    try {
      const r = await servicos.editar(i, { ativo: !i.ativo, aplicar_em: "este" });
      if (!r.ok) {
        toast.error(
          r.atual
            ? "Este item foi alterado por outra pessoa. Abra o item para conferir."
            : r.mensagem,
        );
        return;
      }
      toast.success("Disponibilidade atualizada.");
      reler();
    } catch {
      toast.error("Não foi possível confirmar a alteração.");
    } finally {
      setBusy(false);
    }
  }

  function abrir(m: NonNullable<typeof modal>) {
    setModal(m);
    setNome(m.nome ?? "");
    setDestino("");
    setModo("arquivar");
    setErroModal("");
  }

  async function salvarModal() {
    if (!modal) return;
    let pedido: PedidoCat3;
    if (modal.acao === "criar_categoria") pedido = { acao: "categoria_criar", unidade, nome };
    else if (modal.acao === "renomear")
      pedido = { acao: "categoria_renomear", id: modal.id!, nome };
    else if (modal.acao === "arquivar_categoria")
      pedido = {
        acao: "categoria_arquivar",
        id: modal.id!,
        itens: modo as "arquivar" | "mover",
        ...(modo === "mover" ? { destino: Number(destino) } : {}),
      };
    else if (modal.acao === "copiar")
      pedido = { acao: "copiar", itens: [modal.id!], destino, ligar: true };
    else
      pedido = {
        acao: "lote",
        itens: [modal.id!],
        operacao: "mover",
        categoria_id: Number(destino),
        simulacao: false,
      };
    setBusy(true);
    setErroModal("");
    try {
      const r = await executar(pedido);
      if (!r.ok) {
        setErroModal(r.erro.mensagem);
        return;
      }
      const rs = (r.dados as { resultados?: LinhaResultado[] })?.resultados;
      if (rs) setResultados(rs);
      setModal(null);
      reler();
      toast.success("Operação concluída.");
    } catch {
      setErroModal("Resultado não confirmado. Atualize antes de repetir.");
    } finally {
      setBusy(false);
    }
  }

  function categoriaOrdem(de: number, para: number) {
    if (de === para) return;
    void agir({
      acao: "ordenar_categorias",
      unidade,
      categorias: moverNaOrdem(
        categorias.map((c) => c.id),
        de,
        para,
      ),
    });
  }

  function itemOrdem(categoria: number, de: number, para: number) {
    if (de === para) return;
    void agir({
      acao: "ordenar_itens",
      id: categoria,
      itens: moverNaOrdem(
        ordenarItens(daUnidade.filter((i) => i.categoria_id === categoria)).map((i) => i.item_id),
        de,
        para,
      ),
    });
  }

  const moverUnidade = (codigo: string) => {
    if (editar !== undefined) return;
    mudarFiltros({ ...filtros, unidade: codigo, categoria: "", prato: "" });
  };

  function irParaCategoria(id: number) {
    setCategoriaAtiva(id);
    setFechadas((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    requestAnimationFrame(() => {
      document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function alternarCategoria(id: number) {
    setFechadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const campoSelect =
    "h-10 w-full rounded-lg border border-base-200 bg-card px-3 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500";

  return (
    <div className="mt-4 space-y-4 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-purple-950">
            Cardápio
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Encontre, edite e organize itens por unidade e categoria.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Visão do cardápio"
          className="flex h-10 rounded-lg border border-base-200 bg-card p-0.5"
        >
          {(
            [
              ["itens", "Itens"],
              ["pratos", "Pratos iguais"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className={`rounded-md px-3 text-sm font-medium transition-colors ${
                aba === id ? "bg-purple-800 text-white" : "text-ink-700 hover:bg-base-100"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {aba === "pratos" ? (
        <SugestoesCat3 executar={executar} admin={admin} atualizar={reler} />
      ) : (
        <>
          <div role="tablist" aria-label="Unidade" className="flex gap-1.5 overflow-x-auto pb-1">
            {unidades.map((u) => {
              const qtd = itens.filter((i) => i.unidade === u.codigo).length;
              const ativa = unidade === u.codigo;
              const semCardapio =
                !carregando && !itens.some((i) => i.unidade === u.codigo && i.preco !== null);
              return (
                <button
                  key={u.codigo}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => moverUnidade(u.codigo)}
                  className={`shrink-0 rounded-lg border px-3.5 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-purple-500 ${
                    ativa
                      ? "border-purple-800 bg-purple-900 text-white shadow-sm"
                      : "border-base-200 bg-card text-ink-700 hover:border-purple-300"
                  }`}
                >
                  <span className="block text-sm font-semibold leading-tight">{u.nome}</span>
                  <span
                    className={`mt-0.5 block text-[11px] ${ativa ? "text-white/75" : "text-ink-500"}`}
                  >
                    {qtd} {qtd === 1 ? "item" : "itens"}
                    {semCardapio
                      ? ` · ${filtros.filtro === "arquivados" ? "sem arquivados" : "sem cardápio"}`
                      : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="sticky top-0 z-20 -mx-1 space-y-3 rounded-xl border border-base-200 bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
                  aria-hidden
                />
                <Input
                  aria-label="Buscar no cardápio"
                  placeholder="Buscar por nome, código ou descrição…"
                  className="h-10 rounded-lg pl-9"
                  value={filtros.busca}
                  onChange={(e) => mudarFiltros({ ...filtros, busca: e.target.value })}
                />
                {filtros.busca ? (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-base-100 hover:text-ink-700"
                    onClick={() => mudarFiltros({ ...filtros, busca: "" })}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-1.5 rounded-lg"
                aria-expanded={verFiltros}
                onClick={() => setVerFiltros((v) => !v)}
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                <span className="hidden sm:inline">Filtros</span>
                {filtrosAtivos > 0 ? (
                  <span className="rounded-full bg-purple-800 px-1.5 text-[11px] font-semibold text-white">
                    {filtrosAtivos}
                  </span>
                ) : null}
              </Button>
              {admin && (
                <>
                  <Button
                    className="h-10 rounded-lg"
                    disabled={!unidade || categoriasBusy}
                    onClick={() => setEditar(null)}
                  >
                    <Plus className="size-4" /> Novo item
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-lg"
                    disabled={!unidade}
                    onClick={() => abrir({ acao: "criar_categoria" })}
                  >
                    Nova categoria
                  </Button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {resumo.map((r) => (
                <button
                  key={r.nome}
                  type="button"
                  onClick={() => mudarFiltros({ ...filtros, filtro: r.filtro })}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-purple-500 ${
                    filtros.filtro === r.filtro
                      ? "border-purple-800 bg-purple-100 text-purple-950"
                      : "border-base-200 bg-base-50 text-ink-700 hover:border-purple-300"
                  }`}
                >
                  {r.nome}
                  <strong className="tabular-nums">{carregando ? "—" : r.valor}</strong>
                </button>
              ))}
              <span className="mx-1 hidden h-4 w-px bg-base-200 sm:inline-block" aria-hidden />
              {FILTROS_RAPIDOS.filter((f) => !resumo.some((r) => r.filtro === f.id)).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filtros.filtro === f.id}
                  onClick={() => mudarFiltros({ ...filtros, filtro: f.id })}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    filtros.filtro === f.id
                      ? "border-purple-800 bg-purple-100 text-purple-950"
                      : "border-transparent bg-transparent text-ink-600 hover:bg-base-100"
                  }`}
                >
                  {f.nome}
                </button>
              ))}
              {FILTROS_MAIS.map((f) =>
                filtros.filtro === f.id || verFiltros ? (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={filtros.filtro === f.id}
                    onClick={() => mudarFiltros({ ...filtros, filtro: f.id })}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      filtros.filtro === f.id
                        ? "border-purple-800 bg-purple-100 text-purple-950"
                        : "border-transparent bg-transparent text-ink-600 hover:bg-base-100"
                    }`}
                  >
                    {f.nome}
                  </button>
                ) : null,
              )}
              {filtrosAtivos > 0 ? (
                <button
                  type="button"
                  className="ml-auto text-xs font-medium text-purple-800 hover:underline"
                  onClick={() =>
                    mudarFiltros({
                      ...filtros,
                      busca: "",
                      filtro: "todos",
                      categoria: "",
                      prato: "",
                    })
                  }
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>

            {verFiltros ? (
              <div className="grid gap-2 border-t border-base-100 pt-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-ink-500">
                  Categoria
                  <select
                    aria-label="Filtrar por categoria"
                    className={campoSelect}
                    value={filtros.categoria ?? ""}
                    onChange={(e) => mudarFiltros({ ...filtros, categoria: e.target.value })}
                  >
                    <option value="">Todas as categorias</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-ink-500">
                  Prato ligado
                  <select
                    aria-label="Filtrar por prato"
                    className={campoSelect}
                    value={filtros.prato ?? ""}
                    onChange={(e) => mudarFiltros({ ...filtros, prato: e.target.value })}
                  >
                    <option value="">Todos os pratos</option>
                    {pratos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>

          {(erro || categoriaErro) && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {erro || categoriaErro}{" "}
              <button type="button" className="font-medium underline" onClick={reler}>
                Tentar novamente
              </button>
            </p>
          )}
          {resultados.length > 0 && <ResultadoCat3 linhas={resultados} />}

          {carregando || categoriasBusy ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <nav
                aria-label="Categorias"
                className="sticky top-[9.5rem] hidden max-h-[calc(100vh-11rem)] overflow-y-auto rounded-xl border border-base-200 bg-card p-2 lg:block"
              >
                <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  Categorias
                </p>
                <ul className="space-y-0.5">
                  {categoriasVisiveis.map((c) => {
                    const qtd = filtrados.filter((i) => i.categoria_id === c.id).length;
                    const ativa = categoriaAtiva === c.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => irParaCategoria(c.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                            ativa
                              ? "bg-purple-100 font-semibold text-purple-950"
                              : "text-ink-700 hover:bg-base-100"
                          }`}
                        >
                          <span className="truncate">{c.nome}</span>
                          <span
                            className={`tabular-nums text-xs ${ativa ? "text-purple-700" : "text-ink-400"}`}
                          >
                            {qtd}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {!categoriasVisiveis.length ? (
                  <p className="px-2 py-3 text-xs text-ink-500">Nenhuma categoria.</p>
                ) : null}
              </nav>

              <div ref={listaRef} className="min-w-0 space-y-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
                  {categoriasVisiveis.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => irParaCategoria(c.id)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                        categoriaAtiva === c.id
                          ? "border-purple-800 bg-purple-100 text-purple-950"
                          : "border-base-200 bg-card text-ink-700"
                      }`}
                    >
                      {c.nome}
                      <span className="ml-1 text-ink-400">
                        {filtrados.filter((i) => i.categoria_id === c.id).length}
                      </span>
                    </button>
                  ))}
                </div>

                {categoriasVisiveis.map((c, ci) => {
                  const linhas = ordenarItens(filtrados.filter((i) => i.categoria_id === c.id));
                  const fechada = fechadas.has(c.id);
                  return (
                    <section
                      id={`cat-${c.id}`}
                      key={c.id}
                      data-categoria-id={c.id}
                      className="scroll-mt-36 overflow-hidden rounded-xl border border-base-200 bg-card shadow-sm"
                      onDragOver={(e) => {
                        if (drag?.tipo === "categoria") e.preventDefault();
                      }}
                      onDrop={(e) => {
                        if (drag?.tipo === "categoria") {
                          e.preventDefault();
                          categoriaOrdem(drag.id, c.id);
                          setDrag(null);
                        }
                      }}
                    >
                      <header className="sticky top-[8.75rem] z-10 flex flex-wrap items-center gap-1 border-b border-base-100 bg-purple-50/95 px-2 py-2 backdrop-blur sm:px-3">
                        <button
                          type="button"
                          aria-expanded={!fechada}
                          aria-label={`${fechada ? "Expandir" : "Recolher"} ${c.nome}`}
                          className="rounded p-1.5 text-ink-600 hover:bg-purple-100"
                          onClick={() => alternarCategoria(c.id)}
                        >
                          {fechada ? (
                            <ChevronRight className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </button>
                        {admin && (
                          <div className="flex items-center opacity-60 transition group-hover:opacity-100 hover:opacity-100">
                            <button
                              aria-label={`Arrastar categoria ${c.nome}`}
                              draggable
                              disabled={busy}
                              onDragStart={() => setDrag({ tipo: "categoria", id: c.id })}
                              onDragEnd={() => setDrag(null)}
                              className="cursor-grab rounded p-1.5 hover:bg-purple-100"
                            >
                              <GripVertical className="size-4" />
                            </button>
                            <button
                              aria-label={`Subir categoria ${c.nome}`}
                              disabled={busy || ci === 0}
                              className="rounded p-1 hover:bg-purple-100 disabled:opacity-30"
                              onClick={() => categoriaOrdem(c.id, categorias[ci - 1]!.id)}
                            >
                              <ArrowUp className="size-3.5" />
                            </button>
                            <button
                              aria-label={`Descer categoria ${c.nome}`}
                              disabled={busy || ci === categorias.length - 1}
                              className="rounded p-1 hover:bg-purple-100 disabled:opacity-30"
                              onClick={() => categoriaOrdem(c.id, categorias[ci + 1]!.id)}
                            >
                              <ArrowDown className="size-3.5" />
                            </button>
                          </div>
                        )}
                        {admin && linhas.length > 0 && (
                          <input
                            aria-label={`Selecionar todos de ${c.nome}`}
                            type="checkbox"
                            className="mx-1 size-4 accent-purple-800"
                            checked={linhas.every((i) => selecionados.includes(i.item_id))}
                            onChange={(e) =>
                              setSelecionados((x) =>
                                e.target.checked
                                  ? [...new Set([...x, ...linhas.map((i) => i.item_id)])]
                                  : x.filter((id) => !linhas.some((i) => i.item_id === id)),
                              )
                            }
                          />
                        )}
                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-purple-950">
                          {c.nome}
                          <span className="ml-2 text-xs font-normal text-ink-500">
                            {linhas.length} {linhas.length === 1 ? "item" : "itens"}
                          </span>
                        </h3>
                        {admin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Opções da categoria ${c.nome}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => abrir({ acao: "renomear", id: c.id, nome: c.nome })}
                              >
                                Renomear
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  abrir({ acao: "arquivar_categoria", id: c.id, nome: c.nome })
                                }
                              >
                                Arquivar categoria
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </header>

                      {!fechada && !linhas.length && (
                        <p className="px-4 py-8 text-center text-sm text-ink-500">
                          {filtros.filtro === "sem_preco"
                            ? "Nenhum item sem preço nesta categoria."
                            : "Nenhum item com estes filtros."}
                        </p>
                      )}

                      {!fechada &&
                        linhas.map((i, ii) => {
                          const selo = seloStatus(i);
                          const esgotadoTxt = textoEsgotado(i, unidades);
                          const esgotado = i.esgotado_agora ?? i.indisponivel_motivo === "esgotado";
                          return (
                            <article
                              key={i.item_id}
                              className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 border-b border-base-100 px-2 py-2.5 last:border-b-0 hover:bg-base-50/80 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-3 sm:px-3"
                              onDragOver={(e) => {
                                if (drag?.tipo === "item" && drag.categoria === c.id)
                                  e.preventDefault();
                              }}
                              onDrop={(e) => {
                                if (drag?.tipo === "item" && drag.categoria === c.id) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  itemOrdem(c.id, drag.id, i.item_id);
                                  setDrag(null);
                                }
                              }}
                            >
                              {admin ? (
                                <div className="flex items-center gap-0.5 self-start pt-0.5">
                                  <input
                                    type="checkbox"
                                    aria-label={`Selecionar ${i.nome}`}
                                    className="size-4 accent-purple-800"
                                    checked={selecionados.includes(i.item_id)}
                                    onChange={(e) =>
                                      setSelecionados((x) =>
                                        e.target.checked
                                          ? [...x, i.item_id]
                                          : x.filter((id) => id !== i.item_id),
                                      )
                                    }
                                  />
                                  <button
                                    type="button"
                                    draggable
                                    disabled={busy}
                                    aria-label={`Arrastar item ${i.nome}`}
                                    className="cursor-grab rounded p-1 text-ink-300 opacity-0 transition group-hover:opacity-100 hover:bg-base-100 hover:text-ink-600"
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      setDrag({ tipo: "item", id: i.item_id, categoria: c.id });
                                    }}
                                    onDragEnd={() => setDrag(null)}
                                  >
                                    <GripVertical className="size-4" />
                                  </button>
                                  <div className="hidden flex-col opacity-0 transition group-hover:opacity-100 sm:flex">
                                    <button
                                      type="button"
                                      disabled={busy || ii === 0}
                                      aria-label={`Subir item ${i.nome}`}
                                      className="rounded p-0.5 text-ink-400 hover:bg-base-100 disabled:opacity-20"
                                      onClick={() =>
                                        itemOrdem(c.id, i.item_id, linhas[ii - 1]!.item_id)
                                      }
                                    >
                                      <ArrowUp className="size-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy || ii === linhas.length - 1}
                                      aria-label={`Descer item ${i.nome}`}
                                      className="rounded p-0.5 text-ink-400 hover:bg-base-100 disabled:opacity-20"
                                      onClick={() =>
                                        itemOrdem(c.id, i.item_id, linhas[ii + 1]!.item_id)
                                      }
                                    >
                                      <ArrowDown className="size-3" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className="w-1" aria-hidden />
                              )}

                              <button
                                type="button"
                                className="min-w-0 rounded text-left focus-visible:ring-2 focus-visible:ring-purple-500"
                                onClick={() => setEditar(i)}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong className="text-sm font-semibold text-ink-900">
                                    {i.nome}
                                  </strong>
                                  <span
                                    className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${selo.classe}`}
                                  >
                                    {selo.texto}
                                  </span>
                                  {i.codigo ? (
                                    <span className="font-mono text-[11px] text-ink-400">
                                      {i.codigo}
                                    </span>
                                  ) : null}
                                </div>
                                {(i.descricao || i.disponibilidade?.resumo || esgotadoTxt) && (
                                  <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                                    {[i.descricao, i.disponibilidade?.resumo, esgotadoTxt]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                )}
                              </button>

                              <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 sm:col-span-1 sm:flex-nowrap">
                                <div className="min-w-[4.5rem] text-right text-sm font-semibold tabular-nums text-ink-900">
                                  {admin ? (
                                    <PrecoRapido item={i} servicos={servicos} />
                                  ) : (
                                    precoTexto(i.preco)
                                  )}
                                </div>
                                {admin && (
                                  <label className="flex items-center gap-1.5 text-xs text-ink-600">
                                    <Switch
                                      checked={i.ativo}
                                      disabled={busy || i.arquivado}
                                      onCheckedChange={() => void ativo(i)}
                                      aria-label={`Disponível: ${i.nome}`}
                                    />
                                    <span className="hidden xl:inline">Ativo</span>
                                  </label>
                                )}
                                <Button
                                  size="sm"
                                  variant={esgotado ? "secondary" : "outline"}
                                  className="h-8 rounded-lg px-2.5 text-xs"
                                  disabled={busy || i.arquivado}
                                  onClick={() =>
                                    void agir({
                                      acao: "item",
                                      id: i.item_id,
                                      operacao: esgotado ? "repor" : "esgotar",
                                    })
                                  }
                                >
                                  {esgotado ? "Repor" : "Esgotar"}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  aria-label={`Editar ${i.nome}`}
                                  onClick={() => setEditar(i)}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                {admin && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8"
                                        aria-label={`Opções de ${i.nome}`}
                                      >
                                        <MoreHorizontal className="size-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onSelect={() =>
                                          void agir({
                                            acao: "item",
                                            id: i.item_id,
                                            operacao: "duplicar",
                                          })
                                        }
                                      >
                                        Duplicar (inativo)
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onSelect={() =>
                                          abrir({ acao: "mover", id: i.item_id, nome: i.nome })
                                        }
                                      >
                                        Mover
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onSelect={() =>
                                          abrir({ acao: "copiar", id: i.item_id, nome: i.nome })
                                        }
                                      >
                                        Copiar para outra unidade
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onSelect={() => {
                                          if (
                                            window.confirm(
                                              `${i.arquivado ? "Desarquivar" : "Arquivar"} ${i.nome}?`,
                                            )
                                          )
                                            void agir({
                                              acao: "item",
                                              id: i.item_id,
                                              operacao: i.arquivado ? "desarquivar" : "arquivar",
                                            });
                                        }}
                                      >
                                        {i.arquivado ? "Desarquivar" : "Arquivar"}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </article>
                          );
                        })}
                    </section>
                  );
                })}

                {!categorias.length && (
                  <div className="rounded-xl border border-dashed border-base-300 bg-card px-6 py-14 text-center">
                    <p className="text-sm font-medium text-ink-800">
                      Esta unidade ainda não tem categorias.
                    </p>
                    <p className="mt-1 text-sm text-ink-500">
                      {admin
                        ? "Crie uma categoria para começar a organizar o cardápio."
                        : "Aguarde o cadastro pelo administrador."}
                    </p>
                    {admin ? (
                      <Button className="mt-4" onClick={() => abrir({ acao: "criar_categoria" })}>
                        <Plus className="size-4" /> Nova categoria
                      </Button>
                    ) : null}
                  </div>
                )}

                {categorias.length > 0 && !filtrados.length && (
                  <div className="rounded-xl border border-base-200 bg-card px-6 py-10 text-center">
                    <p className="text-sm font-medium text-ink-800">Nenhum item encontrado.</p>
                    <p className="mt-1 text-sm text-ink-500">
                      Ajuste a busca ou os filtros para ver o cardápio.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() =>
                        mudarFiltros({
                          ...filtros,
                          busca: "",
                          filtro: "todos",
                          categoria: "",
                          prato: "",
                        })
                      }
                    >
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {admin && selecionados.length > 0 && (
            <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-purple-950 p-3.5 text-white shadow-lg">
              <span className="text-sm font-medium">
                {selecionados.length}{" "}
                {selecionados.length === 1 ? "item selecionado" : "itens selecionados"}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelecionados([])}>
                  Limpar
                </Button>
                <Button
                  size="sm"
                  disabled={selecionados.length > 500}
                  onClick={() => setLote(true)}
                >
                  Ações em lote
                </Button>
              </div>
              {selecionados.length > 500 && (
                <p className="w-full text-xs text-white/80">Selecione até 500 itens.</p>
              )}
            </div>
          )}
        </>
      )}

      {editar !== undefined &&
        (admin ? (
          <ItemCat3
            item={editar}
            unidade={unidade}
            categorias={categorias}
            itens={daUnidade}
            servicos={servicos}
            executar={executar}
            fechar={() => setEditar(undefined)}
            atualizar={reler}
            proteger={proteger}
          />
        ) : (
          editar && (
            <ItemCat2
              item={editar}
              admin={false}
              grade={grade}
              itens={daUnidade}
              unidadeNome={unidade}
              servicos={servicos}
              fechar={() => setEditar(undefined)}
              proteger={proteger}
            />
          )
        ))}
      {lote && (
        <LoteCat3
          itens={itens.filter((i) => selecionados.includes(i.item_id))}
          categorias={categorias}
          executar={executar}
          atualizar={reler}
          fechar={() => setLote(false)}
        />
      )}
      <Dialog open={!!modal} onOpenChange={(o) => !o && !busy && setModal(null)}>
        <DialogContent>
          <DialogTitle>
            {
              {
                criar_categoria: "Nova categoria",
                renomear: "Renomear categoria",
                arquivar_categoria: "Arquivar categoria",
                copiar: "Copiar para outra unidade",
                mover: "Mover item",
              }[modal?.acao ?? "criar_categoria"]
            }
          </DialogTitle>
          <DialogDescription>
            {modal?.nome || "Organize o cardápio desta unidade."}
          </DialogDescription>
          {modal?.acao === "criar_categoria" || modal?.acao === "renomear" ? (
            <label>
              Nome
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
          ) : (
            <>
              {modal?.acao === "arquivar_categoria" && (
                <label>
                  O que fazer com os itens?
                  <select
                    className="mt-2 w-full rounded border p-3"
                    value={modo}
                    onChange={(e) => setModo(e.target.value)}
                  >
                    <option value="arquivar">Arquivar os itens</option>
                    <option value="mover">Mover para outra categoria</option>
                  </select>
                </label>
              )}
              {(modal?.acao !== "arquivar_categoria" || modo === "mover") && (
                <label>
                  Destino
                  <select
                    className="mt-2 w-full rounded border p-3"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                  >
                    <option value="">Escolha</option>
                    {modal?.acao === "copiar"
                      ? unidades
                          .filter((u) => u.codigo !== unidade)
                          .map((u) => (
                            <option key={u.codigo} value={u.codigo}>
                              {u.nome}
                            </option>
                          ))
                      : categorias
                          .filter((c) => c.id !== modal?.id || modal?.acao !== "arquivar_categoria")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                  </select>
                </label>
              )}
              {modal?.acao === "copiar" && (
                <p className="text-sm text-ink-500">
                  A cópia será criada inativa e ligada ao mesmo prato. Ative-a depois de conferir.
                </p>
              )}
            </>
          )}
          {erroModal && (
            <p role="alert" className="text-red-700">
              {erroModal}
            </p>
          )}
          <Button disabled={busy} onClick={() => void salvarModal()}>
            {busy ? "Salvando…" : "Confirmar"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
