/** Utilitários das telas de conversa (Simular e Conversas ao vivo). */
import type { MensagemGateway } from "./tipos";

export /** Segundos entre a última mensagem do cliente e cada resposta. */
function temposDeResposta(mensagens: MensagemGateway[]) {
  const tempos = new Map<number, number>();
  let ultimaDoCliente: number | null = null;
  for (const m of mensagens) {
    const quando = m.enviada_em ? Date.parse(m.enviada_em) : NaN;
    if (m.direcao === "entrada") ultimaDoCliente = Number.isNaN(quando) ? null : quando;
    else if (ultimaDoCliente !== null && !Number.isNaN(quando)) {
      tempos.set(m.id, Math.max(0, (quando - ultimaDoCliente) / 1000));
      ultimaDoCliente = null;
    }
  }
  return tempos;
}
