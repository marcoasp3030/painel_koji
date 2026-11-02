/** Cardápio do cliente: abre pelo link da conversa, sem login, e foi pensado para o navegador do WhatsApp. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bike,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Store,
  TriangleAlert,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ajustarRepeticao,
  alternarOpcao,
  faltaNasEscolhas,
  filtrarCategorias,
  mapaDeItens,
  mudarQuantidade,
  novaLinha,
  precoUnitario,
  proximaAbertura,
  reais,
  resumoDoPedido,
  somarLinha,
  textoAbertura,
  textoRecusa,
  unidadeLiberada,
  type Categoria,
  type CotacaoTaxa,
  type Escolha,
  type Grupo,
  type ItemCardapio,
  type Linha,
  type UnidadeCardapio,
} from "@/lib/cardapio";
import {
  cotarTaxaCardapio,
  enviarPedidoCardapio,
  lerCardapio,
  lerCep,
  lerUnidadeCardapio,
} from "@/lib/cardapio-publico.functions";
import { temaDoCardapio, type AparenciaCardapio, type Tema } from "@/lib/cardapio-tema";
import type { ResultadoCep } from "./EnderecoEntrega";
import { CapaLoja, MarcaLoja, TopoCardapio, type InfoLoja } from "./TopoCardapio";
import { Contador, DADOS_VAZIOS, PedidoCliente, type DadosPedido } from "./PedidoCliente";

type CarrinhoInicial = {
  unidade: string | null;
  modalidade: "delivery" | "retirada" | null;
  forma_pagamento: string | null;
  tem_endereco: boolean;
  agendado_para: string | null;
  itens: { item_id: number; quantidade: number; observacao: string | null; opcoes: Escolha[] }[];
};
type Inicio = {
  empresa: string;
  aparencia?: AparenciaCardapio | null;
  previa?: boolean;
  usado?: { numero: string };
  unidades?: UnidadeCardapio[];
  carrinho?: CarrinhoInicial | null;
};
type Salvo = { unidade: string | null; linhas: Linha[] };

const SOMBRA = "shadow-[0_1px_3px_rgba(26,21,32,0.07)]";
// A partir daqui o texto costuma passar das duas linhas do cartão.
const DESCRICAO_LONGA = 80;
const comMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function lerSalvo(chave: string): Salvo | null {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as Salvo) : null;
  } catch {
    return null;
  }
}
function gravarSalvo(chave: string, valor: Salvo | null) {
  try {
    if (valor) localStorage.setItem(chave, JSON.stringify(valor));
    else localStorage.removeItem(chave);
  } catch {
    /* Sem armazenamento, o pedido só não sobrevive a um recarregamento. */
  }
}

function Tela({
  titulo,
  children,
  icone,
}: {
  titulo: string;
  children: React.ReactNode;
  icone: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-base-50 px-6 text-center">
      <div className="duration-300 motion-safe:animate-in motion-safe:zoom-in-90">{icone}</div>
      <h1 className="mt-4 font-display text-3xl leading-tight text-[var(--cd-marca)]">{titulo}</h1>
      <div className="mt-2 max-w-xs text-base text-ink-700">{children}</div>
    </main>
  );
}

export function CardapioCliente() {
  const ler = useServerFn(lerCardapio);
  const [token, setToken] = useState<string | null>(null);
  const [inicio, setInicio] = useState<Inicio | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (inicio) document.title = inicio.aparencia?.nome_exibicao || inicio.empresa;
  }, [inicio]);

  useEffect(() => {
    const atual = window.location.hash.slice(1);
    if (!atual) {
      setErro("link_invalido");
      return;
    }
    setToken(atual);
    void ler({ data: { token: atual } })
      .then((r) => {
        if (r.ok) setInicio(r.dados as unknown as Inicio);
        else setErro(r.motivo ?? "indisponivel");
      })
      .catch(() => setErro("link_invalido"));
  }, [ler]);

  if (erro) {
    return (
      <Tela
        titulo="Link indisponível"
        icone={<TriangleAlert className="size-12 text-gold-700" aria-hidden />}
      >
        {textoRecusa(erro)}
      </Tela>
    );
  }
  if (!inicio || !token) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-base-50">
        <Loader2 className="size-8 animate-spin text-[var(--cd-marca)]" aria-label="Carregando" />
      </main>
    );
  }
  const tema = temaDoCardapio(inicio.aparencia);
  return (
    <div style={tema.estilo} className={tema.classe}>
      {inicio.usado ? (
        <Tela
          titulo={`Pedido nº ${inicio.usado.numero}`}
          icone={<CheckCircle2 className="size-16 text-success" aria-hidden />}
        >
          Este pedido já foi enviado. Acompanhe pela conversa.
        </Tela>
      ) : (
        <Cardapio token={token} inicio={inicio} tema={tema} />
      )}
    </div>
  );
}

