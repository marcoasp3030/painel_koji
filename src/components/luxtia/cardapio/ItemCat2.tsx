import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  corpoDisponibilidade,
  problemaRascunho,
  rascunhoDe,
  precoTexto,
  type ItemCardapio,
} from "@/lib/gateway/cardapio";
import { resumoRascunho } from "@/lib/gateway/cardapio-ux";
import {
  AVISO_SEM_PRECO,
  LIMITE_DESCRICAO,
  LIMITE_NOME,
  avisoCategoriaSome,
  camposAlterados,
  categoriaVaiSumir,
  dadosDe,
  dataHistorico,
  diferencaItem,
  horaReferencia,
  lerPreco,
  opcoesCategoria,
  precoDigitado,
  precoEditavel,
  situacaoAgora,
  valorHistorico,
  type AlteracaoItem,
  type CamposItem,
  type CategoriaItem,
  type PreviaItem,
  type ServicosCat2,
} from "@/lib/gateway/cardapio-cat2";
import { DisponibilidadeEditor } from "./DisponibilidadeEditor";

const CAMPOS_COM_ERRO = ["nome", "descricao", "preco", "categoria", "ativo", "disponibilidade"];
const ERRO_INCERTO =
  "Não foi possível confirmar a gravação. Recarregue o item antes de tentar novamente.";

