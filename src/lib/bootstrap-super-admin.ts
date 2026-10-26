/** Variável de uso único. O valor não fica no código e não é reaplicado se a conta já existe. */
export const VARIAVEL_SENHA_BOOTSTRAP = "BOOTSTRAP_SUPER_ADMIN_SENHA";

export type DecisaoBootstrap =
  | { acao: "recusar"; motivo: "conta-ja-existe" | "senha-ausente" }
  | { acao: "criar" };

/**
 * A criação só acontece quando a conta ainda não existe e a variável foi informada.
 * Se a conta existe, a variável é ignorada.
 */
export function decidirBootstrap(opcoes: {
  contaExiste: boolean;
  senhaDefinida: boolean;
}): DecisaoBootstrap {
  if (opcoes.contaExiste) return { acao: "recusar", motivo: "conta-ja-existe" };
  if (!opcoes.senhaDefinida) return { acao: "recusar", motivo: "senha-ausente" };
  return { acao: "criar" };
}
