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
  chamar<T = unknown>(
    metodo: MetodoGateway,
    partes?: string[],
    opcoes?: object,
  ): Promise<{ dados: T }>;
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
  const ocultos = new Set<string>();
  let cursor: string | null = null;
  for (let pagina = 0; pagina < 100; pagina++) {
    const {
      dados,
    }: { dados: { itens: { id: string; nome: string }[]; proximo_cursor?: string | null } } =
      await t.chamar("GET", ["agentes"], {
        query: { limite: 99, cursor },
      });
    for (const a of dados.itens) if (ehAgenteDeTeste(a.nome)) ocultos.add(a.id);
    if (!dados.proximo_cursor) return ocultos;
    if (dados.proximo_cursor === cursor) throw naoEncontrado();
    cursor = dados.proximo_cursor;
  }
  throw naoEncontrado();
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
  const { dados } = await t.chamar<{ agente_id: string | null }>("GET", ["canais", canal]);
  if (dados.agente_id && (await agentesOcultos(t)).has(dados.agente_id)) throw naoEncontrado();
}
