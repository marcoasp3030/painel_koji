/**
 * CARD-LINK / CARD-LINK2: envio do link do cardápio na conversa.
 * on = cardápio do sistema · proprio = link informado · off = não envia.
 */

export const CAMPO_ENVIAR_LINK_CARDAPIO = "enviar_link_cardapio" as const;
export const CAMPO_LINK_CARDAPIO_PROPRIO = "link_cardapio_proprio" as const;
/** Campo da unidade (PATCH). */
export const CAMPO_LINK_CARDAPIO_UNIDADE = "link_cardapio" as const;

export type ModoEnviarLinkCardapio = "on" | "off" | "proprio";

export const MODOS_ENVIAR_LINK_CARDAPIO: ModoEnviarLinkCardapio[] = ["on", "proprio", "off"];

export const ROTULO_ENVIAR_LINK_CARDAPIO = "Link do cardápio na conversa";

export const ROTULO_MODO_LINK_CARDAPIO: Record<ModoEnviarLinkCardapio, string> = {
  on: "Cardápio do sistema",
  proprio: "Link próprio",
  off: "Não enviar link",
};

export const ROTULO_LINK_CARDAPIO_PROPRIO = "Link do cardápio";

export const AJUDA_ENVIAR_LINK_CARDAPIO =
  "Cada unidade pode ter o próprio link (em Unidades). Sem nenhum link, o agente usa o cardápio do sistema.";

export const AJUDA_LINK_CARDAPIO_PROPRIO =
  "Link público https:// (até 500 caracteres). O da unidade, se houver, vale sobre este.";

export const ERRO_LINK_CARDAPIO =
  "Informe um link público começando com https://";

/** Gestor e plataforma veem e alteram; supervisor e funcionário não. */
export function podeVerEnviarLinkCardapio(papel: string | null | undefined): boolean {
  return papel === "plataforma" || papel === "gestor";
}

export function modoEnviarLinkCardapio(
  valor: string | null | undefined,
): ModoEnviarLinkCardapio {
  if (valor === "off" || valor === "proprio") return valor;
  return "on";
}

/** @deprecated CARD-LINK1: true se não for off. */
export function enviarLinkLigado(valor: string | null | undefined): boolean {
  return modoEnviarLinkCardapio(valor) !== "off";
}

/** @deprecated CARD-LINK1. */
export function valorEnviarLink(ligado: boolean): "on" | "off" {
  return ligado ? "on" : "off";
}

export function rotuloModoLinkCardapio(valor: string | null | undefined): string {
  return ROTULO_MODO_LINK_CARDAPIO[modoEnviarLinkCardapio(valor)];
}

/**
 * Validação leve no painel (o gateway confere de verdade).
 * Vazio/null = ok (opcional). Senão precisa começar com https:// e ter até 500 chars.
 */
export function linkCardapioValido(valor: string | null | undefined): boolean {
  if (valor == null) return true;
  const v = valor.trim();
  if (v === "") return true;
  if (v.length > 500) return false;
  if (!v.startsWith("https://")) return false;
  if (/\s/.test(v)) return false;
  return true;
}

export function mensagemErroLinkCardapio(valor: string | null | undefined): string | null {
  if (valor == null || valor.trim() === "") return null;
  return linkCardapioValido(valor) ? null : ERRO_LINK_CARDAPIO;
}

/** Para PATCH/rascunho: string vazia vira null (limpar). */
export function normalizarLinkCardapio(
  valor: string | null | undefined,
): string | null {
  if (valor == null) return null;
  const v = valor.trim();
  return v === "" ? null : v;
}
