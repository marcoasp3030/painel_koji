/** CANAL-EXC: regras da exclusão de canal na tela Canais (só plataforma). */

export type PapelCanal = "plataforma" | "gestor" | "supervisor" | "funcionario";

export type ResultadoExcluirCanal = {
  ok: true;
  conversas_apagadas: number;
  conversas_com_pedido: number;
  pedidos_mantidos: number;
  mensagens_apagadas?: number;
  contatos_apagados?: number;
  canal?: "apagado" | "marcado";
};

/** Só a plataforma vê a ação; o gateway também recusa os demais. */
export function podeExibirExcluirCanal(papel: PapelCanal | null | undefined) {
  return papel === "plataforma";
}

/** Canal ativo: botão desabilitado (desative antes). */
export function excluirCanalDesabilitado(ativo: boolean) {
  return ativo;
}

export const DICA_CANAL_ATIVO = "Desative o canal antes de excluir";

/** O botão Excluir do modal só libera com o nome igual (trim). */
export function confirmacaoExcluirCanalConfere(digitado: string, nome: string) {
  return digitado.trim() === nome.trim() && nome.trim().length > 0;
}

/** Toast de sucesso: X = apagadas + com pedido; Y = pedidos mantidos. */
export function toastExcluirCanal(r: ResultadoExcluirCanal) {
  const conversas = r.conversas_apagadas + r.conversas_com_pedido;
  return `Canal excluído: ${conversas} conversas apagadas, ${r.pedidos_mantidos} pedidos mantidos`;
}

export const TEXTO_CONFIRMACAO_EXCLUIR_CANAL =
  "Apaga todo o histórico das conversas deste canal (mensagens, atendimentos, notas e documentos) e os contatos que só existem nele. Os pedidos continuam, sem dados pessoais. Não dá para desfazer.";
