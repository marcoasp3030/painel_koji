/** CARD-LINK: ligar/desligar o envio do link do cardápio digital na conversa. */

export const CAMPO_ENVIAR_LINK_CARDAPIO = "enviar_link_cardapio" as const;

export const ROTULO_ENVIAR_LINK_CARDAPIO = "Enviar o link do cardápio digital na conversa";

export const AJUDA_ENVIAR_LINK_CARDAPIO =
  "Ligado: o agente manda o link do cardápio quando o cliente pede. Desligado: o agente apresenta as opções na própria conversa. O Link da loja continua funcionando.";

/** Gestor e plataforma veem e alteram; supervisor e funcionário não. */
export function podeVerEnviarLinkCardapio(papel: string | null | undefined): boolean {
  return papel === "plataforma" || papel === "gestor";
}

/** Nulo herda o padrão on. */
export function enviarLinkLigado(valor: string | null | undefined): boolean {
  return valor !== "off";
}

export function valorEnviarLink(ligado: boolean): "on" | "off" {
  return ligado ? "on" : "off";
}
