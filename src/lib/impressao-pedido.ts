/**
 * Cupom de cozinha do pedido: HTML próprio para impressora térmica (80 ou 58 mm), impresso pelo navegador.
 * As preferências ficam no aparelho: cada computador decide se imprime e em que papel.
 */
import {
  ROTULO_ORIGEM_PEDIDO,
  nomeClientePedido,
  reais,
  textoPagamento,
  whatsappPedido,
  type OrigemPedido,
  type PedidoDetalhe,
} from "@/lib/gateway/pedidos";

export type LarguraPapel = 58 | 80;
export type QuandoImprimir = "chegar" | "confirmar";
export type PrefImpressao = {
  automatica: boolean;
  quando: QuandoImprimir;
  largura: LarguraPapel;
  vias: 1 | 2;
};
export const PREF_IMPRESSAO_PADRAO: PrefImpressao = {
  automatica: false,
  quando: "chegar",
  largura: 80,
  vias: 1,
};
/** Status que disparam a impressão automática em cada modo. */
export const STATUS_DA_IMPRESSAO: Record<QuandoImprimir, ("aguardando_loja" | "confirmado")[]> = {
  chegar: ["aguardando_loja"],
  confirmar: ["confirmado"],
};
export const EVENTO_IMPRESSAO = "luxtia:pedidos-impressao";
const MAX_LEMBRADOS = 300;

const chavePref = (empresa: string) => `luxtia:pedidos-impressao:${empresa}`;
const chaveImpressos = (empresa: string, quando: QuandoImprimir) =>
  `luxtia:pedidos-impressos:${empresa}:${quando}`;

export function lerPrefImpressao(empresa: string): PrefImpressao {
  try {
    const bruto = JSON.parse(
      localStorage.getItem(chavePref(empresa)) ?? "null",
    ) as Partial<PrefImpressao> | null;
    if (!bruto) return PREF_IMPRESSAO_PADRAO;
    return {
      automatica: bruto.automatica === true,
      quando: bruto.quando === "confirmar" ? "confirmar" : "chegar",
      largura: bruto.largura === 58 ? 58 : 80,
      vias: bruto.vias === 2 ? 2 : 1,
    };
  } catch {
    return PREF_IMPRESSAO_PADRAO;
  }
}

export function gravarPrefImpressao(empresa: string, pref: PrefImpressao) {
  try {
    localStorage.setItem(chavePref(empresa), JSON.stringify(pref));
  } catch {
    /* Sem armazenamento, vale enquanto a aba estiver aberta. */
  }
  window.dispatchEvent(new Event(EVENTO_IMPRESSAO));
}

/** Números já impressos neste aparelho: recarregar a página não imprime de novo. */
export function lerImpressos(empresa: string, quando: QuandoImprimir): string[] | null {
  try {
    const bruto = localStorage.getItem(chaveImpressos(empresa, quando));
    return bruto ? (JSON.parse(bruto) as string[]) : null;
  } catch {
    return null;
  }
}

export function gravarImpressos(empresa: string, quando: QuandoImprimir, numeros: string[]) {
  try {
    localStorage.setItem(
      chaveImpressos(empresa, quando),
      JSON.stringify(numeros.slice(-MAX_LEMBRADOS)),
    );
  } catch {
    /* Sem armazenamento, a lista vale enquanto a aba estiver aberta. */
  }
}

