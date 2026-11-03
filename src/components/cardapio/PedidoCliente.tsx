/** Fechamento do pedido: revisar, como receber, pagamento e enviar. O que foi preenchido fica guardado ao voltar ao cardápio. */
import { useEffect, useState, type ReactNode } from "react";
import {
  Banknote,
  Bike,
  CreditCard,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquareText,
  QrCode,
  ShoppingBag,
  Store,
  Wallet,
  X,
} from "lucide-react";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ENDERECO_VAZIO,
  faltaNoEndereco,
  pendenciaDaArea,
  taxaFinal,
  type CotacaoTaxa,
  montarEndereco,
  mudarQuantidade,
  nomesDasEscolhas,
  precoUnitario,
  reais,
  resumoDoPedido,
  textoRecusa,
  type Categoria,
  type Endereco,
  type Escolha,
  type ItemCardapio,
  type Linha,
  type UnidadeCardapio,
} from "@/lib/cardapio";
import { EnderecoEntrega, type ResultadoCep } from "./EnderecoEntrega";
import { FinalizarWhatsapp, type Finalizacao, type SituacaoFinalizacao } from "./FinalizarWhatsapp";

export type DadosPedido = {
  modalidade: "delivery" | "retirada" | null;
  endereco: Endereco;
  usarDaConversa: boolean;
  forma: string | null;
  precisaTroco: boolean;
  troco: string;
  maioridade: boolean;
  observacao: string;
};

export const DADOS_VAZIOS: DadosPedido = {
  modalidade: null,
  endereco: ENDERECO_VAZIO,
  usarDaConversa: false,
  forma: null,
  precisaTroco: false,
  troco: "",
  maioridade: false,
  observacao: "",
};

export type CorpoEnvio = {
  unidade: string;
  itens: { item_id: number; quantidade: number; observacao: string | null; opcoes: Escolha[] }[];
  modalidade: "delivery" | "retirada";
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  bairro_confirmado: boolean;
  forma_pagamento: string;
  troco_para: number | null;
  observacao: string | null;
  maioridade_confirmada: boolean;
  total_visto: number;
};

export type RespostaEnvio =
  { ok: true; dados: { [chave: string]: unknown } } | { ok: false; motivo: string | null };

export function Contador({
  valor,
  tirar,
  somar,
  nome,
}: {
  valor: number;
  tirar: () => void;
  somar: () => void;
  nome: string;
}) {
  return (
    <span className="flex items-center rounded-full bg-purple-50 p-0.5">
      <button
        type="button"
        aria-label={`Tirar ${nome}`}
        onClick={tirar}
        className="flex size-9 items-center justify-center rounded-full text-xl leading-none text-[var(--cd-marca)] active:bg-purple-100"
      >
        −
      </button>
      <span className="w-6 text-center text-base font-semibold tabular-nums text-[var(--cd-marca)]">
        {valor}
      </span>
      <button
        type="button"
        aria-label={`Somar ${nome}`}
        onClick={somar}
        className="flex size-9 items-center justify-center rounded-full bg-purple-800 text-xl leading-none text-[var(--cd-sobre)] active:bg-purple-900"
      >
        +
      </button>
    </span>
  );
}

