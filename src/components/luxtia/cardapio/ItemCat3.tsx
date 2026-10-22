import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  corpoDisponibilidade,
  rascunhoDe,
  problemaRascunho,
  type ItemCardapio,
} from "@/lib/gateway/cardapio";
import {
  lerPreco,
  precoEditavel,
  type CamposItem,
  type ServicosCat2,
} from "@/lib/gateway/cardapio-cat2";
import type { CategoriaCat3, ExecutarCat3 } from "@/lib/gateway/cat3";
import { DisponibilidadeEditor } from "./DisponibilidadeEditor";
import { PreviaAoVivo, HistoricoItem, Conflito } from "./ItemCat2";
const dados = (i: ItemCardapio) => ({
  nome: i.nome,
  descricao: i.descricao ?? "",
  preco: precoEditavel(i.preco),
  categoria_id: i.categoria_id ?? 0,
  codigo: i.codigo ?? "",
  tipo: i.tipo,
  alcoolico: i.alcoolico ?? false,
  delivery: i.delivery ?? "sim",
  ativo: i.ativo,
  observacao: i.observacao ?? "",
});
export function ItemCat3({
  item,
  unidade,
  categorias,
  itens,
  servicos,
  executar,
  fechar,
  atualizar,
  proteger,
}: {
  item: ItemCardapio | null;
  unidade: string;
  categorias: CategoriaCat3[];
  itens: ItemCardapio[];
  servicos: ServicosCat2;
  executar: ExecutarCat3;
  fechar: () => void;
  atualizar: () => void;
  proteger: (v: boolean) => void;
}) {
  const inicial: ItemCardapio = item ?? {
    item_id: 0,
    nome: "",
    descricao: null,
    preco: null,
    categoria: null,
    categoria_id: categorias[0]?.id ?? 0,
    codigo: null,
    unidade,
    tipo: "item",
    ativo: true,
    disponibilidade: null,
  };
  const [base, setBase] = useState(inicial),
    [v, setV] = useState(dados(inicial)),
    [r, setR] = useState(rascunhoDe(inicial.disponibilidade));
  const [carregando, setCarregando] = useState(Boolean(item)),
    [busy, setBusy] = useState(false),
    [erro, setErro] = useState<{ campo: string; mensagem: string } | null>(null);
  const [pendente, setPendente] = useState<CamposItem | null>(null),
    [escopo, setEscopo] = useState<"este" | "todas">("este"),
    [conflito, setConflito] = useState<{ atual: ItemCardapio; campos: CamposItem } | null>(null);
  const sujo =
    JSON.stringify(v) !== JSON.stringify(dados(base)) ||
    JSON.stringify(r) !== JSON.stringify(rascunhoDe(base.disponibilidade));
  useEffect(() => {
    if (!item) return;
    let vivo = true;
    servicos
      .obter(item.item_id)
      .then((i) => {
        if (vivo) {
          setBase(i);
          setV(dados(i));
          setR(rascunhoDe(i.disponibilidade));
          setCarregando(false);
        }
      })
      .catch(
        () =>
          vivo &&
          setErro({ campo: "corpo", mensagem: "Falha ao ler o item. Feche e tente novamente." }),
      );
    return () => {
      vivo = false;
    };
  }, [item, servicos]);
  useEffect(() => {
    proteger(sujo || busy);
    const sair = (e: BeforeUnloadEvent) => {
      if (sujo || busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const troca = (e: Event) => {
      if (busy || (sujo && !window.confirm("Descartar alterações não salvas?"))) e.preventDefault();
    };
    window.addEventListener("beforeunload", sair);
    window.addEventListener("gestao:trocar", troca);
    return () => {
      proteger(false);
      window.removeEventListener("beforeunload", sair);
      window.removeEventListener("gestao:trocar", troca);
    };
  }, [sujo, busy, proteger]);
  function sair() {
    if (!busy && (!sujo || window.confirm("Descartar alterações não salvas?"))) fechar();
  }
  function preparar() {
    setErro(null);
    try {
      const preco = lerPreco(v.preco);
      const problema = problemaRascunho(r);
      if (problema) {
        setErro({ campo: "disponibilidade", mensagem: problema });
        return;
      }
      const todos = {
        ...v,
        preco,
        descricao: v.descricao || null,
        observacao: v.observacao || null,
        disponibilidade: corpoDisponibilidade(r),
      };
      const anteriores = {
        ...dados(base),
        preco: base.preco,
        descricao: base.descricao || null,
        observacao: base.observacao || null,
        disponibilidade: corpoDisponibilidade(rascunhoDe(base.disponibilidade)),
      };
      const campos = Object.fromEntries(
        Object.entries(todos).filter(
          ([k, x]) =>
            !item || JSON.stringify(x) !== JSON.stringify(anteriores[k as keyof typeof anteriores]),
        ),
      ) as CamposItem;
      if (!v.nome.trim()) {
        setErro({ campo: "nome", mensagem: "Informe o nome." });
        return;
      }
      setEscopo("este");
      setPendente(campos);
    } catch (e) {
      setErro({ campo: "preco", mensagem: (e as Error).message });
    }
  }
  async function gravar(c: CamposItem, atual = base) {
    setBusy(true);
    setErro(null);
    try {
      if (!item) {
        const resultado = await executar({
          acao: "criar",
          campos: {
            unidade,
            categoria_id: v.categoria_id,
            nome: v.nome.trim(),
            descricao: v.descricao || null,
            preco: lerPreco(v.preco),
            ...(v.codigo.trim() ? { codigo: v.codigo.trim() } : {}),
            tipo: v.tipo as "item" | "adicional" | "opcao_executivo" | "regra",
            alcoolico: v.alcoolico,
            delivery: v.delivery as "sim" | "nao" | "a_confirmar",
            ativo: v.ativo,
            observacao: v.observacao || null,
            disponibilidade: corpoDisponibilidade(r),
          },
        });
        if (!resultado.ok) {
          setErro(resultado.erro);
          setPendente(null);
          return;
        }
      } else {
        const resultado = await servicos.editar(atual, { ...c, aplicar_em: escopo });
        if (!resultado.ok) {
          setPendente(null);
          if (resultado.atual) setConflito({ atual: resultado.atual, campos: c });
          else setErro({ campo: resultado.campo ?? "corpo", mensagem: resultado.mensagem });
          return;
        }
        const falhas = resultado.item.aplicado_em?.filter((x) => !x.ok) ?? [];
        if (falhas.length) {
          setPendente(null);
          setErro({
            campo: "corpo",
            mensagem: `Salvo nesta unidade; falhou em ${falhas.map((x) => `${x.unidade}: ${x.motivo}`).join("; ")}. Confira antes de tentar novamente.`,
          });
          setBase(resultado.item);
          setV(dados(resultado.item));
          setR(rascunhoDe(resultado.item.disponibilidade));
          atualizar();
          return;
        }
      }
      toast.success(item ? "Item atualizado." : "Item criado.");
      atualizar();
      fechar();
    } catch {
      setPendente(null);
      setErro({
        campo: "corpo",
        mensagem: "Gravação não confirmada. Recarregue antes de tentar novamente.",
      });
    } finally {
      setBusy(false);
    }
  }
  const erroDo = (campo: string) =>
    erro?.campo === campo ? (
      <p role="alert" className="text-sm text-red-700">
        {erro.mensagem}
      </p>
    ) : null;
  return (
    <>
      <Sheet open onOpenChange={(o) => !o && sair()}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[640px]">
          <header className="border-b p-6 pr-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-700">
              {unidade} · Cardápio
            </p>
            <SheetTitle className="mt-2 text-2xl">{item ? base.nome : "Novo item"}</SheetTitle>
            <SheetDescription>Dados e disponibilidade do item nesta unidade.</SheetDescription>
          </header>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            {carregando && <p>Carregando dados atuais…</p>}
            {conflito && (
              <Conflito
                atual={conflito.atual}
                pendente={conflito.campos}
                busy={busy}
                recarregar={() => {
                  setBase(conflito.atual);
                  setV(dados(conflito.atual));
                  setR(rascunhoDe(conflito.atual.disponibilidade));
                  setConflito(null);
                }}
                reaplicar={() => void gravar(conflito.campos, conflito.atual)}
              />
            )}
            <fieldset disabled={busy || carregando} className="space-y-4">
              <label className="block text-sm">
                Nome
                <Input
                  aria-label="Nome"
                  value={v.nome}
                  maxLength={120}
                  onChange={(e) => setV({ ...v, nome: e.target.value })}
                />
                <span className="text-xs text-ink-500">{v.nome.length}/120</span>
                {erroDo("nome")}
              </label>
              <label className="block text-sm">
                Descrição
                <textarea
                  className="mt-1 w-full rounded-md border p-3"
                  aria-label="Descrição"
                  value={v.descricao}
                  maxLength={300}
                  onChange={(e) => setV({ ...v, descricao: e.target.value })}
                />
                <span className="text-xs text-ink-500">{v.descricao.length}/300</span>
                {erroDo("descricao")}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm">
                  Preço (R$)
                  <Input
                    inputMode="decimal"
                    value={v.preco}
                    placeholder="Sem preço"
                    onChange={(e) => setV({ ...v, preco: e.target.value })}
                  />
                  {erroDo("preco")}
                </label>
                <label className="text-sm">
                  Categoria
                  <select
                    className="h-10 w-full rounded-md border bg-card px-2"
                    value={v.categoria_id}
                    onChange={(e) => setV({ ...v, categoria_id: Number(e.target.value) })}
                  >
                    <option value={0}>Escolha</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                  {erroDo("categoria_id")}
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm">
                  Código
                  <Input
                    value={v.codigo}
                    placeholder="Gerado ao criar"
                    onChange={(e) => setV({ ...v, codigo: e.target.value })}
                  />
                  {erroDo("codigo")}
                </label>
                <label className="text-sm">
                  Tipo
                  <select
                    className="h-10 w-full rounded border bg-card px-2"
                    value={v.tipo}
                    onChange={(e) => setV({ ...v, tipo: e.target.value })}
                  >
                    {Object.entries({
                      item: "Item",
                      adicional: "Adicional",
                      opcao_executivo: "Opção executivo",
                      regra: "Regra",
                    }).map(([k, n]) => (
                      <option key={k} value={k}>
                        {n}
                      </option>
                    ))}
                  </select>
                  {erroDo("tipo")}
                </label>
              </div>
              <div className="flex flex-wrap gap-5">
                <label>
                  <input
                    type="checkbox"
                    checked={v.ativo}
                    onChange={(e) => setV({ ...v, ativo: e.target.checked })}
                  />{" "}
                  Ativo
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={v.alcoolico}
                    onChange={(e) => setV({ ...v, alcoolico: e.target.checked })}
                  />{" "}
                  Alcoólico
                </label>
                <label>
                  Delivery{" "}
                  <select
                    className="rounded border p-2"
                    value={v.delivery}
                    onChange={(e) => setV({ ...v, delivery: e.target.value })}
                  >
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                    <option value="a_confirmar">A confirmar</option>
                  </select>
                </label>
              </div>
              {erroDo("ativo")}
              {erroDo("alcoolico")}
              {erroDo("delivery")}
              <label className="block text-sm">
                Observação interna
                <textarea
                  className="mt-1 w-full rounded border p-3"
                  maxLength={300}
                  value={v.observacao}
                  onChange={(e) => setV({ ...v, observacao: e.target.value })}
                />
                {erroDo("observacao")}
              </label>
              <DisponibilidadeEditor
                r={r}
                mudar={setR}
                busy={busy}
                itens={itens.filter((i) => i.item_id !== base.item_id)}
                previa={
                  !problemaRascunho(r) ? (
                    <PreviaAoVivo
                      servicos={servicos}
                      unidade={unidade}
                      regra={corpoDisponibilidade(r)}
                    />
                  ) : (
                    <p role="alert">{problemaRascunho(r)}</p>
                  )
                }
              />
              {erroDo("disponibilidade")}
            </fieldset>
            {item && <HistoricoItem servicos={servicos} itemId={base.item_id} />}
            {erro && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {erro.mensagem}
              </p>
            )}
          </div>
          <footer className="flex items-center justify-between border-t bg-card p-4">
            <span className="text-xs text-ink-500">
              {sujo ? "Alterações não salvas" : "Dados atuais"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={sair}>
                Cancelar
              </Button>
              <Button
                disabled={busy || carregando || !v.categoria_id || (!sujo && !!item)}
                onClick={preparar}
              >
                Salvar
              </Button>
            </div>
          </footer>
        </SheetContent>
      </Sheet>
      <Dialog open={!!pendente} onOpenChange={(o) => !o && !busy && setPendente(null)}>
        <DialogContent className="z-[70]">
          <DialogTitle>{item ? "Onde aplicar a alteração?" : "Criar item"}</DialogTitle>
          <DialogDescription>Confira o alcance antes de salvar.</DialogDescription>
          {pendente?.preco === null && (
            <p className="rounded bg-amber-50 p-3 text-amber-900">
              Sem preço, o item sai do cardápio do atendimento.
            </p>
          )}
          {item && (
            <>
              <label>
                <input
                  type="radio"
                  checked={escopo === "este"}
                  onChange={() => setEscopo("este")}
                />{" "}
                Só nesta unidade
              </label>
              <label>
                <input
                  type="radio"
                  disabled={!base.prato}
                  checked={escopo === "todas"}
                  onChange={() => setEscopo("todas")}
                />{" "}
                Em todas as unidades com este prato
              </label>
              <p className="text-xs text-ink-500">
                {base.prato
                  ? `Prato ${base.prato.codigo}. Código, categoria, posição e observação permanecem locais.`
                  : "Este item ainda não está ligado a um prato. Use Pratos iguais nas unidades para ligar."}
              </p>
            </>
          )}
          <Button disabled={busy} onClick={() => pendente && void gravar(pendente)}>
            {busy ? "Salvando…" : "Confirmar e salvar"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
