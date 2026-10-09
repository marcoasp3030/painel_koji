/**
 * Agentes de teste (nome começando com "[teste]") ficam escondidos de quem é
 * da empresa: some das listas e o acesso direto responde "não encontrado".
 * O admin da plataforma vê tudo. Nada é apagado nem pausado.
 */
import type { MetodoGateway } from "./cliente.server";
import { GatewayErro } from "./erros";
import type { PapelGateway } from "./tipos";

export const PREFIXO_TESTE = "[teste]";

export function ehAgenteDeTeste(nome: string | null | undefined) {
  return (nome ?? "").trim().toLowerCase().startsWith(PREFIXO_TESTE);
}

type Escopo = {
  papel: PapelGateway;
  chamar<T = unknown>(metodo: MetodoGateway, partes?: string[], opcoes?: object): Promise<{ dados: T }>;
};

const naoEncontrado = () => new GatewayErro({ codigo: "NOT_FOUND", status: 404 });

export function filtrarAgentes<T extends { nome: string }>(papel: PapelGateway, agentes: T[]) {
  return papel === "plataforma" ? agentes : agentes.filter((a) => !ehAgenteDeTeste(a.nome));
}

export function filtrarCanais<T extends { agente_id: string | null }>(
  papel: PapelGateway,
  canais: T[],
  ocultos: Set<string>,
) {
  return papel === "plataforma"
    ? canais
    : canais.filter((c) => !c.agente_id || !ocultos.has(c.agente_id));
}

/** IDs dos agentes de teste da empresa (vazio para a plataforma). */
export async function agentesOcultos(t: Escopo): Promise<Set<string>> {
  if (t.papel === "plataforma") return new Set();
  const { dados } = await t.chamar<{ itens: { id: string; nome: string }[] }>("GET", ["agentes"], {
    query: { limite: 99 },
  });
  return new Set(dados.itens.filter((a) => ehAgenteDeTeste(a.nome)).map((a) => a.id));
}

/** Para quem é da empresa, agente de teste "não existe". */
export async function exigirAgenteVisivel(t: Escopo, agenteId: string) {
  if (t.papel === "plataforma") return;
  const { dados } = await t.chamar<{ nome: string }>("GET", ["agentes", agenteId]);
  if (ehAgenteDeTeste(dados.nome)) throw naoEncontrado();
}

/** Conversa "<tenant>:<canal>:<contato>" de canal ligado a agente de teste também some. */
export async function exigirConversaVisivel(t: Escopo, conversa: string) {
  if (t.papel === "plataforma") return;
  const canal = conversa.split(":")[1];
  if (!canal) return;
  const { dados } = await t.chamar<{ agente_id: string | null }>("GET", ["canais", canal]).catch(
    () => ({ dados: { agente_id: null } }),
  );
  if (dados.agente_id && (await agentesOcultos(t)).has(dados.agente_id)) throw naoEncontrado();
}
