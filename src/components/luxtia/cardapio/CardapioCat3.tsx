import { useEffect, useState } from "react";
import { GripVertical, MoreHorizontal, Plus, ArrowUp, ArrowDown, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { filtrarCardapio, type BuscaCardapio } from "@/lib/gateway/cardapio-ux";
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
export function CardapioCat3({
  itens,
  unidades,
  admin,
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
  }, [unidade, filtros.filtro]);
  const daUnidade = itens.filter((i) => i.unidade === unidade);
  const filtrados = filtrarCardapio(itens, { ...filtros, unidade }).filter(
    (i) =>
      (!filtros.categoria || String(i.categoria_id) === filtros.categoria) &&
      (!filtros.prato || String(i.prato?.id) === filtros.prato),
  );
  const resumo = [
    { nome: "Total de itens", valor: daUnidade.length, filtro: "todos" },
    {
      nome: "Sem preço",
      valor: daUnidade.filter((i) => i.preco === null).length,
      filtro: "sem_preco",
    },
    {
      nome: "Esgotados",
      valor: daUnidade.filter((i) => i.esgotado_agora ?? i.indisponivel_motivo === "esgotado")
        .length,
      filtro: "esgotados",
    },
    {
      nome: "Indisponíveis agora",
      valor: daUnidade.filter((i) => i.disponivel_agora === false).length,
      filtro: "indisponiveis",
    },
  ] as const;
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
  return (
    <div className="mt-6 space-y-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-purple-950">
            Seu cardápio, organizado
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Preços, categorias e disponibilidade no mesmo lugar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={aba === "itens" ? "secondary" : "ghost"} onClick={() => setAba("itens")}>
            Cardápio
          </Button>
          <Button
            variant={aba === "pratos" ? "secondary" : "ghost"}
            onClick={() => setAba("pratos")}
          >
            Pratos iguais nas unidades
          </Button>
        </div>
      </div>
      {aba === "pratos" ? (
        <SugestoesCat3 executar={executar} admin={admin} atualizar={reler} />
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Unidade"
            className="flex gap-2 overflow-x-auto border-b pb-3"
          >
            {unidades.map((u) => (
              <button
                key={u.codigo}
                role="tab"
                aria-selected={unidade === u.codigo}
                onClick={() => moverUnidade(u.codigo)}
                className={`shrink-0 rounded-xl px-5 py-3 text-left focus-visible:ring-2 focus-visible:ring-purple-500 ${unidade === u.codigo ? "bg-purple-900 text-white" : "bg-card text-ink-700"}`}
              >
                <span className="font-semibold">{u.nome}</span>
                <span className="ml-2 text-xs">
                  {itens.filter((i) => i.unidade === u.codigo).length} itens
                </span>
                {!carregando && !itens.some((i) => i.unidade === u.codigo && i.preco !== null) && (
                  <span className="mt-1 block text-xs">
                    {filtros.filtro === "arquivados" ? "Sem arquivados com preço" : "Sem cardápio"}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {resumo.map((r) => (
              <button
                key={r.nome}
                onClick={() => mudarFiltros({ ...filtros, filtro: r.filtro })}
                className="rounded-xl border bg-card p-4 text-left hover:border-purple-400 focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <span className="text-sm text-ink-500">{r.nome}</span>
                <strong className="mt-1 block text-2xl text-purple-950">
                  {carregando ? "—" : r.valor}
                </strong>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-3.5 size-5 text-ink-400" />
              <Input
                aria-label="Buscar no cardápio"
                placeholder="Buscar item em qualquer categoria…"
                className="h-12 pl-10"
                value={filtros.busca}
                onChange={(e) => mudarFiltros({ ...filtros, busca: e.target.value })}
              />
            </div>
            {admin && (
              <>
                <Button
                  className="h-12"
                  disabled={!unidade || categoriasBusy}
                  onClick={() => setEditar(null)}
                >
                  <Plus /> Novo item
                </Button>
                <Button
                  variant="outline"
                  className="h-12"
                  disabled={!unidade}
                  onClick={() => abrir({ acao: "criar_categoria" })}
                >
                  Nova categoria
                </Button>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries({
              todos: "Todos",
              disponiveis: "Disponíveis agora",
              restricao: "Com restrição",
              sem_preco: "Sem preço",
              inativos: "Inativos",
              esgotados: "Esgotados",
              arquivados: "Arquivados",
              indisponiveis: "Indisponíveis agora",
            }).map(([k, v]) => (
              <button
                key={k}
                aria-pressed={filtros.filtro === k}
                className={`rounded-full border px-3 py-2 text-sm ${filtros.filtro === k ? "border-purple-800 bg-purple-100 text-purple-900" : "bg-card"}`}
                onClick={() => mudarFiltros({ ...filtros, filtro: k as BuscaCardapio["filtro"] })}
              >
                {v}
              </button>
            ))}
            <select
              aria-label="Filtrar por categoria"
              className="max-w-48 rounded-lg border bg-card px-2"
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
            <select
              aria-label="Filtrar por prato"
              className="max-w-48 rounded-lg border bg-card px-2"
              value={filtros.prato ?? ""}
              onChange={(e) => mudarFiltros({ ...filtros, prato: e.target.value })}
            >
              <option value="">Todos os pratos</option>
              {[
                ...new Map(
                  daUnidade.filter((i) => i.prato).map((i) => [i.prato!.id, i.prato!]),
                ).values(),
              ].map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          {(erro || categoriaErro) && (
            <p role="alert" className="rounded border border-red-200 p-4 text-red-800">
              {erro || categoriaErro}{" "}
              <button className="underline" onClick={reler}>
                Tentar novamente
              </button>
            </p>
          )}
          {resultados.length > 0 && <ResultadoCat3 linhas={resultados} />}
          {carregando || categoriasBusy ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid items-start gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
              <nav
                aria-label="Categorias"
                className="sticky top-2 flex gap-2 overflow-x-auto lg:flex-col"
              >
                {categorias.map((c) => (
                  <a
                    className="shrink-0 rounded-lg px-3 py-2 text-sm hover:bg-purple-100 focus-visible:ring-2"
                    key={c.id}
                    href={`#cat-${c.id}`}
                  >
                    {c.nome}{" "}
                    <span className="text-ink-400">
                      {filtrados.filter((i) => i.categoria_id === c.id).length}
                    </span>
                  </a>
                ))}
              </nav>
              <div className="space-y-5">
                {categorias
                  .filter((c) => !filtros.categoria || String(c.id) === filtros.categoria)
                  .map((c, ci) => {
                    const linhas = ordenarItens(filtrados.filter((i) => i.categoria_id === c.id));
                    return (
                      <section
                        id={`cat-${c.id}`}
                        key={c.id}
                        className="scroll-mt-20 rounded-2xl border bg-card"
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
                        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-purple-50 px-4 py-3">
                          {admin && (
                            <>
                              <button
                                aria-label={`Arrastar categoria ${c.nome}`}
                                draggable
                                disabled={busy}
                                onDragStart={() => setDrag({ tipo: "categoria", id: c.id })}
                                onDragEnd={() => setDrag(null)}
                                className="cursor-grab p-2"
                              >
                                <GripVertical className="size-4" />
                              </button>
                              <button
                                aria-label={`Subir categoria ${c.nome}`}
                                disabled={busy || ci === 0}
                                onClick={() => categoriaOrdem(c.id, categorias[ci - 1]!.id)}
                              >
                                <ArrowUp className="size-4" />
                              </button>
                              <button
                                aria-label={`Descer categoria ${c.nome}`}
                                disabled={busy || ci === categorias.length - 1}
                                onClick={() => categoriaOrdem(c.id, categorias[ci + 1]!.id)}
                              >
                                <ArrowDown className="size-4" />
                              </button>
                            </>
                          )}
                          {admin && linhas.length > 0 && (
                            <input
                              aria-label={`Selecionar todos de ${c.nome}`}
                              type="checkbox"
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
                          <h3 className="flex-1 font-semibold text-purple-950">
                            {c.nome}{" "}
                            <span className="text-xs font-normal">{linhas.length} itens</span>
                          </h3>
                          {admin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Opções da categoria ${c.nome}`}
                                >
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    abrir({ acao: "renomear", id: c.id, nome: c.nome })
                                  }
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
                        {!linhas.length && (
                          <p className="p-6 text-sm text-ink-500">
                            {filtros.filtro === "sem_preco"
                              ? "Nenhum item sem preço 🎉"
                              : "Nenhum item nesta categoria com estes filtros."}
                          </p>
                        )}
                        {linhas.map((i, ii) => (
                          <article
                            key={i.item_id}
                            className="group flex flex-wrap items-center gap-3 border-b p-4 last:border-b-0 hover:bg-base-50"
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
                            {admin && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  aria-label={`Selecionar ${i.nome}`}
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
                                  draggable
                                  disabled={busy}
                                  aria-label={`Arrastar item ${i.nome}`}
                                  className="cursor-grab p-2"
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    setDrag({ tipo: "item", id: i.item_id, categoria: c.id });
                                  }}
                                  onDragEnd={() => setDrag(null)}
                                >
                                  <GripVertical className="size-4 text-ink-400" />
                                </button>
                                <div className="flex flex-col">
                                  <button
                                    disabled={busy || ii === 0}
                                    aria-label={`Subir item ${i.nome}`}
                                    onClick={() =>
                                      itemOrdem(c.id, i.item_id, linhas[ii - 1]!.item_id)
                                    }
                                  >
                                    <ArrowUp className="size-3" />
                                  </button>
                                  <button
                                    disabled={busy || ii === linhas.length - 1}
                                    aria-label={`Descer item ${i.nome}`}
                                    onClick={() =>
                                      itemOrdem(c.id, i.item_id, linhas[ii + 1]!.item_id)
                                    }
                                  >
                                    <ArrowDown className="size-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                            <button
                              className="min-w-40 flex-1 rounded text-left focus-visible:ring-2 focus-visible:ring-purple-500"
                              onClick={() => setEditar(i)}
                            >
                              <strong className="text-ink-900">{i.nome}</strong>
                              <p className="mt-1 line-clamp-1 text-xs text-ink-500">
                                {i.descricao || i.codigo}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                                {!i.ativo && (
                                  <span className="rounded bg-base-200 px-2 py-1">Inativo</span>
                                )}
                                {i.arquivado && (
                                  <span className="rounded bg-base-200 px-2 py-1">Arquivado</span>
                                )}
                                {i.disponibilidade?.resumo && (
                                  <span className="rounded bg-purple-50 px-2 py-1">
                                    {i.disponibilidade.resumo}
                                  </span>
                                )}
                                {(i.esgotado_agora ?? i.indisponivel_motivo === "esgotado") ? (
                                  <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">
                                    Esgotado · até{" "}
                                    {i.esgotado_ate
                                      ? unidades.find((u) => u.codigo === i.unidade)?.fuso
                                        ? new Date(i.esgotado_ate).toLocaleString("pt-BR", {
                                            timeZone: unidades.find((u) => u.codigo === i.unidade)!
                                              .fuso!,
                                            day: "2-digit",
                                            month: "2-digit",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        : `${horaReferencia(i.esgotado_ate)} (${i.esgotado_ate.slice(-6)})`
                                      : "reposição"}
                                  </span>
                                ) : (
                                  <span
                                    className={
                                      i.disponivel_agora ? "text-green-800" : "text-amber-800"
                                    }
                                  >
                                    {situacaoAgora(i)}
                                  </span>
                                )}
                              </div>
                            </button>
                            <div className="min-w-24 text-right">
                              {admin ? (
                                <PrecoRapido item={i} servicos={servicos} />
                              ) : (
                                <strong>{precoTexto(i.preco)}</strong>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {admin && (
                                <label className="text-xs">
                                  <input
                                    type="checkbox"
                                    disabled={busy || i.arquivado}
                                    checked={i.ativo}
                                    onChange={() => void ativo(i)}
                                  />{" "}
                                  Disponível
                                </label>
                              )}
                              <Button
                                size="sm"
                                variant={
                                  (i.esgotado_agora ?? i.indisponivel_motivo === "esgotado")
                                    ? "secondary"
                                    : "outline"
                                }
                                disabled={busy || i.arquivado}
                                onClick={() =>
                                  void agir({
                                    acao: "item",
                                    id: i.item_id,
                                    operacao:
                                      (i.esgotado_agora ?? i.indisponivel_motivo === "esgotado")
                                        ? "repor"
                                        : "esgotar",
                                  })
                                }
                              >
                                {(i.esgotado_agora ?? i.indisponivel_motivo === "esgotado")
                                  ? "Repor"
                                  : "Esgotado hoje"}
                              </Button>
                              {admin && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Opções de ${i.nome}`}
                                    >
                                      <MoreHorizontal />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
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
                        ))}
                      </section>
                    );
                  })}
                {!categorias.length && (
                  <p className="rounded-xl border bg-card p-10 text-center">
                    Esta unidade ainda não tem categorias.{" "}
                    {admin
                      ? "Crie uma categoria para começar."
                      : "Aguarde o cadastro pelo administrador."}
                  </p>
                )}
              </div>
            </div>
          )}
          {admin && selecionados.length > 0 && (
            <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-xl bg-purple-950 p-4 text-white shadow-lg">
              <span>{selecionados.length} itens selecionados</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setSelecionados([])}>
                  Limpar
                </Button>
                <Button disabled={selecionados.length > 500} onClick={() => setLote(true)}>
                  Ações em lote
                </Button>
              </div>
              {selecionados.length > 500 && <p>Selecione até 500 itens.</p>}
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
