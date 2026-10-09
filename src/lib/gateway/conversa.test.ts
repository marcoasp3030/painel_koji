// Executar: bun test src/lib/gateway
import { describe, expect, test } from "bun:test";
import { temposDeResposta } from "./conversa";
import type { MensagemGateway } from "./tipos";

const m = (id: number, direcao: "entrada" | "saida", seg: number | null): MensagemGateway => ({
  id,
  conteudo: "x",
  direcao,
  origem: direcao === "entrada" ? "cliente" : "bot",
  enviada_em: seg === null ? null : new Date(Date.UTC(2026, 9, 9, 12, 0, seg)).toISOString(),
});

describe("tempo de resposta por balão", () => {
  test("conta da última mensagem do cliente até a resposta seguinte", () => {
    const t = temposDeResposta([
      m(1, "entrada", 0),
      m(2, "entrada", 3),
      m(3, "saida", 8),
      m(4, "saida", 9),
    ]);
    expect(t.get(3)).toBe(5);
    expect(t.has(4)).toBe(false); // segunda resposta seguida não tem tempo próprio
    expect(t.has(1)).toBe(false);
  });

  test("sem horário não inventa tempo", () => {
    const t = temposDeResposta([m(1, "entrada", null), m(2, "saida", 8)]);
    expect(t.size).toBe(0);
  });
});
