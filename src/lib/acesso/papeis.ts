/**
 * Papéis do painel (USUARIOS1). O navegador não escolhe o papel:
 * o servidor lê o cadastro e estes nomes vão no X-Role.
 */
export const PAPEIS = ["plataforma", "gestor", "supervisor", "funcionario"] as const;
export type PapelAcesso = (typeof PAPEIS)[number];

const NIVEL: Record<PapelAcesso, number> = {
  plataforma: 40,
  gestor: 30,
  supervisor: 20,
  funcionario: 10,
};

export const ROTULO_PAPEL: Record<PapelAcesso, string> = {
  plataforma: "Plataforma",
  gestor: "Gestor",
  supervisor: "Supervisor",
  funcionario: "Funcionário",
};

export function papelAcesso(valor: string | null | undefined): PapelAcesso | null {
  return (PAPEIS as readonly string[]).includes(valor ?? "") ? (valor as PapelAcesso) : null;
}

export function peloMenos(papel: PapelAcesso | null | undefined, minimo: PapelAcesso) {
  if (!papel) return false;
  return NIVEL[papel] >= NIVEL[minimo];
}

/** Papéis de sistema que esta pessoa pode conceder. Personalizado só o gestor (e a plataforma). */
export function papeisConcediveis(papel: PapelAcesso): PapelAcesso[] {
  if (papel === "plataforma") return ["plataforma", "gestor", "supervisor", "funcionario"];
  if (papel === "gestor") return ["gestor", "supervisor", "funcionario"];
  if (papel === "supervisor") return ["funcionario"];
  return [];
}

export function podeConceder(ator: PapelAcesso, alvo: PapelAcesso) {
  return papeisConcediveis(ator).includes(alvo) && NIVEL[alvo] <= NIVEL[ator];
}

/** Carga inicial. Plataforma tem todas. Um papel personalizado usa a tabela, não esta lista. */
const DO_FUNCIONARIO = [
  "pedidos.operar",
  "cardapio.esgotar",
  "conversas.operar",
  "historico.ver",
] as const;

const DO_SUPERVISOR = [
  ...DO_FUNCIONARIO,
  "pedidos.cancelar_confirmado",
  "cardapio.disponibilidade",
  "conversas.encerrar",
  "unidade.operar",
  "agente.ver",
  "simular",
  "avisos",
  "usuarios.funcionario",
  "followup.cancelar",
  "telefone.completo",
] as const;

const DO_GESTOR = [
  ...DO_SUPERVISOR,
  "cardapio.editar",
  "relatorios.exportar",
  "usuarios.gerir",
  "agente.editar",
  "integracoes.gerir",
  "documentos",
  "canais.editar",
  "followup.reativar",
] as const;

const LISTA: Record<Exclude<PapelAcesso, "plataforma">, readonly string[]> = {
  funcionario: DO_FUNCIONARIO,
  supervisor: DO_SUPERVISOR,
  gestor: DO_GESTOR,
};

export function temPermissao(papel: PapelAcesso | null | undefined, codigo: string) {
  if (papel === "plataforma") return true;
  if (!papel) return false;
  return LISTA[papel].includes(codigo);
}

/**
 * X-Unidades montado no servidor.
 * Plataforma e gestor: "*". Supervisor e funcionário: códigos ordenados, sem espaço.
 * "*" ou lista vazia para esses dois não é cabeçalho válido.
 */
export function cabecalhoUnidades(
  papel: PapelAcesso,
  unidades: "*" | readonly string[],
): string | null {
  if (papel === "plataforma" || papel === "gestor") return "*";
  if (unidades === "*") return null;
  const codigos = [
    ...new Set(
      unidades.map((u) => u.trim()).filter((u) => /^[a-z0-9_]{1,40}$/.test(u)),
    ),
  ].sort();
  if (codigos.length === 0) return null;
  return codigos.join(",");
}

/** Funcionário vê só os 4 últimos dígitos. Número já curto permanece. */
export function telefoneParaPapel(
  papel: PapelAcesso | null | undefined,
  telefone: string | null | undefined,
) {
  if (telefone == null || telefone === "") return telefone ?? null;
  if (papel !== "funcionario") return telefone;
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 5) return telefone;
  return `····${digitos.slice(-4)}`;
}

/** Busca do funcionário: nome ou no máximo os 4 últimos dígitos. */
export function buscaRestrita(papel: PapelAcesso | null | undefined, busca: string | undefined) {
  if (papel !== "funcionario" || !busca) return false;
  return busca.replace(/\D/g, "").length >= 5;
}

/** O apelido cv_<hash> é um id de conversa opaco, igual a qualquer outro id. */
export function idConversa(valor: string) {
  const limpo = valor.trim();
  if (limpo.startsWith("cv_")) return /^cv_[a-z0-9]{8,64}$/.test(limpo) ? limpo : null;
  if (limpo.length >= 3 && limpo.length <= 300 && !/[\r\n]/.test(limpo)) return limpo;
  return null;
}
