// Executar: bun test src/lib/gateway
import { describe, expect, test } from "bun:test";
import { GatewayErro } from "./erros";
import {
  agentesOcultos,
  ehAgenteDeTeste,
  exigirAgenteVisivel,
  exigirConversaVisivel,
  filtrarAgentes,
  filtrarCanais,
} from "./ocultos";
import type { PapelGateway } from "./tipos";

const AGENTES = [
  { id: "ag_bench", nome: "[teste] Bench segundo agente" },
  { id: "bykoji_atendimento", nome: "Atendimento By Koji" },
];
const CANAIS = [
  { id: "can_bench", agente_id: "ag_bench" },
  { id: "can_real", agente_id: "bykoji_atendimento" },
];

function escopo(papel: PapelGateway) {
  const chamadas: string[] = [];
  return {
    chamadas,
    papel,
    async chamar<T>(_metodo: string, partes: string[] = []) {
      chamadas.push(partes.join("/"));
      if (partes.length === 1 && partes[0] === "agentes") return { dados: { itens: AGENTES } as T };
      if (partes[0] === "agentes") return { dados: AGENTES.find((a) => a.id === partes[1]) as T };
      return { dados: CANAIS.find((c) => c.id === partes[1]) as T };
    },
  };
}

const naoEncontrado = (p: Promise<unknown>) =>
  p.then(
    () => false,
    (e) => e instanceof GatewayErro && e.codigo === "NOT_FOUND",
  );

describe("agentes de teste escondidos da empresa", () => {
  test("prefixo [teste], com ou sem espaços e maiúsculas", () => {
    expect(ehAgenteDeTeste("[teste] Bench")).toBe(true);
    expect(ehAgenteDeTeste("  [TESTE]Bench")).toBe(true);
    expect(ehAgenteDeTeste("Atendimento [teste]")).toBe(false);
    expect(ehAgenteDeTeste(null)).toBe(false);
  });

  test("listas: empresa não vê agente de teste nem o canal dele; plataforma vê tudo", async () => {
    for (const papel of ["gestor", "funcionario"] as const) {
      expect(filtrarAgentes(papel, AGENTES).map((a) => a.id)).toEqual(["bykoji_atendimento"]);
      const ocultos = await agentesOcultos(escopo(papel));
      expect(filtrarCanais(papel, CANAIS, ocultos).map((c) => c.id)).toEqual(["can_real"]);
    }
    expect(filtrarAgentes("plataforma", AGENTES)).toHaveLength(2);
    expect(filtrarCanais("plataforma", CANAIS, new Set(["ag_bench"]))).toHaveLength(2);
  });

  test("acesso direto ao agente de teste responde não encontrado para a empresa", async () => {
    for (const papel of ["gestor", "funcionario"] as const) {
      expect(await naoEncontrado(exigirAgenteVisivel(escopo(papel), "ag_bench"))).toBe(true);
      expect(await naoEncontrado(exigirAgenteVisivel(escopo(papel), "bykoji_atendimento"))).toBe(false);
    }
    const p = escopo("plataforma");
    expect(await naoEncontrado(exigirAgenteVisivel(p, "ag_bench"))).toBe(false);
    expect(p.chamadas).toHaveLength(0);
  });

  test("histórico de conversa de canal de agente de teste também some", async () => {
    expect(await naoEncontrado(exigirConversaVisivel(escopo("gestor"), "bykoji:can_bench:marco"))).toBe(true);
    expect(await naoEncontrado(exigirConversaVisivel(escopo("gestor"), "bykoji:can_real:marco"))).toBe(false);
    expect(await naoEncontrado(exigirConversaVisivel(escopo("plataforma"), "bykoji:can_bench:marco"))).toBe(false);
  });
});