function Cardapio({ token, inicio, tema }: { token: string; inicio: Inicio; tema: Tema }) {
  const aparencia = inicio.aparencia ?? null;
  const nome = aparencia?.nome_exibicao || inicio.empresa;
  const lerUnidade = useServerFn(lerUnidadeCardapio);
  const enviar = useServerFn(enviarPedidoCardapio);
  const consultarCep = useServerFn(lerCep);
  const cotar = useServerFn(cotarTaxaCardapio);
  const ler = useServerFn(lerCardapio);
  const [unidades, setUnidades] = useState(inicio.unidades ?? []);
  const [verFechada, setVerFechada] = useState(false);
  const carrinho = inicio.carrinho ?? null;
  const agendado = Boolean(carrinho?.agendado_para);

  // A loja pode fechar com a página aberta: confere de tempos em tempos e ao voltar para a aba.
  useEffect(() => {
    function conferir() {
      if (document.visibilityState !== "visible") return;
      void ler({ data: { token } })
        .then((r) => {
          const novas = r.ok ? (r.dados as unknown as Inicio).unidades : null;
          if (novas) setUnidades(novas);
        })
        .catch(() => undefined);
    }
    const relogio = window.setInterval(conferir, 60_000);
    document.addEventListener("visibilitychange", conferir);
    return () => {
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", conferir);
    };
  }, [ler, token]);
  const chaveSalvo = `cardapio:${token.slice(0, 12)}`;
  const salvo = useRef(lerSalvo(chaveSalvo));

  const [codigo, setCodigo] = useState<string | null>(
    salvo.current?.unidade ??
      carrinho?.unidade ??
      (unidades.length === 1 ? unidades[0]!.codigo : null),
  );
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>(() => {
    if (salvo.current) return salvo.current.linhas;
    return (carrinho?.itens ?? []).map((i) =>
      novaLinha(i.item_id, i.quantidade, i.opcoes, i.observacao ?? ""),
    );
  });
  const [dados, setDados] = useState<DadosPedido>(() => ({
    ...DADOS_VAZIOS,
    usarDaConversa: Boolean(carrinho?.tem_endereco),
  }));
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<ItemCardapio | null>(null);
  const [verPedido, setVerPedido] = useState(false);
  const [trocarUnidade, setTrocarUnidade] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<{ numero: string; total: number } | null>(null);

  const unidade = unidades.find((u) => u.codigo === codigo) ?? null;

  useEffect(() => {
    gravarSalvo(chaveSalvo, enviado ? null : { unidade: codigo, linhas });
  }, [chaveSalvo, codigo, linhas, enviado]);

  // Modalidade e pagamento vêm prontos quando só há uma opção, ou quando já foram ditos na conversa.
  useEffect(() => {
    if (!unidade) return;
    setDados((d) => {
      const modalidades = [
        ...(unidade.faz_entrega ? (["delivery"] as const) : []),
        ...(unidade.aceita_retirada ? (["retirada"] as const) : []),
      ];
      const pedida = carrinho?.modalidade;
      const modalidade =
        d.modalidade && modalidades.includes(d.modalidade)
          ? d.modalidade
          : pedida && modalidades.includes(pedida)
            ? pedida
            : modalidades.length === 1
              ? modalidades[0]!
              : null;
      const forma =
        unidade.formas.find((f) => f.codigo === d.forma)?.codigo ??
        unidade.formas.find((f) => f.codigo === carrinho?.forma_pagamento)?.codigo ??
        (unidade.formas.length === 1 ? unidade.formas[0]!.codigo : null);
      return { ...d, modalidade, forma };
    });
  }, [unidade, carrinho]);

  const carregar = useCallback(
    async (u: string) => {
      const r = await lerUnidade({ data: { token, unidade: u } });
      if (r.ok) {
        setCategorias((r.dados as unknown as { categorias: Categoria[] }).categorias);
        setErroCarga(null);
      } else setErroCarga(textoRecusa(r.motivo));
    },
    [lerUnidade, token],
  );
  useEffect(() => {
    if (!codigo) return;
    setCategorias(null);
    void carregar(codigo).catch(() => setErroCarga(textoRecusa(null)));
  }, [codigo, carregar]);

  const buscarCep = useCallback(
    async (cep: string): Promise<ResultadoCep> => {
      const r = await consultarCep({ data: { token, cep } });
      if (!r.ok) return { ok: false, motivo: r.motivo };
      const d = r.dados as { rua: string; bairro: string; cidade: string; uf: string };
      return { ok: true, rua: d.rua, bairro: d.bairro, cidade: d.cidade, uf: d.uf };
    },
    [consultarCep, token],
  );

  const cotarTaxa = useCallback(
    async (corpo: {
      unidade: string;
      bairro: string | null;
      cep: string | null;
      bairro_confirmado: boolean;
    }) => {
      const r = await cotar({ data: { token, ...corpo } });
      return r.ok ? (r.dados as unknown as CotacaoTaxa) : null;
    },
    [cotar, token],
  );

  const visiveis = useMemo(() => filtrarCategorias(categorias ?? [], busca), [categorias, busca]);
  const itens = useMemo(() => mapaDeItens(categorias ?? []), [categorias]);
  const resumo = resumoDoPedido(linhas, categorias ?? [], null);
  const refsCategoria = useRef(new Map<string, HTMLElement>());
  const refsChip = useRef(new Map<string, HTMLButtonElement>());

  // A categoria em destaque acompanha a rolagem.
  useEffect(() => {
    if (busca || !categorias?.length) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const topo = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (topo) setCategoriaAtiva(topo.target.getAttribute("data-categoria"));
        // No topo, a primeira seção ainda está abaixo da faixa observada.
        else if (window.scrollY < 200) setCategoriaAtiva(categorias[0]!.nome);
      },
      { rootMargin: "-130px 0px -70% 0px" },
    );
    refsCategoria.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [categorias, busca]);

  useEffect(() => {
    if (categoriaAtiva)
      refsChip.current
        .get(categoriaAtiva)
        ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [categoriaAtiva]);

  if (enviado) {
    return (
      <Tela
        titulo="Pedido enviado!"
        icone={
          <span className="flex size-20 items-center justify-center rounded-full bg-success-soft">
            <Check className="size-10 text-success" strokeWidth={3} aria-hidden />
          </span>
        }
      >
        <p className="font-display text-xl text-[var(--cd-marca)]">Nº {enviado.numero}</p>
        <p className="mt-1">Total de {reais(enviado.total)}</p>
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-card p-3 text-left text-sm text-ink-700 shadow-sm">
          <MessageCircle className="mt-0.5 size-4 shrink-0 text-[var(--cd-marca)]" aria-hidden />A
          unidade vai confirmar pela conversa. Pode fechar esta página.
        </p>
      </Tela>
    );
  }

  if (!unidade || !(unidadeLiberada(unidade, agendado) || verFechada)) {
    return (
      <EscolherUnidade
        empresa={nome}
        slogan={aparencia?.slogan ?? null}
        logoUrl={aparencia?.logo_url ?? null}
        bannerUrl={aparencia?.banner_url ?? null}
        bannerFoco={aparencia?.banner_foco ?? 50}
        previa={Boolean(inicio.previa)}
        agendado={agendado}
        guardados={linhas.length}
        unidades={unidades}
        escolher={(u) => {
          if (u !== codigo) setLinhas([]);
          setCodigo(u);
        }}
        verFechada={() => {
          setCodigo((c) => c ?? unidades[0]?.codigo ?? null);
          setVerFechada(true);
        }}
      />
    );
  }

  const noPedido = (itemId: number) =>
    linhas.filter((l) => l.item_id === itemId).reduce((s, l) => s + l.quantidade, 0);

  function adicionarDireto(item: ItemCardapio) {
    setLinhas((l) => somarLinha(l, novaLinha(item.item_id, 1, [], "")));
  }
  function diminuirDireto(item: ItemCardapio) {
    const chave = novaLinha(item.item_id, 1, [], "").chave;
    setLinhas((l) => {
      const atual = l.find((x) => x.chave === chave);
      return atual ? mudarQuantidade(l, chave, atual.quantidade - 1) : l;
    });
  }

  const fechada = !unidadeLiberada(unidade, agendado);
  const abre = textoAbertura(unidade.proxima_abertura);
  const faltaMinimo = unidade.pedido_minimo !== null ? unidade.pedido_minimo - resumo.subtotal : 0;
  const infos: InfoLoja[] = [
    unidade.faz_entrega
      ? {
          icone: Bike,
          titulo: "Entrega",
          valor: unidade.taxa_por_area
            ? "Conforme o endereço"
            : unidade.taxa_entrega !== null
              ? reais(unidade.taxa_entrega)
              : "A confirmar",
        }
      : null,
    unidade.aceita_retirada ? { icone: Store, titulo: "Retirada", valor: "Sem taxa" } : null,
    unidade.pedido_minimo !== null
      ? { icone: Receipt, titulo: "Mínimo", valor: reais(unidade.pedido_minimo) }
      : null,
  ].flatMap((i) => (i ? [i] : []));

  return (
    <div className="min-h-dvh bg-base-100 pb-28 text-ink-900">
      <TopoCardapio
        nome={nome}
        slogan={aparencia?.slogan ?? null}
        unidade={unidade.nome}
        aberta={unidade.aberta_agora}
        podeTrocar={unidades.length > 1}
        trocar={() => setTrocarUnidade(true)}
        logoUrl={aparencia?.logo_url ?? null}
        bannerUrl={aparencia?.banner_url ?? null}
        bannerFoco={aparencia?.banner_foco ?? 50}
        infos={infos}
      />

      {inicio.previa ? (
        <p className="mx-auto mt-3 max-w-3xl px-4 text-center text-sm text-gold-700">
          Prévia: é assim que o cliente vê. Pedidos não são enviados.
        </p>
      ) : null}
      {fechada ? (
        <p className="mx-auto mt-3 flex max-w-3xl items-center justify-center gap-1.5 px-4 text-center text-sm text-gold-700">
          <Clock className="size-4 shrink-0" aria-hidden />
          Fechada agora.{abre ? ` Abre ${abre}.` : ""}
        </p>
      ) : null}

      <div className="sticky top-0 z-20 mt-2 bg-base-100/90 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 pt-2">
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-500"
              aria-hidden
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="O que você quer pedir?"
              aria-label="Buscar no cardápio"
              className={`h-11 w-full rounded-full bg-card pl-10 pr-4 text-base outline-none ring-1 ring-base-200 transition-shadow focus:ring-2 focus:ring-purple-400 ${SOMBRA}`}
            />
          </div>
          {!busca && (categorias?.length ?? 0) > 1 ? (
            <nav
              aria-label="Categorias"
              className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none]"
            >
              {categorias!.map((c) => (
                <button
                  key={c.nome}
                  type="button"
                  ref={(el) => {
                    if (el) refsChip.current.set(c.nome, el);
                    else refsChip.current.delete(c.nome);
                  }}
                  aria-current={categoriaAtiva === c.nome ? "true" : undefined}
                  onClick={() =>
                    refsCategoria.current.get(c.nome)?.scrollIntoView({ behavior: "smooth" })
                  }
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    categoriaAtiva === c.nome
                      ? "bg-purple-800 text-[var(--cd-sobre)]"
                      : "bg-card text-ink-700 ring-1 ring-base-200"
                  }`}
                >
                  {c.nome}
                </button>
              ))}
            </nav>
          ) : (
            <div className="h-2" />
          )}
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4">
        {erroCarga ? (
          <p role="alert" className="py-10 text-center text-base text-ink-700">
            {erroCarga}
          </p>
        ) : !categorias ? (
          <ul className="space-y-2 pt-4" aria-label="Carregando">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-24 animate-pulse rounded-2xl bg-base-200/70" />
            ))}
          </ul>
        ) : visiveis.length === 0 ? (
          <p className="py-10 text-center text-base text-ink-500">
            {busca ? `Nada encontrado para “${busca}”.` : "O cardápio ainda não tem itens."}
          </p>
        ) : (
          visiveis.map((c) => (
            <section
              key={c.nome}
              data-categoria={c.nome}
              aria-label={c.nome}
              className="scroll-mt-28"
              ref={(el) => {
                if (el) refsCategoria.current.set(c.nome, el);
                else refsCategoria.current.delete(c.nome);
              }}
            >
              <h2 className="pb-2 pt-4 font-display text-xl text-[var(--cd-marca)]">{c.nome}</h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {c.itens.map((item) => (
                  <CartaoItem
                    key={item.item_id}
                    item={item}
                    quantidade={noPedido(item.item_id)}
                    abrir={() => setAberto(item)}
                    somar={() => adicionarDireto(item)}
                    tirar={() => diminuirDireto(item)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </main>

      {resumo.quantidade > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] duration-200 motion-safe:animate-in motion-safe:slide-in-from-bottom-4">
          <div className="mx-auto max-w-3xl">
            {faltaMinimo > 0 ? (
              <p className="mb-1.5 rounded-full bg-card px-3 py-1 text-center text-xs text-ink-700 shadow-md">
                Faltam {reais(faltaMinimo)} para o pedido mínimo
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setVerPedido(true)}
              className="flex h-14 w-full items-center gap-3 rounded-2xl bg-purple-800 px-4 text-base font-semibold text-[var(--cd-sobre)] shadow-[0_8px_24px_rgba(46,35,64,0.35)] transition-colors active:bg-purple-900"
            >
              <span className="relative">
                <ShoppingBag className="size-5" aria-hidden />
                <span
                  key={resumo.quantidade}
                  className="absolute -right-2.5 -top-2.5 flex size-5 items-center justify-center rounded-full bg-[var(--cd-destaque)] text-[11px] font-bold text-[var(--cd-sobre-destaque)] duration-200 motion-safe:animate-in motion-safe:zoom-in-50"
                >
                  {resumo.quantidade}
                </span>
              </span>
              <span className="ml-1">Ver pedido</span>
              <span className="ml-auto tabular-nums">{reais(resumo.subtotal)}</span>
              <ChevronRight className="size-5 opacity-70" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <Sheet open={Boolean(aberto)} onOpenChange={(a) => !a && setAberto(null)}>
        <SheetContent
          side="bottom"
          style={tema.estilo}
          className={`${tema.classe} text-ink-900 mx-auto flex max-h-[92dvh] max-w-2xl flex-col gap-0 overflow-hidden rounded-t-3xl p-0`}
        >
          {aberto ? (
            <MontarItem
              key={aberto.item_id}
              item={aberto}
              adicionar={(linha) => {
                setLinhas((l) => somarLinha(l, linha));
                setAberto(null);
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={verPedido} onOpenChange={setVerPedido}>
        <SheetContent
          side="bottom"
          style={tema.estilo}
          className={`${tema.classe} text-ink-900 mx-auto flex h-[100dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:h-[94dvh] sm:rounded-t-3xl`}
        >
          {verPedido && categorias ? (
            <PedidoCliente
              unidade={unidade}
              linhas={linhas}
              categorias={categorias}
              itens={itens}
              temEnderecoNaConversa={Boolean(carrinho?.tem_endereco)}
              previa={Boolean(inicio.previa)}
              fechada={fechada}
              dados={dados}
              mudarDados={(parte) => setDados((d) => ({ ...d, ...parte }))}
              // Sempre sobre o estado de agora: a busca do CEP responde depois e não pode usar uma cópia antiga.
              mudarEndereco={(parte) =>
                setDados((d) => ({ ...d, endereco: { ...d.endereco, ...parte } }))
              }
              mudarLinhas={setLinhas}
              recarregar={() => carregar(unidade.codigo)}
              fechar={() => setVerPedido(false)}
              enviar={(corpo) => enviar({ data: { token, ...corpo } })}
              concluir={(numero, total) => {
                gravarSalvo(chaveSalvo, null);
                setEnviado({ numero, total });
              }}
              buscarCep={buscarCep}
              cotarTaxa={cotarTaxa}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={trocarUnidade} onOpenChange={setTrocarUnidade}>
        <SheetContent
          side="bottom"
          style={tema.estilo}
          className={`${tema.classe} text-ink-900 mx-auto max-h-[80dvh] max-w-2xl overflow-y-auto rounded-t-3xl p-4`}
        >
          <SheetHeader className="text-left">
            <SheetTitle>Escolher unidade</SheetTitle>
            <SheetDescription>
              {linhas.length
                ? "Cada unidade tem seu cardápio: trocar esvazia o pedido."
                : "Cada unidade tem seu cardápio."}
            </SheetDescription>
          </SheetHeader>
          <ListaUnidades
            unidades={unidades}
            agendado={agendado}
            atual={unidade.codigo}
            escolher={(u) => {
              if (u !== unidade.codigo) {
                setLinhas([]);
                setCodigo(u);
              }
              setTrocarUnidade(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ListaUnidades({
  unidades,
  agendado,
  atual,
  escolher,
}: {
  unidades: UnidadeCardapio[];
  agendado: boolean;
  atual?: string;
  escolher: (codigo: string) => void;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {unidades.map((u) => {
        const liberada = unidadeLiberada(u, agendado);
        const abre = textoAbertura(u.proxima_abertura);
        return (
          <li key={u.codigo}>
            <button
              type="button"
              disabled={!liberada}
              onClick={() => escolher(u.codigo)}
              className={`flex min-h-16 w-full items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 transition-shadow ${SOMBRA} ${
                atual === u.codigo ? "ring-2 ring-purple-700" : "ring-base-200"
              } ${liberada ? "" : "cursor-not-allowed bg-base-100 opacity-70 shadow-none"}`}
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${liberada ? "bg-purple-100 text-[var(--cd-marca)]" : "bg-base-200 text-ink-500"}`}
              >
                {liberada ? (
                  <Store className="size-5" aria-hidden />
                ) : (
                  <Clock className="size-5" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{u.nome}</span>
                {u.endereco ? (
                  <span className="block truncate text-sm text-ink-500">{u.endereco}</span>
                ) : null}
                {!liberada ? (
                  <span className="block text-sm font-medium text-gold-700">
                    {abre ? `Fechada · abre ${abre}` : "Fechada no momento"}
                  </span>
                ) : null}
              </span>
              {liberada && u.aberta_agora ? (
                <span className="shrink-0 text-xs font-medium text-success">Aberta</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EscolherUnidade({
  empresa,
  slogan,
  logoUrl,
  bannerUrl,
  bannerFoco,
  previa,
  agendado,
  guardados,
  unidades,
  escolher,
  verFechada,
}: {
  empresa: string;
  slogan: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerFoco: number;
  previa: boolean;
  agendado: boolean;
  guardados: number;
  unidades: UnidadeCardapio[];
  escolher: (codigo: string) => void;
  verFechada: () => void;
}) {
  if (unidades.length === 0) {
    return (
      <Tela
        titulo={empresa}
        icone={<Store className="size-12 text-[var(--cd-marca)]" aria-hidden />}
      >
        O cardápio não está disponível agora. Fale com o atendente.
      </Tela>
    );
  }
  const todasFechadas = !unidades.some((u) => unidadeLiberada(u, agendado));
  const abre = textoAbertura(proximaAbertura(unidades));
  return (
    <div className="min-h-dvh bg-base-100 text-ink-900">
      <CapaLoja bannerUrl={bannerUrl} bannerFoco={bannerFoco}>
        <div className="relative mx-auto flex w-full max-w-md items-center gap-3 pb-2">
          <MarcaLoja nome={empresa} logoUrl={logoUrl} />
          <div className="min-w-0">
            <h1 className="line-clamp-2 font-display text-2xl leading-tight">{empresa}</h1>
            {slogan ? <p className="line-clamp-2 text-sm opacity-90">{slogan}</p> : null}
          </div>
        </div>
      </CapaLoja>
      <main className="relative mx-auto -mt-8 max-w-md rounded-t-3xl bg-base-100 px-4 pb-8 pt-5">
        {previa ? (
          <p className="mb-2 text-sm text-gold-700">
            Prévia: é assim que o cliente vê. Pedidos não são enviados.
          </p>
        ) : null}
        {todasFechadas ? (
          <div
            role="alert"
            className={`rounded-2xl bg-card p-5 text-center ring-2 ring-[var(--cd-destaque)] ${SOMBRA}`}
          >
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-purple-100 text-[var(--cd-marca)]">
              <Clock className="size-7" aria-hidden />
            </span>
            <p className="mt-3 font-display text-2xl text-[var(--cd-marca)]">
              Estamos fechados agora
            </p>
            <p className="mt-1 text-base text-ink-700">
              {abre
                ? `Abrimos ${abre}. Você poderá fazer seu pedido nesse horário.`
                : "Não estamos recebendo pedidos no momento. Volte mais tarde."}
            </p>
            {guardados ? (
              <p className="mt-2 text-sm text-ink-500">Seu pedido fica guardado neste link.</p>
            ) : null}
          </div>
        ) : (
          <p className="font-display text-xl text-[var(--cd-marca)]">Qual unidade você quer?</p>
        )}
        {unidades.length > 1 || !todasFechadas ? (
          <ListaUnidades unidades={unidades} agendado={agendado} escolher={escolher} />
        ) : null}
        {previa && todasFechadas ? (
          <button
            type="button"
            onClick={verFechada}
            className="mt-4 w-full text-center text-sm font-medium text-[var(--cd-marca)] underline underline-offset-2"
          >
            Ver o cardápio mesmo assim (só na prévia)
          </button>
        ) : null}
      </main>
    </div>
  );
}

export function CartaoItem({
  item,
  quantidade,
  abrir,
  somar,
  tirar,
}: {
  item: ItemCardapio;
  quantidade: number;
  abrir: () => void;
  somar: () => void;
  tirar: () => void;
}) {
  const simples = item.grupos.length === 0;
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 transition-shadow ${SOMBRA} ${
        quantidade > 0 ? "ring-2 ring-purple-300" : "ring-transparent"
      } ${item.disponivel ? "" : "opacity-60"}`}
    >
      <button
        type="button"
        aria-label={`Ver detalhes de ${item.nome}`}
        onClick={abrir}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block text-base font-semibold leading-snug">{item.nome}</span>
        {item.descricao ? (
          <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-ink-500">
            {item.descricao}
          </span>
        ) : null}
        {(item.descricao?.length ?? 0) > DESCRICAO_LONGA ? (
          <span className="mt-0.5 block text-xs font-medium text-[var(--cd-marca)]">Ver mais</span>
        ) : null}
        <span className="mt-1.5 block text-base font-semibold tabular-nums text-[var(--cd-marca)]">
          {item.grupos.length ? (
            <span className="text-xs font-normal text-ink-500">a partir de </span>
          ) : null}
          {reais(item.preco)}
        </span>
        {item.aviso ? (
          <span className="mt-0.5 block text-xs text-gold-700">{comMaiuscula(item.aviso)}</span>
        ) : null}
      </button>
      {!item.disponivel ? null : simples && quantidade > 0 ? (
        <Contador valor={quantidade} tirar={tirar} somar={somar} nome={item.nome} />
      ) : (
        <button
          type="button"
          aria-label={`Adicionar ${item.nome}`}
          onClick={simples ? somar : abrir}
          className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-purple-800 text-[var(--cd-sobre)] shadow-md transition-transform active:scale-90"
        >
          <Plus className="size-5" aria-hidden />
          {quantidade > 0 ? (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[var(--cd-destaque)] text-[11px] font-bold text-[var(--cd-sobre-destaque)]">
              {quantidade}
            </span>
          ) : null}
        </button>
      )}
    </li>
  );
}

function regraDoGrupo(g: Grupo) {
  if (g.minimo > 0 && g.minimo === g.maximo)
    return g.maximo === 1 ? "Escolha 1" : `Escolha ${g.maximo}`;
  if (g.minimo > 0) return `Escolha de ${g.minimo} a ${g.maximo}`;
  return `Até ${g.maximo}`;
}

function MontarItem({ item, adicionar }: { item: ItemCardapio; adicionar: (l: Linha) => void }) {
  const [opcoes, setOpcoes] = useState<Escolha[]>([]);
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");
  const falta = faltaNasEscolhas(item, opcoes);
  const unitario = precoUnitario(item, opcoes);
  return (
    <>
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-base-200" aria-hidden />
      <SheetHeader className="px-4 pb-2 pt-2 pr-10 text-left">
        <SheetTitle className="font-display text-2xl leading-tight">{item.nome}</SheetTitle>
        <SheetDescription className="sr-only">Detalhes do item</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          <p className="text-lg font-semibold tabular-nums text-[var(--cd-marca)]">
            {item.grupos.length ? (
              <span className="text-sm font-normal text-ink-500">a partir de </span>
            ) : null}
            {reais(item.preco)}
          </p>
          {item.descricao ? (
            <p className="whitespace-pre-line text-base leading-relaxed text-ink-700">
              {item.descricao}
            </p>
          ) : null}
          {item.alcoolico ? (
            <p className="inline-flex rounded-full bg-base-100 px-2.5 py-1 text-xs font-medium text-ink-700">
              Bebida alcoólica · venda para maiores de 18 anos
            </p>
          ) : null}
          {!item.disponivel ? (
            <p className="flex items-start gap-1.5 rounded-xl bg-base-100 p-3 text-sm font-medium text-gold-700">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              {item.aviso ? comMaiuscula(item.aviso) : "Indisponível no momento."}
            </p>
          ) : null}
        </div>
        {(item.disponivel ? item.grupos : []).map((g) => (
          <fieldset key={g.grupo_id}>
            <legend className="flex w-full items-center justify-between gap-2">
              <span className="text-base font-semibold">{g.nome}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${g.obrigatorio ? "bg-purple-800 text-[var(--cd-sobre)]" : "bg-base-100 text-ink-500"}`}
              >
                {regraDoGrupo(g)}
              </span>
            </legend>
            <ul className="mt-2 space-y-1.5">
              {g.opcoes.map((o) => {
                const atual = opcoes.find(
                  (e) => e.grupo_id === g.grupo_id && e.opcao_id === o.opcao_id,
                );
                const extra = o.preco_extra ? `+ ${reais(o.preco_extra)}` : null;
                if (g.repetir && g.maximo > 1) {
                  return (
                    <li
                      key={o.opcao_id}
                      className="flex items-center gap-2 rounded-xl bg-base-50 px-3 py-1.5"
                    >
                      <span className="min-w-0 flex-1 text-base">
                        {o.nome}
                        {extra ? <span className="block text-sm text-ink-500">{extra}</span> : null}
                      </span>
                      <Contador
                        valor={atual?.quantidade ?? 0}
                        nome={o.nome}
                        tirar={() => setOpcoes(ajustarRepeticao(g, opcoes, o.opcao_id, -1))}
                        somar={() => setOpcoes(ajustarRepeticao(g, opcoes, o.opcao_id, 1))}
                      />
                    </li>
                  );
                }
                return (
                  <li key={o.opcao_id}>
                    <button
                      type="button"
                      role={g.maximo === 1 ? "radio" : "checkbox"}
                      aria-checked={Boolean(atual)}
                      onClick={() => setOpcoes(alternarOpcao(g, opcoes, o.opcao_id))}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                        atual ? "border-purple-800 bg-purple-50" : "border-transparent bg-base-50"
                      }`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center border-2 ${g.maximo === 1 ? "rounded-full" : "rounded-md"} ${atual ? "border-purple-800 bg-purple-800 text-[var(--cd-sobre)]" : "border-ink-300"}`}
                      >
                        {atual ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
                      </span>
                      <span className="min-w-0 flex-1 text-base">{o.nome}</span>
                      {extra ? <span className="text-sm text-ink-500">{extra}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
        {item.disponivel ? (
          <label className="block">
            <span className="text-base font-semibold">Observação</span>
            <textarea
              value={observacao}
              maxLength={300}
              rows={2}
              placeholder="Ex.: sem cebola"
              onChange={(e) => setObservacao(e.target.value)}
              className="mt-2 w-full resize-none rounded-xl border border-base-200 bg-base-50 p-3 text-base outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
            />
          </label>
        ) : null}
      </div>
      {!item.disponivel ? null : (
        <div className="flex items-center gap-3 border-t border-base-200 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Contador
            valor={quantidade}
            nome={item.nome}
            tirar={() => setQuantidade(Math.max(1, quantidade - 1))}
            somar={() => setQuantidade(Math.min(99, quantidade + 1))}
          />
          <button
            type="button"
            disabled={Boolean(falta)}
            onClick={() => adicionar(novaLinha(item.item_id, quantidade, opcoes, observacao))}
            className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-2xl bg-purple-800 px-3 text-base font-semibold text-[var(--cd-sobre)] transition-colors active:bg-purple-900 disabled:bg-base-200 disabled:font-medium disabled:text-ink-700"
          >
            <span className="truncate">
              {falta ?? `Adicionar · ${reais(unitario * quantidade)}`}
            </span>
          </button>
        </div>
      )}
    </>
  );
}
