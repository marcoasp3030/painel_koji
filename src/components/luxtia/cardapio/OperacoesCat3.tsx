import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { precoTexto, type ItemCardapio } from "@/lib/gateway/cardapio";
import type {
  CategoriaCat3,
  ExecutarCat3,
  LinhaResultado,
  PaginaSugestoes,
  PedidoCat3,
} from "@/lib/gateway/cat3";
export function ResultadoCat3({
  linhas,
  itens = [],
  simulacao = false,
}: {
  linhas: LinhaResultado[];
  itens?: ItemCardapio[];
  simulacao?: boolean;
}) {
  const motivos: Record<string, string> = {
    sem_preco: "Item sem preço",
    unidade_diferente: "Item de outra unidade",
    ja_existe: "Já existe no destino",
    mesma_unidade: "Origem e destino iguais",
    item_ja_ligado: "Item já ligado a outro prato",
    unidade_repetida: "Mais de um item da mesma unidade",
    varios_na_unidade: "Escolha um item por unidade",
    sugestao_inexistente: "Sugestão não existe mais",
    item_fora_do_grupo: "Item fora do grupo",
    item_inexistente: "Item não encontrado",
  };
  return (
    <div
      aria-live="polite"
      className="max-h-64 overflow-y-auto rounded-lg border bg-base-50 p-3 text-sm"
    >
      <p className="mb-2 font-semibold">
        {linhas.filter((l) => l.ok).length} {simulacao ? "prontos para atualizar" : "atualizados"} ·{" "}
        {linhas.filter((l) => !l.ok).length} {simulacao ? "com impedimento" : "com falha"}
      </p>
      {linhas.map((l, i) => (
        <div key={i} className="border-t py-2">
          <span>
            {l.item_id
              ? (itens.find((i) => i.item_id === l.item_id)?.nome ?? `Item #${l.item_id}`)
              : l.chave}{" "}
            {l.destino}
          </span>{" "}
          ·{" "}
          <span className={l.ok ? "text-green-800" : "text-red-700"}>
            {l.ok ? "OK" : (motivos[l.motivo ?? ""] ?? l.motivo ?? "Falha")}
          </span>
          {l.antes && l.depois && ("preco" in l.antes || "preco" in l.depois) && (
            <span className="ml-2">
              {typeof l.antes["preco"] === "number" ? precoTexto(l.antes["preco"]) : "Sem preço"} →{" "}
              {typeof l.depois["preco"] === "number" ? precoTexto(l.depois["preco"]) : "Sem preço"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
export function LoteCat3({
  itens,
  categorias,
  executar,
  fechar,
  atualizar,
  operacaoInicial = "reajustar",
}: {
  itens: ItemCardapio[];
  categorias: CategoriaCat3[];
  executar: ExecutarCat3;
  fechar: () => void;
  atualizar: () => void;
  operacaoInicial?: Extract<PedidoCat3, { acao: "lote" }>["operacao"];
}) {
  const [op, setOp] = useState(operacaoInicial),
    [modo, setModo] = useState("percentual"),
    [valor, setValor] = useState("5"),
    [categoria, setCategoria] = useState(categorias[0]?.id ?? 0),
    [busy, setBusy] = useState(false),
    [erro, setErro] = useState(""),
    [previa, setPrevia] = useState<LinhaResultado[] | null>(null),
    [resultado, setResultado] = useState<LinhaResultado[] | null>(null);
  const chave = JSON.stringify([op, modo, valor, categoria, itens.map((i) => i.item_id)]);
  useEffect(() => {
    setPrevia(null);
    setResultado(null);
    setErro("");
  }, [chave]);
  async function rodar(simulacao: boolean) {
    if (!simulacao && !previa) return;
    setBusy(true);
    setErro("");
    try {
      const n = Number(valor.replace(",", "."));
      const r = await executar({
        acao: "lote",
        itens: itens.map((i) => i.item_id),
        operacao: op,
        simulacao,
        ...(op === "mover" ? { categoria_id: categoria } : {}),
        ...(op === "reajustar" ? (modo === "percentual" ? { percentual: n } : { valor: n }) : {}),
      });
      if (!r.ok) {
        setErro(r.erro.mensagem);
        return;
      }
      const linhas = (r.dados as { resultados: LinhaResultado[] }).resultados;
      if (simulacao) setPrevia(linhas);
      else {
        setResultado(linhas);
        setPrevia(null);
        atualizar();
      }
    } catch {
      setErro("Resultado não confirmado. Confira os itens antes de repetir a operação.");
      setPrevia(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && fechar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle>Ações em lote · {itens.length} itens</DialogTitle>
        <DialogDescription>
          Veja a simulação antes de aplicar. Cada item tem seu próprio resultado.
        </DialogDescription>
        <fieldset disabled={busy} className="space-y-3">
          <label className="block text-sm">
            Ação
            <select
              className="ml-3 rounded border p-2"
              value={op}
              onChange={(e) => setOp(e.target.value as typeof op)}
            >
              {Object.entries({
                reajustar: "Reajustar preço",
                mover: "Mover",
                pausar: "Pausar",
                ativar: "Ativar",
                esgotar: "Esgotado hoje",
                repor: "Repor",
                arquivar: "Arquivar",
                desarquivar: "Desarquivar",
              }).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {op === "reajustar" && (
            <div className="flex gap-3">
              <select
                aria-label="Tipo de reajuste"
                className="rounded border p-2"
                value={modo}
                onChange={(e) => setModo(e.target.value)}
              >
                <option value="percentual">Percentual (%)</option>
                <option value="valor">Somar valor (R$)</option>
              </select>
              <Input
                aria-label="Valor do reajuste"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
          )}
          {op === "mover" && (
            <label>
              Categoria de destino
              <select
                className="ml-2 rounded border p-2"
                value={categoria}
                onChange={(e) => setCategoria(Number(e.target.value))}
              >
                {categorias.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button variant="outline" onClick={() => void rodar(true)}>
            Simular alterações
          </Button>
        </fieldset>
        {erro && (
          <p role="alert" className="text-red-700">
            {erro}
          </p>
        )}
        {busy && <p role="status">{previa ? "Aplicando alterações…" : "Preparando prévia…"}</p>}
        {previa && (
          <section>
            <h3 className="mb-2 font-semibold">Prévia do gateway · nada alterado ainda</h3>
            <ResultadoCat3 linhas={previa} itens={itens} simulacao />
            <Button
              className="mt-4"
              disabled={busy || !previa.some((l) => l.ok)}
              onClick={() => void rodar(false)}
            >
              Confirmar e aplicar
            </Button>
          </section>
        )}
        {resultado && <ResultadoCat3 linhas={resultado} itens={itens} />}
        <Button variant="ghost" disabled={busy} onClick={fechar}>
          Fechar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
export function SugestoesCat3({
  executar,
  admin,
  atualizar,
}: {
  executar: ExecutarCat3;
  admin: boolean;
  atualizar: () => void;
}) {
  const [ignoradas, setIgnoradas] = useState(false),
    [pagina, setPagina] = useState<PaginaSugestoes | null>(null),
    [selecionados, setSelecionados] = useState<string[]>([]),
    [escolhas, setEscolhas] = useState<Record<string, number[]>>({}),
    [busy, setBusy] = useState(false),
    [erro, setErro] = useState(""),
    [resultado, setResultado] = useState<LinhaResultado[]>([]);
  async function carregar(mais = false) {
    setBusy(true);
    setErro("");
    try {
      const r = await executar({
        acao: "sugestoes",
        ignoradas,
        ...(mais && pagina?.proximo_cursor ? { cursor: pagina.proximo_cursor } : {}),
      });
      if (!r.ok) {
        setErro(r.erro.mensagem);
        return;
      }
      const nova = r.dados as PaginaSugestoes;
      setPagina((p) => (mais && p ? { ...nova, grupos: [...p.grupos, ...nova.grupos] } : nova));
    } catch {
      setErro("Não foi possível ler as sugestões.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setPagina(null);
    setSelecionados([]);
    setEscolhas({});
    void carregar(); /* A mudança de aba inicia uma nova paginação. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ignoradas, executar]);
  async function agir(op: "confirmar" | "ignorar" | "restaurar") {
    setBusy(true);
    setErro("");
    try {
      const r = await executar(
        op === "confirmar"
          ? {
              acao: "ligar",
              grupos: selecionados.map((chave) => ({
                chave,
                ...(escolhas[chave] ? { itens: escolhas[chave] } : {}),
              })),
            }
          : { acao: "sugestoes_acao", operacao: op, chaves: selecionados },
      );
      if (!r.ok) {
        setErro(r.erro.mensagem);
        return;
      }
      const dados = r.dados as { resultados?: LinhaResultado[]; restauradas?: string[] };
      setResultado(
        dados.resultados ?? dados.restauradas?.map((chave) => ({ chave, ok: true })) ?? [],
      );
      setSelecionados([]);
      await carregar();
      atualizar();
    } catch {
      setErro("Resultado não confirmado. Recarregue antes de repetir.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Pratos iguais nas unidades</h2>
          <p className="text-sm text-ink-500">
            Ligue os itens para poder editar o mesmo prato em várias unidades.
          </p>
        </div>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={ignoradas}
            onChange={(e) => setIgnoradas(e.target.checked)}
            disabled={busy}
          />{" "}
          Mostrar ignorados
        </label>
      </header>
      {erro && (
        <p role="alert" className="text-red-700">
          {erro}
        </p>
      )}
      {resultado.length > 0 && <ResultadoCat3 linhas={resultado} />}
      <div className="grid gap-4 lg:grid-cols-2">
        {pagina?.grupos.map((g) => (
          <article className="rounded-xl border bg-card p-5" key={g.chave}>
            <div className="flex gap-3">
              {admin && (
                <input
                  aria-label={`Selecionar ${g.nome}`}
                  type="checkbox"
                  disabled={busy}
                  checked={selecionados.includes(g.chave)}
                  onChange={(e) =>
                    setSelecionados((x) =>
                      e.target.checked ? [...x, g.chave] : x.filter((k) => k !== g.chave),
                    )
                  }
                />
              )}
              <h3 className="font-semibold">{g.nome}</h3>
            </div>
            {new Set(g.itens.map((i) => i.preco)).size > 1 && (
              <p className="my-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
                Preços diferentes entre unidades. Ligar os itens não altera os preços.
              </p>
            )}
            {g.conflito && (
              <p className="my-2 text-sm text-red-700">
                Há mais de um item na mesma unidade. Selecione um por unidade para confirmar.
              </p>
            )}
            {g.itens.map((i) => (
              <label
                key={i.item_id}
                className="flex items-center justify-between gap-2 border-t py-3 text-sm"
              >
                <span>
                  {admin && g.conflito && (
                    <input
                      aria-label={`Incluir ${i.nome} ${i.unidade} #${i.item_id}`}
                      type="checkbox"
                      checked={(escolhas[g.chave] ?? []).includes(i.item_id)}
                      onChange={(e) =>
                        setEscolhas((x) => ({
                          ...x,
                          [g.chave]: e.target.checked
                            ? [
                                ...(x[g.chave] ?? []).filter(
                                  (id) =>
                                    g.itens.find((j) => j.item_id === id)?.unidade !== i.unidade,
                                ),
                                i.item_id,
                              ]
                            : (x[g.chave] ?? []).filter((id) => id !== i.item_id),
                        }))
                      }
                    />
                  )}{" "}
                  {i.unidade} · {i.nome}
                </span>
                <strong>{precoTexto(i.preco)}</strong>
              </label>
            ))}
          </article>
        ))}
      </div>
      {busy && <p role="status">Carregando…</p>}
      {pagina && !pagina.grupos.length && (
        <p className="rounded-xl border p-8 text-center text-ink-500">
          Nenhuma sugestão {ignoradas ? "ignorada" : "pendente"}.
        </p>
      )}
      {pagina?.proximo_cursor && (
        <Button variant="outline" disabled={busy} onClick={() => void carregar(true)}>
          Carregar mais sugestões
        </Button>
      )}
      {admin && selecionados.length > 0 && (
        <div className="sticky bottom-4 flex flex-wrap gap-3 rounded-xl bg-purple-950 p-4 text-white">
          <span className="self-center">{selecionados.length} grupos selecionados</span>
          {ignoradas ? (
            <Button disabled={busy} onClick={() => void agir("restaurar")}>
              Restaurar ignorados
            </Button>
          ) : (
            <>
              <Button disabled={busy} onClick={() => void agir("confirmar")}>
                Confirmar ligações
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void agir("ignorar")}>
                Ignorar
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
