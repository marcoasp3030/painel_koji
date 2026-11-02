import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { OpcoesItem } from "./OpcoesItem";
import { useOpcoes } from "./useOpcoes";
/** Erros já mostrados ao lado do campo; os demais aparecem acima do rodapé, visíveis em qualquer aba. */
const CAMPOS_NA_TELA = [
  "nome",
  "descricao",
  "preco",
  "categoria_id",
  "codigo",
  "tipo",
  "delivery",
  "alcoolico",
  "observacao",
];
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
  categoriaInicial,
  maisUm,
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
  /** Categoria aberta na lista: é onde a pessoa está cadastrando. */
  categoriaInicial: number | null;
  /** Abre um cadastro limpo na mesma categoria. */
  maisUm: (categoria: number) => void;
}) {
  const inicial: ItemCardapio = item ?? {
    item_id: 0,
    nome: "",
    descricao: null,
    preco: null,
    categoria: null,
    categoria_id: categoriaInicial ?? categorias[0]?.id ?? 0,
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
  // Criado nesta tela e com a gravação das opções pendente: tentar de novo não pode criar outro.
  const [criado, setCriado] = useState<ItemCardapio | null>(null);
  const existente = item ?? criado;
  const [aba, setAba] = useState("produto"),
    [mais, setMais] = useState(false);
  const opcoes = useOpcoes(item?.item_id ?? null, servicos);
  const sujo =
    JSON.stringify(v) !== JSON.stringify(dados(base)) ||
    JSON.stringify(r) !== JSON.stringify(rascunhoDe(base.disponibilidade));
  const alterado = sujo || opcoes.sujo;
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
    proteger(alterado || busy);
    const sair = (e: BeforeUnloadEvent) => {
      if (alterado || busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const troca = (e: Event) => {
      if (busy || (alterado && !window.confirm("Descartar alterações não salvas?")))
        e.preventDefault();
    };
    window.addEventListener("beforeunload", sair);
    window.addEventListener("gestao:trocar", troca);
    return () => {
      proteger(false);
      window.removeEventListener("beforeunload", sair);
      window.removeEventListener("gestao:trocar", troca);
    };
  }, [alterado, busy, proteger]);
  function sair() {
    if (!busy && (!alterado || window.confirm("Descartar alterações não salvas?"))) fechar();
  }
  /** Leva a pessoa até o campo com problema, que pode estar em outra aba. */
  function mostrarErro(e: { campo: string; mensagem: string }) {
    setErro(e);
    if (e.campo === "disponibilidade") setAba("disponibilidade");
    else if (e.campo === "opcoes") setAba("opcoes");
    else {
      setAba("produto");
      if (["codigo", "tipo", "alcoolico", "delivery", "observacao"].includes(e.campo))
        setMais(true);
    }
  }
  function preparar(outro = false) {
    setErro(null);
    try {
      const preco = lerPreco(v.preco);
      if (!v.nome.trim()) return mostrarErro({ campo: "nome", mensagem: "Informe o nome." });
      const problema = problemaRascunho(r);
      if (problema) return mostrarErro({ campo: "disponibilidade", mensagem: problema });
      if (opcoes.problema) return mostrarErro({ campo: "opcoes", mensagem: opcoes.problema });
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
            !existente ||
            JSON.stringify(x) !== JSON.stringify(anteriores[k as keyof typeof anteriores]),
        ),
      ) as CamposItem;
      // Só existe o que perguntar quando o produto está ligado a outras unidades.
      if (existente && base.prato) {
        setEscopo("este");
        setPendente(campos);
      } else void gravar(campos, base, outro);
    } catch (e) {
      mostrarErro({ campo: "preco", mensagem: (e as Error).message });
    }
  }
  async function gravar(c: CamposItem, atual = base, outro = false) {
    setBusy(true);
    setErro(null);
    try {
      let id = existente?.item_id ?? null;
      if (!existente) {
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
          mostrarErro(resultado.erro);
          return;
        }
        const novo = resultado.dados as unknown as ItemCardapio;
        id = novo.item_id;
        setCriado(novo);
        setBase(novo);
        setV(dados(novo));
        setR(rascunhoDe(novo.disponibilidade));
      } else if (Object.keys(c).length) {
        const resultado = await servicos.editar(atual, { ...c, aplicar_em: escopo });
        if (!resultado.ok) {
          setPendente(null);
          if (resultado.atual) setConflito({ atual: resultado.atual, campos: c });
          else mostrarErro({ campo: resultado.campo ?? "corpo", mensagem: resultado.mensagem });
          return;
        }
        setBase(resultado.item);
        setV(dados(resultado.item));
        setR(rascunhoDe(resultado.item.disponibilidade));
        const falhas = resultado.item.aplicado_em?.filter((x) => !x.ok) ?? [];
        if (falhas.length) {
          setPendente(null);
          setErro({
            campo: "corpo",
            mensagem: `Salvo nesta unidade; falhou em ${falhas.map((x) => `${x.unidade}: ${x.motivo}`).join("; ")}. Confira antes de tentar novamente.`,
          });
          atualizar();
          return;
        }
      }
      if (opcoes.sujo && id !== null) {
        const o = await opcoes.salvar(id, escopo === "todas");
        if (!o.ok) {
          setPendente(null);
          atualizar();
          mostrarErro({
            campo: "opcoes",
            mensagem: `${existente ? "Produto salvo" : "Produto criado"}, mas as opções não foram gravadas. ${o.mensagem}`,
          });
          return;
        }
        if (o.falhas) toast.warning(`${o.falhas} unidade(s) não receberam as opções.`);
      }
      toast.success(existente ? "Produto atualizado." : `${v.nome.trim()} criado.`);
      atualizar();
      if (outro) maisUm(v.categoria_id);
      else fechar();
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
  const semPreco = !v.preco.trim();
  const qtdOpcoes = (opcoes.grupos ?? []).filter((g) => g.ativo).length;
  return (
    <>
      <Sheet open onOpenChange={(o) => !o && sair()}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[720px]">
          <header className="flex items-start justify-between gap-4 border-b px-6 py-4 pr-12">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-700">
                {unidade}
              </p>
              <SheetTitle className="mt-1 truncate text-xl">
                {v.nome.trim() || (existente ? base.nome : "Novo produto")}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Dados, opções e disponibilidade do produto nesta unidade.
              </SheetDescription>
            </div>
            <label className="mt-1 flex shrink-0 items-center gap-2 text-sm">
              <Switch
                checked={v.ativo}
                disabled={busy || carregando}
                onCheckedChange={(ativo) => setV({ ...v, ativo })}
                aria-label="Ativo no cardápio"
              />
              {v.ativo ? "Ativo" : "Inativo"}
            </label>
          </header>
          <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-6 mt-3 h-auto w-fit max-w-[calc(100%-3rem)] justify-start overflow-x-auto [scrollbar-width:none]">
              <TabsTrigger value="produto">Produto</TabsTrigger>
              <TabsTrigger value="opcoes">Opções{qtdOpcoes ? ` (${qtdOpcoes})` : ""}</TabsTrigger>
              <TabsTrigger value="disponibilidade">
                Disponibilidade{corpoDisponibilidade(r) ? " ·" : ""}
              </TabsTrigger>
              {existente ? <TabsTrigger value="historico">Histórico</TabsTrigger> : null}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {carregando && <p className="pb-3 text-sm">Carregando dados atuais…</p>}
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
              <TabsContent value="produto" className="mt-0">
                <fieldset disabled={busy || carregando} className="space-y-4">
                  <label className="block text-sm font-medium">
                    Nome
                    <Input
                      aria-label="Nome"
                      autoFocus={!item}
                      className="mt-1 font-normal"
                      value={v.nome}
                      maxLength={120}
                      onChange={(e) => setV({ ...v, nome: e.target.value })}
                    />
                    {erroDo("nome")}
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      Preço (R$)
                      <Input
                        aria-label="Preço"
                        inputMode="decimal"
                        className="mt-1 font-normal"
                        value={v.preco}
                        placeholder="0,00"
                        onChange={(e) => setV({ ...v, preco: e.target.value })}
                      />
                      {semPreco ? (
                        <span className="mt-1 block text-xs font-normal text-amber-800">
                          Sem preço, o produto não é oferecido ao cliente.
                        </span>
                      ) : null}
                      {erroDo("preco")}
                    </label>
                    <label className="text-sm font-medium">
                      Categoria
                      <select
                        aria-label="Categoria"
                        className="mt-1 h-10 w-full rounded-md border bg-card px-2 font-normal"
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
                  <label className="block text-sm font-medium">
                    <span className="flex justify-between">
                      Descrição
                      <span className="text-xs font-normal text-ink-500">
                        {v.descricao.length}/300
                      </span>
                    </span>
                    <textarea
                      className="mt-1 w-full rounded-md border p-3 font-normal"
                      aria-label="Descrição"
                      rows={3}
                      placeholder="O que vem no prato. Ajuda o cliente a escolher."
                      value={v.descricao}
                      maxLength={300}
                      onChange={(e) => setV({ ...v, descricao: e.target.value })}
                    />
                    {erroDo("descricao")}
                  </label>
                  <div>
                    <button
                      type="button"
                      aria-expanded={mais}
                      onClick={() => setMais(!mais)}
                      className="flex items-center gap-1 text-sm font-medium text-purple-800"
                    >
                      <ChevronDown
                        className={`size-4 transition-transform ${mais ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                      Mais detalhes
                    </button>
                    {mais ? (
                      <div className="mt-3 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <label className="text-sm">
                            Código
                            <Input
                              className="mt-1"
                              value={v.codigo}
                              placeholder="Gerado ao criar"
                              onChange={(e) => setV({ ...v, codigo: e.target.value })}
                            />
                            {erroDo("codigo")}
                          </label>
                          <label className="text-sm">
                            Tipo
                            <select
                              className="mt-1 h-10 w-full rounded-md border bg-card px-2"
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
                          <label className="text-sm">
                            Entrega
                            <select
                              className="mt-1 h-10 w-full rounded-md border bg-card px-2"
                              value={v.delivery}
                              onChange={(e) => setV({ ...v, delivery: e.target.value })}
                            >
                              <option value="sim">Sim</option>
                              <option value="nao">Não</option>
                              <option value="a_confirmar">A confirmar</option>
                            </select>
                            {erroDo("delivery")}
                          </label>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={v.alcoolico}
                            onChange={(e) => setV({ ...v, alcoolico: e.target.checked })}
                          />
                          Bebida alcoólica
                        </label>
                        {erroDo("alcoolico")}
                        <label className="block text-sm">
                          Observação interna
                          <textarea
                            className="mt-1 w-full rounded-md border p-3"
                            rows={2}
                            placeholder="Só a equipe vê."
                            maxLength={300}
                            value={v.observacao}
                            onChange={(e) => setV({ ...v, observacao: e.target.value })}
                          />
                          {erroDo("observacao")}
                        </label>
                      </div>
                    ) : null}
                  </div>
                </fieldset>
              </TabsContent>
              <TabsContent value="opcoes" className="mt-0">
                <fieldset disabled={busy || carregando}>
                  <OpcoesItem
                    opcoes={opcoes}
                    itemId={existente?.item_id ?? null}
                    itens={itens}
                    servicos={servicos}
                  />
                </fieldset>
              </TabsContent>
              <TabsContent value="disponibilidade" className="mt-0">
                <fieldset disabled={busy || carregando} className="space-y-4">
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
                </fieldset>
              </TabsContent>
              {existente ? (
                <TabsContent value="historico" className="mt-0">
                  <HistoricoItem servicos={servicos} itemId={existente.item_id} />
                </TabsContent>
              ) : null}
            </div>
          </Tabs>
          {erro && !CAMPOS_NA_TELA.includes(erro.campo) ? (
            <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {erro.mensagem}
            </p>
          ) : null}
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-card p-4">
            <span className="text-xs text-ink-500">
              {alterado ? "Alterações não salvas" : existente ? "Tudo salvo" : ""}
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={sair}>
                Cancelar
              </Button>
              {existente ? null : (
                <Button
                  variant="outline"
                  disabled={busy || carregando || !v.categoria_id || !opcoes.pronto}
                  onClick={() => preparar(true)}
                >
                  Salvar e adicionar outro
                </Button>
              )}
              <Button
                disabled={
                  busy ||
                  carregando ||
                  !v.categoria_id ||
                  !opcoes.pronto ||
                  (!alterado && !!existente)
                }
                onClick={() => preparar()}
              >
                Salvar
              </Button>
            </div>
          </footer>
        </SheetContent>
      </Sheet>
      <Dialog open={!!pendente} onOpenChange={(o) => !o && !busy && setPendente(null)}>
        <DialogContent className="z-[70]">
          <DialogTitle>Onde aplicar a alteração?</DialogTitle>
          <DialogDescription>
            Este produto está ligado às outras unidades pelo prato {base.prato?.codigo}.
          </DialogDescription>
          {pendente?.preco === null && (
            <p className="rounded bg-amber-50 p-3 text-amber-900">
              Sem preço, o item sai do cardápio do atendimento.
            </p>
          )}
          <>
            <label>
              <input type="radio" checked={escopo === "este"} onChange={() => setEscopo("este")} />{" "}
              Só nesta unidade
            </label>
            <label>
              <input
                type="radio"
                checked={escopo === "todas"}
                onChange={() => setEscopo("todas")}
              />{" "}
              Em todas as unidades com este prato
            </label>
            <p className="text-xs text-ink-500">
              Código, categoria, posição e observação permanecem locais.
            </p>
          </>
          <Button disabled={busy} onClick={() => pendente && void gravar(pendente)}>
            {busy ? "Salvando…" : "Confirmar e salvar"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