/** Pedidos da lista que ainda não foram impressos, do mais antigo para o mais novo. */
export function paraImprimir(lista: { numero: string }[], impressos: readonly string[]) {
  const vistos = new Set(impressos);
  return lista
    .map((p) => p.numero)
    .filter((n) => !vistos.has(n))
    .reverse();
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

function quando(iso: string | null | undefined, fuso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: fuso,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Opcao = { grupo?: string | null; opcao?: string | null; quantidade?: number | null };

/** Uma linha por escolha: "Tamanho: Grande", "2× Cream cheese". */
export function linhasDasOpcoes(opcoes: readonly Opcao[] | null | undefined) {
  return (opcoes ?? [])
    .filter((o) => o.opcao)
    .map((o) => {
      const qtd = o.quantidade && o.quantidade > 1 ? `${o.quantidade}× ` : "";
      return o.grupo ? `${o.grupo}: ${qtd}${o.opcao}` : `${qtd}${o.opcao}`;
    });
}

export function htmlDoCupom(
  p: PedidoDetalhe,
  o: { largura: LarguraPapel; empresa?: string | null; fuso: string; via?: string | null },
) {
  const estreito = o.largura === 58;
  const entrega = p.modalidade === "delivery";
  const endereco = p.entrega?.endereco || p.endereco;
  const observacao = p.entrega?.observacao || p.observacao;
  const agendado = p.entrega?.horario || p.horario;
  const cliente = nomeClientePedido(p.cliente);
  // Sem nome, o nome já é o telefone: não repete.
  const fone = entrega && cliente.temNome ? whatsappPedido(p.cliente?.telefone) : null;
  const origem =
    p.origem && p.origem !== "real" ? ROTULO_ORIGEM_PEDIDO[p.origem as OrigemPedido] : null;
  const taxa = !entrega
    ? null
    : p.frete_gratis
      ? "Grátis"
      : p.taxa_origem === "a_confirmar"
        ? "A confirmar"
        : p.taxa_entrega !== null && p.taxa_entrega !== undefined
          ? reais(p.taxa_entrega)
          : null;
  const itens = (p.itens ?? [])
    .map((i) => {
      const opcoes = linhasDasOpcoes((i as { opcoes?: Opcao[] }).opcoes)
        .map((l) => `<div class="op">+ ${esc(l)}</div>`)
        .join("");
      const obs = i.observacao ? `<div class="obs">Obs: ${esc(i.observacao)}</div>` : "";
      return `<div class="item"><div class="linha"><span class="qtd">${esc(i.quantidade)}×</span><span class="nome">${esc(i.nome)}</span><span class="valor">${esc(reais(i.subtotal))}</span></div>${opcoes}${obs}</div>`;
    })
    .join("");
  const linha = (rotulo: string, valor: string | null, forte = false) =>
    valor
      ? `<div class="linha${forte ? " forte" : ""}"><span>${esc(rotulo)}</span><span>${esc(valor)}</span></div>`
      : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido ${esc(p.numero)}</title><style>
@page{size:${o.largura}mm auto;margin:0}
*{box-sizing:border-box}
body{margin:0;padding:${estreito ? "2mm" : "3mm 4mm"};width:${o.largura}mm;font-family:Arial,Helvetica,sans-serif;font-size:${estreito ? 11 : 13}px;line-height:1.3;color:#000;background:#fff}
.centro{text-align:center}.mini{font-size:0.85em}
h1{margin:2px 0;font-size:${estreito ? 26 : 34}px;letter-spacing:1px;text-align:center}
.faixa{margin:4px 0;padding:3px;text-align:center;font-weight:700;font-size:1.25em;border:2px solid #000}
.faixa.cheia{background:#000;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
hr{border:0;border-top:1px dashed #000;margin:6px 0}
.linha{display:flex;gap:4px;justify-content:space-between}.linha>span:first-child{flex:none}
.item{margin:4px 0}.qtd{font-weight:700;min-width:2.2em}.nome{flex:1;font-weight:700;font-size:1.1em}.valor{flex:none}
.op{padding-left:2.2em}.obs{padding-left:2.2em;font-weight:700;text-transform:uppercase}
.forte{font-weight:700;font-size:1.15em}.bloco{margin:3px 0}.aviso{font-weight:700;text-align:center;border:1px dashed #000;padding:2px}
</style></head><body>
${o.empresa ? `<div class="centro forte">${esc(o.empresa)}</div>` : ""}
${p.unidade_nome || p.unidade ? `<div class="centro">${esc(p.unidade_nome || p.unidade)}</div>` : ""}
${o.via ? `<div class="centro mini">${esc(o.via)}</div>` : ""}
<h1>#${esc(p.numero)}</h1>
<div class="faixa cheia">${entrega ? "ENTREGA" : p.modalidade === "retirada" ? "RETIRADA" : "PEDIDO"}</div>
<div class="centro">${esc(quando(p.criado_em, o.fuso))}</div>
${agendado ? `<div class="faixa">AGENDADO: ${esc(quando(agendado, o.fuso) || agendado)}</div>` : ""}
${origem ? `<div class="aviso">${esc(origem.toUpperCase())}</div>` : ""}
<hr>
<div class="bloco"><b>${esc(cliente.nome)}</b>${fone ? ` · ${esc(fone)}` : ""}</div>
${entrega && endereco ? `<div class="bloco">${esc(endereco)}</div>` : ""}
<hr>
${itens}
${observacao ? `<hr><div class="obs" style="padding:0">Obs do pedido: ${esc(observacao)}</div>` : ""}
<hr>
${linha("Subtotal", p.subtotal !== null && p.subtotal !== undefined ? reais(p.subtotal) : null)}
${linha("Entrega", taxa)}
${linha("Total", reais(p.total), true)}
${linha("Pagamento", textoPagamento(p.pagamento) === "—" ? null : textoPagamento(p.pagamento))}
<hr><div class="centro mini">Impresso em ${esc(quando(new Date().toISOString(), o.fuso))}</div>
</body></html>`;
}

/** Imprime por um quadro escondido: não abre janela nem tira a tela do lugar. */
export function imprimirHtml(html: string) {
  return new Promise<void>((resolve) => {
    const quadro = document.createElement("iframe");
    quadro.setAttribute("aria-hidden", "true");
    quadro.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    // O foco volta para onde estava: sem isso, o Esc e os atalhos ficam presos no quadro.
    const antes = document.activeElement as HTMLElement | null;
    let feito = false;
    const terminar = () => {
      if (feito) return;
      feito = true;
      window.focus();
      antes?.focus?.();
      window.setTimeout(() => quadro.remove(), 1000);
      resolve();
    };
    quadro.onload = () => {
      const janela = quadro.contentWindow;
      if (!janela) return terminar();
      janela.addEventListener("afterprint", terminar, { once: true });
      janela.focus();
      janela.print();
      // No Chrome, print() só volta quando a janela de impressão fecha (ou na hora, sem janela).
      window.focus();
      antes?.focus?.();
      // Navegadores que não avisam o fim da impressão.
      window.setTimeout(terminar, 60_000);
    };
    quadro.srcdoc = html;
    document.body.appendChild(quadro);
  });
}

export async function imprimirPedido(
  p: PedidoDetalhe,
  pref: Pick<PrefImpressao, "largura" | "vias">,
  o: { empresa?: string | null; fuso: string },
) {
  for (let via = 1; via <= pref.vias; via++) {
    await imprimirHtml(
      htmlDoCupom(p, {
        ...o,
        largura: pref.largura,
        via: pref.vias > 1 ? `Via ${via} de ${pref.vias}` : null,
      }),
    );
  }
}

/** Volta a lista ao começo: a próxima leitura marca o que já existe como impresso, sem imprimir atrasados. */
export function reiniciarImpressos(empresa: string, quando: QuandoImprimir) {
  try {
    localStorage.removeItem(chaveImpressos(empresa, quando));
  } catch {
    /* Nada guardado para apagar. */
  }
}