function Bloco({
  id,
  destaque,
  icone,
  titulo,
  children,
}: {
  id?: string;
  destaque?: boolean;
  icone: ReactNode;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={titulo}
      className={`scroll-mt-3 rounded-2xl bg-card p-4 shadow-[0_1px_3px_rgba(26,21,32,0.07)] transition-shadow duration-300 ${
        destaque ? "ring-2 ring-[var(--cd-marca)]" : ""
      }`}
    >
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink-900">
        <span className="flex size-7 items-center justify-center rounded-full bg-purple-100 text-[var(--cd-marca)]">
          {icone}
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Escolha2({
  ativo,
  onClick,
  icone,
  titulo,
  detalhe,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: ReactNode;
  titulo: string;
  detalhe?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      aria-label={titulo}
      onClick={onClick}
      className={`flex min-h-16 flex-col justify-center rounded-xl border-2 px-3 py-2 text-left transition-colors ${
        ativo ? "border-purple-800 bg-purple-50" : "border-base-200 bg-card"
      }`}
    >
      <span
        className={`flex items-center gap-2 ${ativo ? "text-[var(--cd-marca)]" : "text-ink-700"}`}
      >
        {icone}
        <span className="text-base font-medium">{titulo}</span>
      </span>
      {detalhe ? <span className="mt-0.5 text-sm text-ink-500">{detalhe}</span> : null}
    </button>
  );
}

function iconeDaForma(codigo: string) {
  if (codigo.includes("pix")) return <QrCode className="size-5" aria-hidden />;
  if (codigo.includes("cart") || codigo.includes("vale"))
    return <CreditCard className="size-5" aria-hidden />;
  if (codigo.includes("dinheiro")) return <Banknote className="size-5" aria-hidden />;
  return <Wallet className="size-5" aria-hidden />;
}

export function PedidoCliente({
  unidade,
  linhas,
  categorias,
  itens,
  temEnderecoNaConversa,
  previa,
  fechada,
  dados,
  mudarDados,
  mudarEndereco,
  mudarLinhas,
  recarregar,
  fechar,
  enviar,
  loja,
  finalizar,
  consultarFinalizacao,
  concluir,
  buscarCep,
  cotarTaxa,
}: {
  unidade: UnidadeCardapio;
  linhas: Linha[];
  categorias: Categoria[];
  itens: Map<number, ItemCardapio>;
  temEnderecoNaConversa: boolean;
  previa: boolean;
  fechada: boolean;
  dados: DadosPedido;
  mudarDados: (parte: Partial<DadosPedido>) => void;
  mudarEndereco: (parte: Partial<Endereco>) => void;
  mudarLinhas: (f: (l: Linha[]) => Linha[]) => void;
  recarregar: () => Promise<void>;
  fechar: () => void;
  enviar: (corpo: CorpoEnvio) => Promise<RespostaEnvio>;
  /** Link da loja: o pedido termina com uma mensagem no WhatsApp. */
  loja: boolean;
  finalizar: (corpo: CorpoEnvio) => Promise<RespostaEnvio>;
  consultarFinalizacao: (codigo: string) => Promise<SituacaoFinalizacao | null>;
  concluir: (numero: string, total: number) => void;
  buscarCep: (cep: string) => Promise<ResultadoCep>;
  cotarTaxa: (corpo: {
    unidade: string;
    bairro: string | null;
    cep: string | null;
    bairro_confirmado: boolean;
  }) => Promise<CotacaoTaxa | null>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [finalizacao, setFinalizacao] = useState<Finalizacao | null>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  const { modalidade, forma, precisaTroco, troco, maioridade, observacao } = dados;
  // Taxa por área precisa de bairro e CEP separados: o endereço solto da conversa não mostra o valor antes de pedir.
  const usarDaConversa = dados.usarDaConversa && !unidade.taxa_por_area;
  const porArea = modalidade === "delivery" && unidade.taxa_por_area;
  const bairroDigitado = dados.endereco.bairro.trim();
  const cepDigitado = dados.endereco.cep.length === 8 ? dados.endereco.cep : null;
  const chaveArea = `${unidade.codigo}|${bairroDigitado}|${cepDigitado ?? ""}`;
  const [confirmou, setConfirmou] = useState<string | null>(null);
  const bairroConfirmado = confirmou === chaveArea;
  const [cotacao, setCotacao] = useState<{ chave: string; c: CotacaoTaxa | null } | null>(null);
  const chaveCotacao = `${chaveArea}|${bairroConfirmado}`;
  const temArea = Boolean(bairroDigitado || cepDigitado);
  useEffect(() => {
    if (!porArea || !temArea) return;
    let vivo = true;
    const espera = window.setTimeout(() => {
      void cotarTaxa({
        unidade: unidade.codigo,
        bairro: bairroDigitado || null,
        cep: cepDigitado,
        bairro_confirmado: bairroConfirmado,
      })
        .catch(() => null)
        .then((c) => {
          if (vivo) setCotacao({ chave: chaveCotacao, c });
        });
    }, 350);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [
    porArea,
    temArea,
    unidade.codigo,
    bairroDigitado,
    cepDigitado,
    bairroConfirmado,
    chaveCotacao,
    cotarTaxa,
  ]);
  const cotando = porArea && temArea && cotacao?.chave !== chaveCotacao;
  const cotada = cotacao?.chave === chaveCotacao ? cotacao.c : null;
  const modalidades = [
    ...(unidade.faz_entrega ? (["delivery"] as const) : []),
    ...(unidade.aceita_retirada ? (["retirada"] as const) : []),
  ];
  const taxa =
    modalidade !== "delivery"
      ? null
      : taxaFinal(
          porArea ? (cotada?.taxa ?? null) : unidade.taxa_entrega,
          unidade.frete_gratis_acima,
          resumoDoPedido(linhas, categorias, null).subtotal,
        );
  const r = resumoDoPedido(linhas, categorias, taxa);
  const formaAtual = unidade.formas.find((f) => f.codigo === forma);
  const trocoValor = Number(troco.replace(",", "."));
  // O que falta e onde: o botão leva o cliente até o bloco, em vez de só ficar cinza.
  const falta = ((): [string, string] | null => {
    if (!r.quantidade) return ["Seu pedido está vazio", "pedido-itens"];
    if (r.fora.length) return ["Tire os itens indisponíveis", "pedido-itens"];
    if (unidade.pedido_minimo !== null && r.subtotal < unidade.pedido_minimo)
      return [`Pedido mínimo: ${reais(unidade.pedido_minimo)}`, "pedido-itens"];
    if (!modalidade) return ["Escolha entrega ou retirada", "pedido-receber"];
    if (modalidade === "delivery" && !usarDaConversa) {
      const endereco = faltaNoEndereco(dados.endereco);
      if (endereco) return [endereco, "pedido-receber"];
    }
    if (porArea) {
      if (cotando) return ["Calculando a taxa de entrega…", "pedido-receber"];
      if (temArea && !cotada)
        return ["Não foi possível calcular a taxa. Tente de novo", "pedido-receber"];
      const area = pendenciaDaArea(cotada, bairroConfirmado);
      if (area) return [area, "pedido-receber"];
    }
    if (!forma) return ["Escolha a forma de pagamento", "pedido-pagamento"];
    if (precisaTroco && !(trocoValor > r.total))
      return ["Informe o valor para troco", "pedido-pagamento"];
    if (r.alcoolico && !maioridade)
      return ["Confirme que tem 18 anos ou mais", "pedido-maioridade"];
    return null;
  })();
  const pendencia = falta?.[0] ?? null;

  function levarAoQueFalta() {
    if (!falta) return;
    document.getElementById(falta[1])?.scrollIntoView({ behavior: "smooth", block: "center" });
    setDestaque(falta[1]);
    window.setTimeout(() => setDestaque(null), 1800);
  }

  async function mandar() {
    if (pendencia || !modalidade || !forma || enviando || previa || fechada) return;
    setEnviando(true);
    setErro(null);
    try {
      const corpo = {
        unidade: unidade.codigo,
        itens: linhas.map((l) => ({
          item_id: l.item_id,
          quantidade: l.quantidade,
          observacao: l.observacao || null,
          opcoes: l.opcoes,
        })),
        modalidade,
        endereco:
          modalidade === "delivery" && !usarDaConversa ? montarEndereco(dados.endereco) : null,
        bairro: modalidade === "delivery" && !usarDaConversa ? bairroDigitado || null : null,
        cep: modalidade === "delivery" && !usarDaConversa ? cepDigitado : null,
        bairro_confirmado: bairroConfirmado,
        forma_pagamento: forma,
        troco_para: precisaTroco && formaAtual?.aceita_troco ? trocoValor : null,
        observacao: observacao.trim() || null,
        maioridade_confirmada: maioridade,
        total_visto: r.total,
      };
      if (loja) {
        const resposta = await finalizar(corpo);
        if (resposta.ok) {
          setFinalizacao(resposta.dados as unknown as Finalizacao);
          return;
        }
        setErro(textoRecusa(resposta.motivo));
        await recarregar().catch(() => undefined);
        return;
      }
      const resposta = await enviar(corpo);
      if (resposta.ok) {
        const total = resposta.dados["total"];
        concluir(String(resposta.dados["numero"]), typeof total === "number" ? total : r.total);
        return;
      }
      setErro(textoRecusa(resposta.motivo));
      // Preço, item ou opção mudou: mostra o cardápio de agora antes de tentar de novo.
      await recarregar().catch(() => undefined);
    } catch {
      setErro(textoRecusa(null));
    } finally {
      setEnviando(false);
    }
  }

  if (finalizacao) {
    return (
      <FinalizarWhatsapp
        finalizacao={finalizacao}
        total={r.total}
        consultar={consultarFinalizacao}
        concluir={concluir}
        voltar={() => setFinalizacao(null)}
      />
    );
  }

  return (
    <>
      <SheetHeader className="border-b border-base-200 bg-card px-4 py-3 pr-10 text-left">
        <SheetTitle className="text-lg">Seu pedido</SheetTitle>
        <SheetDescription>{unidade.nome}</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-base-100 p-3">
        <Bloco
          id="pedido-itens"
          destaque={destaque === "pedido-itens"}
          icone={<ShoppingBag className="size-4" aria-hidden />}
          titulo="Itens"
        >
          <ul className="divide-y divide-base-200">
            {linhas.map((l) => {
              const item = itens.get(l.item_id);
              const indisponivel = !item || !item.disponivel;
              const escolhas = item ? nomesDasEscolhas(item, l.opcoes) : [];
              return (
                <li key={l.chave} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium leading-snug">{item?.nome ?? "Item"}</p>
                    {escolhas.length ? (
                      <p className="text-sm text-ink-500">{escolhas.join(", ")}</p>
                    ) : null}
                    {l.observacao ? (
                      <p className="text-sm text-ink-500">Obs.: {l.observacao}</p>
                    ) : null}
                    {indisponivel ? (
                      <p className="text-sm text-destructive">Indisponível agora</p>
                    ) : (
                      <p className="text-sm font-medium tabular-nums text-[var(--cd-marca)]">
                        {reais(precoUnitario(item, l.opcoes) * l.quantidade)}
                      </p>
                    )}
                  </div>
                  {indisponivel ? (
                    <button
                      type="button"
                      aria-label={`Tirar ${item?.nome ?? "item"}`}
                      onClick={() => mudarLinhas((ls) => mudarQuantidade(ls, l.chave, 0))}
                      className="flex size-9 items-center justify-center rounded-full bg-base-100"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  ) : (
                    <Contador
                      valor={l.quantidade}
                      nome={item.nome}
                      tirar={() =>
                        mudarLinhas((ls) => mudarQuantidade(ls, l.chave, l.quantidade - 1))
                      }
                      somar={() =>
                        mudarLinhas((ls) => mudarQuantidade(ls, l.chave, l.quantidade + 1))
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={fechar}
            className="mt-2 text-sm font-medium text-[var(--cd-marca)] underline-offset-2 hover:underline"
          >
            Adicionar mais itens
          </button>
        </Bloco>

        {modalidades.length ? (
          <Bloco
            id="pedido-receber"
            destaque={destaque === "pedido-receber"}
            icone={<MapPin className="size-4" aria-hidden />}
            titulo="Como receber"
          >
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Como receber">
              {modalidades.map((m) => (
                <Escolha2
                  key={m}
                  ativo={modalidade === m}
                  onClick={() => mudarDados({ modalidade: m })}
                  icone={
                    m === "delivery" ? (
                      <Bike className="size-5" aria-hidden />
                    ) : (
                      <Store className="size-5" aria-hidden />
                    )
                  }
                  titulo={m === "delivery" ? "Entrega" : "Retirada"}
                  detalhe={
                    m === "retirada"
                      ? "Sem taxa"
                      : unidade.taxa_por_area
                        ? "Taxa conforme o endereço"
                        : unidade.taxa_entrega !== null
                          ? reais(unidade.taxa_entrega)
                          : "Taxa a confirmar"
                  }
                />
              ))}
            </div>
            {modalidade === "delivery" ? (
              <div className="mt-3">
                {usarDaConversa ? (
                  <p className="flex items-start gap-2 rounded-xl bg-purple-50 p-3 text-sm text-ink-700">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--cd-marca)]" aria-hidden />
                    <span className="min-w-0 flex-1">
                      Vamos usar o endereço que você informou na conversa.{" "}
                      <button
                        type="button"
                        className="font-medium text-[var(--cd-marca)] underline underline-offset-2"
                        onClick={() => mudarDados({ usarDaConversa: false })}
                      >
                        Informar outro
                      </button>
                    </span>
                  </p>
                ) : (
                  <>
                    <EnderecoEntrega
                      valor={dados.endereco}
                      mudar={mudarEndereco}
                      buscarCep={buscarCep}
                    />
                    {porArea && cotada?.motivo === "fora_area" ? (
                      <div
                        role="alert"
                        className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-900"
                      >
                        <p className="font-medium">Não entregamos neste endereço.</p>
                        {unidade.aceita_retirada ? (
                          <button
                            type="button"
                            className="mt-1 underline underline-offset-2"
                            onClick={() => mudarDados({ modalidade: "retirada" })}
                          >
                            Retirar na loja
                          </button>
                        ) : (
                          <p>Confira o CEP e o bairro.</p>
                        )}
                      </div>
                    ) : null}
                    {porArea && cotada?.pedir === "confirmar_bairro" ? (
                      <label className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={bairroConfirmado}
                          onChange={(e) => setConfirmou(e.target.checked ? chaveArea : null)}
                        />
                        Não encontramos este bairro na nossa lista. Está certo? A loja confirma a
                        taxa com você.
                      </label>
                    ) : null}
                    {porArea && bairroConfirmado && cotada?.origem === "a_confirmar" ? (
                      <label className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked
                          onChange={() => setConfirmou(null)}
                        />
                        Bairro confirmado. A loja confirma a taxa com você.
                      </label>
                    ) : null}
                    {temEnderecoNaConversa && !unidade.taxa_por_area ? (
                      <button
                        type="button"
                        className="mt-2 text-sm text-[var(--cd-marca)] underline underline-offset-2"
                        onClick={() => mudarDados({ usarDaConversa: true })}
                      >
                        Usar o endereço da conversa
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ) : modalidade === "retirada" && unidade.endereco ? (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-purple-50 p-3 text-sm text-ink-700">
                <Store className="mt-0.5 size-4 shrink-0 text-[var(--cd-marca)]" aria-hidden />
                Retire em {unidade.endereco}
              </p>
            ) : null}
          </Bloco>
        ) : null}

        <Bloco
          id="pedido-pagamento"
          destaque={destaque === "pedido-pagamento"}
          icone={<Wallet className="size-4" aria-hidden />}
          titulo="Pagamento"
        >
          {unidade.formas.length ? (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pagamento">
              {unidade.formas.map((f) => (
                <Escolha2
                  key={f.codigo}
                  ativo={forma === f.codigo}
                  onClick={() =>
                    mudarDados({
                      forma: f.codigo,
                      ...(f.aceita_troco ? {} : { precisaTroco: false }),
                    })
                  }
                  icone={iconeDaForma(f.codigo)}
                  titulo={f.rotulo}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-500">
              Esta unidade ainda não cadastrou formas de pagamento. Fale com o atendente.
            </p>
          )}
          {formaAtual?.aceita_troco ? (
            <div className="mt-3 space-y-2">
              <label className="flex min-h-9 items-center gap-2 text-base">
                <input
                  type="checkbox"
                  className="size-5 accent-purple-800"
                  checked={precisaTroco}
                  onChange={(e) => mudarDados({ precisaTroco: e.target.checked })}
                />
                Preciso de troco
              </label>
              {precisaTroco ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink-700">
                    Troco para quanto?
                  </span>
                  <input
                    inputMode="decimal"
                    value={troco}
                    onChange={(e) => mudarDados({ troco: e.target.value })}
                    placeholder="Ex.: 100"
                    className="h-12 w-40 rounded-xl border border-base-200 bg-base-50 px-3 text-base outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </Bloco>

        {r.alcoolico ? (
          <label
            id="pedido-maioridade"
            className={`flex scroll-mt-3 items-start gap-2 rounded-2xl bg-card p-4 text-base shadow-[0_1px_3px_rgba(26,21,32,0.07)] ${
              destaque === "pedido-maioridade" ? "ring-2 ring-[var(--cd-marca)]" : ""
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-purple-800"
              checked={maioridade}
              onChange={(e) => mudarDados({ maioridade: e.target.checked })}
            />
            Confirmo que tenho 18 anos ou mais.
          </label>
        ) : null}

        <Bloco
          icone={<MessageSquareText className="size-4" aria-hidden />}
          titulo="Observação do pedido"
        >
          <textarea
            value={observacao}
            maxLength={500}
            rows={2}
            aria-label="Observação do pedido"
            placeholder="Opcional"
            onChange={(e) => mudarDados({ observacao: e.target.value })}
            className="w-full resize-none rounded-xl border border-base-200 bg-base-50 p-3 text-base outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
        </Bloco>
      </div>

      <div className="space-y-2 border-t border-base-200 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(26,21,32,0.06)]">
        <dl className="space-y-0.5 text-sm text-ink-700">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{reais(r.subtotal)}</dd>
          </div>
          {modalidade === "delivery" ? (
            <div className="flex justify-between">
              <dt>Entrega</dt>
              <dd className="tabular-nums">
                {porArea && cotada?.motivo === "fora_area"
                  ? "Fora da área"
                  : porArea && !cotada
                    ? "Conforme o endereço"
                    : taxa === 0 && unidade.frete_gratis_acima !== null
                      ? "Grátis"
                      : taxa !== null
                        ? reais(taxa)
                        : "A confirmar"}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between pt-0.5 text-lg font-semibold text-ink-900">
            <dt>Total</dt>
            <dd className="tabular-nums">{reais(r.total)}</dd>
          </div>
        </dl>
        {erro ? (
          <p role="alert" className="text-center text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <button
          type="button"
          disabled={enviando || previa || fechada}
          onClick={() => (pendencia ? levarAoQueFalta() : void mandar())}
          className={`flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold transition-transform active:scale-[0.98] disabled:bg-base-200 disabled:font-medium disabled:text-ink-700 ${
            pendencia
              ? "bg-base-200 font-medium text-ink-700"
              : loja
                ? "bg-[#25d366] text-[#0b3d20]"
                : "bg-purple-800 text-[var(--cd-sobre)] active:bg-purple-900"
          }`}
        >
          {enviando ? (
            <Loader2 className="size-5 animate-spin" aria-label="Enviando" />
          ) : previa ? (
            "Prévia: envio desligado"
          ) : fechada ? (
            "Unidade fechada agora"
          ) : pendencia ? (
            pendencia
          ) : loja ? (
            <>
              <MessageCircle className="size-5" aria-hidden />
              Finalizar no WhatsApp · {reais(r.total)}
            </>
          ) : (
            `Enviar pedido · ${reais(r.total)}`
          )}
        </button>
        {previa ? (
          <p className="text-center text-xs text-ink-500">
            Para fazer um pedido de verdade, use o Link da loja, no painel.
          </p>
        ) : null}
      </div>
    </>
  );
}
