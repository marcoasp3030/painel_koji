/** Segunda etapa. Plataforma tem 7 dias. A conta de emergência não tem prazo. */

export const EMAIL_CONTA_EMERGENCIA = "admin@luxtia.local";
export const PRAZO_SEGUNDA_ETAPA_MS = 7 * 24 * 60 * 60 * 1000;

export function contaEmergencia(email: string | null | undefined, marcada: boolean) {
  return marcada || email?.trim().toLowerCase() === EMAIL_CONTA_EMERGENCIA;
}

export type DecisaoSegundaEtapa = {
  obrigatorio: boolean;
  bloqueado: boolean;
  prazo_ate: string | null;
  /** Prazo a gravar no primeiro login de uma plataforma que não é emergência. */
  gravarPrazo: string | null;
};

export function decidirSegundaEtapa(entrada: {
  plataforma: boolean;
  emergencia: boolean;
  fatores: number;
  prazoAte: string | null;
  agora: Date;
}): DecisaoSegundaEtapa {
  if (!entrada.plataforma && !entrada.emergencia) {
    return { obrigatorio: false, bloqueado: false, prazo_ate: null, gravarPrazo: null };
  }
  if (entrada.emergencia) {
    return {
      obrigatorio: true,
      bloqueado: entrada.fatores === 0,
      prazo_ate: null,
      gravarPrazo: null,
    };
  }
  if (entrada.fatores > 0) {
    return { obrigatorio: true, bloqueado: false, prazo_ate: null, gravarPrazo: null };
  }
  if (!entrada.prazoAte) {
    const prazo = new Date(entrada.agora.getTime() + PRAZO_SEGUNDA_ETAPA_MS).toISOString();
    return { obrigatorio: true, bloqueado: false, prazo_ate: prazo, gravarPrazo: prazo };
  }
  const bloqueado = new Date(entrada.prazoAte).getTime() <= entrada.agora.getTime();
  return { obrigatorio: true, bloqueado, prazo_ate: entrada.prazoAte, gravarPrazo: null };
}