/** Confirmação da própria tela no lugar do confirm() do navegador. */
function ConfirmarSalvar({
  textos,
  busy,
  voltar,
  confirmar,
}: {
  textos: string[];
  busy: boolean;
  voltar: () => void;
  confirmar: () => void;
}) {
  return (
    <AlertDialog
      open={textos.length > 0}
      onOpenChange={(aberto) => {
        if (!aberto && !busy) voltar();
      }}
    >
      <AlertDialogContent className="z-[70]" onEscapeKeyDown={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar antes de salvar</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {textos.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
          <Button disabled={busy} onClick={confirmar}>
            {busy ? "Salvando…" : "Salvar mesmo assim"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Prévia do rascunho pelo gateway (dia, feriado da unidade e horário), com atraso ao digitar. */
export function PreviaAoVivo({
  servicos,
  unidade,
  regra,
}: {
  servicos: ServicosCat2;
  unidade: string;
  regra: CamposItem["disponibilidade"];
}) {
  const [estado, setEstado] = useState<
    { tipo: "carregando" } | { tipo: "ok"; p: PreviaItem } | { tipo: "erro"; mensagem: string }
  >({ tipo: "carregando" });
  const chave = JSON.stringify(regra ?? null);
  useEffect(() => {
    let vivo = true;
    setEstado({ tipo: "carregando" });
    const timer = setTimeout(() => {
      servicos
        .previa(unidade, JSON.parse(chave) as CamposItem["disponibilidade"])
        .then((p) => vivo && setEstado({ tipo: "ok", p }))
        .catch(
          (e: unknown) =>
            vivo &&
            setEstado({
              tipo: "erro",
              mensagem: e instanceof Error ? e.message : "Não foi possível consultar a prévia.",
            }),
        );
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [chave, unidade, servicos]);
  return (
    <div
      aria-live="polite"
      className={`rounded-xl border p-4 ${estado.tipo === "erro" ? "border-red-200 bg-red-50" : "border-purple-100 bg-purple-50"}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">
        Prévia ao vivo
      </p>
      {estado.tipo === "carregando" && (
        <p className="mt-2 text-sm text-ink-500">Consultando o gateway…</p>
      )}
      {estado.tipo === "erro" && <p className="mt-2 text-sm text-red-700">{estado.mensagem}</p>}
      {estado.tipo === "ok" && (
        <>
          <p className="mt-2 text-sm font-medium text-purple-900">
            {estado.p.resumo || "Todos os dias, o dia inteiro"}
          </p>
          <p
            className={`mt-1 text-sm font-semibold ${estado.p.disponivel_agora ? "text-green-800" : "text-red-700"}`}
          >
            {situacaoAgora(estado.p)}
          </p>
          <p className="mt-2 text-xs text-ink-500">
            Rascunho, ainda não salvo. Avalia dias, feriados da unidade e horários
            {horaReferencia(estado.p.data_referencia)
              ? ` (${horaReferencia(estado.p.data_referencia)}, horário da unidade)`
              : ""}
            ; preço e ativo são conferidos no item salvo.
          </p>
        </>
      )}
    </div>
  );
}

function valorPendente(campo: keyof CamposItem, campos: CamposItem) {
  const v = campos[campo];
  if (campo === "disponibilidade" && v)
    return resumoRascunho(rascunhoDe({ ...(v as object), resumo: null } as never));
  return valorHistorico(campo, v);
}

/** 409: valores atuais do gateway e a escolha entre recarregar e reaplicar. */
export function Conflito({
  atual,
  pendente,
  recarregar,
  reaplicar,
  busy,
  compacto = false,
}: {
  atual: ItemCardapio;
  pendente: CamposItem;
  recarregar: () => void;
  reaplicar: () => void;
  busy: boolean;
  compacto?: boolean;
}) {
  const linhas: [keyof CamposItem, string][] = [
    ["codigo", atual.codigo || "—"],
    ["tipo", atual.tipo],
    ["alcoolico", atual.alcoolico ? "Sim" : "Não"],
    ["delivery", atual.delivery || "—"],
    ["observacao", atual.observacao || "(vazio)"],
    ["categoria_id", atual.categoria || "Sem categoria"],
    ["nome", atual.nome],
    ["preco", precoTexto(atual.preco)],
    ["categoria", atual.categoria || "Sem categoria"],
    ["ativo", atual.ativo ? "Sim" : "Não"],
    ["descricao", atual.descricao || "(vazio)"],
    ["disponibilidade", atual.disponibilidade?.resumo || "Sempre disponível"],
  ];
  const nomes: Record<string, string> = {
    codigo: "Código",
    tipo: "Tipo",
    alcoolico: "Alcoólico",
    delivery: "Delivery",
    observacao: "Observação",
    categoria_id: "Categoria",
    nome: "Nome",
    preco: "Preço",
    categoria: "Categoria",
    ativo: "Ativo",
    descricao: "Descrição",
    disponibilidade: "Disponibilidade",
  };
  return (
    <section role="alert" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-semibold text-amber-950">Este item foi alterado por outra pessoa</h3>
      <p className="text-xs text-amber-900">Nada foi gravado. Valores atuais:</p>
      <dl className="space-y-1.5 text-sm">
        {linhas
          .filter(([k]) => !compacto || k in pendente)
          .map(([k, valor]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="text-ink-500">{nomes[k]}</dt>
              <dd className="min-w-0 break-words">
                <span className="font-medium text-ink-900">{valor}</span>
                {k in pendente && (
                  <span className="block text-xs text-purple-800">
                    Sua alteração: {valorPendente(k, pendente)}
                  </span>
                )}
              </dd>
            </div>
          ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={recarregar}>
          Recarregar valores atuais
        </Button>
        <Button size="sm" disabled={busy} onClick={reaplicar}>
          {busy ? "Salvando…" : "Reaplicar minha alteração"}
        </Button>
      </div>
    </section>
  );
}

/** Edição rápida do preço na lista: Enter salva, Esc cancela. */
export function PrecoRapido({ item, servicos }: { item: ItemCardapio; servicos: ServicosCat2 }) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [conflito, setConflito] = useState<ItemCardapio | null>(null);
  const [avisoPreco, setAvisoPreco] = useState<ItemCardapio | null>(null);
  function cancelar() {
    if (busy) return;
    setAberto(false);
    setConflito(null);
    setAvisoPreco(null);
    setErro("");
  }
  async function salvar(base = item, confirmado = false) {
    if (busy) return;
    let preco: number | null;
    try {
      preco = lerPreco(valor);
    } catch (e) {
      setErro((e as Error).message);
      return;
    }
    if (preco === base.preco) return cancelar();
    if (preco === null && base.preco !== null && !confirmado) {
      setAvisoPreco(base);
      return;
    }
    setAvisoPreco(null);
    setBusy(true);
    setErro("");
    try {
      const r = await servicos.editar(base, { preco });
      if (!r.ok) {
        setConflito(r.atual ?? null);
        if (!r.atual) setErro(r.mensagem);
        return;
      }
      setAberto(false);
      setConflito(null);
      toast.success(`Preço de ${item.nome} salvo: ${precoTexto(preco)}.`);
    } catch {
      setErro(ERRO_INCERTO);
    } finally {
      setBusy(false);
    }
  }
  if (!aberto)
    return (
      <button
        className={`mr-3 min-h-11 shrink-0 rounded-md px-3 text-sm font-semibold tabular-nums hover:bg-purple-100 focus-visible:outline-2 focus-visible:outline-purple-600 ${item.preco === null ? "bg-amber-50 text-amber-800" : "text-purple-900"}`}
        aria-label={`Editar preço de ${item.nome}`}
        title="Clique para editar o preço"
        onClick={() => {
          setValor(precoEditavel(item.preco));
          setErro("");
          setAberto(true);
        }}
      >
        {precoTexto(item.preco)}
      </button>
    );
  const digitado = precoDigitado(valor);
  return (
    <>
      <div className="w-72 max-w-[60vw] shrink-0 space-y-2 p-3">
        <label className="block text-xs font-medium text-ink-700">
          Preço de {item.nome}
          <span className="mt-1 flex items-center rounded-md border border-purple-300 bg-card focus-within:ring-2 focus-within:ring-purple-200">
            <span className="pl-3 text-sm text-ink-500">R$</span>
            <input
              autoFocus
              inputMode="decimal"
              aria-label={`Preço de ${item.nome}`}
              placeholder="0,00"
              className="h-10 w-full bg-transparent px-2 text-sm tabular-nums outline-none"
              value={valor}
              disabled={busy}
              onChange={(e) => {
                setValor(e.target.value);
                setErro("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void salvar();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelar();
                }
              }}
            />
          </span>
        </label>
        <p className={`text-xs ${digitado.erro ? "text-red-700" : "text-ink-500"}`}>
          {busy
            ? "Salvando…"
            : digitado.erro
              ? digitado.texto
              : `${digitado.texto} · Enter salva · Esc cancela`}
        </p>
        {!valor.trim() && item.preco !== null && (
          <p className="text-xs text-amber-800">{AVISO_SEM_PRECO}</p>
        )}
        {erro && (
          <p role="alert" className="text-xs text-red-700">
            {erro}
          </p>
        )}
        {conflito && (
          <Conflito
            compacto
            atual={conflito}
            pendente={{ preco: lerPrecoSeguro(valor) }}
            busy={busy}
            recarregar={() => {
              servicos.atualizarLocal(conflito);
              setConflito(null);
              setAberto(false);
            }}
            reaplicar={() => void salvar(conflito)}
          />
        )}
      </div>
      <ConfirmarSalvar
        textos={avisoPreco ? [AVISO_SEM_PRECO] : []}
        busy={busy}
        voltar={() => setAvisoPreco(null)}
        confirmar={() => avisoPreco && void salvar(avisoPreco, true)}
      />
    </>
  );
}
function lerPrecoSeguro(v: string) {
  try {
    return lerPreco(v);
  } catch {
    return null;
  }
}

/** Seção "Histórico": quem mudou, quando, antes e depois (gestao/alteracoes). */
export function HistoricoItem({ servicos, itemId }: { servicos: ServicosCat2; itemId: number }) {
  const [itens, setItens] = useState<AlteracaoItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  async function carregar(mais: boolean) {
    setEstado("carregando");
    try {
      const p = await servicos.historico(itemId, mais ? (cursor ?? undefined) : undefined);
      setItens((x) => (mais ? [...x, ...p.itens] : p.itens));
      setCursor(p.proximo_cursor);
      setEstado("ok");
    } catch {
      setEstado("erro");
    }
  }
  useEffect(() => {
    void carregar(false);
    // Uma leitura ao abrir o item; "Carregar mais" segue o cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);
  return (
    <section className="space-y-3 border-t border-base-200 pt-5" aria-label="Histórico">
      <h3 className="flex items-center gap-2 font-semibold text-purple-900">
        <History className="size-4" />
        Histórico
      </h3>
      {estado === "erro" && (
        <p role="alert" className="text-sm text-red-700">
          Não foi possível carregar o histórico.{" "}
          <button className="underline" onClick={() => void carregar(false)}>
            Tentar novamente
          </button>
        </p>
      )}
      {estado === "ok" && !itens.length && (
        <p className="text-sm text-ink-500">Nenhuma alteração feita pelo painel até agora.</p>
      )}
      <ol className="space-y-3">
        {itens.map((h) => (
          <li key={h.id} className="rounded-lg border border-base-200 p-3 text-sm">
            <p className="flex flex-wrap justify-between gap-x-3">
              <span className="font-semibold text-ink-900">{h.actor || "Sem identificação"}</span>
              <span className="text-xs text-ink-500">{dataHistorico(h.criado_em)}</span>
            </p>
            <dl className="mt-2 space-y-2">
              {camposAlterados(h).map((c) => (
                <div key={c.campo}>
                  <dt className="text-xs font-medium text-ink-500">{c.nome}</dt>
                  <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2 break-words">
                    <span className="text-ink-500 line-through decoration-ink-300">{c.antes}</span>
                    <span aria-hidden>→</span>
                    <span className="sr-only">passou a</span>
                    <span className="font-medium text-ink-900">{c.depois}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
      {estado === "carregando" && <p className="text-sm text-ink-500">Carregando histórico…</p>}
      {cursor !== null && estado === "ok" && (
        <Button variant="outline" size="sm" onClick={() => void carregar(true)}>
          Carregar mais
        </Button>
      )}
    </section>
  );
}

type ErroCampo = { campo: string; mensagem: string };

/** Painel lateral do item: dados, disponibilidade com prévia e histórico. Atendente só lê. */
export function ItemCat2({
  item,
  admin,
  grade = false,
  itens,
  unidadeNome,
  servicos,
  fechar,
  proteger,
}: {
  item: ItemCardapio;
  admin: boolean;
  grade?: boolean;
  itens: ItemCardapio[];
  unidadeNome: string;
  servicos: ServicosCat2;
  fechar: () => void;
  proteger?: ((v: boolean) => void) | undefined;
}) {
  const [base, setBase] = useState(item);
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState(dadosDe(item));
  const [r, setR] = useState(rascunhoDe(item.disponibilidade));
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [erro, setErro] = useState<ErroCampo | null>(null);
  const [conflito, setConflito] = useState<{ atual: ItemCardapio; pendente: CamposItem } | null>(
    null,
  );
  const [avisos, setAvisos] = useState<{
    atual: ItemCardapio;
    campos: CamposItem;
    textos: string[];
  } | null>(null);
  const regraMudou = JSON.stringify(r) !== JSON.stringify(rascunhoDe(base.disponibilidade));
  const sujo =
    (admin && (JSON.stringify(v) !== JSON.stringify(dadosDe(base)) || regraMudou)) ||
    (!admin && grade && regraMudou);
  const problema = problemaRascunho(r);
  const digitado = precoDigitado(v.preco);
  const some =
    admin && v.categoria !== base.categoria
      ? categoriaVaiSumir(categorias, base, { categoria: v.categoria })
      : null;

  function carregar(i: ItemCardapio) {
    setBase(i);
    setV(dadosDe(i));
    setR(rascunhoDe(i.disponibilidade));
    setConflito(null);
    setErro(null);
  }
  useEffect(() => {
    let vivo = true;
    void Promise.all([servicos.obter(item.item_id), servicos.categorias(item.unidade ?? "")])
      .then(([i, c]) => {
        if (!vivo) return;
        carregar(i);
        servicos.atualizarLocal(i);
        setCategorias(c.categorias);
        setCarregando(false);
      })
      .catch(() => {
        if (vivo)
          setErro({
            campo: "corpo",
            mensagem: "Não foi possível carregar os dados atuais do item. Feche e abra novamente.",
          });
      });
    return () => {
      vivo = false;
    };
  }, [item.item_id, item.unidade, servicos]);
  useEffect(() => {
    proteger?.(sujo || busy);
    const sairDaPagina = (e: BeforeUnloadEvent) => {
      if (!sujo && !busy) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const trocar = (e: Event) => {
      if (busy || (sujo && !window.confirm("Descartar alterações não salvas?"))) e.preventDefault();
    };
    window.addEventListener("beforeunload", sairDaPagina);
    window.addEventListener("gestao:trocar", trocar);
    return () => {
      proteger?.(false);
      window.removeEventListener("beforeunload", sairDaPagina);
      window.removeEventListener("gestao:trocar", trocar);
    };
  }, [sujo, busy, proteger]);
  const sair = () => {
    if (!busy && (!sujo || window.confirm("Descartar alterações não salvas?"))) fechar();
  };

  async function gravar(atual = base, pendente?: CamposItem, confirmado = false) {
    if ((!admin && !grade) || busy || carregando) return;
    let c: CamposItem;
    try {
      c = !admin && grade ? { disponibilidade: corpoDisponibilidade(r) } : (pendente ?? diferencaItem(base, v));
    } catch (e) {
      setErro({ campo: "preco", mensagem: (e as Error).message });
      return;
    }
    if (!pendente && regraMudou) c.disponibilidade = corpoDisponibilidade(r);
    if (!Object.keys(c).length) return;
    const some = categoriaVaiSumir(categorias, atual, c);
    const textos = [
      ...(c.preco === null && atual.preco !== null ? [AVISO_SEM_PRECO] : []),
      ...(some ? [avisoCategoriaSome(some)] : []),
    ];
    if (textos.length && !confirmado) {
      setAvisos({ atual, campos: c, textos });
      return;
    }
    setAvisos(null);
    setBusy(true);
    setErro(null);
    try {
      const res = await servicos.editar(atual, c);
      if (!res.ok) {
        if (res.atual) setConflito({ atual: res.atual, pendente: c });
        else setErro({ campo: res.campo ?? "corpo", mensagem: res.mensagem });
        return;
      }
      setConflito(null);
      toast.success("Item salvo.");
      fechar();
    } catch {
      setErro({ campo: "corpo", mensagem: ERRO_INCERTO });
    } finally {
      setBusy(false);
    }
  }
  const erroDo = (campo: string) =>
    erro?.campo === campo ? (
      <p role="alert" className="mt-1 text-xs text-red-700">
        {erro.mensagem}
      </p>
    ) : null;
  const agora = situacaoAgora(base);
  return (
    <Sheet open onOpenChange={(o) => !o && sair()}>
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[580px]"
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <header className="shrink-0 border-b border-base-200 px-6 pb-5 pt-7 pr-12">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-purple-600">
            Item do cardápio
          </p>
          <SheetTitle className="font-display text-2xl text-purple-900">{base.nome}</SheetTitle>
          <SheetDescription className="mt-2">
            {base.categoria || "Sem categoria"} · {unidadeNome}
          </SheetDescription>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p
              className={`text-xl font-semibold ${base.preco === null ? "text-amber-800" : "text-purple-900"}`}
            >
              {precoTexto(base.preco)}
            </p>
            <p
              className={`text-sm font-medium ${base.disponivel_agora ? "text-green-800" : "text-red-700"}`}
            >
              {agora}
            </p>
          </div>
          {horaReferencia(base.data_referencia) && (
            <p className="mt-1 text-xs text-ink-500">
              Situação do item salvo em {horaReferencia(base.data_referencia)} (horário da unidade).
              Não informa se a unidade está aberta.
            </p>
          )}
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {carregando && !erro && (
            <p role="status" className="text-sm text-ink-500">
              Carregando dados atuais…
            </p>
          )}
          {conflito && (
            <Conflito
              atual={conflito.atual}
              pendente={conflito.pendente}
              busy={busy}
              recarregar={() => {
                servicos.atualizarLocal(conflito.atual);
                carregar(conflito.atual);
              }}
              reaplicar={() => void gravar(conflito.atual, conflito.pendente)}
            />
          )}
          {admin ? (
            <fieldset disabled={busy || carregando} className="space-y-4">
              <legend className="mb-3 font-semibold text-purple-900">Dados do item</legend>
              <label className="block text-sm font-medium">
                Nome
                <Input
                  className="mt-1"
                  maxLength={LIMITE_NOME}
                  value={v.nome}
                  aria-invalid={erro?.campo === "nome" || !v.nome.trim()}
                  onChange={(e) => setV({ ...v, nome: e.target.value })}
                />
                <span className="mt-1 flex justify-between text-xs font-normal text-ink-500">
                  <span>{!v.nome.trim() ? "O nome é obrigatório." : ""}</span>
                  <span className="tabular-nums">
                    {v.nome.length}/{LIMITE_NOME}
                  </span>
                </span>
                {erroDo("nome")}
              </label>
              <label className="block text-sm font-medium">
                Descrição
                <textarea
                  className="mt-1 min-h-20 w-full rounded-md border border-input bg-card p-3 text-sm font-normal"
                  maxLength={LIMITE_DESCRICAO}
                  value={v.descricao}
                  aria-invalid={erro?.campo === "descricao"}
                  onChange={(e) => setV({ ...v, descricao: e.target.value })}
                />
                <span className="block text-right text-xs font-normal tabular-nums text-ink-500">
                  {v.descricao.length}/{LIMITE_DESCRICAO}
                </span>
                {erroDo("descricao")}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Preço
                  <span className="mt-1 flex items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-purple-200">
                    <span className="pl-3 text-sm font-normal text-ink-500">R$</span>
                    <input
                      inputMode="decimal"
                      placeholder="Sem preço"
                      className="h-10 w-full bg-transparent px-2 text-sm font-normal tabular-nums outline-none"
                      value={v.preco}
                      aria-invalid={erro?.campo === "preco" || digitado.erro}
                      onChange={(e) => {
                        setV({ ...v, preco: e.target.value });
                        if (erro?.campo === "preco") setErro(null);
                      }}
                    />
                  </span>
                  <span
                    className={`mt-1 block text-xs font-normal ${digitado.erro ? "text-red-700" : "text-ink-500"}`}
                  >
                    {digitado.texto}
                  </span>
                  {!v.preco.trim() && base.preco !== null && (
                    <span className="mt-1 block rounded-md bg-amber-50 p-2 text-xs font-normal text-amber-900">
                      {AVISO_SEM_PRECO}
                    </span>
                  )}
                  {erroDo("preco")}
                </label>
                <label className="block text-sm font-medium">
                  Categoria
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-card px-2 text-sm font-normal"
                    value={v.categoria}
                    aria-invalid={erro?.campo === "categoria"}
                    onChange={(e) => setV({ ...v, categoria: e.target.value })}
                  >
                    {opcoesCategoria(categorias, base.categoria).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {some && (
                    <span className="mt-1 block rounded-md bg-amber-50 p-2 text-xs font-normal text-amber-900">
                      {avisoCategoriaSome(some)} Ela não pode ser recriada pelo painel.
                    </span>
                  )}
                  {erroDo("categoria")}
                </label>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-base-200 p-3 text-sm font-medium">
                <span>
                  Item ativo
                  <span className="block text-xs font-normal text-ink-500">
                    Inativo, o item não é oferecido no atendimento.
                  </span>
                </span>
                <Switch checked={v.ativo} onCheckedChange={(ativo) => setV({ ...v, ativo })} />
              </label>
              {erroDo("ativo")}
            </fieldset>
          ) : (
            <section className="space-y-2 rounded-xl bg-base-100 p-4 text-sm">
              <p className="text-ink-700">{base.descricao || "Sem descrição cadastrada."}</p>
              <p className="text-xs text-ink-500">
                {base.ativo ? "Ativo" : "Inativo"} · Somente consulta
              </p>
            </section>
          )}
          {admin || grade ? (
            <div>
              <DisponibilidadeEditor
                r={r}
                mudar={(x) => {
                  setR(x);
                  if (erro?.campo === "disponibilidade") setErro(null);
                }}
                busy={busy || carregando}
                itens={itens.filter((i) => i.item_id !== base.item_id)}
                previa={
                  problema ? (
                    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      {problema}
                    </p>
                  ) : base.unidade ? (
                    <PreviaAoVivo
                      servicos={servicos}
                      unidade={base.unidade}
                      regra={corpoDisponibilidade(r)}
                    />
                  ) : undefined
                }
              />
              {erroDo("disponibilidade")}
            </div>
          ) : (
            <section>
              <h3 className="font-semibold text-purple-900">Disponibilidade</h3>
              <p className="mt-3 rounded-lg bg-purple-50 p-4 text-sm">
                {base.disponibilidade?.resumo || "Todos os dias, o dia inteiro"}
              </p>
            </section>
          )}
          {admin && <HistoricoItem servicos={servicos} itemId={base.item_id} />}
          {erro && !CAMPOS_COM_ERRO.includes(erro.campo) && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {erro.mensagem}
            </p>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-base-200 bg-card px-6 py-4">
          <span className="text-xs text-ink-500">
            {busy
              ? "Salvando…"
              : sujo
                ? "Alterações não salvas"
                : admin
                  ? "Dados atuais"
                  : "Somente consulta"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={sair}>
              {admin ? "Cancelar" : "Fechar"}
            </Button>
            {(admin || grade) && (
              <Button
                disabled={
                  busy ||
                  carregando ||
                  !sujo ||
                  Boolean(problema) ||
                  !v.nome.trim() ||
                  digitado.erro
                }
                onClick={() => void gravar()}
              >
                {busy ? "Salvando…" : "Salvar"}
              </Button>
            )}
          </div>
        </footer>
      </SheetContent>
      <ConfirmarSalvar
        textos={avisos?.textos ?? []}
        busy={busy}
        voltar={() => setAvisos(null)}
        confirmar={() => avisos && void gravar(avisos.atual, avisos.campos, true)}
      />
    </Sheet>
  );
}
